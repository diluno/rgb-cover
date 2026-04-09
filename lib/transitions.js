import { getMatrix, MATRIX_SIZE, sleep, sync as matrixSync, getRgbBuffer, drawBuffer } from './matrix.js';

const TRANSITION_FPS = 30;

// Precomputed distance maps (computed once on import)
const centerX = MATRIX_SIZE / 2;
const centerY = MATRIX_SIZE / 2;
const maxCircleRadius = Math.sqrt(centerX * centerX + centerY * centerY);
const maxDiamondDist = centerX + centerY;

const circleDistMap = new Float32Array(MATRIX_SIZE * MATRIX_SIZE);
const diamondDistMap = new Float32Array(MATRIX_SIZE * MATRIX_SIZE);
const spiralOrder = [];

for (let y = 0; y < MATRIX_SIZE; y++) {
  for (let x = 0; x < MATRIX_SIZE; x++) {
    const i = y * MATRIX_SIZE + x;
    const dx = x - centerX;
    const dy = y - centerY;
    circleDistMap[i] = Math.sqrt(dx * dx + dy * dy);
    diamondDistMap[i] = Math.abs(dx) + Math.abs(dy);
    const angle = Math.atan2(dy, dx);
    spiralOrder.push({ x, y, value: circleDistMap[i] + (angle + Math.PI) * 5 });
  }
}
spiralOrder.sort((a, b) => a.value - b.value);

export const TransitionType = {
  CROSSFADE: 'crossfade',
  SLIDE_LEFT: 'slideLeft',
  SLIDE_RIGHT: 'slideRight',
  SLIDE_UP: 'slideUp',
  SLIDE_DOWN: 'slideDown',
  DISSOLVE: 'dissolve',
  // Overlay transitions (new cover goes over old)
  WIPE_RIGHT: 'wipeRight',
  WIPE_LEFT: 'wipeLeft',
  WIPE_DOWN: 'wipeDown',
  WIPE_UP: 'wipeUp',
  BLINDS_H: 'blindsH',
  BLINDS_V: 'blindsV',
  CIRCLE: 'circle',
  DIAMOND: 'diamond',
  SPIRAL: 'spiral',
  CHECKERBOARD: 'checkerboard',
  RANDOM: 'random',
};

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function getPixel(pixels, x, y) {
  if (!pixels) return { r: 0, g: 0, b: 0 };
  const i = (y * MATRIX_SIZE + x) * 4;
  return {
    r: pixels.data[i] || 0,
    g: pixels.data[i + 1] || 0,
    b: pixels.data[i + 2] || 0,
  };
}

export async function crossfade(fromPixels, toPixels, duration) {
  if (!getMatrix()) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const buf = getRgbBuffer();

  for (let frame = 0; frame <= frames; frame++) {
    const t = frame / frames;

    for (let i = 0; i < MATRIX_SIZE * MATRIX_SIZE; i++) {
      const x = i % MATRIX_SIZE;
      const y = (i - x) / MATRIX_SIZE;
      const from = getPixel(fromPixels, x, y);
      const to = getPixel(toPixels, x, y);
      const di = i * 3;
      buf[di] = lerp(from.r, to.r, t);
      buf[di + 1] = lerp(from.g, to.g, t);
      buf[di + 2] = lerp(from.b, to.b, t);
    }
    drawBuffer(buf);
    matrixSync();
    await sleep(frameDelay);
  }
}

export async function slide(fromPixels, toPixels, duration, direction) {
  if (!getMatrix()) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const buf = getRgbBuffer();

  for (let frame = 0; frame <= frames; frame++) {
    const progress = frame / frames;
    const offset = Math.round(progress * MATRIX_SIZE);

    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        let srcX, srcY, useNew;

        switch (direction) {
          case 'left':
            srcX = x + offset; srcY = y;
            useNew = srcX >= MATRIX_SIZE;
            if (useNew) srcX -= MATRIX_SIZE;
            break;
          case 'right':
            srcX = x - offset; srcY = y;
            useNew = srcX < 0;
            if (useNew) srcX += MATRIX_SIZE;
            break;
          case 'up':
            srcX = x; srcY = y + offset;
            useNew = srcY >= MATRIX_SIZE;
            if (useNew) srcY -= MATRIX_SIZE;
            break;
          case 'down':
            srcX = x; srcY = y - offset;
            useNew = srcY < 0;
            if (useNew) srcY += MATRIX_SIZE;
            break;
        }

        const pixel = getPixel(useNew ? toPixels : fromPixels, srcX, srcY);
        const di = (y * MATRIX_SIZE + x) * 3;
        buf[di] = pixel.r; buf[di + 1] = pixel.g; buf[di + 2] = pixel.b;
      }
    }
    drawBuffer(buf);
    matrixSync();
    await sleep(frameDelay);
  }
}

