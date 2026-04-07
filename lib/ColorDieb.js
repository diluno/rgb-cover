import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let worker = null;
let pending = null;

function getWorker() {
  if (!worker) {
    worker = new Worker(path.join(__dirname, './worker.js'));
    worker.on('error', (err) => {
      console.error('ColorDieb worker error:', err.message);
      worker = null;
      if (pending) {
        pending.reject(err);
        pending = null;
      }
    });
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`ColorDieb worker exited with code ${code}`);
      }
      worker = null;
      if (pending) {
        pending.reject(new Error(`Worker exited with code ${code}`));
        pending = null;
      }
    });
    worker.on('message', (data) => {
      if (pending && data.type === 'GOT_COLORS_ARRAY') {
        pending.resolve(data.colors);
        pending = null;
      }
    });
  }
  return worker;
}

export function ColorDieb(imageData, width, colorsLength = 5) {
  return new Promise((resolve, reject) => {
    // If a previous extraction is still pending, replace it
    if (pending) {
      pending.reject(new Error('Superseded by new request'));
    }
    pending = { resolve, reject };

    getWorker().postMessage({
      type: 'GENERATE_COLORS_ARRAY',
      imageData,
      width,
      k: colorsLength,
    });
  });
}
