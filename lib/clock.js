import { getMatrix, MATRIX_SIZE, clear, sync } from './matrix.js';

// 5x7 pixel fonts for digits and colon.
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
};

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
  clockStyle = CLOCK_FONTS[style] ? style : DEFAULT_CLOCK_STYLE;
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

export function renderClock() {
  const matrix = getMatrix();
  if (!matrix || !clockVisible) return;

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  
  const scale = 2;
  const spacing = 2;
  const glyphWidths = [...timeStr].map((char) => getCharWidth(char, scale));
  const totalWidth = glyphWidths.reduce((sum, width) => sum + width, 0) + ((timeStr.length - 1) * spacing);
  const totalHeight = 7 * scale;
  
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
