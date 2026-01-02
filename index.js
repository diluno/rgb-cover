import HomeAssistant from './helpers/homeassistant.js';
import ws from 'ws';
import { subscribeEntities } from 'home-assistant-js-websocket';
import { ColorDieb } from './lib/ColorDieb.js';
import { hex2rgb } from './lib/hex2rgb.js';
import { shuffleArray } from './lib/shuffleArray.js';
import sharp from 'sharp';
import { LedMatrix, GpioMapping } from 'rpi-led-matrix';
import { startServer, updateState, setCallbacks } from './server.js';
import config from './config.js';

global.WebSocket = ws;
const homeassistant = new HomeAssistant();

const coverBase = config.hassioUrl;
const mediaEntities = config.entities;
const MATRIX_SIZE = 64;

let currentCover = '';
let currentEntity = null;
let currentPixels = null;
let debounceTimer = null;
let isTransitioning = false;
let lastEntities = null;

// Dynamic settings (can be changed via web UI)
let settings = {
  brightness: config.brightness || 85,
  transition: config.transition || 'crossfade',
  transitionDuration: config.transitionDuration || 500,
};

// Matrix configuration
const matrixOptions = {
  ...LedMatrix.defaultMatrixOptions(),
  rows: MATRIX_SIZE,
  cols: MATRIX_SIZE,
  hardwareMapping: GpioMapping.AdafruitHatPwm,
  brightness: settings.brightness,
  pwmLsbNanoseconds: 130,
  pwmDitherBits: 0,
};

const runtimeOptions = {
  ...LedMatrix.defaultRuntimeOptions(),
  gpioSlowdown: 4,
};

// Initialize the matrix
let matrix;
try {
  matrix = new LedMatrix(matrixOptions, runtimeOptions);
  console.log('LED Matrix initialized');
} catch (err) {
  console.error('Failed to initialize LED matrix:', err.message);
  console.log('Running in preview mode (no matrix connected)');
  matrix = null;
}

// Transition types
const TransitionType = {
  CROSSFADE: 'crossfade',
  SLIDE_LEFT: 'slideLeft',
  SLIDE_RIGHT: 'slideRight',
  SLIDE_UP: 'slideUp',
  SLIDE_DOWN: 'slideDown',
  DISSOLVE: 'dissolve',
};

const TRANSITION_FPS = 30;

// Debounce wrapper
function debounce(fn, delay) {
  return (...args) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), delay);
  };
}

