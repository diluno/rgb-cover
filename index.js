import HomeAssistant from './helpers/homeassistant.js';
import ws from 'ws';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { subscribeEntities } from 'home-assistant-js-websocket';
import { startServer, updateState, setCallbacks } from './server.js';
import { ColorDieb } from './lib/ColorDieb.js';
import { hex2rgb } from './lib/hex2rgb.js';
import { shuffleArray } from './lib/shuffleArray.js';
import { 
  initMatrix, 
  getMatrix, 
  clearMatrix, 
  setBrightness, 
  getPixelsFromBuffer,
  MATRIX_SIZE,
  sync as matrixSync
} from './lib/matrix.js';
import { transition, fadeOut } from './lib/transitions.js';
import { 
  startClock, 
  stopClock, 
  renderClock, 
  setClockColor, 
  setOnStateChange,
  isClockVisible 
} from './lib/clock.js';
import config from './config.js';

// ==================== SETUP ====================

global.WebSocket = ws;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

const homeassistant = new HomeAssistant();
const coverBase = config.hassioUrl;
const mediaEntities = config.entities;

// State
let currentCover = '';
let currentEntity = null;
let currentPixels = null;
let debounceTimer = null;
let isTransitioning = false;
let lastEntities = null;

// ==================== SETTINGS PERSISTENCE ====================

function getDefaultSettings() {
  return {
    brightness: config.brightness || 85,
    transition: config.transition || 'crossfade',
    transitionDuration: config.transitionDuration || 500,
    showClock: config.showClock !== false,
    clockColor: config.clockColor || { r: 120, g: 80, b: 200 },
    wledColors: config.wledColors || 5,
  };
}

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const saved = JSON.parse(data);
      console.log('Loaded settings from settings.json');
      // Merge with defaults in case new settings were added
      return { ...getDefaultSettings(), ...saved };
    }
  } catch (err) {
    console.error('Failed to load settings.json:', err.message);
  }
  console.log('Using default settings from config.js');
  return getDefaultSettings();
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    console.log('Settings saved to settings.json');
  } catch (err) {
    console.error('Failed to save settings:', err.message);
  }
}

// Settings (can be changed via web UI)
let settings = loadSettings();

// Initialize matrix
initMatrix(settings.brightness);

// Initialize clock
setClockColor(settings.clockColor);
setOnStateChange(syncWebState);

// ==================== HELPERS ====================

function debounce(fn, delay) {
  return (...args) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), delay);
  };
}

function syncWebState() {
  updateState({
    currentCover,
    currentEntity,
    isPlaying: !!currentCover,
    brightness: settings.brightness,
    transition: settings.transition,
    transitionDuration: settings.transitionDuration,
    wledUrls: config.wledUrls,
    wledColors: settings.wledColors,
    entities: mediaEntities,
    showClock: settings.showClock,
    clockColor: settings.clockColor,
    clockVisible: isClockVisible(),
  });
}

// ==================== DISPLAY CONTROL ====================

function turnOff() {
  setTimeout(async () => {
    if (getMatrix()) {
      await fadeOut(currentPixels, 300);
      clearMatrix();
    }
    currentPixels = null;
    currentEntity = null;
    syncWebState();
    
    // Start clock when idle
    if (settings.showClock) {
      startClock();
    }
    
    // Turn off WLED
    config.wledUrls?.forEach((url) => {
      fetch(`${url}/win&T=0`).catch(() => {});
    });
  }, 1000);
}

