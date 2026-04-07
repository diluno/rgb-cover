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

const EFFECTS = ['plasma', 'kaleidoscope', 'interference', 'spiral', 'fireflies', 'dissolve', 'ripple'];

// Firefly state
const NUM_FIREFLIES = 12;
const fireflies = [];
for (let i = 0; i < NUM_FIREFLIES; i++) {
  fireflies.push({
    x: Math.random() * MATRIX_SIZE,
    y: Math.random() * MATRIX_SIZE,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    phase: Math.random() * Math.PI * 2,
    speed: 0.03 + Math.random() * 0.04,
    radius: 4 + Math.random() * 3,
    colorIdx: Math.random(),
  });
}

// Dissolve effect state
let coverPixels = null;
let dissolveParticles = null;
const DISSOLVE_CYCLE = 300; // frames per full cycle (form -> dissolve -> form)

let interval = null;
let visible = false;
let paletteName = 'aurora';
let effectName = 'plasma';
let fps = 10;
let time = 0;
let onStateChange = null;
let overlayCallback = null;

export function setCoverPixels(pixels) {
  coverPixels = pixels;
  dissolveParticles = null; // reset on new cover
}

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

function renderFireflies(buf, palette) {
  // Fade the buffer (trail effect)
  for (let i = 0; i < buf.length; i++) {
    buf[i] = Math.floor(buf[i] * 0.85);
  }

  // Update and draw each firefly
  for (const f of fireflies) {
    // Drift with gentle noise-based steering
    const steer = noise1(f.x * 0.05 + time * 0.01, f.y * 0.05) * 0.08;
    f.vx += Math.cos(steer) * 0.02;
    f.vy += Math.sin(steer) * 0.02;

    // Dampen velocity
    f.vx *= 0.98;
    f.vy *= 0.98;

    f.x += f.vx;
    f.y += f.vy;

    // Wrap around edges
    if (f.x < 0) f.x += MATRIX_SIZE;
    if (f.x >= MATRIX_SIZE) f.x -= MATRIX_SIZE;
    if (f.y < 0) f.y += MATRIX_SIZE;
    if (f.y >= MATRIX_SIZE) f.y -= MATRIX_SIZE;

    // Pulsing glow
    f.phase += f.speed;
    const pulse = (Math.sin(f.phase) + 1) * 0.5;
    const glow = pulse * pulse; // sharper pulse

    // Color from palette
    f.colorIdx += 0.001;
    const color = samplePalette(f.colorIdx, palette);

    // Draw soft glow around firefly position
    const r = Math.ceil(f.radius * (0.5 + glow * 0.5));
    const cx = Math.round(f.x);
    const cy = Math.round(f.y);

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        let px = cx + dx;
        let py = cy + dy;
        // Wrap
        if (px < 0) px += MATRIX_SIZE;
        if (px >= MATRIX_SIZE) px -= MATRIX_SIZE;
        if (py < 0) py += MATRIX_SIZE;
        if (py >= MATRIX_SIZE) py -= MATRIX_SIZE;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > r) continue;

        const falloff = 1 - dist / r;
        const brightness = falloff * falloff * glow;

        const di = (py * MATRIX_SIZE + px) * 3;
        buf[di] = Math.min(255, buf[di] + Math.round(color.r * brightness));
        buf[di + 1] = Math.min(255, buf[di + 1] + Math.round(color.g * brightness));
        buf[di + 2] = Math.min(255, buf[di + 2] + Math.round(color.b * brightness));
      }
    }
  }
}

function initDissolveParticles() {
  if (!coverPixels) return;
  dissolveParticles = [];
  for (let y = 0; y < MATRIX_SIZE; y++) {
    for (let x = 0; x < MATRIX_SIZE; x++) {
      const i = (y * MATRIX_SIZE + x) * 4;
      const r = coverPixels.data[i];
      const g = coverPixels.data[i + 1];
      const b = coverPixels.data[i + 2];
      // Skip very dark pixels
      if (r + g + b < 15) continue;
      dissolveParticles.push({
        homeX: x, homeY: y,
        x, y,
        r, g, b,
        // Random drift direction
        driftX: (Math.random() - 0.5) * 2,
        driftY: (Math.random() - 0.5) * 2 - 0.5, // slight upward bias
        delay: Math.random(), // stagger the dissolve
      });
    }
  }
}

