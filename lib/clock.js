import { getMatrix, MATRIX_SIZE, clear, sync } from './matrix.js';

// Pixel fonts for digits and colon.
const CLASSIC_FONT = {
  '0': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,1,1],
    [1,0,1,0,1],
    [1,1,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  '1': [
    [0,0,1,0,0],
    [0,1,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,1,1,1,0],
  ],
  '2': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [0,0,0,0,1],
    [0,0,1,1,0],
    [0,1,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,1],
  ],
  '3': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [0,0,0,0,1],
    [0,0,1,1,0],
    [0,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  '4': [
    [0,0,0,1,0],
    [0,0,1,1,0],
    [0,1,0,1,0],
    [1,0,0,1,0],
    [1,1,1,1,1],
    [0,0,0,1,0],
    [0,0,0,1,0],
  ],
  '5': [
    [1,1,1,1,1],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [0,0,0,0,1],
    [0,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  '6': [
    [0,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  '7': [
    [1,1,1,1,1],
    [0,0,0,0,1],
    [0,0,0,1,0],
    [0,0,1,0,0],
    [0,1,0,0,0],
    [0,1,0,0,0],
    [0,1,0,0,0],
  ],
  '8': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  '9': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,1],
    [0,0,0,0,1],
    [0,0,0,0,1],
    [0,1,1,1,0],
  ],
  ':': [
    [0],
    [1],
    [0],
    [0],
    [0],
    [1],
    [0],
  ],
};

const ROUNDED_FONT = {
  '0': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  '1': [
    [0,0,1,0,0],
    [0,1,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,1,1,1,0],
  ],
  '2': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [0,0,0,0,1],
    [0,0,0,1,0],
    [0,0,1,0,0],
    [0,1,0,0,0],
    [1,1,1,1,1],
  ],
  '3': [
    [1,1,1,1,0],
    [0,0,0,0,1],
    [0,0,0,0,1],
    [0,1,1,1,0],
    [0,0,0,0,1],
    [0,0,0,0,1],
    [1,1,1,1,0],
  ],
  '4': [
    [1,0,0,1,0],
    [1,0,0,1,0],
    [1,0,0,1,0],
    [1,1,1,1,1],
    [0,0,0,1,0],
    [0,0,0,1,0],
    [0,0,0,1,0],
  ],
  '5': [
    [1,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [0,0,0,0,1],
    [0,0,0,0,1],
    [1,1,1,1,0],
  ],
  '6': [
    [0,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  '7': [
    [1,1,1,1,1],
    [0,0,0,0,1],
    [0,0,0,1,0],
    [0,0,1,0,0],
    [0,1,0,0,0],
    [0,1,0,0,0],
    [0,1,0,0,0],
  ],
  '8': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  '9': [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,1],
    [0,0,0,0,1],
    [0,0,0,0,1],
    [0,1,1,1,0],
  ],
  ':': [
    [0],
    [1],
    [0],
    [0],
    [0],
    [1],
    [0],
  ],
};

const TALL_CONDENSED_FONT = {
  '0': [
    [1,1,1],
    [1,0,1],
    [1,0,1],
    [1,0,1],
    [1,0,1],
    [1,0,1],
    [1,0,1],
    [1,0,1],
    [1,1,1],
  ],
  '1': [
    [0,1,0],
    [1,1,0],
    [0,1,0],
    [0,1,0],
    [0,1,0],
    [0,1,0],
    [0,1,0],
    [0,1,0],
    [1,1,1],
  ],
  '2': [
    [1,1,1],
    [0,0,1],
    [0,0,1],
    [0,0,1],
    [1,1,1],
    [1,0,0],
    [1,0,0],
    [1,0,0],
    [1,1,1],
  ],
  '3': [
    [1,1,1],
    [0,0,1],
    [0,0,1],
    [0,0,1],
    [1,1,1],
    [0,0,1],
    [0,0,1],
    [0,0,1],
    [1,1,1],
  ],
  '4': [
    [1,0,1],
    [1,0,1],
    [1,0,1],
    [1,0,1],
    [1,1,1],
    [0,0,1],
    [0,0,1],
    [0,0,1],
    [0,0,1],
  ],
  '5': [
    [1,1,1],
    [1,0,0],
    [1,0,0],
    [1,0,0],
    [1,1,1],
    [0,0,1],
    [0,0,1],
    [0,0,1],
    [1,1,1],
  ],
  '6': [
    [1,1,1],
    [1,0,0],
    [1,0,0],
    [1,0,0],
    [1,1,1],
    [1,0,1],
    [1,0,1],
    [1,0,1],
    [1,1,1],
  ],
  '7': [
    [1,1,1],
    [0,0,1],
    [0,0,1],
    [0,1,0],
    [0,1,0],
    [0,1,0],
    [1,0,0],
    [1,0,0],
    [1,0,0],
  ],
  '8': [
    [1,1,1],
    [1,0,1],
    [1,0,1],
    [1,0,1],
    [1,1,1],
    [1,0,1],
    [1,0,1],
    [1,0,1],
    [1,1,1],
  ],
  '9': [
    [1,1,1],
    [1,0,1],
    [1,0,1],
    [1,0,1],
    [1,1,1],
    [0,0,1],
    [0,0,1],
    [0,0,1],
    [1,1,1],
  ],
  ':': [
    [0],
    [0],
    [1],
    [0],
    [0],
    [0],
    [1],
    [0],
    [0],
  ],
};

const SEVEN_SEGMENT_DEFS = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'],
  '4': ['f', 'g', 'b', 'c'],
  '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'c', 'd'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'],
};

function createSevenSegmentGlyph(segments) {
  const rows = Array.from({ length: 7 }, () => [0,0,0,0,0]);
  const has = (segment) => segments.includes(segment);

  if (has('a')) rows[0] = [0,1,1,1,0];
  if (has('g')) rows[3] = [0,1,1,1,0];
  if (has('d')) rows[6] = [0,1,1,1,0];
  if (has('f')) rows[1][0] = rows[2][0] = 1;
  if (has('b')) rows[1][4] = rows[2][4] = 1;
  if (has('e')) rows[4][0] = rows[5][0] = 1;
  if (has('c')) rows[4][4] = rows[5][4] = 1;

  return rows;
}

const SEVEN_SEGMENT_FONT = Object.fromEntries(
  Object.entries(SEVEN_SEGMENT_DEFS).map(([char, segments]) => [
    char,
    createSevenSegmentGlyph(segments),
  ]),
);

SEVEN_SEGMENT_FONT[':'] = [
  [0],
  [1],
  [0],
  [0],
  [0],
  [1],
  [0],
];

const CLOCK_FONTS = {
  classic: CLASSIC_FONT,
  sevenSegment: SEVEN_SEGMENT_FONT,
  rounded: ROUNDED_FONT,
  tallCondensed: TALL_CONDENSED_FONT,
};

const ANALOG_STYLE = 'analog';

const DEFAULT_CLOCK_STYLE = 'classic';

let clockInterval = null;
let clockVisible = false;
let clockColor = { r: 120, g: 80, b: 200 };
let clockStyle = DEFAULT_CLOCK_STYLE;
let onStateChange = null;
let overlayCallback = null;

export function setOverlayCallback(callback) {
  overlayCallback = callback;
}

export function setClockColor(color) {
  clockColor = color;
}

export function setClockStyle(style) {
  clockStyle = (CLOCK_FONTS[style] || style === ANALOG_STYLE) ? style : DEFAULT_CLOCK_STYLE;
}

export function setOnStateChange(callback) {
  onStateChange = callback;
}

export function isClockVisible() {
  return clockVisible;
}

function drawChar(char, startX, startY, scale, color) {
  const matrix = getMatrix();
  if (!matrix) return;
  
  const glyph = CLOCK_FONTS[clockStyle]?.[char] || CLASSIC_FONT[char];
  if (!glyph) return;

  for (let row = 0; row < glyph.length; row++) {
    for (let col = 0; col < glyph[row].length; col++) {
      if (glyph[row][col]) {
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = startX + col * scale + sx;
            const py = startY + row * scale + sy;
            if (px >= 0 && px < MATRIX_SIZE && py >= 0 && py < MATRIX_SIZE) {
              matrix.fgColor(color).setPixel(px, py);
            }
          }
        }
      }
    }
  }
}

