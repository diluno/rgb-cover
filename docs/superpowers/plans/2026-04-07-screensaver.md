# Screensaver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a simplex-noise plasma screensaver as an alternative idle screen mode, configurable via the web UI.

**Architecture:** New `lib/screensaver.js` module mirrors the `lib/clock.js` pattern. The existing `showClock` boolean setting is replaced with a three-way `idleMode` ('clock'|'screensaver'|'off'). The server and web UI are updated to handle the new mode and screensaver-specific settings (palette, FPS).

**Tech Stack:** Node.js ES modules, simplex noise (self-contained), rpi-led-matrix `drawBuffer`, vanilla HTML/JS frontend.

**Spec:** `docs/superpowers/specs/2026-04-07-screensaver-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/simplex-noise.js` | Create | Self-contained 2D simplex noise function |
| `lib/screensaver.js` | Create | Screensaver animation loop, palettes, rendering |
| `index.js` | Modify | Idle mode switching, settings migration, new callbacks |
| `server.js` | Modify | New state fields, replace `onClockChange` with `onIdleModeChange` |
| `web/index.html` | Modify | Replace Clock card with Idle Screen card, conditional controls |

---

### Task 1: Simplex noise module

**Files:**
- Create: `lib/simplex-noise.js`

- [ ] **Step 1: Create the simplex noise module**

Create `lib/simplex-noise.js` exporting a `createNoise2D()` factory that returns a `noise2D(x, y)` function. This is a standard OpenSimplex2 implementation. The factory creates a permutation table from a seed.

```js
// lib/simplex-noise.js
const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function buildPerm(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807 + 0) % 2147483647;
    const j = seed % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

export function createNoise2D(seed = 0) {
  const perm = buildPerm(seed);

  return function noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;

    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;

    const x0 = x - (i - t);
    const y0 = y - (j - t);

    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      const g = GRAD2[perm[ii + perm[jj]] & 7];
      n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      const g = GRAD2[perm[ii + i1 + perm[jj + j1]] & 7];
      n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      const g = GRAD2[perm[ii + 1 + perm[jj + 1]] & 7];
      n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
    }

    // Returns value in range [-1, 1]
    return 70 * (n0 + n1 + n2);
  };
}
```

- [ ] **Step 2: Verify the module parses**

Run: `node --check lib/simplex-noise.js`
Expected: no output, exit code 0

- [ ] **Step 3: Quick sanity check**

Run: `node -e "import { createNoise2D } from './lib/simplex-noise.js'; const n = createNoise2D(42); console.log(n(0.5, 0.5), n(1.0, 1.0), n(10, 10));"`
Expected: three numbers between -1 and 1

- [ ] **Step 4: Commit**

```bash
git add lib/simplex-noise.js
git commit -m "Add self-contained simplex noise module"
```

---

### Task 2: Screensaver module

**Files:**
- Create: `lib/screensaver.js`
- Read: `lib/clock.js` (for pattern reference)
- Read: `lib/matrix.js` (for `drawBuffer`, `getRgbBuffer`, `sync`, `MATRIX_SIZE`, `clear`)

- [ ] **Step 1: Create the screensaver module**

Create `lib/screensaver.js` with the full animation engine. The module exports the same lifecycle pattern as `clock.js`:

```js
// lib/screensaver.js
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

// Noise layers
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
  // Restart interval if running
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
  // t is 0..1, wraps around
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

    // Broad layer: hue selection (noise returns -1..1, remap to 0..1)
    const n1 = (noise1(x * LAYER_BROAD.scale + t1, y * LAYER_BROAD.scale + t1 * 0.7) + 1) * 0.5;

    // Medium layer: brightness modulation (0.5..1.0)
    const n2 = (noise2(x * LAYER_MED.scale + t2, y * LAYER_MED.scale - t2 * 0.5) + 1) * 0.25 + 0.5;

    // Fine layer: shimmer (0.85..1.0)
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
```

- [ ] **Step 2: Verify module parses**

Run: `node --check lib/screensaver.js`
Expected: no output, exit code 0

- [ ] **Step 3: Commit**

```bash
git add lib/screensaver.js
git commit -m "Add screensaver module with simplex noise plasma"
```

---

### Task 3: Update index.js — settings migration and idle mode logic

**Files:**
- Modify: `index.js`