export async function dissolve(fromPixels, toPixels, duration) {
  if (!getMatrix()) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const totalPixels = MATRIX_SIZE * MATRIX_SIZE;
  const buf = getRgbBuffer();

  const indices = Array.from({ length: totalPixels }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const revealed = new Uint8Array(totalPixels);
  let revealedCount = 0;

  for (let frame = 0; frame <= frames; frame++) {
    const pixelsToReveal = Math.floor((frame / frames) * totalPixels);

    while (revealedCount < pixelsToReveal && revealedCount < totalPixels) {
      revealed[indices[revealedCount]] = 1;
      revealedCount++;
    }

    for (let i = 0; i < totalPixels; i++) {
      const x = i % MATRIX_SIZE;
      const y = (i - x) / MATRIX_SIZE;
      const pixel = getPixel(revealed[i] ? toPixels : fromPixels, x, y);
      const di = i * 3;
      buf[di] = pixel.r; buf[di + 1] = pixel.g; buf[di + 2] = pixel.b;
    }
    drawBuffer(buf);
    matrixSync();
    await sleep(frameDelay);
  }
}

// ==================== OVERLAY TRANSITIONS ====================

// Wipe: line sweeps across revealing new image
export async function wipe(fromPixels, toPixels, duration, direction) {
  if (!getMatrix()) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const buf = getRgbBuffer();

  for (let frame = 0; frame <= frames; frame++) {
    const progress = frame / frames;
    const edge = Math.round(progress * MATRIX_SIZE);

    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        let useNew;
        switch (direction) {
          case 'right': useNew = x < edge; break;
          case 'left': useNew = x >= MATRIX_SIZE - edge; break;
          case 'down': useNew = y < edge; break;
          case 'up': useNew = y >= MATRIX_SIZE - edge; break;
        }
        const pixel = getPixel(useNew ? toPixels : fromPixels, x, y);
        const di = (y * MATRIX_SIZE + x) * 3;
        buf[di] = pixel.r; buf[di + 1] = pixel.g; buf[di + 2] = pixel.b;
      }
    }
    drawBuffer(buf);
    matrixSync();
    await sleep(frameDelay);
  }
}

// Blinds: horizontal or vertical bars reveal new image
export async function blinds(fromPixels, toPixels, duration, horizontal = true) {
  if (!getMatrix()) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const numBlinds = 8;
  const blindSize = MATRIX_SIZE / numBlinds;
  const buf = getRgbBuffer();

  for (let frame = 0; frame <= frames; frame++) {
    const progress = frame / frames;
    const revealAmount = Math.round(progress * blindSize);

    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const pos = horizontal ? y : x;
        const posInBlind = pos % blindSize;
        const useNew = posInBlind < revealAmount;
        const pixel = getPixel(useNew ? toPixels : fromPixels, x, y);
        const di = (y * MATRIX_SIZE + x) * 3;
        buf[di] = pixel.r; buf[di + 1] = pixel.g; buf[di + 2] = pixel.b;
      }
    }
    drawBuffer(buf);
    matrixSync();
    await sleep(frameDelay);
  }
}

// Circle: new image expands from center
export async function circle(fromPixels, toPixels, duration) {
  if (!getMatrix()) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const buf = getRgbBuffer();

  for (let frame = 0; frame <= frames; frame++) {
    const radius = (frame / frames) * maxCircleRadius;

    for (let i = 0; i < MATRIX_SIZE * MATRIX_SIZE; i++) {
      const x = i % MATRIX_SIZE;
      const y = (i - x) / MATRIX_SIZE;
      const useNew = circleDistMap[i] <= radius;
      const pixel = getPixel(useNew ? toPixels : fromPixels, x, y);
      const di = i * 3;
      buf[di] = pixel.r; buf[di + 1] = pixel.g; buf[di + 2] = pixel.b;
    }
    drawBuffer(buf);
    matrixSync();
    await sleep(frameDelay);
  }
}

// Diamond: new image expands from center in diamond shape
export async function diamond(fromPixels, toPixels, duration) {
  if (!getMatrix()) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const buf = getRgbBuffer();

  for (let frame = 0; frame <= frames; frame++) {
    const threshold = (frame / frames) * maxDiamondDist;

    for (let i = 0; i < MATRIX_SIZE * MATRIX_SIZE; i++) {
      const x = i % MATRIX_SIZE;
      const y = (i - x) / MATRIX_SIZE;
      const useNew = diamondDistMap[i] <= threshold;
      const pixel = getPixel(useNew ? toPixels : fromPixels, x, y);
      const di = i * 3;
      buf[di] = pixel.r; buf[di + 1] = pixel.g; buf[di + 2] = pixel.b;
    }
    drawBuffer(buf);
    matrixSync();
    await sleep(frameDelay);
  }
}

