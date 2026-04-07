import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

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
  wledColors: 5,
  entities: [],
  idleMode: 'clock',
  clockColor: { r: 120, g: 80, b: 200 },
  clockVisible: false,
  screensaverEffect: 'plasma',
  screensaverPalette: 'aurora',
  screensaverFps: 10,
  screensaverVisible: false,
};

let callbacks = {
  onBrightnessChange: null,
  onTransitionChange: null,
  onIdleModeChange: null,
  onWledColorsChange: null,
  onRefresh: null,
};

// Cached cover image
let cachedCover = { url: null, buffer: null };

// WebSocket clients
let wsClients = new Set();

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of wsClients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(msg);
    }
  }
}

export function updateState(newState) {
  const coverChanged = newState.currentCover !== undefined && newState.currentCover !== state.currentCover;
  state = { ...state, ...newState };

  // Cache cover image when it changes
  if (coverChanged && state.currentCover) {
    fetch(state.currentCover)
      .then(res => res.arrayBuffer())
      .then(buf => {
        cachedCover = { url: state.currentCover, buffer: Buffer.from(buf) };
      })
      .catch(() => {});
  } else if (coverChanged && !state.currentCover) {
    cachedCover = { url: null, buffer: null };
  }

  // Push state to all WebSocket clients
  broadcast({ type: 'state', state });
}

export function getState() {
  return state;
}

export function setCallbacks(cbs) {
  callbacks = { ...callbacks, ...cbs };
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
        if (settings.idleMode !== undefined) {
          state.idleMode = settings.idleMode;
        }
        if (settings.clockColor !== undefined) {
          state.clockColor = settings.clockColor;
        }
        if (settings.screensaverEffect !== undefined) {
          state.screensaverEffect = settings.screensaverEffect;
        }
        if (settings.screensaverPalette !== undefined) {
          state.screensaverPalette = settings.screensaverPalette;
        }
        if (settings.screensaverFps !== undefined) {
          state.screensaverFps = Math.max(5, Math.min(30, settings.screensaverFps));
        }
        // Fire callback if any idle-related setting changed
        if (settings.idleMode !== undefined || settings.clockColor !== undefined ||
            settings.screensaverEffect !== undefined || settings.screensaverPalette !== undefined || settings.screensaverFps !== undefined) {
          callbacks.onIdleModeChange?.(state.idleMode, {
            clockColor: state.clockColor,
            screensaverEffect: state.screensaverEffect,
            screensaverPalette: state.screensaverPalette,
            screensaverFps: state.screensaverFps,
          });
        }
        if (settings.wledColors !== undefined) {
          state.wledColors = Math.max(1, Math.min(10, settings.wledColors));
          callbacks.onWledColorsChange?.(state.wledColors);
        }

        broadcast({ type: 'state', state });
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

    // Serve cached cover image
    if (url.pathname === '/cover.jpg') {
      if (cachedCover.buffer) {
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'no-cache',
        });
        res.end(cachedCover.buffer);
      } else {
        res.writeHead(404);
        res.end();
      }
      return;
    }

    // Serve index.html for root
    if (url.pathname === '/' || url.pathname === '/index.html') {
      try {
        const content = await fs.readFile(path.join(__dirname, 'web', 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      } catch (err) {
        res.writeHead(500);
        res.end('Failed to load web interface');
      }
      return;
    }

    // 404 for everything else
    res.writeHead(404);
    res.end('Not found');
  });

  // WebSocket server
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    wsClients.add(ws);
    // Send current state on connect
    ws.send(JSON.stringify({ type: 'state', state }));
    ws.on('close', () => wsClients.delete(ws));
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Web interface available at http://localhost:${port}`);
  });

  return server;
}