async function updateWLED(imageBuffer) {
  if (!config.wledUrls?.length) return;

  try {
    const { data } = await sharp(imageBuffer)
      .resize(MATRIX_SIZE, MATRIX_SIZE, { fit: 'contain', background: '#000' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const imageData = {
      data: new Uint8ClampedArray(data),
      width: MATRIX_SIZE,
      height: MATRIX_SIZE,
    };

    const colors = await ColorDieb(imageData, MATRIX_SIZE, settings.wledColors);
    const colorsRGB = shuffleArray(colors.map((c) => hex2rgb(c)));
    const col1 = colorsRGB[0];
    const col2 = colorsRGB[1];

    config.wledUrls.forEach((wledUrl) => {
      fetch(
        `${wledUrl}/win&T=1&R=${col1.r}&G=${col1.g}&B=${col1.b}&R2=${col2.r}&G2=${col2.g}&B2=${col2.b}`
      ).catch(() => {});
    });
  } catch (err) {
    console.error('WLED update failed:', err.message);
  }
}

// ==================== MAIN LOGIC ====================

async function checkCover(_entities) {
  lastEntities = _entities;
  
  if (isTransitioning) return;

  let url = null;
  let activeEntity = null;

  // Find first playing entity
  for (const slug of mediaEntities) {
    const entity = _entities[slug];
    if (!entity) continue;
    if (entity.state === 'playing' && entity.attributes.entity_picture) {
      url = coverBase + entity.attributes.entity_picture;
      activeEntity = slug;
      break;
    }
  }

  // Nothing playing
  if (!url) {
    if (currentCover) {
      currentCover = null;
      currentEntity = null;
      syncWebState();
      turnOff();
    }
    return;
  }

  // Stop clock when music starts
  if (isClockVisible()) {
    stopClock();
  }

  // Same cover, skip
  if (url === currentCover) return;
  
  currentCover = url;
  currentEntity = activeEntity;
  syncWebState();

  try {
    // Fetch album art
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Get pixels and transition
    const newPixels = await getPixelsFromBuffer(imageBuffer);

    if (getMatrix()) {
      isTransitioning = true;
      try {
        await transition(currentPixels, newPixels, settings.transition, settings.transitionDuration);
      } finally {
        isTransitioning = false;
      }
    }
    
    currentPixels = newPixels;

    // Update WLED colors
    updateWLED(imageBuffer);

  } catch (err) {
    console.error(`Error processing cover: ${err.message}`);
  }
}

// ==================== WEB UI CALLBACKS ====================

setCallbacks({
  onBrightnessChange: (brightness) => {
    settings.brightness = brightness;
    setBrightness(brightness);
    saveSettings();
    
    // Redraw current content
    if (isClockVisible()) {
      renderClock();
    } else if (currentPixels && getMatrix()) {
      const matrix = getMatrix();
      for (let y = 0; y < MATRIX_SIZE; y++) {
        for (let x = 0; x < MATRIX_SIZE; x++) {
          const i = (y * MATRIX_SIZE + x) * 4;
          matrix.fgColor({
            r: currentPixels.data[i],
            g: currentPixels.data[i + 1],
            b: currentPixels.data[i + 2],
          }).setPixel(x, y);
        }
      }
      matrixSync();
    }
    console.log(`Brightness changed to ${brightness}%`);
  },
  
  onTransitionChange: (type, duration) => {
    settings.transition = type;
    settings.transitionDuration = duration;
    saveSettings();
    console.log(`Transition changed to ${type} (${duration}ms)`);
  },
  
  onClockChange: (showClock, clockColor) => {
    settings.showClock = showClock;
    settings.clockColor = clockColor;
    setClockColor(clockColor);
    saveSettings();
    
    // If clock should be shown and nothing is playing, start it
    if (showClock && !currentCover && !isClockVisible()) {
      startClock();
    }
    // If clock should be hidden, stop it
    if (!showClock && isClockVisible()) {
      stopClock();
      clearMatrix();
    }
    // If clock is visible, re-render with new color
    if (isClockVisible()) {
      renderClock();
    }
    console.log(`Clock: ${showClock ? 'on' : 'off'}, color: rgb(${clockColor.r},${clockColor.g},${clockColor.b})`);
  },
  
  onWledColorsChange: (wledColors) => {
    settings.wledColors = wledColors;
    saveSettings();
    console.log(`WLED colors changed to ${wledColors}`);
  },
  
  onRefresh: () => {
    if (lastEntities) {
      currentCover = '';
      checkCover(lastEntities);
    }
  },
});

// ==================== STARTUP ====================

function cleanup() {
  console.log('\nShutting down...');
  clearTimeout(debounceTimer);
  stopClock();
  clearMatrix();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Initialize
syncWebState();
startServer(config.webPort || 3000);

const debouncedCheckCover = debounce(checkCover, 500);

const conn = await homeassistant.connectSocket();
subscribeEntities(conn, debouncedCheckCover);

// Start clock on startup
if (settings.showClock) {
  startClock();
}

console.log('RGB Cover started!');
console.log(`Transition: ${settings.transition}, Duration: ${settings.transitionDuration}ms`);
console.log('Listening for media player updates...');
