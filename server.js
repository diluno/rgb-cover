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

// Embedded HTML fallback
const embeddedHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RGB Cover</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0a0f;
      --bg-secondary: #12121a;
      --bg-tertiary: #1a1a24;
      --accent: #7c3aed;
      --accent-glow: rgba(124, 58, 237, 0.4);
      --text-primary: #f0f0f5;
      --text-secondary: #8888a0;
      --text-muted: #555566;
      --border: #2a2a3a;
      --success: #22c55e;
      --error: #ef4444;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Outfit', -apple-system, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      background-image: 
        radial-gradient(ellipse at top, rgba(124, 58, 237, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at bottom right, rgba(59, 130, 246, 0.05) 0%, transparent 50%);
    }
    .container { max-width: 480px; margin: 0 auto; padding: 24px 20px; }
    header { text-align: center; margin-bottom: 32px; }
    h1 { font-size: 1.5rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 4px; }
    .subtitle { color: var(--text-secondary); font-size: 0.875rem; }
    .status-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 12px; background: var(--bg-secondary);
      border: 1px solid var(--border); border-radius: 20px;
      font-size: 0.75rem; font-family: 'JetBrains Mono', monospace; margin-top: 12px;
    }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); }
    .status-dot.playing { background: var(--success); box-shadow: 0 0 8px var(--success); animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .cover-section { margin-bottom: 32px; }
    .cover-container {
      position: relative; aspect-ratio: 1; background: var(--bg-secondary);
      border-radius: 16px; overflow: hidden; border: 1px solid var(--border);
    }
    .cover-image { width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; transition: opacity 0.3s ease; }
    .cover-placeholder {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; color: var(--text-muted);
    }
    .cover-placeholder svg { width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5; }
    .now-playing {
      margin-top: 16px; padding: 12px 16px; background: var(--bg-secondary);
      border: 1px solid var(--border); border-radius: 12px;
    }
    .now-playing-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .now-playing-entity { font-family: 'JetBrains Mono', monospace; font-size: 0.875rem; color: var(--text-secondary); }
    .card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
    .card-title { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
    .control-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .control-row:last-child { margin-bottom: 0; }
    .control-label { font-size: 0.9rem; color: var(--text-primary); }
    .control-value { font-family: 'JetBrains Mono', monospace; font-size: 0.875rem; color: var(--accent); min-width: 48px; text-align: right; }
    input[type="range"] {
      -webkit-appearance: none; appearance: none; width: 100%; height: 6px;
      background: var(--bg-tertiary); border-radius: 3px; outline: none; margin-top: 8px;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none; width: 18px; height: 18px;
      background: var(--accent); border-radius: 50%; cursor: pointer;
      box-shadow: 0 0 12px var(--accent-glow); transition: transform 0.15s ease;
    }
    input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.1); }
    select {
      background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 8px;
      color: var(--text-primary); font-family: 'Outfit', sans-serif; font-size: 0.875rem;
      padding: 8px 12px; cursor: pointer; outline: none; transition: border-color 0.15s ease;
    }
    select:hover, select:focus { border-color: var(--accent); }
    .button-row { display: flex; gap: 12px; }
    button {
      flex: 1; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 10px;
      color: var(--text-primary); font-family: 'Outfit', sans-serif; font-size: 0.875rem;
      font-weight: 500; padding: 12px 16px; cursor: pointer; transition: all 0.15s ease;
    }
    button:hover { background: var(--border); border-color: var(--text-muted); }
    button.primary { background: var(--accent); border-color: var(--accent); }
    button.primary:hover { background: #8b5cf6; border-color: #8b5cf6; }
    .toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(100px);
      background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px;
      padding: 12px 20px; font-size: 0.875rem; opacity: 0; transition: all 0.3s ease; z-index: 100;
    }
    .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
    .toast.success { border-color: var(--success); }
    @media (max-width: 400px) { .container { padding: 16px; } }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>RGB Cover</h1>
      <p class="subtitle">64×64 LED Matrix Controller</p>
      <div class="status-badge">
        <span class="status-dot" id="statusDot"></span>
        <span id="statusText">Connecting...</span>
      </div>
    </header>
    <section class="cover-section">
      <div class="cover-container">
        <img class="cover-image" id="coverImage" src="" alt="Album Cover" style="display: none;">
        <div class="cover-placeholder" id="coverPlaceholder">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <span>Nothing playing</span>
        </div>
      </div>
      <div class="now-playing">
        <div class="now-playing-label">Source</div>
        <div class="now-playing-entity" id="entityName">—</div>
      </div>
    </section>
    <div class="card">
      <div class="card-title">Display</div>
      <div class="control-row">
        <span class="control-label">Brightness</span>
        <span class="control-value" id="brightnessValue">85%</span>
      </div>
      <input type="range" id="brightness" min="0" max="100" value="85">
    </div>
    <div class="card">
      <div class="card-title">Transitions</div>
      <div class="control-row">
        <span class="control-label">Effect</span>
        <select id="transition">
          <option value="crossfade">Crossfade</option>
          <option value="slideLeft">Slide Left</option>
          <option value="slideRight">Slide Right</option>
          <option value="slideUp">Slide Up</option>
          <option value="slideDown">Slide Down</option>
          <option value="dissolve">Dissolve</option>
        </select>
      </div>
      <div class="control-row" style="margin-top: 16px;">
        <span class="control-label">Duration</span>
        <span class="control-value" id="durationValue">500ms</span>
      </div>
      <input type="range" id="duration" min="100" max="2000" step="100" value="500">
    </div>
    <div class="card">
      <div class="card-title">Actions</div>
      <div class="button-row">
        <button id="refreshBtn">Refresh</button>
        <button id="saveBtn" class="primary">Save Settings</button>
      </div>
    </div>
  </div>
  <div class="toast" id="toast"></div>
  <script>
    const API_BASE = '';
    let currentState = {};
    let hasUnsavedChanges = false;
    let lastCoverUrl = null;
    
    const coverImage = document.getElementById('coverImage');
    const coverPlaceholder = document.getElementById('coverPlaceholder');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const entityName = document.getElementById('entityName');
    const brightnessSlider = document.getElementById('brightness');
    const brightnessValue = document.getElementById('brightnessValue');
    const transitionSelect = document.getElementById('transition');
    const durationSlider = document.getElementById('duration');
    const durationValue = document.getElementById('durationValue');
    const refreshBtn = document.getElementById('refreshBtn');
    const saveBtn = document.getElementById('saveBtn');
    const toast = document.getElementById('toast');

    function showToast(message, type = 'default') {
      toast.textContent = message;
      toast.className = 'toast show ' + type;
      setTimeout(() => toast.className = 'toast', 2500);
    }

    function updateUI(state, updateSettings = true) {
      currentState = state;
      
      // Always update status
      if (state.isPlaying) {
        statusDot.classList.add('playing');
        statusText.textContent = 'Playing';
      } else {
        statusDot.classList.remove('playing');
        statusText.textContent = 'Idle';
      }
      
      // Only update cover if it changed
      if (state.currentCover !== lastCoverUrl) {
        lastCoverUrl = state.currentCover;
        if (state.currentCover) {
          coverImage.src = '/cover.jpg?t=' + Date.now();
          coverImage.style.display = 'block';
          coverPlaceholder.style.display = 'none';
        } else {
          coverImage.style.display = 'none';
          coverPlaceholder.style.display = 'flex';
        }
      }
      
      entityName.textContent = state.currentEntity || '—';
      
      // Only update settings if no unsaved changes
      if (updateSettings && !hasUnsavedChanges) {
        brightnessSlider.value = state.brightness;
        brightnessValue.textContent = state.brightness + '%';
        transitionSelect.value = state.transition;
        durationSlider.value = state.transitionDuration;
        durationValue.textContent = state.transitionDuration + 'ms';
      }
    }

    async function fetchStatus() {
      try {
        const res = await fetch(API_BASE + '/api/status');
        const state = await res.json();
        updateUI(state, false); // Don't update settings during polling
      } catch (err) {
        statusText.textContent = 'Disconnected';
        statusDot.classList.remove('playing');
      }
    }

    async function saveSettings() {
      try {
        const res = await fetch(API_BASE + '/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brightness: parseInt(brightnessSlider.value),
            transition: transitionSelect.value,
            transitionDuration: parseInt(durationSlider.value),
          }),
        });
        const data = await res.json();
        if (data.success) {
          hasUnsavedChanges = false;
          showToast('Settings saved', 'success');
          updateUI(data.state, true);
        }
      } catch (err) {
        showToast('Failed to save settings', 'error');
      }
    }

    async function refresh() {
      try {
        await fetch(API_BASE + '/api/refresh', { method: 'POST' });
        showToast('Refreshing...');
        setTimeout(fetchStatus, 500);
      } catch (err) {
        showToast('Failed to refresh', 'error');
      }
    }

    function markDirty() {
      hasUnsavedChanges = true;
    }

    brightnessSlider.addEventListener('input', () => { 
      brightnessValue.textContent = brightnessSlider.value + '%';
      markDirty();
    });
    durationSlider.addEventListener('input', () => { 
      durationValue.textContent = durationSlider.value + 'ms';
      markDirty();
    });
    transitionSelect.addEventListener('change', markDirty);
    saveBtn.addEventListener('click', saveSettings);
    refreshBtn.addEventListener('click', refresh);
    
    // Initial fetch with settings update
    (async () => {
      try {
        const res = await fetch(API_BASE + '/api/status');
        const state = await res.json();
        updateUI(state, true);
      } catch (err) {
        statusText.textContent = 'Disconnected';
      }
    })();
    
    // Polling without settings update
    setInterval(fetchStatus, 3000);
  </script>
</body>
</html>`;

async function serveStaticFile(res, filePath, contentType) {
  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    console.error(`Failed to read ${filePath}:`, err.message);
    // Fallback to embedded HTML
    if (contentType === 'text/html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(embeddedHTML);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
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
      const htmlPath = path.join(__dirname, 'web', 'index.html');
      await serveStaticFile(res, htmlPath, 'text/html');
      return;
    }

    // 404 for everything else
    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Web interface available at http://localhost:${port}`);
  });

  return server;
}
