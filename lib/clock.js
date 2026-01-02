import { getMatrix, MATRIX_SIZE, clear, sync } from './matrix.js';

// 5x7 pixel font for digits and colon (classic LED style)
const FONT = {
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

let clockInterval = null;
let clockVisible = false;
let clockColor = { r: 120, g: 80, b: 200 };
let onStateChange = null;

export function setClockColor(color) {
  clockColor = color;
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
  
  const glyph = FONT[char];
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

export function renderClock() {
  const matrix = getMatrix();
  if (!matrix || !clockVisible) return;

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  
  const scale = 2;
  const charWidth = 5 * scale;
  const colonWidth = 1 * scale;
  const spacing = 2;
  
  const totalWidth = (4 * charWidth) + colonWidth + (4 * spacing);
  const totalHeight = 7 * scale;
  
  const startX = Math.floor((MATRIX_SIZE - totalWidth) / 2);
  const startY = Math.floor((MATRIX_SIZE - totalHeight) / 2);
  
  clear();
  
  let x = startX;
  for (const char of timeStr) {
    const width = char === ':' ? colonWidth : charWidth;
    drawChar(char, x, startY, scale, clockColor);
    x += width + spacing;
  }
  
  // Blinking colon
  const showColon = now.getSeconds() % 2 === 0;
  if (!showColon) {
    const colonX = startX + (2 * charWidth) + (2 * spacing);
    const dimColor = { 
      r: Math.floor(clockColor.r * 0.2), 
      g: Math.floor(clockColor.g * 0.2), 
      b: Math.floor(clockColor.b * 0.2) 
    };
    drawChar(':', colonX, startY, scale, dimColor);
  }
  
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