function getCharWidth(char, scale) {
  const glyph = CLOCK_FONTS[clockStyle]?.[char] || CLASSIC_FONT[char];
  return (glyph?.[0]?.length || 0) * scale;
}

function getCharHeight(char, scale) {
  const glyph = CLOCK_FONTS[clockStyle]?.[char] || CLASSIC_FONT[char];
  return (glyph?.length || 0) * scale;
}

function dimColor(color, amount) {
  return {
    r: Math.floor(color.r * amount),
    g: Math.floor(color.g * amount),
    b: Math.floor(color.b * amount),
  };
}

function drawStyledChar(char, startX, startY, scale, color) {
  drawChar(char, startX + 1, startY + 1, scale, dimColor(color, 0.18));
  drawChar(char, startX, startY, scale, color);
}

// Bresenham line, clamped to matrix bounds (mirrors drawChar's bounds checks).
function drawLine(x0, y0, x1, y1, color) {
  const matrix = getMatrix();
  if (!matrix) return;

  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);

  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    if (x0 >= 0 && x0 < MATRIX_SIZE && y0 >= 0 && y0 < MATRIX_SIZE) {
      matrix.fgColor(color).setPixel(x0, y0);
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// Draw a hand of given length/angle from the center. `thick` adds a parallel
// 1px line offset perpendicular to the hand so the hour hand reads heavier.
function drawHand(cx, cy, angle, length, color, thick) {
  const ex = cx + Math.sin(angle) * length;
  const ey = cy - Math.cos(angle) * length;
  drawLine(cx, cy, ex, ey, color);
  if (thick) {
    const px = Math.round(-Math.cos(angle));
    const py = Math.round(-Math.sin(angle));
    drawLine(cx + px, cy + py, ex + px, ey + py, color);
  }
}

function renderAnalogFace() {
  const matrix = getMatrix();
  if (!matrix) return;

  clear();

  const cx = 32;
  const cy = 32;
  const dotRadius = 30;
  const dimDot = dimColor(clockColor, 0.4);

  // 12 hour dots; quarter dots (12/3/6/9) brighter for orientation.
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const dx = Math.round(cx + Math.sin(angle) * dotRadius);
    const dy = Math.round(cy - Math.cos(angle) * dotRadius);
    if (dx >= 0 && dx < MATRIX_SIZE && dy >= 0 && dy < MATRIX_SIZE) {
      matrix.fgColor(i % 3 === 0 ? clockColor : dimDot).setPixel(dx, dy);
    }
  }

  const now = new Date();
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();

  const minuteAngle = (minutes / 60) * Math.PI * 2;
  const hourAngle = ((hours + minutes / 60) / 12) * Math.PI * 2;

  drawHand(cx, cy, minuteAngle, 22, clockColor, false);
  drawHand(cx, cy, hourAngle, 14, clockColor, true);

  // Center hub (2x2).
  for (let oy = 0; oy < 2; oy++) {
    for (let ox = 0; ox < 2; ox++) {
      matrix.fgColor(clockColor).setPixel(cx - 1 + ox, cy - 1 + oy);
    }
  }

  // Draw any overlays (e.g. CO2 indicator)
  overlayCallback?.();

  sync();
}

