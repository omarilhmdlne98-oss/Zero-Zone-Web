#!/usr/bin/env node
/**
 * Automated Playwright-compatible Headless Chromium Smoke & WebGL Verification Suite.
 * Serves client/dist, verifies zero console/GLSL errors, checks #game-canvas, #tactical-radar,
 * #hud-weather, tests [4] UAV Recon, [5] Artillery Strike, and [6] Time-of-Day cycle,
 * and saves /tmp/zerozone_playwright_verify.png.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const distDir = path.resolve('client/dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm'
};

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('Missing client/dist/index.html. Run `npm --prefix client run build` first.');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const cleanUrl = (req.url || '/').split('?')[0];
  const filePath = path.join(distDir, cleanUrl === '/' ? 'index.html' : cleanUrl);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const targetUrl = `http://127.0.0.1:${port}/`;

const chromeArgs = [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--window-size=1280,720',
  '--remote-debugging-port=0',
  targetUrl
];

const chrome = spawn('/usr/bin/chromium', chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

let wsUrl = null;
const stderrChunks = [];
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Timed out waiting for Chromium DevTools WS URL')), 10000);
  chrome.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderrChunks.push(text);
    const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (match) {
      wsUrl = match[1];
      clearTimeout(timeout);
      resolve();
    }
  });
  chrome.on('exit', (code) => {
    if (!wsUrl) {
      clearTimeout(timeout);
      reject(new Error(`Chromium exited early (${code}): ${stderrChunks.join('')}`));
    }
  });
});

// Connect to the page target via DevTools HTTP -> WebSocket
const listRes = await fetch(wsUrl.replace('ws://', 'http://').replace(/\/devtools\/browser\/.*/, '/json/list'));
const targets = await listRes.json();
const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
const pageWs = new WebSocket(pageTarget.webSocketDebuggerUrl);

await new Promise((resolve, reject) => {
  pageWs.addEventListener('open', resolve);
  pageWs.addEventListener('error', reject);
});

let nextId = 1;
const pending = new Map();
const runtimeErrors = [];

pageWs.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    runtimeErrors.push(msg.params?.exceptionDetails?.text || 'Uncaught exception');
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
    const args = (msg.params.args || []).map((a) => a.value || a.description || '').join(' ');
    if (!args.includes('ERR_NAME_NOT_RESOLVED') && !args.includes('Failed to fetch')) {
      runtimeErrors.push(args);
    }
  }
});

function cdp(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    pageWs.send(JSON.stringify({ id, method, params }));
  });
}

await cdp('Runtime.enable');
await cdp('Page.enable');
await cdp('Input.setIgnoreInputEvents', { ignore: false });

// Wait for WebGL scene, Rapier3D physics, and active match loop (#hud-timer ticks below 05:00)
const evalJS = async (expression) => {
  const res = await cdp('Runtime.evaluate', { expression, returnByValue: true });
  return res.result?.value;
};

for (let attempt = 0; attempt < 30; attempt++) {
  const timerTxt = await evalJS(`document.getElementById('hud-timer')?.textContent?.trim() || '05:00'`);
  if (timerTxt && timerTxt !== '05:00') break;
  await new Promise((r) => setTimeout(r, 250));
}

const initialCheck = await evalJS(`(() => {
  const canvas = document.getElementById('game-canvas');
  const radar = document.getElementById('tactical-radar');
  const weather = document.getElementById('hud-weather');
  const errBanner = document.getElementById('arena-error');
  return {
    hasCanvas: Boolean(canvas && canvas.width > 0 && canvas.height > 0),
    hasRadar: Boolean(radar && radar.getBoundingClientRect().width > 50),
    weatherText: weather ? weather.textContent.trim() : '',
    errBanner: errBanner && errBanner.style.display !== 'none' ? errBanner.textContent : ''
  };
})()`);

if (!initialCheck?.hasCanvas) throw new Error('WebGL #game-canvas missing or zero-sized');
if (!initialCheck?.hasRadar) throw new Error('Tactical Minimap #tactical-radar missing');
if (!initialCheck?.weatherText) throw new Error('#hud-weather missing');
if (initialCheck?.errBanner) throw new Error(`Visible #arena-error: ${initialCheck.errBanner}`);

// Trigger [4] UAV Recon, [5] Artillery Strike, and [6] Time-of-Day Cycle (LIVE -> DAWN)
for (const [key, code] of [
  ['4', 'Digit4'],
  ['5', 'Digit5'],
  ['6', 'Digit6']
]) {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: key.charCodeAt(0) });
  await new Promise((r) => setTimeout(r, 150));
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: key.charCodeAt(0) });
  await new Promise((r) => setTimeout(r, 220));
}

const afterKeys = await evalJS(`(() => ({
  weatherAfter6: document.getElementById('hud-weather')?.textContent?.trim() || '',
  uavText: document.getElementById('ks-uav')?.textContent?.trim() || '',
  artyText: document.getElementById('ks-arty')?.textContent?.trim() || ''
}))()`);

if (!afterKeys.weatherAfter6.startsWith('DAWN //')) {
  throw new Error(`Expected [6] to cycle weather to DAWN, got: ${afterKeys.weatherAfter6}`);
}
if (!afterKeys.uavText.includes('UAV') || afterKeys.uavText.includes('Ready')) {
  throw new Error(`Expected [4] UAV Recon to activate, got: ${afterKeys.uavText}`);
}
if (!afterKeys.artyText.includes('Arty (')) {
  throw new Error(`Expected [5] Artillery Strike to enter cooldown, got: ${afterKeys.artyText}`);
}

const shot = await cdp('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('/tmp/zerozone_playwright_verify.png', Buffer.from(shot.data, 'base64'));

pageWs.close();
chrome.kill('SIGTERM');
server.close();

if (runtimeErrors.length > 0) {
  console.error('Runtime/Console Errors:', runtimeErrors);
  process.exit(1);
}

console.log('PLAYWRIGHT SMOKE PASS:', JSON.stringify({ initialCheck, afterKeys, screenshot: '/tmp/zerozone_playwright_verify.png' }));
