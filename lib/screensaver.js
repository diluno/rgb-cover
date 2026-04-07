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

// Precomputed lookup tables for geometric effects
const half = MATRIX_SIZE / 2;
const distMap = new Float32Array(MATRIX_SIZE * MATRIX_SIZE);
const angleMap = new Float32Array(MATRIX_SIZE * MATRIX_SIZE);
for (let y = 0; y < MATRIX_SIZE; y++) {
  for (let x = 0; x < MATRIX_SIZE; x++) {
    const dx = x - half + 0.5;
    const dy = y - half + 0.5;
    const i = y * MATRIX_SIZE + x;
    distMap[i] = Math.sqrt(dx * dx + dy * dy);
    angleMap[i] = Math.atan2(dy, dx);
  }
}

const EFFECTS = ['plasma', 'kaleidoscope', 'interference', 'spiral'];

let interval = null;
let visible = false;
let paletteName = 'aurora';
let effectName = 'plasma';
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

export function setScreensaverEffect(name) {
  if (EFFECTS.includes(name)) effectName = name;
}

export function getEffectNames() {
  return EFFECTS;
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

// ==================== EFFECTS ====================

function renderPlasma(buf, palette) {
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
}

function renderKaleidoscope(buf, palette) {
  const t = time * 0.015;
  const segments = 6;
  const segAngle = (Math.PI * 2) / segments;

  for (let i = 0; i < MATRIX_SIZE * MATRIX_SIZE; i++) {
    const dist = distMap[i];
    let angle = angleMap[i];

    // Fold angle into a single segment and mirror
    angle = ((angle % segAngle) + segAngle) % segAngle;
    if (angle > segAngle / 2) angle = segAngle - angle;

    // Map folded coordinates to noise space
    const nx = Math.cos(angle) * dist * 0.08;
    const ny = Math.sin(angle) * dist * 0.08;

    const n1 = (noise1(nx + t, ny + t * 0.6) + 1) * 0.5;
    const n2 = (noise2(nx * 1.5 - t * 0.4, ny * 1.5 + t * 0.3) + 1) * 0.25 + 0.5;

    const color = samplePalette(n1, palette);
    const di = i * 3;
    buf[di] = Math.round(color.r * n2);
    buf[di + 1] = Math.round(color.g * n2);
    buf[di + 2] = Math.round(color.b * n2);
  }
}

function renderInterference(buf, palette) {
  const t = time * 0.03;

  // Three ring sources that drift slowly
  const cx1 = half + Math.sin(t * 0.7) * 12;
  const cy1 = half + Math.cos(t * 0.5) * 12;
  const cx2 = half + Math.sin(t * 0.5 + 2) * 15;
  const cy2 = half + Math.cos(t * 0.8 + 1) * 15;
  const cx3 = half + Math.sin(t * 0.3 + 4) * 10;
  const cy3 = half + Math.cos(t * 0.6 + 3) * 10;

  for (let i = 0; i < MATRIX_SIZE * MATRIX_SIZE; i++) {
    const x = i % MATRIX_SIZE;
    const y = (i - x) / MATRIX_SIZE;

    const d1 = Math.sqrt((x - cx1) ** 2 + (y - cy1) ** 2);
    const d2 = Math.sqrt((x - cx2) ** 2 + (y - cy2) ** 2);
    const d3 = Math.sqrt((x - cx3) ** 2 + (y - cy3) ** 2);

    // Overlapping sine waves create moiré
    const wave = (Math.sin(d1 * 0.4 - t * 2) +
                  Math.sin(d2 * 0.5 - t * 1.7) +
                  Math.sin(d3 * 0.3 - t * 2.3)) / 3;

    const hue = (wave + 1) * 0.5;
    const brightness = (Math.sin(d1 * 0.2 + d2 * 0.15) + 1) * 0.25 + 0.5;

    const color = samplePalette(hue, palette);
    const di = i * 3;
    buf[di] = Math.round(color.r * brightness);
    buf[di + 1] = Math.round(color.g * brightness);
    buf[di + 2] = Math.round(color.b * brightness);
  }
}

function renderSpiral(buf, palette) {
  const t = time * 0.02;
  const arms = 4;

  for (let i = 0; i < MATRIX_SIZE * MATRIX_SIZE; i++) {
    const dist = distMap[i];
    const angle = angleMap[i];

    // Spiral arms: angle offset by distance creates spiral, time rotates it
    const spiral = ((angle * arms + dist * 0.3 - t * 3) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const armBrightness = (Math.cos(spiral) + 1) * 0.5;

    // Color varies with distance and time
    const hue = (dist * 0.02 + t * 0.3) % 1;

    // Add noise for organic feel
    const n = (noise1(dist * 0.05 + t * 0.5, angle * 2) + 1) * 0.15 + 0.7;

    const color = samplePalette(hue, palette);
    const brightness = armBrightness * n;
    const di = i * 3;
    buf[di] = Math.round(color.r * brightness);
    buf[di + 1] = Math.round(color.g * brightness);
    buf[di + 2] = Math.round(color.b * brightness);
  }
}

const effectRenderers = {
  plasma: renderPlasma,
  kaleidoscope: renderKaleidoscope,
  interference: renderInterference,
  spiral: renderSpiral,
};

function renderFrame() {
  const matrix = getMatrix();
  if (!matrix || !visible) return;

  const palette = PALETTES[paletteName] || PALETTES.aurora;
  const buf = getRgbBuffer();

  time++;
  const renderer = effectRenderers[effectName] || renderPlasma;
  renderer(buf, palette);

  drawBuffer(buf);
  overlayCallback?.();
  sync();
}

export function startScreensaver() {
  if (interval) return;
  visible = true;
  onStateChange?.();
  console.log(`Screensaver started (${effectName}, ${paletteName}, ${fps} FPS)`);
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
