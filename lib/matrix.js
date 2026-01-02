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
    matrix.brightness(currentBrightness);
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

// Always re-apply brightness before sync to prevent flickering
export function sync() {
  if (matrix) {
    matrix.brightness(currentBrightness);
    matrix.sync();
  }
}

export function clear() {
  if (matrix) {
    matrix.clear();
  }
}

// Draw pixels array to matrix
export function drawPixels(pixels) {
  if (!matrix || !pixels) return;

  for (let y = 0; y < pixels.height; y++) {
    for (let x = 0; x < pixels.width; x++) {
      const i = (y * pixels.width + x) * 4;
      const r = pixels.data[i];
      const g = pixels.data[i + 1];
      const b = pixels.data[i + 2];
      matrix.fgColor({ r, g, b }).setPixel(x, y);
    }
  }
  matrix.brightness(currentBrightness);
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