export function renderClock() {
  const matrix = getMatrix();
  if (!matrix || !clockVisible) return;

  if (clockStyle === ANALOG_STYLE) {
    renderAnalogFace();
    return;
  }

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  
  const scale = 2;
  const spacing = 2;
  const glyphWidths = [...timeStr].map((char) => getCharWidth(char, scale));
  const glyphHeights = [...timeStr].map((char) => getCharHeight(char, scale));
  const totalWidth = glyphWidths.reduce((sum, width) => sum + width, 0) + ((timeStr.length - 1) * spacing);
  const totalHeight = Math.max(...glyphHeights);
  
  const startX = Math.floor((MATRIX_SIZE - totalWidth) / 2);
  const startY = Math.floor((MATRIX_SIZE - totalHeight) / 2);
  
  clear();
  
  const showColon = now.getSeconds() % 2 === 0;
  let x = startX;
  for (let i = 0; i < timeStr.length; i++) {
    const char = timeStr[i];
    const charColor = char === ':' && !showColon ? dimColor(clockColor, 0.2) : clockColor;
    drawStyledChar(char, x, startY, scale, charColor);
    x += glyphWidths[i] + spacing;
  }
  
  // Draw any overlays (e.g. CO2 indicator)
  overlayCallback?.();
  
  sync();
}

export function startClock() {
  if (clockInterval) return;
  
  clockVisible = true;
  onStateChange?.();
  console.log('Clock started');
  
  renderClock();
  clockInterval = setInterval(renderClock, 1000);
}

export function stopClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
  clockVisible = false;
  onStateChange?.();
}
