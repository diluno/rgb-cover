import { getMatrix, MATRIX_SIZE, sleep, sync as matrixSync } from './matrix.js';

const TRANSITION_FPS = 30;

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
  const matrix = getMatrix();
  if (!matrix) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;

  for (let frame = 0; frame <= frames; frame++) {
    const t = frame / frames;
    
    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const from = getPixel(fromPixels, x, y);
        const to = getPixel(toPixels, x, y);
        
        matrix.fgColor({
          r: lerp(from.r, to.r, t),
          g: lerp(from.g, to.g, t),
          b: lerp(from.b, to.b, t),
        }).setPixel(x, y);
      }
    }
    matrixSync();
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

        const pixel = getPixel(useNew ? toPixels : fromPixels, srcX, srcY);
        matrix.fgColor(pixel).setPixel(x, y);
      }
    }
    matrixSync();
    await sleep(frameDelay);
  }
}

export async function dissolve(fromPixels, toPixels, duration) {
  const matrix = getMatrix();
  if (!matrix) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const totalPixels = MATRIX_SIZE * MATRIX_SIZE;
  
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
        const useNew = revealed.has(pixelIndex);
        const pixel = getPixel(useNew ? toPixels : fromPixels, x, y);
        matrix.fgColor(pixel).setPixel(x, y);
      }
    }
    matrixSync();
    await sleep(frameDelay);
  }
}

// ==================== OVERLAY TRANSITIONS ====================

// Wipe: line sweeps across revealing new image
export async function wipe(fromPixels, toPixels, duration, direction) {
  const matrix = getMatrix();
  if (!matrix) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;

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
        matrix.fgColor(pixel).setPixel(x, y);
      }
    }
    matrixSync();
    await sleep(frameDelay);
  }
}

// Blinds: horizontal or vertical bars reveal new image
export async function blinds(fromPixels, toPixels, duration, horizontal = true) {
  const matrix = getMatrix();
  if (!matrix) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const numBlinds = 8;
  const blindSize = MATRIX_SIZE / numBlinds;

  for (let frame = 0; frame <= frames; frame++) {
    const progress = frame / frames;
    const revealAmount = Math.round(progress * blindSize);

    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const pos = horizontal ? y : x;
        const posInBlind = pos % blindSize;
        const useNew = posInBlind < revealAmount;
        const pixel = getPixel(useNew ? toPixels : fromPixels, x, y);
        matrix.fgColor(pixel).setPixel(x, y);
      }
    }
    matrixSync();
    await sleep(frameDelay);
  }
}

// Circle: new image expands from center
export async function circle(fromPixels, toPixels, duration) {
  const matrix = getMatrix();
  if (!matrix) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const centerX = MATRIX_SIZE / 2;
  const centerY = MATRIX_SIZE / 2;
  const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);

  for (let frame = 0; frame <= frames; frame++) {
    const progress = frame / frames;
    const radius = progress * maxRadius;

    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const useNew = dist <= radius;
        const pixel = getPixel(useNew ? toPixels : fromPixels, x, y);
        matrix.fgColor(pixel).setPixel(x, y);
      }
    }
    matrixSync();
    await sleep(frameDelay);
  }
}

// Diamond: new image expands from center in diamond shape
export async function diamond(fromPixels, toPixels, duration) {
  const matrix = getMatrix();
  if (!matrix) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const centerX = MATRIX_SIZE / 2;
  const centerY = MATRIX_SIZE / 2;
  const maxDist = centerX + centerY;

  for (let frame = 0; frame <= frames; frame++) {
    const progress = frame / frames;
    const threshold = progress * maxDist;

    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const dist = Math.abs(x - centerX) + Math.abs(y - centerY);
        const useNew = dist <= threshold;
        const pixel = getPixel(useNew ? toPixels : fromPixels, x, y);
        matrix.fgColor(pixel).setPixel(x, y);
      }
    }
    matrixSync();
    await sleep(frameDelay);
  }
}

// Spiral: reveals in a spiral pattern from center
export async function spiral(fromPixels, toPixels, duration) {
  const matrix = getMatrix();
  if (!matrix) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const centerX = MATRIX_SIZE / 2;
  const centerY = MATRIX_SIZE / 2;

  // Pre-calculate spiral order
  const spiralOrder = [];
  for (let y = 0; y < MATRIX_SIZE; y++) {
    for (let x = 0; x < MATRIX_SIZE; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const angle = Math.atan2(dy, dx);
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Combine distance and angle to create spiral effect
      const spiralValue = dist + (angle + Math.PI) * 5;
      spiralOrder.push({ x, y, value: spiralValue });
    }
  }
  spiralOrder.sort((a, b) => a.value - b.value);

  const revealed = new Set();
  const totalPixels = MATRIX_SIZE * MATRIX_SIZE;

  for (let frame = 0; frame <= frames; frame++) {
    const pixelsToReveal = Math.floor((frame / frames) * totalPixels);
    
    while (revealed.size < pixelsToReveal && revealed.size < totalPixels) {
      const { x, y } = spiralOrder[revealed.size];
      revealed.add(y * MATRIX_SIZE + x);
    }

    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const useNew = revealed.has(y * MATRIX_SIZE + x);
        const pixel = getPixel(useNew ? toPixels : fromPixels, x, y);
        matrix.fgColor(pixel).setPixel(x, y);
      }
    }
    matrixSync();
    await sleep(frameDelay);
  }
}

// Checkerboard: reveals in a checkerboard pattern
export async function checkerboard(fromPixels, toPixels, duration) {
  const matrix = getMatrix();
  if (!matrix) return;

  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;
  const tileSize = 8;

  for (let frame = 0; frame <= frames; frame++) {
    const progress = frame / frames;

    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const tileX = Math.floor(x / tileSize);
        const tileY = Math.floor(y / tileSize);
        const isEvenTile = (tileX + tileY) % 2 === 0;
        
        // Even tiles reveal in first half, odd tiles in second half
        let useNew;
        if (isEvenTile) {
          useNew = progress >= 0 && progress * 2 >= 1 - (1 - progress * 2);
          useNew = progress > 0.5 ? true : progress * 2 > Math.random() * 0.5;
        } else {
          useNew = progress > 0.5 ? progress * 2 - 1 > Math.random() * 0.5 : false;
        }
        
        // Simpler approach: staggered reveal
        const tileProgress = isEvenTile ? progress * 2 : (progress - 0.5) * 2;
        useNew = tileProgress >= 1;
        
        const pixel = getPixel(useNew ? toPixels : fromPixels, x, y);
        matrix.fgColor(pixel).setPixel(x, y);
      }
    }
    matrixSync();
    await sleep(frameDelay);
  }
}

// ==================== FADE OUT ====================

export async function fadeOut(fromPixels, duration) {
  const matrix = getMatrix();
  if (!matrix || !fromPixels) return;
  
  const frames = Math.floor((duration / 1000) * TRANSITION_FPS);
  const frameDelay = duration / frames;

  for (let frame = frames; frame >= 0; frame--) {
    const t = frame / frames;
    
    for (let y = 0; y < MATRIX_SIZE; y++) {
      for (let x = 0; x < MATRIX_SIZE; x++) {
        const pixel = getPixel(fromPixels, x, y);
        matrix.fgColor({
          r: Math.round(pixel.r * t),
          g: Math.round(pixel.g * t),
          b: Math.round(pixel.b * t),
        }).setPixel(x, y);
      }
    }
    matrixSync();
    await sleep(frameDelay);
  }
}

// ==================== MAIN TRANSITION DISPATCHER ====================

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