This task replaces `showClock` with `idleMode` and wires up the screensaver lifecycle.

- [ ] **Step 1: Add screensaver imports**

At the top of `index.js`, add after the clock imports (line 30):

```js
import {
  startScreensaver,
  stopScreensaver,
  isScreensaverVisible,
  setScreensaverPalette,
  setScreensaverFps,
  setOnStateChange as setScreensaverOnStateChange,
  setOverlayCallback as setScreensaverOverlayCallback,
} from './lib/screensaver.js';
```

Note: the clock imports also use `setOnStateChange` and `setOverlayCallback`, so these need aliased imports to avoid conflicts. The existing clock imports at lines 23-29 already use the unaliased names, which is fine.

- [ ] **Step 2: Update getDefaultSettings()**

Replace the `getDefaultSettings()` function (currently at lines 63-71) with:

```js
function getDefaultSettings() {
  return {
    brightness: config.brightness || 85,
    transition: config.transition || 'crossfade',
    transitionDuration: config.transitionDuration || 500,
    idleMode: config.showClock !== false ? 'clock' : 'off',
    clockColor: config.clockColor || { r: 120, g: 80, b: 200 },
    wledColors: config.wledColors || 5,
    screensaverPalette: 'aurora',
    screensaverFps: 10,
  };
}
```

- [ ] **Step 3: Add settings migration in loadSettings()**

After the `const saved = JSON.parse(data)` line and the merge with defaults (currently line 79), add migration logic. Replace the return statement in the `try` block:

```js
      const merged = { ...getDefaultSettings(), ...saved };
      // Migrate showClock -> idleMode
      if (saved.showClock !== undefined && saved.idleMode === undefined) {
        merged.idleMode = saved.showClock ? 'clock' : 'off';
      }
      delete merged.showClock;
      console.log('Loaded settings from settings.json');
      return merged;
```

- [ ] **Step 4: Initialize screensaver module**

After the clock initialization block (currently lines 125-128), add:

```js
// Initialize screensaver
setScreensaverPalette(settings.screensaverPalette);
setScreensaverFps(settings.screensaverFps);
setScreensaverOnStateChange(syncWebState);
setScreensaverOverlayCallback(drawCo2Indicator);
```

- [ ] **Step 5: Add startIdleMode and stopIdleMode helpers**

Add these after the `debounce` helper function (after line 135):

```js
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
```

- [ ] **Step 6: Update turnOff() to use startIdleMode**

In the `turnOff` function, replace:
```js
    // Start clock when idle
    if (settings.showClock) {
      startClock();
    }
```

with:
```js
    // Start idle screen
    startIdleMode();
```

- [ ] **Step 7: Update checkCover() to use stopIdleMode**

In `checkCover`, replace (around line 318):
```js
  // Stop clock when music starts
  if (isClockVisible()) {
    stopClock();
  }
```

with:
```js
  // Stop idle screen when music starts
  if (isClockVisible() || isScreensaverVisible()) {
    stopIdleMode();
  }
```

- [ ] **Step 8: Update syncWebState()**

Replace the `syncWebState` function body to include new state fields. Replace the entire function:

```js
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
    screensaverPalette: settings.screensaverPalette,
    screensaverFps: settings.screensaverFps,
    screensaverVisible: isScreensaverVisible(),
    co2: currentCo2,
    co2High,
    co2Threshold: CO2_THRESHOLD,
  });
}
```

- [ ] **Step 9: Update the CO2 redraw logic**

In `checkCo2`, replace (around line 196):
```js
    if (isClockVisible()) {
      renderClock();
    } else if (currentPixels && getMatrix()) {
```

with:
```js
    if (isClockVisible()) {
      renderClock();
    } else if (isScreensaverVisible()) {
      // Screensaver handles its own overlay via callback
    } else if (currentPixels && getMatrix()) {
```

- [ ] **Step 10: Replace onClockChange callback with onIdleModeChange**

Replace the entire `onClockChange` callback (lines 408-428) with:

```js
  onIdleModeChange: (mode, options) => {
    settings.idleMode = mode;
    settings.clockColor = options.clockColor;
    settings.screensaverPalette = options.screensaverPalette;
    settings.screensaverFps = options.screensaverFps;
    setClockColor(options.clockColor);
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
```

