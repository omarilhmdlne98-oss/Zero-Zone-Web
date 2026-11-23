#!/usr/bin/env node
/\*\*

- Headless Chromium smoke test for the Zero-Zone extraction prototype.
- Build first with `npm --prefix client run build`.
 \*/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child\_process';

const distDir = path.resolve('client/dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm' };
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('Missing client/dist/index.html. Run `npm --prefix client run build` first.');
  process.exit(1);
}
const server = http.createServer((req, res) =&gt; {
  const clean = (req.url || '/').split('?')\[0\];
  const file = path.join(distDir, clean === '/' ? 'index.html' : clean);
  if (fs.existsSync(file) &amp;&amp; fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': mime\[path.extname(file)\] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } else { res.writeHead(404); res.end(); }
});
await new Promise((resolve) =&gt; server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const chrome = spawn('/usr/bin/chromium', \[
  '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,720', '--remote-debugging-port=0', url
\], { stdio: \['ignore', 'pipe', 'pipe'\] });
let wsUrl = '';
let stderr = '';
let pageWs;
try {
  await new Promise((resolve, reject) =&gt; {
    const timeout = setTimeout(() =&gt; reject(new Error('Timed out waiting for Chromium DevTools endpoint')), 12000);
    chrome.stderr.on('data', (chunk) =&gt; {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws://\[^\\s\]+)/);
      if (match) { wsUrl = match\[1\]; clearTimeout(timeout); resolve(); }
    });
    chrome.on('exit', (code) =&gt; { if (!wsUrl) { clearTimeout(timeout); reject(new Error(`Chromium exited (${code}): ${stderr}`)); } });
  });
  const listUrl = wsUrl.replace('ws://', 'http://').replace(//devtools/browser/.\*/, '/json/list');
  const targets = await (await fetch(listUrl)).json();
  const page = targets.find((t) =&gt; t.type === 'page') || targets\[0\];
  pageWs = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) =&gt; { pageWs.addEventListener('open', resolve); pageWs.addEventListener('error', reject); });
  let nextId = 1;
  const pending = new Map();
  const errors = \[\];
  pageWs.addEventListener('message', (event) =&gt; {
    const msg = JSON.parse(event.data);
    if (msg.id &amp;&amp; pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params?.exceptionDetails?.text || 'Uncaught exception');
    } else if (msg.method === 'Runtime.consoleAPICalled' &amp;&amp; msg.params?.type === 'error') {
      const text = (msg.params.args || \[\]).map((a) =&gt; a.value || a.description || '').join(' ');
      if (!/ERR\_NAME\_NOT\_RESOLVED|Failed to fetch/.test(text)) errors.push(text);
    }
  });
  const cdp = (method, params = {}) =&gt; new Promise((resolve, reject) =&gt; {
    const id = nextId++; pending.set(id, { resolve, reject }); pageWs.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) =&gt; {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Page evaluation failed');
    return result.result?.value;
  };
  await cdp('Runtime.enable'); await cdp('Page.enable');
  const waitFor = async (expression, label, timeoutMs = 12000) =&gt; {
    const start = Date.now();
    while (Date.now() - start &lt; timeoutMs) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) =&gt; setTimeout(resolve, 200));
    }
    throw new Error(`Timed out waiting for ${label}`);
  };

  await waitFor(`(() => {     const canvas = document.getElementById('game-canvas');     const base = document.getElementById('base-screen');     return Boolean(canvas && canvas.width > 0 && canvas.height > 0 && base && !base.hidden && document.getElementById('deploy-btn'));   })()`, 'operations hub and WebGL canvas');
  const initial = await evaluate(`(() => ({     canvas: !!document.getElementById('game-canvas'),     radar: !!document.getElementById('tactical-radar'),     weather: document.getElementById('hud-weather')?.textContent.trim() || '',     error: document.getElementById('arena-error')?.hidden === false ? document.getElementById('arena-error').textContent : ''   }))()`);
  if (!initial.canvas || !initial.radar || !initial.weather) throw new Error(`Missing core UI: ${JSON.stringify(initial)}`);
  if (initial.error) throw new Error(`WebGL error banner: ${initial.error}`);

  await evaluate(`document.getElementById('deploy-btn').click()`);
  await waitFor(`document.getElementById('raid-hud')?.hidden === false`, 'deployment HUD');
  await waitFor(`document.getElementById('hud-timer')?.textContent?.trim() !== '06:00'`, 'live raid timer', 4000);
  const raid = await evaluate(`(() => ({     hudVisible: document.getElementById('raid-hud')?.hidden === false,     radarVisible: document.getElementById('tactical-radar')?.getBoundingClientRect().width > 50,     objective: document.getElementById('objective-status')?.textContent.trim() || '',     timer: document.getElementById('hud-timer')?.textContent.trim() || '',     physics: document.getElementById('physics-status')?.textContent.trim() || ''   }))()`);
  if (!raid.hudVisible || !raid.radarVisible || !raid.objective || !raid.timer) throw new Error(`Deployment UI failed: ${JSON.stringify(raid)}`);

  for (const \[key, code\] of \[\['4', 'Digit4'\], \['5', 'Digit5'\], \['6', 'Digit6'\]\]) {
    const vk = key.charCodeAt(0);
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
    await new Promise((resolve) =&gt; setTimeout(resolve, 160));
  }
  const actions = await evaluate(`(() => ({     weather: document.getElementById('hud-weather')?.textContent.trim() || '',     uav: document.getElementById('ks-uav')?.textContent.trim() || '',     support: document.getElementById('ks-arty')?.textContent.trim() || ''   }))()`);
  if (!actions.weather.startsWith('DAWN //')) throw new Error(`Key 6 did not advance weather: ${actions.weather}`);
  if (!actions.uav.includes('UAV') || actions.uav.includes('READY')) throw new Error(`Key 4 did not activate UAV: ${actions.uav}`);
  if (!actions.support.includes('Arty (')) throw new Error(`Key 5 did not activate support cooldown: ${actions.support}`);
  if (errors.length) throw new Error(`Browser console/runtime errors: ${errors.join(' | ')}`);
  const shot = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/tmp/zerozone\_playwright\_verify.png', Buffer.from(shot.data, 'base64'));
  console.log('ZERO-ZONE EXTRACTION SMOKE PASS:', JSON.stringify({ initial, raid, actions, screenshot: '/tmp/zerozone\_playwright\_verify.png' }));
} finally {
  pageWs?.close();
  chrome.kill('SIGTERM');
  server.close();
}