// Spiral: reveals in a spiral pattern from center
export async function spiral(fromPixels, toPixels, duration) {
  if (!getMatrix()) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const totalPixels = MATRIX_SIZE * MATRIX_SIZE;
  const buf = getRgbBuffer();

  const revealed = new Uint8Array(totalPixels);
  let revealedCount = 0;

  for (let frame = 0; frame <= frames; frame++) {
    const pixelsToReveal = Math.floor((frame / frames) * totalPixels);

    while (revealedCount < pixelsToReveal && revealedCount < totalPixels) {
      const { x, y } = spiralOrder[revealedCount];
      revealed[y * MATRIX_SIZE + x] = 1;
      revealedCount++;
    }

    for (let i = 0; i < totalPixels; i++) {
      const x = i % MATRIX_SIZE;
      const y = (i - x) / MATRIX_SIZE;
      const pixel = getPixel(revealed[i] ? toPixels : fromPixels, x, y);
      const di = i * 3;
      buf[di] = pixel.r; buf[di + 1] = pixel.g; buf[di + 2] = pixel.b;
    }
    drawBuffer(buf);
    matrixSync();
    await sleep(frameDelay);
  }
}

// Checkerboard: reveals in a checkerboard pattern
export async function checkerboard(fromPixels, toPixels, duration) {
  if (!getMatrix()) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const tileSize = 8;
  const buf = getRgbBuffer();

  for (let frame = 0; frame <= frames; frame++) {
    const progress = frame / frames;

    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const tileX = Math.floor(x / tileSize);
        const tileY = Math.floor(y / tileSize);
        const isEvenTile = (tileX + tileY) % 2 === 0;

        const tileProgress = isEvenTile ? progress * 2 : (progress - 0.5) * 2;
        const useNew = tileProgress >= 1;

        const pixel = getPixel(useNew ? toPixels : fromPixels, x, y);
        const di = (y * MATRIX_SIZE + x) * 3;
        buf[di] = pixel.r; buf[di + 1] = pixel.g; buf[di + 2] = pixel.b;
      }
    }
    drawBuffer(buf);
    matrixSync();
    await sleep(frameDelay);
  }
}

// ==================== FADE OUT ====================

export async function fadeOut(fromPixels, duration) {
  if (!getMatrix() || !fromPixels) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const buf = getRgbBuffer();

  for (let frame = frames; frame >= 0; frame--) {
    const t = frame / frames;

    for (let i = 0; i < MATRIX_SIZE * MATRIX_SIZE; i++) {
      const x = i % MATRIX_SIZE;
      const y = (i - x) / MATRIX_SIZE;
      const pixel = getPixel(fromPixels, x, y);
      const di = i * 3;
      buf[di] = Math.round(pixel.r * t);
      buf[di + 1] = Math.round(pixel.g * t);
      buf[di + 2] = Math.round(pixel.b * t);
    }
    drawBuffer(buf);
    matrixSync();
    await sleep(frameDelay);
  }
}

// ==================== MAIN TRANSITION DISPATCHER ====================

const allTypes = Object.values(TransitionType).filter(t => t !== 'random');

export async function transition(fromPixels, toPixels, type, duration) {
  const matrix = getMatrix();
  if (!matrix) return;

  if (type === TransitionType.RANDOM) {
    type = allTypes[Math.floor(Math.random() * allTypes.length)];
  }

  switch (type) {
    case TransitionType.CROSSFADE:
      await crossfade(fromPixels, toPixels, duration);
      break;
    case TransitionType.SLIDE_LEFT:
      await slide(fromPixels, toPixels, duration, 'left');
      break;
    case TransitionType.SLIDE_RIGHT:
      await slide(fromPixels, toPixels, duration, 'right');
      break;
    case TransitionType.SLIDE_UP:
      await slide(fromPixels, toPixels, duration, 'up');
      break;
    case TransitionType.SLIDE_DOWN:
      await slide(fromPixels, toPixels, duration, 'down');
      break;
    case TransitionType.DISSOLVE:
      await dissolve(fromPixels, toPixels, duration);
      break;
    // Overlay transitions
    case TransitionType.WIPE_RIGHT:
      await wipe(fromPixels, toPixels, duration, 'right');
      break;
    case TransitionType.WIPE_LEFT:
      await wipe(fromPixels, toPixels, duration, 'left');
      break;
    case TransitionType.WIPE_DOWN:
      await wipe(fromPixels, toPixels, duration, 'down');
      break;
    case TransitionType.WIPE_UP:
      await wipe(fromPixels, toPixels, duration, 'up');
      break;
    case TransitionType.BLINDS_H:
      await blinds(fromPixels, toPixels, duration, true);
      break;
    case TransitionType.BLINDS_V:
      await blinds(fromPixels, toPixels, duration, false);
      break;
    case TransitionType.CIRCLE:
      await circle(fromPixels, toPixels, duration);
      break;
    case TransitionType.DIAMOND:
      await diamond(fromPixels, toPixels, duration);
      break;
    case TransitionType.SPIRAL:
      await spiral(fromPixels, toPixels, duration);
      break;
    case TransitionType.CHECKERBOARD:
      await checkerboard(fromPixels, toPixels, duration);
      break;
    default:
      await crossfade(fromPixels, toPixels, duration);
  }
}