function renderDissolve(buf) {
  if (!coverPixels) {
    // No cover available, fall back to plasma
    renderPlasma(buf, PALETTES[paletteName] || PALETTES.aurora);
    return;
  }

  if (!dissolveParticles) initDissolveParticles();
  if (!dissolveParticles) return;

  // Clear buffer
  buf.fill(0);

  // Cycle: 0-0.3 formed, 0.3-0.5 dissolving, 0.5-0.8 drifting, 0.8-1.0 reforming
  const cycle = (time % DISSOLVE_CYCLE) / DISSOLVE_CYCLE;

  let phase; // 0 = formed, 1 = fully dissolved
  if (cycle < 0.3) {
    phase = 0;
  } else if (cycle < 0.5) {
    phase = (cycle - 0.3) / 0.2; // 0 -> 1
  } else if (cycle < 0.8) {
    phase = 1;
  } else {
    phase = 1 - (cycle - 0.8) / 0.2; // 1 -> 0
  }

  // Smooth easing
  phase = phase * phase * (3 - 2 * phase);

  for (const p of dissolveParticles) {
    // Stagger: particles with higher delay dissolve later
    let particlePhase = Math.max(0, Math.min(1, (phase - p.delay * 0.5) / 0.5));
    particlePhase = particlePhase * particlePhase * (3 - 2 * particlePhase);

    // Interpolate between home position and drifted position
    const driftScale = 15;
    const px = p.homeX + p.driftX * driftScale * particlePhase;
    const py = p.homeY + p.driftY * driftScale * particlePhase;

    // Round to pixel
    const rx = Math.round(px);
    const ry = Math.round(py);

    if (rx < 0 || rx >= MATRIX_SIZE || ry < 0 || ry >= MATRIX_SIZE) continue;

    // Fade slightly when dissolved
    const alpha = 1 - particlePhase * 0.3;

    const di = (ry * MATRIX_SIZE + rx) * 3;
    buf[di] = Math.min(255, buf[di] + Math.round(p.r * alpha));
    buf[di + 1] = Math.min(255, buf[di + 1] + Math.round(p.g * alpha));
    buf[di + 2] = Math.min(255, buf[di + 2] + Math.round(p.b * alpha));
  }
}

function renderRipple(buf) {
  if (!coverPixels) {
    renderPlasma(buf, PALETTES[paletteName] || PALETTES.aurora);
    return;
  }

  const t = time * 0.04;
  const data = coverPixels.data;

  for (let y = 0; y < MATRIX_SIZE; y++) {
    for (let x = 0; x < MATRIX_SIZE; x++) {
      // Layer 1: broad slow wave
      const dx1 = Math.sin(y * 0.12 + t * 0.7) * 2.5 +
                   Math.sin(y * 0.05 + x * 0.03 + t * 0.4) * 1.5;
      const dy1 = Math.cos(x * 0.10 + t * 0.6) * 2.0 +
                   Math.cos(x * 0.04 + y * 0.03 + t * 0.5) * 1.2;

      // Layer 2: fine noise ripple
      const n = noise1(x * 0.08 + t * 0.3, y * 0.08 + t * 0.2);
      const dx2 = n * 1.0;
      const dy2 = noise2(x * 0.08 - t * 0.25, y * 0.08 + t * 0.35) * 1.0;

      // Sample source with distortion
      let sx = x + dx1 + dx2;
      let sy = y + dy1 + dy2;

      // Clamp to edges
      sx = Math.max(0, Math.min(MATRIX_SIZE - 1.001, sx));
      sy = Math.max(0, Math.min(MATRIX_SIZE - 1.001, sy));

      // Bilinear interpolation for smooth result
      const ix = Math.floor(sx);
      const iy = Math.floor(sy);
      const fx = sx - ix;
      const fy = sy - iy;
      const ix1 = Math.min(ix + 1, MATRIX_SIZE - 1);
      const iy1 = Math.min(iy + 1, MATRIX_SIZE - 1);

      const i00 = (iy * MATRIX_SIZE + ix) * 4;
      const i10 = (iy * MATRIX_SIZE + ix1) * 4;
      const i01 = (iy1 * MATRIX_SIZE + ix) * 4;
      const i11 = (iy1 * MATRIX_SIZE + ix1) * 4;

      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const di = (y * MATRIX_SIZE + x) * 3;
      buf[di] = Math.round(
        data[i00] * w00 + data[i10] * w10 + data[i01] * w01 + data[i11] * w11
      );
      buf[di + 1] = Math.round(
        data[i00 + 1] * w00 + data[i10 + 1] * w10 + data[i01 + 1] * w01 + data[i11 + 1] * w11
      );
      buf[di + 2] = Math.round(
        data[i00 + 2] * w00 + data[i10 + 2] * w10 + data[i01 + 2] * w01 + data[i11 + 2] * w11
      );
    }
  }
}

const effectRenderers = {
  plasma: renderPlasma,
  kaleidoscope: renderKaleidoscope,
  interference: renderInterference,
  spiral: renderSpiral,
  fireflies: renderFireflies,
  dissolve: renderDissolve,
  ripple: renderRipple,
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
