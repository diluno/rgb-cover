import { getMatrix, MATRIX_SIZE, sync } from './matrix.js';

// 3x5 pixel font - compact enough to overlay on cover art
// Each character is an array of 5 rows, each row is 3 bits wide
const FONT = {
  'A': [0b111,0b101,0b111,0b101,0b101],
  'B': [0b110,0b101,0b110,0b101,0b110],
  'C': [0b111,0b100,0b100,0b100,0b111],
  'D': [0b110,0b101,0b101,0b101,0b110],
  'E': [0b111,0b100,0b110,0b100,0b111],
  'F': [0b111,0b100,0b110,0b100,0b100],
  'G': [0b111,0b100,0b101,0b101,0b111],
  'H': [0b101,0b101,0b111,0b101,0b101],
  'I': [0b111,0b010,0b010,0b010,0b111],
  'J': [0b011,0b001,0b001,0b101,0b111],
  'K': [0b101,0b101,0b110,0b101,0b101],
  'L': [0b100,0b100,0b100,0b100,0b111],
  'M': [0b101,0b111,0b111,0b101,0b101],
  'N': [0b101,0b111,0b111,0b101,0b101],
  'O': [0b111,0b101,0b101,0b101,0b111],
  'P': [0b111,0b101,0b111,0b100,0b100],
  'Q': [0b111,0b101,0b101,0b111,0b001],
  'R': [0b111,0b101,0b111,0b110,0b101],
  'S': [0b111,0b100,0b111,0b001,0b111],
  'T': [0b111,0b010,0b010,0b010,0b010],
  'U': [0b101,0b101,0b101,0b101,0b111],
  'V': [0b101,0b101,0b101,0b101,0b010],
  'W': [0b101,0b101,0b111,0b111,0b101],
  'X': [0b101,0b101,0b010,0b101,0b101],
  'Y': [0b101,0b101,0b010,0b010,0b010],
  'Z': [0b111,0b001,0b010,0b100,0b111],
  '0': [0b111,0b101,0b101,0b101,0b111],
  '1': [0b010,0b110,0b010,0b010,0b111],
  '2': [0b111,0b001,0b111,0b100,0b111],
  '3': [0b111,0b001,0b111,0b001,0b111],
  '4': [0b101,0b101,0b111,0b001,0b001],
  '5': [0b111,0b100,0b111,0b001,0b111],
  '6': [0b111,0b100,0b111,0b101,0b111],
  '7': [0b111,0b001,0b001,0b010,0b010],
  '8': [0b111,0b101,0b111,0b101,0b111],
  '9': [0b111,0b101,0b111,0b001,0b111],
  '-': [0b000,0b000,0b111,0b000,0b000],
  '.': [0b000,0b000,0b000,0b000,0b010],
  ',': [0b000,0b000,0b000,0b010,0b100],
  '!': [0b010,0b010,0b010,0b000,0b010],
  '?': [0b111,0b001,0b010,0b000,0b010],
  '\'': [0b010,0b010,0b000,0b000,0b000],
  '"': [0b101,0b101,0b000,0b000,0b000],
  '(': [0b010,0b100,0b100,0b100,0b010],
  ')': [0b010,0b001,0b001,0b001,0b010],
  '/': [0b001,0b001,0b010,0b100,0b100],
  ':': [0b000,0b010,0b000,0b010,0b000],
  '&': [0b010,0b101,0b010,0b101,0b011],
  ' ': [0b000,0b000,0b000,0b000,0b000],
};

const CHAR_W = 3;
const CHAR_H = 5;
const CHAR_GAP = 1;
const OVERLAY_H = CHAR_H + 2; // 1px padding top and bottom
const OVERLAY_Y = Math.floor((MATRIX_SIZE - OVERLAY_H) / 2);

let overlayText = null;
let scrollOffset = 0;
let textWidth = 0;
let overlayTimer = null;
let fadeAlpha = 1;
let phase = 'idle'; // 'scroll' | 'hold' | 'fadeout' | 'idle'