- [ ] **Step 11: Update startup idle mode**

Replace the startup block (lines 483-486):
```js
// Start clock on startup
if (settings.showClock) {
  startClock();
}
```

with:
```js
// Start idle screen on startup
startIdleMode();
```

- [ ] **Step 12: Update cleanup**

In the `cleanup` function, add `stopScreensaver()` after `stopClock()`:

```js
function cleanup() {
  console.log('\nShutting down...');
  clearTimeout(debounceTimer);
  stopClock();
  stopScreensaver();
  clearMatrix();
  process.exit(0);
}
```

- [ ] **Step 13: Verify parse**

Run: `node --check index.js`
Expected: no output, exit code 0

- [ ] **Step 14: Commit**

```bash
git add index.js
git commit -m "Wire up screensaver in index.js with idle mode switching"
```

---

### Task 4: Update server.js — state and callbacks

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Update default state object**

Replace the `showClock` and `clockVisible` fields in the `state` object (lines 9-22) with:

```js
let state = {
  currentCover: null,
  currentEntity: null,
  isPlaying: false,
  brightness: 85,
  transition: 'crossfade',
  transitionDuration: 500,
  wledUrls: [],
  wledColors: 5,
  entities: [],
  idleMode: 'clock',
  clockColor: { r: 120, g: 80, b: 200 },
  clockVisible: false,
  screensaverPalette: 'aurora',
  screensaverFps: 10,
  screensaverVisible: false,
};
```

- [ ] **Step 2: Update callbacks object**

Replace `onClockChange` with `onIdleModeChange` in the callbacks object (lines 24-30):

```js
let callbacks = {
  onBrightnessChange: null,
  onTransitionChange: null,
  onIdleModeChange: null,
  onWledColorsChange: null,
  onRefresh: null,
};
```

- [ ] **Step 3: Update settings POST handler**

In `handleApi`, replace the `showClock` and `clockColor` blocks (lines 115-122) with:

```js
        if (settings.idleMode !== undefined) {
          state.idleMode = settings.idleMode;
        }
        if (settings.clockColor !== undefined) {
          state.clockColor = settings.clockColor;
        }
        if (settings.screensaverPalette !== undefined) {
          state.screensaverPalette = settings.screensaverPalette;
        }
        if (settings.screensaverFps !== undefined) {
          state.screensaverFps = Math.max(5, Math.min(30, settings.screensaverFps));
        }
        // Fire callback if any idle-related setting changed
        if (settings.idleMode !== undefined || settings.clockColor !== undefined ||
            settings.screensaverPalette !== undefined || settings.screensaverFps !== undefined) {
          callbacks.onIdleModeChange?.(state.idleMode, {
            clockColor: state.clockColor,
            screensaverPalette: state.screensaverPalette,
            screensaverFps: state.screensaverFps,
          });
        }
```

- [ ] **Step 4: Verify parse**

Run: `node --check server.js`
Expected: no output, exit code 0

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "Update server state and callbacks for idle mode"
```

---

### Task 5: Update web UI — Idle Screen card

**Files:**
- Modify: `web/index.html`

Note: the HTML has been auto-formatted with 2-space indentation. Match that style.

- [ ] **Step 1: Replace the Clock card HTML**

Replace the entire Clock card (lines 502-515):

```html
      <div class="card">
        <div class="card-title">Clock (Idle Screen)</div>
        ...
      </div>
```

with:

```html
      <div class="card">
        <div class="card-title">Idle Screen</div>
        <div class="control-row">
          <span class="control-label">Mode</span>
          <select id="idleMode">
            <option value="clock">Clock</option>
            <option value="screensaver">Screensaver</option>
            <option value="off">Off</option>
          </select>
        </div>
        <div id="clockOptions">
          <div class="control-row">
            <span class="control-label">Color</span>
            <input type="color" id="clockColor" value="#7850c8" />
          </div>
        </div>
        <div id="screensaverOptions" style="display: none">
          <div class="control-row">
            <span class="control-label">Palette</span>
            <select id="screensaverPalette">
              <option value="aurora">Aurora</option>
              <option value="ember">Ember</option>
              <option value="ocean">Ocean</option>
              <option value="sunset">Sunset</option>
              <option value="forest">Forest</option>
            </select>
          </div>
          <div class="control-row">
            <span class="control-label">FPS</span>
            <span class="control-value" id="screensaverFpsValue">10</span>
          </div>
          <input
            type="range"
            id="screensaverFps"
            min="5"
            max="30"
            value="10"
          />
        </div>
      </div>
