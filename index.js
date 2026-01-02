import HomeAssistant from './helpers/homeassistant.js';
import ws from 'ws';
import fs from 'fs/promises';
import { subscribeEntities } from 'home-assistant-js-websocket';
import { ColorDieb } from './lib/ColorDieb.js';
import { getImageDataFromURL } from './lib/getImageDataFromURL.js';
import { hex2rgb } from './lib/hex2rgb.js';
import { shuffleArray } from './lib/shuffleArray.js';
import sharp from 'sharp';
import config from './config.js';

global.WebSocket = ws;
const homeassistant = new HomeAssistant();

const coverBase = config.hassioUrl;
const mediaEntities = config.entities;
const squareImagePath = 'square-cover.jpg';
let currentCover = '';
let child = null;
let debounceTimer = null;

// Debounce wrapper to prevent hammering from frequent entity updates
function debounce(fn, delay) {
  return (...args) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), delay);
  };
}

// Graceful shutdown handling
function cleanup() {
  console.log('\nShutting down...');
  if (child) {
    child.kill('SIGKILL');
    child = null;
  }
  clearTimeout(debounceTimer);
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

function turnOff() {
  setTimeout(() => {
    if (child) {
      child.kill();
      child = null;
    }
    config.wledUrls.forEach((url) => {
      fetch(`${url}/win&T=0`).catch(() => {});
    });
  }, 1000);
}

async function checkCover(_entities) {
  let url = null;

  // Priority: first playing entity wins (iterate in config order)
  for (const slug of mediaEntities) {
    const entity = _entities[slug];
    if (!entity) continue;
    if (entity.state === 'playing' && entity.attributes.entity_picture) {
      url = coverBase + entity.attributes.entity_picture;
      break; // First active player wins
    }
  }

  if (!url) {
    currentCover = null;
    turnOff();
    return;
  }

  if (url === currentCover) return;
  currentCover = url;

  try {
    // Fetch image using native fetch (handles both HTTP and HTTPS)
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Process image directly through sharp (no intermediate temp file)
    const metadata = await sharp(imageBuffer).metadata();
    
    // Calculate scaling dimensions while maintaining aspect ratio
    const size = 64;
    const scale = Math.min(size / metadata.width, size / metadata.height);
    const scaledWidth = Math.round(metadata.width * scale);
    const scaledHeight = Math.round(metadata.height * scale);
    const left = Math.round((size - scaledWidth) / 2);
    const top = Math.round((size - scaledHeight) / 2);

    // Process and save the squared image
    await sharp(imageBuffer)
      .resize(scaledWidth, scaledHeight, {
        fit: 'fill',
        kernel: config.imageSampling || 'nearest',
        fastShrinkOnLoad: false,
      })
      .extend({
        top: top,
        bottom: size - scaledHeight - top,
        left: left,
        right: size - scaledWidth - left,
        background: { r: 0, g: 0, b: 0 },
      })
      .jpeg({
        quality: 100,
        chromaSubsampling: '4:4:4',
      })
      .toFile(squareImagePath);

    // Extract colors from the SQUARED image (fixed path bug)
    const { imageData, width } = await getImageDataFromURL(squareImagePath);

    if (config.wledUrls && config.wledUrls.length > 0) {
      const colors = await ColorDieb(imageData, width, config.wledColors);
      const colorsRGB = shuffleArray(colors.map((c) => hex2rgb(c)));
      const col1 = colorsRGB[0];
      const col2 = colorsRGB[1];

      config.wledUrls.forEach((wledUrl) => {
        fetch(
          `${wledUrl}/win&T=1&R=${col1.r}&G=${col1.g}&B=${col1.b}&R2=${col2.r}&G2=${col2.g}&B2=${col2.b}`
        ).catch(() => {});
      });
    }

    // Kill existing viewer process before starting new one
    if (child) {
      child.kill('SIGKILL');
      child = null;
    }

    const { exec } = await import('child_process');
    child = exec(
      `${config.root}/rpi-rgb-led-matrix/utils/led-image-viewer --led-rows=64 --led-cols=64 --led-gpio-mapping=adafruit-hat-pwm --led-brightness=${config.brightness} --led-slowdown-gpio=4 ${config.root}/rgb-cover/${squareImagePath}`,
      { shell: '/bin/bash', detached: true }
    );

    child.on('error', (err) => {
      console.error('Failed to start subprocess:', err);
    });

    child.stderr.on('data', (data) => {
      console.error(`led-image-viewer: ${data}`);
    });

  } catch (err) {
    console.error(`Error processing cover: ${err.message}`);
    // Clean up on error
    try {
      await fs.unlink(squareImagePath);
    } catch {
      // File might not exist, ignore
    }
  }
}

// Wrap checkCover with debouncing (500ms delay)
const debouncedCheckCover = debounce(checkCover, 500);

const conn = await homeassistant.connectSocket();
subscribeEntities(conn, (ent) => {
  debouncedCheckCover(ent);
});

console.log('RGB Cover started. Listening for media player updates...');
