import { getMatrix, MATRIX_SIZE, clear, sync, getRgbBuffer, drawBuffer } from './matrix.js';
import { createNoise2D } from './simplex-noise.js';

const PALETTES = {
  aurora: [
    { r: 20, g: 0, b: 80 },
    { r: 0, g: 180, b: 180 },
    { r: 0, g: 200, b: 80 },
    { r: 120, g: 0, b: 200 },
  ],
  ember: [
    { r: 0, g: 0, b: 0 },
    { r: 150, g: 20, b: 0 },
    { r: 255, g: 120, b: 0 },
    { r: 255, g: 200, b: 50 },
  ],
  ocean: [
    { r: 0, g: 10, b: 40 },
    { r: 0, g: 60, b: 180 },
    { r: 0, g: 200, b: 220 },
    { r: 200, g: 220, b: 255 },
  ],
  sunset: [
    { r: 60, g: 0, b: 120 },
    { r: 200, g: 0, b: 100 },
    { r: 255, g: 120, b: 0 },
    { r: 255, g: 200, b: 80 },
  ],
  forest: [
    { r: 0, g: 10, b: 0 },
    { r: 0, g: 80, b: 20 },
    { r: 0, g: 180, b: 80 },
    { r: 120, g: 220, b: 60 },
  ],
};

const noise1 = createNoise2D(1);
const noise2 = createNoise2D(2);
const noise3 = createNoise2D(3);

const LAYER_BROAD = { scale: 0.05, speed: 0.008 };
const LAYER_MED   = { scale: 0.10, speed: 0.015 };
const LAYER_FINE  = { scale: 0.15, speed: 0.025 };

let interval = null;
let visible = false;
let paletteName = 'aurora';
let fps = 10;
let time = 0;
let onStateChange = null;
let overlayCallback = null;

export function setOnStateChange(callback) {
  onStateChange = callback;
}

export function setOverlayCallback(callback) {
  overlayCallback = callback;
}

export function setScreensaverPalette(name) {
  if (PALETTES[name]) paletteName = name;
}

export function setScreensaverFps(newFps) {
  fps = Math.max(5, Math.min(30, newFps));
  if (interval) {
    clearInterval(interval);
    interval = setInterval(renderFrame, 1000 / fps);
  }
}

export function isScreensaverVisible() {
  return visible;
}

export function getPaletteNames() {
  return Object.keys(PALETTES);
}

function samplePalette(t, palette) {
  t = ((t % 1) + 1) % 1;
  const len = palette.length;
  const scaled = t * len;
  const i = Math.floor(scaled);
  const frac = scaled - i;
  const c0 = palette[i % len];
  const c1 = palette[(i + 1) % len];
  return {
    r: Math.round(c0.r + (c1.r - c0.r) * frac),
    g: Math.round(c0.g + (c1.g - c0.g) * frac),
    b: Math.round(c0.b + (c1.b - c0.b) * frac),
  };
}

function renderFrame() {
  const matrix = getMatrix();
  if (!matrix || !visible) return;

  const palette = PALETTES[paletteName] || PALETTES.aurora;
  const buf = getRgbBuffer();

  time++;
  const t1 = time * LAYER_BROAD.speed;
  const t2 = time * LAYER_MED.speed;
  const t3 = time * LAYER_FINE.speed;

  for (let i = 0; i < MATRIX_SIZE * MATRIX_SIZE; i++) {
    const x = i % MATRIX_SIZE;
    const y = (i - x) / MATRIX_SIZE;

    const n1 = (noise1(x * LAYER_BROAD.scale + t1, y * LAYER_BROAD.scale + t1 * 0.7) + 1) * 0.5;
    const n2 = (noise2(x * LAYER_MED.scale + t2, y * LAYER_MED.scale - t2 * 0.5) + 1) * 0.25 + 0.5;
    const n3 = (noise3(x * LAYER_FINE.scale - t3, y * LAYER_FINE.scale + t3 * 0.8) + 1) * 0.075 + 0.85;

    const color = samplePalette(n1, palette);
    const brightness = n2 * n3;
    const di = i * 3;
    buf[di] = Math.round(color.r * brightness);
    buf[di + 1] = Math.round(color.g * brightness);
    buf[di + 2] = Math.round(color.b * brightness);
  }

  drawBuffer(buf);
  overlayCallback?.();
  sync();
}

export function startScreensaver() {
  if (interval) return;
  visible = true;
  onStateChange?.();
  console.log(`Screensaver started (${paletteName}, ${fps} FPS)`);
  renderFrame();
  interval = setInterval(renderFrame, 1000 / fps);
}

export function stopScreensaver() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  visible = false;
  onStateChange?.();
}