// Graceful shutdown
function cleanup() {
  console.log('\nShutting down...');
  clearTimeout(debounceTimer);
  if (matrix) {
    matrix.clear().sync();
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Update web UI state
function syncWebState() {
  updateState({
    currentCover,
    currentEntity,
    isPlaying: !!currentCover,
    brightness: settings.brightness,
    transition: settings.transition,
    transitionDuration: settings.transitionDuration,
    wledUrls: config.wledUrls,
    entities: mediaEntities,
  });
}

// Turn off matrix and WLED
function turnOff() {
  setTimeout(async () => {
    if (matrix) {
      await fadeOut(currentPixels, 300);
      matrix.clear().sync();
    }
    currentPixels = null;
    currentEntity = null;
    syncWebState();
    config.wledUrls.forEach((url) => {
      fetch(`${url}/win&T=0`).catch(() => {});
    });
  }, 1000);
}

// Get pixel data from sharp image buffer
async function getPixelsFromBuffer(buffer) {
  const { data, info } = await sharp(buffer)
    .resize(MATRIX_SIZE, MATRIX_SIZE, { fit: 'contain', background: '#000' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: new Uint8Array(data),
    width: info.width,
    height: info.height,
  };
}

// Lerp helper for smooth interpolation
function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// Crossfade transition
async function crossfade(fromPixels, toPixels, duration) {
  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;

  for (let frame = 0; frame <= frames; frame++) {
    const t = frame / frames;
    
    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const i = (y * MATRIX_SIZE + x) * 4;
        
        const fromR = fromPixels ? fromPixels.data[i] : 0;
        const fromG = fromPixels ? fromPixels.data[i + 1] : 0;
        const fromB = fromPixels ? fromPixels.data[i + 2] : 0;
        
        const toR = toPixels.data[i];
        const toG = toPixels.data[i + 1];
        const toB = toPixels.data[i + 2];
        
        const r = lerp(fromR, toR, t);
        const g = lerp(fromG, toG, t);
        const b = lerp(fromB, toB, t);
        
        matrix.fgColor({ r, g, b }).setPixel(x, y);
      }
    }
    matrix.sync();
    await sleep(frameDelay);
  }
}

// Slide transition
async function slide(fromPixels, toPixels, duration, direction) {
  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;

  for (let frame = 0; frame <= frames; frame++) {
    const progress = frame / frames;
    const offset = Math.round(progress * MATRIX_SIZE);

    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        let srcX, srcY, useNew;

        switch (direction) {
          case 'left':
            srcX = x + offset;
            srcY = y;
            useNew = srcX >= MATRIX_SIZE;
            if (useNew) srcX -= MATRIX_SIZE;
            break;
          case 'right':
            srcX = x - offset;
            srcY = y;
            useNew = srcX < 0;
            if (useNew) srcX += MATRIX_SIZE;
            break;
          case 'up':
            srcX = x;
            srcY = y + offset;
            useNew = srcY >= MATRIX_SIZE;
            if (useNew) srcY -= MATRIX_SIZE;
            break;
          case 'down':
            srcX = x;
            srcY = y - offset;
            useNew = srcY < 0;
            if (useNew) srcY += MATRIX_SIZE;
            break;
        }

        const pixels = useNew ? toPixels : (fromPixels || toPixels);
        const i = (srcY * MATRIX_SIZE + srcX) * 4;
        const r = pixels.data[i] || 0;
        const g = pixels.data[i + 1] || 0;
        const b = pixels.data[i + 2] || 0;

        matrix.fgColor({ r, g, b }).setPixel(x, y);
      }
    }
    matrix.sync();
    await sleep(frameDelay);
  }
}

// Dissolve transition (random pixel reveal)
async function dissolve(fromPixels, toPixels, duration) {
  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const totalPixels = MATRIX_SIZE * MATRIX_SIZE;
  
  // Create shuffled pixel indices
  const indices = Array.from({ length: totalPixels }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const revealed = new Set();

  for (let frame = 0; frame <= frames; frame++) {
    const pixelsToReveal = Math.floor((frame / frames) * totalPixels);
    
    while (revealed.size < pixelsToReveal && revealed.size < totalPixels) {
      revealed.add(indices[revealed.size]);
    }

    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const pixelIndex = y * MATRIX_SIZE + x;
        const i = pixelIndex * 4;
        
        const useNew = revealed.has(pixelIndex);
        const pixels = useNew ? toPixels : (fromPixels || toPixels);
        
        const r = pixels.data[i] || 0;
        const g = pixels.data[i + 1] || 0;
        const b = pixels.data[i + 2] || 0;

        matrix.fgColor({ r, g, b }).setPixel(x, y);
      }
    }
    matrix.sync();
    await sleep(frameDelay);
  }
}

// Fade out transition
async function fadeOut(fromPixels, duration) {
  if (!matrix || !fromPixels) return;
  
  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;

  for (let frame = frames; frame >= 0; frame--) {
    const t = frame / frames;
    
    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const i = (y * MATRIX_SIZE + x) * 4;
        const r = Math.round(fromPixels.data[i] * t);
        const g = Math.round(fromPixels.data[i + 1] * t);
        const b = Math.round(fromPixels.data[i + 2] * t);
        matrix.fgColor({ r, g, b }).setPixel(x, y);
      }
    }
    matrix.sync();
    await sleep(frameDelay);
  }
}

