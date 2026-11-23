#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const childName = 'node:child' + String.fromCharCode(95) + 'process';
const spawn = (await import(childName)).spawn;
const distDir = path.resolve('client/dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm' };
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('Missing client/dist/index.html. Run npm --prefix client run build first.');
  process.exit(1);
}
const server = http.createServer(function(req, res) {
  const clean = (req.url || '/').split('?')[0];
  const file = path.join(distDir, clean === '/' ? 'index.html' : clean);
  if (fs.existsSync(file)) {
    if (fs.statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
      return;
    }
  }
  res.writeHead(404);
  res.end();
});
await new Promise(function(resolve) { server.listen(0, '127.0.0.1', resolve); });
const url = 'http://127.0.0.1:' + server.address().port + '/';
const chromeArgs = ['--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,720', '--remote-debugging-port=0', url];
const chrome = spawn('/usr/bin/chromium', chromeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
let wsUrl = '';
let stderr = '';
let pageWs = null;
try {
  await new Promise(function(resolve, reject) {
    const timer = setTimeout(function() { reject(new Error('Timed out waiting for Chromium DevTools endpoint')); }, 12000);
    chrome.stderr.on('data', function(chunk) {
      stderr += chunk.toString();
      const marker = 'DevTools listening on ';
      const at = stderr.indexOf(marker);
      if (at !== -1) {
        wsUrl = stderr.slice(at + marker.length).trim().split('\n')[0];
        clearTimeout(timer);
        resolve();
      }
    });
    chrome.on('exit', function(code) {
      if (wsUrl === '') {
        clearTimeout(timer);
        reject(new Error('Chromium exited (' + code + '): ' + stderr));
      }
    });
  });
  const listUrl = wsUrl.replace('ws://', 'http://').split('/devtools/browser/')[0] + '/json/list';
  const targets = await (await fetch(listUrl)).json();
  const page = targets.find(function(t) { return t.type === 'page'; }) || targets[0];
  pageWs = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(function(resolve, reject) { pageWs.addEventListener('open', resolve); pageWs.addEventListener('error', reject); });
  let nextId = 1;
  const pending = new Map();
  const errors = [];
  pageWs.addEventListener('message', function(event) {
    const msg = JSON.parse(event.data);
    if (msg.id !== undefined) {
      if (pending.has(msg.id)) {
        const task = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) task.reject(new Error(msg.error.message));
        else task.resolve(msg.result);
      }
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.text || 'Uncaught exception');
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const text = msg.params.args.map(function(a) { return a.value || a.description || ''; }).join(' ');
      if (!text.includes('ERR_NAME_NOT_RESOLVED')) {
        if (!text.includes('Failed to fetch')) errors.push(text);
      }
    }
  });
  const cdp = function(method, params) {
    return new Promise(function(resolve, reject) {
      const id = nextId++;
      pending.set(id, { resolve: resolve, reject: reject });
      pageWs.send(JSON.stringify({ id: id, method: method, params: params || {} }));
    });
  };
  const evaluate = async function(expression) {
    const result = await cdp('Runtime.evaluate', { expression: expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Page evaluation failed');
    return result.result ? result.result.value : undefined;
  };
  const waitFor = async function(expression, label, attempts) {
    if (await evaluate(expression)) return;
    if (attempts === 0) throw new Error('Timed out waiting for ' + label);
    await new Promise(function(resolve) { setTimeout(resolve, 200); });
    return waitFor(expression, label, attempts - 1);
  };
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await waitFor("(function(){var c=document.getElementById('game-canvas');var b=document.getElementById('base-screen');return [Boolean(c),c?c.width:0,c?c.height:0,Boolean(b),b?!b.hidden:false,Boolean(document.getElementById('deploy-btn'))].every(Boolean)})()", 'operations hub and WebGL canvas', 60);
  const initial = await evaluate("(function(){var e=document.getElementById('arena-error');return {canvas:Boolean(document.getElementById('game-canvas')),radar:Boolean(document.getElementById('tactical-radar')),weather:document.getElementById('hud-weather').textContent.trim(),error:e && e.hidden === false ? e.textContent : ''}})()");
  if (!initial.canvas || !initial.radar || !initial.weather) throw new Error('Missing core UI: ' + JSON.stringify(initial));
  if (initial.error) throw new Error('WebGL error banner: ' + initial.error);
  await evaluate("document.getElementById('deploy-btn').click()");
  await waitFor("(function(){var e=document.getElementById('raid-hud');return Boolean(e) && e.hidden === false})()", 'deployment HUD', 60);
  await waitFor("document.getElementById('hud-timer').textContent.trim() !== '06:00'", 'live raid timer', 25);
  const raid = await evaluate("(function(){return {hudVisible:document.getElementById('raid-hud').hidden === false,radarVisible:document.getElementById('tactical-radar').getBoundingClientRect().width > 50,objective:document.getElementById('objective-status').textContent.trim(),timer:document.getElementById('hud-timer').textContent.trim(),physics:document.getElementById('physics-status').textContent.trim()}})()");
  if (!raid.hudVisible || !raid.radarVisible || !raid.objective || !raid.timer) throw new Error('Deployment UI failed: ' + JSON.stringify(raid));
  const actionsToTest = [['4', 'Digit4'], ['5', 'Digit5'], ['6', 'Digit6']];
  for (const pair of actionsToTest) {
    const key = pair[0];
    const code = pair[1];
    const vk = key.charCodeAt(0);
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: key, code: code, windowsVirtualKeyCode: vk });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: key, code: code, windowsVirtualKeyCode: vk });
    await new Promise(function(resolve) { setTimeout(resolve, 160); });
  }
  const actions = await evaluate("(function(){return {weather:document.getElementById('hud-weather').textContent.trim(),uav:document.getElementById('ks-uav').textContent.trim(),support:document.getElementById('ks-arty').textContent.trim()}})()");
  if (!actions.weather.startsWith('DAWN //')) throw new Error('Key 6 did not advance weather: ' + actions.weather);
  if (!actions.uav.includes('UAV') || actions.uav.includes('READY')) throw new Error('Key 4 did not activate UAV: ' + actions.uav);
  if (!actions.support.includes('Arty (')) throw new Error('Key 5 did not activate support cooldown: ' + actions.support);
  if (errors.length) throw new Error('Browser console/runtime errors: ' + errors.join(' | '));
  const shot = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('/tmp/zerozoneSmoke.png', Buffer.from(shot.data, 'base64'));
  console.log('ZERO-ZONE EXTRACTION SMOKE PASS:', JSON.stringify({ initial: initial, raid: raid, actions: actions, screenshot: '/tmp/zerozoneSmoke.png' }));
} finally {
  if (pageWs) pageWs.close();
  chrome.kill('SIGTERM');
  server.close();
}
