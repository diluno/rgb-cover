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
  setOverlayCallback,
  isClockVisible 
} from './lib/clock.js';
import {
  startScreensaver,
  stopScreensaver,
  isScreensaverVisible,
  setScreensaverPalette,
  setScreensaverEffect,
  setScreensaverFps,
  setOnStateChange as setScreensaverOnStateChange,
  setOverlayCallback as setScreensaverOverlayCallback,
} from './lib/screensaver.js';
import config from './config.js';

// ==================== SETUP ====================

global.WebSocket = ws;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use /var/tmp for settings (persists across reboots, always writable)
const SETTINGS_FILE = '/var/tmp/rgb-cover-settings.json';
console.log(`Settings file: ${SETTINGS_FILE}`);

const homeassistant = new HomeAssistant();
const coverBase = config.hassioUrl;
const mediaEntities = config.entities;
const CO2_ENTITY = config.co2Entity || 'sensor.indoor_carbon_dioxide';
const CO2_THRESHOLD = config.co2Threshold || 1000; // ppm

// State
let currentCover = '';
let currentEntity = null;
let currentPixels = null;
let debounceTimer = null;
let isTransitioning = false;
let lastEntities = null;
let turnOffTimer = null;
let pendingCoverCheck = false;
let currentCo2 = null;
let co2High = false;

// ==================== SETTINGS PERSISTENCE ====================

function getDefaultSettings() {
  return {
    brightness: config.brightness || 85,
    transition: config.transition || 'crossfade',
    transitionDuration: config.transitionDuration || 500,
    idleMode: config.showClock !== false ? 'clock' : 'off',
    clockColor: config.clockColor || { r: 120, g: 80, b: 200 },
    wledColors: config.wledColors || 5,
    screensaverEffect: 'plasma',
    screensaverPalette: 'aurora',
    screensaverFps: 10,
  };
}

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const saved = JSON.parse(data);
      // Merge with defaults in case new settings were added
      const merged = { ...getDefaultSettings(), ...saved };
      // Migrate showClock -> idleMode
      if (saved.showClock !== undefined && saved.idleMode === undefined) {
        merged.idleMode = saved.showClock ? 'clock' : 'off';
      }
      delete merged.showClock;
      console.log('Loaded settings from settings.json');
      return merged;
    }
  } catch (err) {
    console.error('Failed to load settings.json:', err.message);
  }
  console.log('Using default settings from config.js');
  return getDefaultSettings();
}

function saveSettings() {
  // Use async write to avoid issues with native module interactions
  const data = JSON.stringify(settings, null, 2);
  fs.writeFile(SETTINGS_FILE, data, (err) => {
    if (err) {
      console.error(`Failed to save settings to ${SETTINGS_FILE}:`, err.message);
      // Try alternative location as last resort
      const altPath = '/tmp/rgb-cover-settings.json';
      fs.writeFile(altPath, data, (err2) => {
        if (err2) {
          console.error(`Also failed to save to ${altPath}:`, err2.message);
        } else {
          console.log(`Settings saved to ${altPath} (fallback)`);
        }
      });
    } else {
      console.log(`Settings saved to ${SETTINGS_FILE}`);
    }
  });
}

// Settings (can be changed via web UI)
let settings = loadSettings();

// Save settings on startup to create file if it doesn't exist (sync for init)
try {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  console.log(`Settings saved to ${SETTINGS_FILE}`);
} catch (err) {
  console.error(`Failed to save initial settings: ${err.message}`);
}

// Initialize matrix
initMatrix(settings.brightness);

// Initialize clock
setClockColor(settings.clockColor);
setOnStateChange(syncWebState);
setOverlayCallback(drawCo2Indicator);

// Initialize screensaver
setScreensaverEffect(settings.screensaverEffect);
setScreensaverPalette(settings.screensaverPalette);
setScreensaverFps(settings.screensaverFps);
setScreensaverOnStateChange(syncWebState);
setScreensaverOverlayCallback(drawCo2Indicator);

// ==================== HELPERS ====================

function debounce(fn, delay) {
  return (...args) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), delay);
  };
}

function stopIdleMode() {
  if (isClockVisible()) stopClock();
  if (isScreensaverVisible()) stopScreensaver();
}

function startIdleMode() {
  stopIdleMode();
  if (settings.idleMode === 'clock') {
    startClock();
  } else if (settings.idleMode === 'screensaver') {
    startScreensaver();
  }
}

// Draw red CO2 warning dot in top-right corner
function drawCo2Indicator() {
  if (!co2High) return;
  
  const matrix = getMatrix();
  if (!matrix) return;
  
  // Draw a 3x3 red dot in top-right corner (with 2px margin)
  const dotSize = 3;
  const margin = 2;
  const startX = MATRIX_SIZE - dotSize - margin;
  const startY = margin;
  
  for (let y = 0; y < dotSize; y++) {
    for (let x = 0; x < dotSize; x++) {
      matrix.fgColor({ r: 255, g: 0, b: 0 }).setPixel(startX + x, startY + y);
    }
  }
}

