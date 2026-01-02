import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Shared state (will be set by index.js)
let state = {
  currentCover: null,
  currentEntity: null,
  isPlaying: false,
  brightness: 85,
  transition: 'crossfade',
  transitionDuration: 500,
  wledUrls: [],
  entities: [],
};

let callbacks = {
  onBrightnessChange: null,
  onTransitionChange: null,
  onRefresh: null,
};

export function updateState(newState) {
  state = { ...state, ...newState };
}

export function getState() {
  return state;
}

export function setCallbacks(cbs) {
  callbacks = { ...callbacks, ...cbs };
}

async function serveStaticFile(res, filePath, contentType) {
  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (url.pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state));
    return;
  }

  if (url.pathname === '/api/settings' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const settings = JSON.parse(body);
        
        if (settings.brightness !== undefined) {
          state.brightness = Math.max(0, Math.min(100, settings.brightness));
          callbacks.onBrightnessChange?.(state.brightness);
        }
        if (settings.transition !== undefined) {
          state.transition = settings.transition;
          callbacks.onTransitionChange?.(state.transition, state.transitionDuration);
        }
        if (settings.transitionDuration !== undefined) {
          state.transitionDuration = settings.transitionDuration;
          callbacks.onTransitionChange?.(state.transition, state.transitionDuration);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, state }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === '/api/refresh' && req.method === 'POST') {
    callbacks.onRefresh?.();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

export function startServer(port = 3000) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // API routes
    if (url.pathname.startsWith('/api/')) {
      handleApi(req, res);
      return;
    }

    // Proxy current cover image
    if (url.pathname === '/cover.jpg') {
      if (state.currentCover) {
        try {
          const response = await fetch(state.currentCover);
          const buffer = await response.arrayBuffer();
          res.writeHead(200, { 
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'no-cache'
          });
          res.end(Buffer.from(buffer));
        } catch {
          res.writeHead(404);
          res.end();
        }
      } else {
        res.writeHead(404);
        res.end();
      }
      return;
    }

    // Serve index.html for root
    if (url.pathname === '/' || url.pathname === '/index.html') {
      await serveStaticFile(res, path.join(__dirname, 'web', 'index.html'), 'text/html');
      return;
    }

    // 404 for everything else
    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, () => {
    console.log(`Web interface available at http://localhost:${port}`);
  });

  return server;
}

