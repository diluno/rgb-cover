import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function ColorDieb(imageData, width, colorsLength = 5) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, './worker.js'));
    
    worker.on('message', (data) => {
      const { type } = data;
      
      if (type === 'GOT_COLORS_ARRAY') {
        const { colors } = data;
        worker.terminate();
        resolve(colors);
      } else if (type === 'ERROR') {
        worker.terminate();
        reject(new Error(data.error));
      }
    });

    worker.on('error', (error) => {
      worker.terminate();
      reject(error);
    });

    worker.postMessage({
      type: 'GENERATE_COLORS_ARRAY',
      imageData,
      width,
      k: colorsLength,
    });
  });
}