function checkCo2(entities) {
  const co2Entity = entities[CO2_ENTITY];
  if (!co2Entity) return;
  
  const value = parseFloat(co2Entity.state);
  if (isNaN(value)) return;
  
  const wasHigh = co2High;
  const prevCo2 = currentCo2;
  currentCo2 = value;
  co2High = value >= CO2_THRESHOLD;
  
  // Update web state if value changed
  if (prevCo2 !== currentCo2) {
    syncWebState();
  }
  
  // If CO2 status changed, redraw indicator (but not during transitions)
  if (wasHigh !== co2High) {
    console.log(`CO2: ${value} ppm - ${co2High ? 'HIGH!' : 'OK'}`);
    // Don't redraw during transitions - indicator will be drawn after
    if (isTransitioning) return;

    // Redraw current display with updated indicator
    if (isClockVisible()) {
      renderClock();
    } else if (isScreensaverVisible()) {
      // Screensaver handles its own overlay via callback
    } else if (currentPixels && getMatrix()) {
      drawCo2Indicator();
      matrixSync();
    }
  }
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
    idleMode: settings.idleMode,
    clockColor: settings.clockColor,
    clockVisible: isClockVisible(),
    screensaverEffect: settings.screensaverEffect,
    screensaverPalette: settings.screensaverPalette,
    screensaverFps: settings.screensaverFps,
    screensaverVisible: isScreensaverVisible(),
    co2: currentCo2,
    co2High,
    co2Threshold: CO2_THRESHOLD,
  });
}

// ==================== DISPLAY CONTROL ====================

function turnOff() {
  clearTimeout(turnOffTimer);
  turnOffTimer = setTimeout(async () => {
    // Abort if something started playing during the delay
    if (currentCover) return;

    if (getMatrix()) {
      await fadeOut(currentPixels, 300);
      clearMatrix();
    }
    currentPixels = null;
    currentEntity = null;
    syncWebState();

    // Start idle mode
    startIdleMode();

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

    // Build WLED JSON API payload with full palette
    const seg = {
      col: colorsRGB.slice(0, 3).map(c => [c.r, c.g, c.b]),
    };

    config.wledUrls.forEach((wledUrl) => {
      fetch(`${wledUrl}/json/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on: true, seg: [seg] }),
      }).catch(() => {});
    });
  } catch (err) {
    console.error('WLED update failed:', err.message);
  }
}

// ==================== MAIN LOGIC ====================

async function checkCover(_entities) {
  lastEntities = _entities;

  // Check CO2 level
  checkCo2(_entities);

  if (isTransitioning) {
    pendingCoverCheck = true;
    return;
  }

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

  // Stop idle mode when music starts
  if (isClockVisible() || isScreensaverVisible()) {
    stopIdleMode();
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
      // Draw CO2 indicator on top of new cover
      drawCo2Indicator();
      matrixSync();
    }

    currentPixels = newPixels;

    // Update WLED colors
    updateWLED(imageBuffer);

  } catch (err) {
    console.error(`Error processing cover: ${err.message}`);
  }

  // Process any cover change that arrived during the transition
  if (pendingCoverCheck && lastEntities) {
    pendingCoverCheck = false;
    checkCover(lastEntities);
  }
}

// ==================== WEB UI CALLBACKS ====================

setCallbacks({
  onBrightnessChange: (brightness) => {
    settings.brightness = brightness;
    setBrightness(brightness);
    saveSettings();
    
    // Don't redraw during transitions - brightness will be applied on next sync
    if (isTransitioning) {
      console.log(`Brightness changed to ${brightness}% (will apply after transition)`);
      return;
    }
    
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
      drawCo2Indicator();
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
  
  onIdleModeChange: (mode, options) => {
    settings.idleMode = mode;
    settings.clockColor = options.clockColor;
    settings.screensaverEffect = options.screensaverEffect;
    settings.screensaverPalette = options.screensaverPalette;
    settings.screensaverFps = options.screensaverFps;
    setClockColor(options.clockColor);
    setScreensaverEffect(options.screensaverEffect);
    setScreensaverPalette(options.screensaverPalette);
    setScreensaverFps(options.screensaverFps);
    saveSettings();

    // Stop whatever is running and start the new mode if idle
    if (!currentCover) {
      startIdleMode();
    } else {
      stopIdleMode();
    }
    console.log(`Idle mode: ${mode}`);
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
  stopScreensaver();
  clearMatrix();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Initialize
syncWebState();
startServer(config.webPort || 3000);

const debouncedCheckCover = debounce(checkCover, 500);

async function connectHA() {
  try {
    const conn = await homeassistant.connectSocket();
    console.log('Connected to Home Assistant');

    conn.addEventListener('disconnected', () => {
      console.warn('Home Assistant disconnected, reconnecting in 5s...');
      setTimeout(connectHA, 5000);
    });

    subscribeEntities(conn, debouncedCheckCover);
  } catch (err) {
    console.error(`Failed to connect to Home Assistant: ${err.message}`);
    console.log('Retrying in 10s...');
    setTimeout(connectHA, 10000);
  }
}

await connectHA();

// Start idle mode on startup
startIdleMode();

console.log('RGB Cover started!');
console.log(`Transition: ${settings.transition}, Duration: ${settings.transitionDuration}ms`);
console.log('Listening for media player updates...');
