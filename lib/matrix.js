import { LedMatrix, GpioMapping } from 'rpi-led-matrix';
import sharp from 'sharp';

export const MATRIX_SIZE = 64;

let matrix = null;
let currentBrightness = 85;

export function initMatrix(brightness = 85) {
  currentBrightness = brightness;
  
  const matrixOptions = {
    ...LedMatrix.defaultMatrixOptions(),
    rows: MATRIX_SIZE,
    cols: MATRIX_SIZE,
    hardwareMapping: GpioMapping.AdafruitHatPwm,
    brightness: currentBrightness,
    pwmLsbNanoseconds: 130,
    pwmDitherBits: 0,
  };

  const runtimeOptions = {
    ...LedMatrix.defaultRuntimeOptions(),
    gpioSlowdown: 4,
  };

  try {
    matrix = new LedMatrix(matrixOptions, runtimeOptions);
    console.log('LED Matrix initialized');
    return matrix;
  } catch (err) {
    console.error('Failed to initialize LED matrix:', err.message);
    console.log('Running in preview mode (no matrix connected)');
    return null;
  }
}

export function getMatrix() {
  return matrix;
}

export function clearMatrix() {
  if (matrix) {
    matrix.clear();
    matrix.sync();
  }
}

export function setBrightness(brightness) {
  currentBrightness = brightness;
  if (matrix) {
    matrix.brightness(brightness);
  }
}

export function getBrightness() {
  return currentBrightness;
}

export function setPixel(x, y, r, g, b) {
  if (matrix && x >= 0 && x < MATRIX_SIZE && y >= 0 && y < MATRIX_SIZE) {
    matrix.fgColor({ r, g, b }).setPixel(x, y);
  }
}

export function sync() {
  if (matrix) {
    matrix.sync();
  }
}

export function clear() {
  if (matrix) {
    matrix.clear();
  }
}

// Shared RGB buffer for bulk writes (avoids per-pixel fgColor/setPixel overhead)
const rgbBuffer = Buffer.alloc(MATRIX_SIZE * MATRIX_SIZE * 3);

export function drawBuffer(buf) {
  if (!matrix) return;
  matrix.drawBuffer(buf, MATRIX_SIZE, MATRIX_SIZE);
}

export function getRgbBuffer() {
  return rgbBuffer;
}

// Draw pixels array to matrix
export function drawPixels(pixels) {
  if (!matrix || !pixels) return;

  for (let i = 0; i < MATRIX_SIZE * MATRIX_SIZE; i++) {
    const srcIdx = i * 4;
    const dstIdx = i * 3;
    rgbBuffer[dstIdx] = pixels.data[srcIdx];
    rgbBuffer[dstIdx + 1] = pixels.data[srcIdx + 1];
    rgbBuffer[dstIdx + 2] = pixels.data[srcIdx + 2];
  }
  matrix.drawBuffer(rgbBuffer, MATRIX_SIZE, MATRIX_SIZE);
  matrix.sync();
}

// Get pixel data from sharp image buffer
export async function getPixelsFromBuffer(buffer) {
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

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