function getTextWidth(text) {
  let w = 0;
  for (const ch of text) {
    w += (FONT[ch.toUpperCase()] ? CHAR_W : CHAR_W) + CHAR_GAP;
  }
  return w > 0 ? w - CHAR_GAP : 0;
}

let tickInterval = null;
let onRender = null;

export function setOverlayRenderCallback(callback) {
  onRender = callback;
}

function startTicking() {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
    if (phase === 'idle') {
      clearInterval(tickInterval);
      tickInterval = null;
      return;
    }
    onRender?.();
  }, 1000 / 20); // 20 FPS for smooth scrolling
}

export function showTrackInfo(artist, title) {
  clearTimeout(overlayTimer);

  const text = artist && title ? `${artist}  -  ${title}` : (title || artist || '');
  if (!text) return;

  overlayText = text;
  textWidth = getTextWidth(text);
  fadeAlpha = 1;

  // If text fits on screen, just hold it centered
  if (textWidth <= MATRIX_SIZE) {
    scrollOffset = -Math.floor((MATRIX_SIZE - textWidth) / 2);
    phase = 'hold';
    overlayTimer = setTimeout(() => {
      phase = 'fadeout';
    }, 3000);
  } else {
    // Start scrolled to beginning, scroll across
    scrollOffset = -4; // small initial padding
    phase = 'scroll';
  }

  startTicking();
}

export function isOverlayActive() {
  return phase !== 'idle';
}

export function renderOverlay() {
  const matrix = getMatrix();
  if (!matrix || phase === 'idle' || !overlayText) return;

  // Handle scroll
  if (phase === 'scroll') {
    scrollOffset += 0.5; // half pixel per frame for smooth scroll
    // When fully scrolled, hold briefly then fade
    if (scrollOffset > textWidth - MATRIX_SIZE + 4) {
      phase = 'hold';
      overlayTimer = setTimeout(() => {
        phase = 'fadeout';
      }, 1500);
    }
  }

  // Handle fade
  if (phase === 'fadeout') {
    fadeAlpha -= 0.05;
    if (fadeAlpha <= 0) {
      phase = 'idle';
      overlayText = null;
      return;
    }
  }

  const alpha = fadeAlpha;

  // Draw dark background strip
  for (let y = OVERLAY_Y; y < MATRIX_SIZE; y++) {
    for (let x = 0; x < MATRIX_SIZE; x++) {
      matrix.fgColor({
        r: 0,
        g: 0,
        b: 0,
      }).setPixel(x, y);
    }
  }

  // Draw text
  const textY = OVERLAY_Y + 1;
  const intOffset = Math.round(scrollOffset);

  for (let ci = 0; ci < overlayText.length; ci++) {
    const ch = overlayText[ci].toUpperCase();
    const glyph = FONT[ch];
    if (!glyph) continue;

    // Calculate character x position
    let charX = 0;
    for (let j = 0; j < ci; j++) {
      charX += CHAR_W + CHAR_GAP;
    }
    charX -= intOffset;

    // Skip if fully off screen
    if (charX + CHAR_W < 0 || charX >= MATRIX_SIZE) continue;

    for (let row = 0; row < CHAR_H; row++) {
      const bits = glyph[row];
      for (let col = 0; col < CHAR_W; col++) {
        if (bits & (1 << (CHAR_W - 1 - col))) {
          const px = charX + col;
          const py = textY + row;
          if (px >= 0 && px < MATRIX_SIZE && py >= 0 && py < MATRIX_SIZE) {
            const brightness = Math.round(255 * alpha);
            matrix.fgColor({
              r: brightness,
              g: brightness,
              b: brightness,
            }).setPixel(px, py);
          }
        }
      }
    }
  }
}

export function stopOverlay() {
  clearTimeout(overlayTimer);
  phase = 'idle';
  overlayText = null;
}