```

- [ ] **Step 2: Update DOM element references in the script**

Replace the `showClockToggle` and `clockColorInput` declarations (lines 554-555) with:

```js
      const idleModeSelect = document.getElementById("idleMode");
      const clockOptions = document.getElementById("clockOptions");
      const clockColorInput = document.getElementById("clockColor");
      const screensaverOptions = document.getElementById("screensaverOptions");
      const screensaverPaletteSelect = document.getElementById("screensaverPalette");
      const screensaverFpsSlider = document.getElementById("screensaverFps");
      const screensaverFpsValue = document.getElementById("screensaverFpsValue");
```

- [ ] **Step 3: Add idle mode visibility toggle function**

Add this function right after the `hexToRgb` function:

```js
      function updateIdleModeUI() {
        const mode = idleModeSelect.value;
        clockOptions.style.display = mode === "clock" ? "" : "none";
        screensaverOptions.style.display = mode === "screensaver" ? "" : "none";
      }
```

- [ ] **Step 4: Update updateUI() function**

In `updateUI`, replace the `showClock` and `clockColor` settings update block (lines 620-627) with:

```js
          idleModeSelect.value = state.idleMode || "clock";
          if (state.clockColor) {
            clockColorInput.value = rgbToHex(
              state.clockColor.r,
              state.clockColor.g,
              state.clockColor.b,
            );
          }
          screensaverPaletteSelect.value = state.screensaverPalette || "aurora";
          screensaverFpsSlider.value = state.screensaverFps || 10;
          screensaverFpsValue.textContent = state.screensaverFps || 10;
          updateIdleModeUI();
```

- [ ] **Step 5: Update saveSettings() payload**

In the `saveSettings` function, replace the `showClock` and `clockColor` lines in the POST body with:

```js
              idleMode: idleModeSelect.value,
              clockColor: hexToRgb(clockColorInput.value),
              screensaverPalette: screensaverPaletteSelect.value,
              screensaverFps: parseInt(screensaverFpsSlider.value),
```

- [ ] **Step 6: Update event listeners**

Replace the `showClockToggle` and `clockColorInput` event listeners (lines 700-701) with:

```js
      idleModeSelect.addEventListener("change", () => {
        updateIdleModeUI();
        markDirty();
      });
      clockColorInput.addEventListener("input", markDirty);
      screensaverPaletteSelect.addEventListener("change", markDirty);
      screensaverFpsSlider.addEventListener("input", () => {
        screensaverFpsValue.textContent = screensaverFpsSlider.value;
        markDirty();
      });
```

- [ ] **Step 7: Verify the file is valid HTML**

Open `web/index.html` in a browser or run: `node -e "import('fs').then(fs => { const html = fs.readFileSync('web/index.html', 'utf-8'); console.log('Length:', html.length, 'OK'); })"`

- [ ] **Step 8: Commit**

```bash
git add web/index.html
git commit -m "Replace Clock card with Idle Screen card in web UI"
```

---

### Task 6: Integration verification and final commit

**Files:**
- All modified files

- [ ] **Step 1: Verify all files parse**

Run: `node --check index.js && node --check server.js && node --check lib/screensaver.js && node --check lib/simplex-noise.js && echo "All OK"`
Expected: "All OK"

- [ ] **Step 2: Verify no import/export mismatches**

Run: `node -e "import('./lib/simplex-noise.js').then(() => console.log('simplex-noise OK'))"`
Run: `node -e "import('./lib/screensaver.js').then(() => console.log('screensaver OK')).catch(e => console.log(e.message))"`

The screensaver import may fail due to `rpi-led-matrix` not being available on macOS. That's expected. Verify the error is about `rpi-led-matrix`, not about missing exports or syntax.

- [ ] **Step 3: Review the complete diff**

Run: `git diff --stat` to verify only the expected files were changed.

Expected modified files:
- `lib/simplex-noise.js` (new)
- `lib/screensaver.js` (new)
- `index.js` (modified)
- `server.js` (modified)
- `web/index.html` (modified)

- [ ] **Step 4: Push**

```bash
git push
```