// Perform transition between two images
async function transition(fromPixels, toPixels, type, duration) {
  if (!matrix) return;
  
  isTransitioning = true;
  
  try {
    switch (type) {
      case TransitionType.CROSSFADE:
        await crossfade(fromPixels, toPixels, duration);
        break;
      case TransitionType.SLIDE_LEFT:
        await slide(fromPixels, toPixels, duration, 'left');
        break;
      case TransitionType.SLIDE_RIGHT:
        await slide(fromPixels, toPixels, duration, 'right');
        break;
      case TransitionType.SLIDE_UP:
        await slide(fromPixels, toPixels, duration, 'up');
        break;
      case TransitionType.SLIDE_DOWN:
        await slide(fromPixels, toPixels, duration, 'down');
        break;
      case TransitionType.DISSOLVE:
        await dissolve(fromPixels, toPixels, duration);
        break;
      default:
        await crossfade(fromPixels, toPixels, duration);
    }
  } finally {
    isTransitioning = false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkCover(_entities) {
  // Store entities for refresh
  lastEntities = _entities;
  
  // Skip if currently transitioning
  if (isTransitioning) return;

  let url = null;
  let activeEntity = null;

  // Priority: first playing entity wins
  for (const slug of mediaEntities) {
    const entity = _entities[slug];
    if (!entity) continue;
    if (entity.state === 'playing' && entity.attributes.entity_picture) {
      url = coverBase + entity.attributes.entity_picture;
      activeEntity = slug;
      break;
    }
  }

  if (!url) {
    if (currentCover) {
      currentCover = null;
      currentEntity = null;
      syncWebState();
      turnOff();
    }
    return;
  }

  if (url === currentCover) return;
  currentCover = url;
  currentEntity = activeEntity;
  syncWebState();

  try {
    // Fetch image
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Get pixel data for matrix
    const newPixels = await getPixelsFromBuffer(imageBuffer);

    // Perform transition
    if (matrix) {
      await transition(currentPixels, newPixels, settings.transition, settings.transitionDuration);
    }
    
    // Store current pixels for next transition
    currentPixels = newPixels;

    // Extract colors for WLED
    if (config.wledUrls && config.wledUrls.length > 0) {
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

      const colors = await ColorDieb(imageData, MATRIX_SIZE, config.wledColors);
      const colorsRGB = shuffleArray(colors.map((c) => hex2rgb(c)));
      const col1 = colorsRGB[0];
      const col2 = colorsRGB[1];

      config.wledUrls.forEach((wledUrl) => {
        fetch(
          `${wledUrl}/win&T=1&R=${col1.r}&G=${col1.g}&B=${col1.b}&R2=${col2.r}&G2=${col2.g}&B2=${col2.b}`
        ).catch(() => {});
      });
    }

  } catch (err) {
    console.error(`Error processing cover: ${err.message}`);
  }
}

// Web UI callbacks
setCallbacks({
  onBrightnessChange: (brightness) => {
    settings.brightness = brightness;
    if (matrix) {
      matrix.brightness(brightness);
      // Redraw current image with new brightness
      if (currentPixels) {
        for (let y = 0; y < MATRIX_SIZE; y++) {
          for (let x = 0; x < MATRIX_SIZE; x++) {
            const i = (y * MATRIX_SIZE + x) * 4;
            const r = currentPixels.data[i];
            const g = currentPixels.data[i + 1];
            const b = currentPixels.data[i + 2];
            matrix.fgColor({ r, g, b }).setPixel(x, y);
          }
        }
        matrix.sync();
      }
    }
    console.log(`Brightness changed to ${brightness}%`);
  },
  onTransitionChange: (type, duration) => {
    settings.transition = type;
    settings.transitionDuration = duration;
    console.log(`Transition changed to ${type} (${duration}ms)`);
  },
  onRefresh: () => {
    if (lastEntities) {
      currentCover = ''; // Force refresh
      checkCover(lastEntities);
    }
  },
});

// Initialize web state
syncWebState();

// Start web server
const webPort = config.webPort || 3000;
startServer(webPort);

// Wrap checkCover with debouncing
const debouncedCheckCover = debounce(checkCover, 500);

const conn = await homeassistant.connectSocket();
subscribeEntities(conn, (ent) => {
  debouncedCheckCover(ent);
});

console.log('RGB Cover started with transition effects!');
console.log(`Transition: ${settings.transition}, Duration: ${settings.transitionDuration}ms`);
console.log('Listening for media player updates...');
