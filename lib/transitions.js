import { getMatrix, MATRIX_SIZE, sleep } from './matrix.js';

const TRANSITION_FPS = 30;

export const TransitionType = {
  CROSSFADE: 'crossfade',
  SLIDE_LEFT: 'slideLeft',
  SLIDE_RIGHT: 'slideRight',
  SLIDE_UP: 'slideUp',
  SLIDE_DOWN: 'slideDown',
  DISSOLVE: 'dissolve',
};

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

export async function crossfade(fromPixels, toPixels, duration) {
  const matrix = getMatrix();
  if (!matrix) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;

  for (let frame = 0; frame <= frames; frame++) {
    const t = frame / frames;
    
    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const i = (y * MATRIX_SIZE + x) * 4;
        
        const fromR = fromPixels ? fromPixels.data[i] : 0;
        const fromG = fromPixels ? fromPixels.data[i + 1] : 0;
        const fromB = fromPixels ? fromPixels.data[i + 2] : 0;
        
        const toR = toPixels.data[i];
        const toG = toPixels.data[i + 1];
        const toB = toPixels.data[i + 2];
        
        const r = lerp(fromR, toR, t);
        const g = lerp(fromG, toG, t);
        const b = lerp(fromB, toB, t);
        
        matrix.fgColor({ r, g, b }).setPixel(x, y);
      }
    }
    matrix.sync();
    await sleep(frameDelay);
  }
}

export async function slide(fromPixels, toPixels, duration, direction) {
  const matrix = getMatrix();
  if (!matrix) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;

  for (let frame = 0; frame <= frames; frame++) {
    const progress = frame / frames;
    const offset = Math.round(progress * MATRIX_SIZE);

    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        let srcX, srcY, useNew;

        switch (direction) {
          case 'left':
            srcX = x + offset;
            srcY = y;
            useNew = srcX >= MATRIX_SIZE;
            if (useNew) srcX -= MATRIX_SIZE;
            break;
          case 'right':
            srcX = x - offset;
            srcY = y;
            useNew = srcX < 0;
            if (useNew) srcX += MATRIX_SIZE;
            break;
          case 'up':
            srcX = x;
            srcY = y + offset;
            useNew = srcY >= MATRIX_SIZE;
            if (useNew) srcY -= MATRIX_SIZE;
            break;
          case 'down':
            srcX = x;
            srcY = y - offset;
            useNew = srcY < 0;
            if (useNew) srcY += MATRIX_SIZE;
            break;
        }

        const pixels = useNew ? toPixels : (fromPixels || toPixels);
        const i = (srcY * MATRIX_SIZE + srcX) * 4;
        const r = pixels.data[i] || 0;
        const g = pixels.data[i + 1] || 0;
        const b = pixels.data[i + 2] || 0;

        matrix.fgColor({ r, g, b }).setPixel(x, y);
      }
    }
    matrix.sync();
    await sleep(frameDelay);
  }
}

export async function dissolve(fromPixels, toPixels, duration) {
  const matrix = getMatrix();
  if (!matrix) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const totalPixels = MATRIX_SIZE * MATRIX_SIZE;
  
  // Create shuffled pixel indices
  const indices = Array.from({ length: totalPixels }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const revealed = new Set();

  for (let frame = 0; frame <= frames; frame++) {
    const pixelsToReveal = Math.floor((frame / frames) * totalPixels);
    
    while (revealed.size < pixelsToReveal && revealed.size < totalPixels) {
      revealed.add(indices[revealed.size]);
    }

    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const pixelIndex = y * MATRIX_SIZE + x;
        const i = pixelIndex * 4;
        
        const useNew = revealed.has(pixelIndex);
        const pixels = useNew ? toPixels : (fromPixels || toPixels);
        
        const r = pixels.data[i] || 0;
        const g = pixels.data[i + 1] || 0;
        const b = pixels.data[i + 2] || 0;

        matrix.fgColor({ r, g, b }).setPixel(x, y);
      }
    }
    matrix.sync();
    await sleep(frameDelay);
  }
}

export async function fadeOut(fromPixels, duration) {
  const matrix = getMatrix();
  if (!matrix || !fromPixels) return;
  
  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;

  for (let frame = frames; frame >= 0; frame--) {
    const t = frame / frames;
    
    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const i = (y * MATRIX_SIZE + x) * 4;
        const r = Math.round(fromPixels.data[i] * t);
        const g = Math.round(fromPixels.data[i + 1] * t);
        const b = Math.round(fromPixels.data[i + 2] * t);
        matrix.fgColor({ r, g, b }).setPixel(x, y);
      }
    }
    matrix.sync();
    await sleep(frameDelay);
  }
}

export async function transition(fromPixels, toPixels, type, duration) {
  const matrix = getMatrix();
  if (!matrix) return;

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
    default:
      await crossfade(fromPixels, toPixels, duration);
  }
}

