import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { EffectComposer, EffectPass, RenderPass, BloomEffect, VignetteEffect } from 'postprocessing';
import { NetworkClient } from './network.js';

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const SAVE = 'zerozone.profile.v1';
const weapons = [
  { id: 'ar9', name: 'AR-9 CARBINE', type: 'ASSAULT RIFLE', damage: 27, mag: 30, reserve: 120, rate: .12, color: 0x7ce8ff },
  { id: 'dmr4', name: 'DMR-4 MARKSMAN', type: 'DESIGNATED MARKSMAN', damage: 58, mag: 8, reserve: 48, rate: .48, color: 0xb9a2ff },
  { id: 'c12', name: 'C-12 BREACHER', type: 'COMBAT SHOTGUN', damage: 15, mag: 7, reserve: 42, rate: .65, color: 0xffb46a }
];
const items = {
  intel: { name: 'Intel Core', weight: .4, value: 1800, color: '#ffd27a' },
  medkit: { name: 'Trauma Kit', weight: 1.2, value: 420, color: '#78d8ba' },
  plate: { name: 'Composite Plate', weight: 2.5, value: 680, color: '#a6b8c5' },
  cell: { name: 'Power Cell', weight: .7, value: 560, color: '#78cfff' },
  optic: { name: 'Prism Optic', weight: .3, value: 740, color: '#c4a4ff' },
  suppressor: { name: 'Sound Shroud', weight: .8, value: 920, color: '#9eabb7' },
  stimulant: { name: 'Focus Ampoule', weight: .2, value: 290, color: '#f2a4a0' }
};
const freshProfile = () => ({ xp: 0, raids: 0, stashScore: 0, stash: [{ itemId: 'medkit', count: 2 }, { itemId: 'plate', count: 1 }, { itemId: 'cell', count: 2 }, { itemId: 'optic', count: 1 }, { itemId: 'stimulant', count: 2 }], loadout: { weaponId: 'ar9', armor: true, optic: false, suppressor: false }, contract: true });
let profile;
try { const stored = JSON.parse(localStorage.getItem(SAVE) || '{}'); profile = { ...freshProfile(), ...stored, loadout: { ...freshProfile().loadout, ...(stored.loadout || {}) } }; if (!Array.isArray(profile.stash)) profile.stash = freshProfile().stash; }
catch { profile = freshProfile(); }
const state = { mode: 'base', hp: 100, armor: 60, stamina: 100, time: 360, elapsed: 0, radius: 96, flare: false, extract: 0, extractSent: false, site: 0, bag: [], kills: 0, scan: 0, scanCd: 0, supportCd: 0, reload: 0, shotCd: 0, crouch: false, weather: 0, toast: 0, recoil: 0, ammo: 30, reserve: 120 };
const weather = ['NIGHT // RADIO STATIC', 'DAWN // DUST FRONT', 'NOON // HARD LIGHT', 'DUSK // LOW VIS'];
const canvas = $('game-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#a9a28d');
scene.fog = new THREE.FogExp2('#a9a28d', .0048);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .1, 420);
let renderer, composer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  try { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); composer.addPass(new EffectPass(camera, new BloomEffect({ intensity: .4 }), new VignetteEffect({ offset: .24, darkness: .72 }))); } catch (e) { console.warn('Post effects unavailable', e); }
} catch (e) { const banner = $('arena-error'); banner.hidden = false; banner.textContent = `WebGL could not start: ${e.message}`; throw e; }
scene.add(new THREE.HemisphereLight(0xc9d9e3, 0x6b5942, 1.7));
const sun = new THREE.DirectionalLight(0xffdfb1, 2.8); sun.position.set(-42, 75, 38); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
function groundY(x, z) { return Math.sin(x * .035) * 1.1 + Math.cos(z * .029) * .9 + Math.sin((x + z) * .018) * 1.2; }
function makeBox(parent, x, y, z, w, h, d, material) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
const groundCanvas = document.createElement('canvas'); groundCanvas.width = groundCanvas.height = 256; const gctx = groundCanvas.getContext('2d'); gctx.fillStyle = '#8d8069'; gctx.fillRect(0, 0, 256, 256); for (let i = 0; i < 18000; i++) { const v = 95 + Math.random() * 50; gctx.fillStyle = `rgba(${v},${v * .88},${v * .68},.16)`; gctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
const groundTex = new THREE.CanvasTexture(groundCanvas); groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(10, 10); groundTex.colorSpace = THREE.SRGBColorSpace;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220, 80, 80), new THREE.MeshStandardMaterial({ map: groundTex, roughness: .96 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const concrete = new THREE.MeshStandardMaterial({ color: '#77776d', roughness: .9 });
const metal = new THREE.MeshStandardMaterial({ color: '#303a42', metalness: .68, roughness: .36 });
const glass = new THREE.MeshStandardMaterial({ color: '#8dd8dc', emissive: '#1e525d', emissiveIntensity: .35, metalness: .35, roughness: .22 });
const crateMat = new THREE.MeshStandardMaterial({ color: '#aa8451', roughness: .84 });
const enemyMat = new THREE.MeshStandardMaterial({ color: '#374a50', roughness: .7 });
const glowMat = new THREE.MeshStandardMaterial({ color: '#d18148', emissive: '#401708', emissiveIntensity: .5 });
const buildings = [{ x: -47, z: -35, w: 24, d: 17, h: 6.6, name: 'RESEARCH ANNEX' }, { x: 41, z: -28, w: 21, d: 15, h: 6.6, name: 'RELAY YARD' }, { x: -38, z: 42, w: 19, d: 14, h: 3.3, name: 'QUARANTINE DEPOT' }, { x: 48, z: 43, w: 23, d: 17, h: 6.6, name: 'TRANSFER STATION' }, { x: 0, z: -4, w: 15, d: 12, h: 6.6, name: 'FIELD CONTROL' }];
for (const b of buildings) { const y = groundY(b.x, b.z), group = new THREE.Group(); makeBox(group, 0, b.h / 2, 0, b.w, b.h, b.d, concrete); makeBox(group, 0, b.h + .2, 0, b.w + 1, .4, b.d + 1, metal); for (let f = 0; f < b.h / 3.3; f++) for (const side of [-1, 1]) for (let j = -1; j <= 1; j++) makeBox(group, j * b.w * .28, f * 3.3 + 1.65, side * (b.d / 2 + .03), 2, 1, .05, glass); group.position.set(b.x, y, b.z); scene.add(group); const label = document.createElement('canvas'); label.width = 420; label.height = 70; const ctx = label.getContext('2d'); ctx.fillStyle = '#0b1518'; ctx.fillRect(0, 0, 420, 70); ctx.fillStyle = '#d8e3e1'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'; ctx.fillText(b.name, 210, 45); const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(label) })); sprite.position.set(b.x, y + b.h + 3.5, b.z); sprite.scale.set(13, 2.2, 1); scene.add(sprite); }
const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1.25, 4, 7), new THREE.MeshStandardMaterial({ color: '#536a4c', roughness: .96 }), 46), dummy = new THREE.Object3D();
for (let i = 0; i < 46; i++) { const a = i * 2.4, r = 36 + (i % 6) * 8, x = Math.cos(a) * r, z = Math.sin(a) * r; dummy.position.set(x, groundY(x, z) + 2, z); dummy.rotation.y = a; dummy.scale.setScalar(.7 + (i % 4) * .15); dummy.updateMatrix(); trees.setMatrixAt(i, dummy.matrix); } trees.castShadow = true; scene.add(trees);
const anomaly = new THREE.Mesh(new THREE.RingGeometry(.99, 1, 100), new THREE.MeshBasicMaterial({ color: '#b7fbff', transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false })); anomaly.rotation.x = -Math.PI / 2; anomaly.position.y = .1; anomaly.scale.setScalar(96); scene.add(anomaly);
const sites = [{ x: 73, z: 0, name: 'NORTH RELAY' }, { x: -70, z: -18, name: 'DRY DOCK' }, { x: 3, z: 76, name: 'SOUTH CUT' }];
for (const s of sites) { const ring = new THREE.Mesh(new THREE.RingGeometry(4, 4.5, 36), new THREE.MeshBasicMaterial({ color: '#7de2d1', transparent: true, opacity: .8, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, groundY(s.x, s.z) + .25, s.z); s.mesh = ring; scene.add(ring); const mast = new THREE.Mesh(new THREE.CylinderGeometry(.13, .2, 4, 8), metal); mast.position.set(s.x, groundY(s.x, s.z) + 2, s.z); scene.add(mast); const lamp = new THREE.PointLight('#80e8d5', 2, 16); lamp.position.set(s.x, groundY(s.x, s.z) + 4.5, s.z); scene.add(lamp); }
let world = null, player = null, physicsOK = false;
const spawn = new THREE.Vector3(0, groundY(0, 73) + 1.5, 73);
async function initPhysics() { try { await RAPIER.init(); world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -.25, 0)); world.createCollider(RAPIER.ColliderDesc.cuboid(110, .25, 110), floorBody); player = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(spawn.x, spawn.y, spawn.z).lockRotations().setLinearDamping(4)); world.createCollider(RAPIER.ColliderDesc.capsule(.55, .35).setFriction(0), player); physicsOK = true; } catch (e) { console.warn('Physics fallback', e); $('physics-status').textContent = 'KINEMATIC FALLBACK'; } }
function position() { if (player) { const p = player.translation(); return new THREE.Vector3(p.x, p.y, p.z); } return spawn.clone(); }
function teleport(x, z) { const y = groundY(x, z) + 1.5; spawn.set(x, y, z); if (player) { player.setTranslation({ x, y, z }, true); player.setLinvel({ x: 0, y: 0, z: 0 }, true); } }
const loot = [], guards = [], keys = new Set(), ray = new THREE.Raycaster(), mouse = { yaw: 0, pitch: 0, locked: false };
const remotePlayers = new Map();
const remoteTorsoGeo = new THREE.CapsuleGeometry(.4, .7, 4, 7);
const remoteHeadGeo = new THREE.SphereGeometry(.24, 10, 8);
const remoteTorsoMat = new THREE.MeshStandardMaterial({ color: '#e6b85c', roughness: .45, metalness: .25 });
const remoteHeadMat = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ff9f40', emissiveIntensity: .45 });
let lastNetSync = 0;
let openLootId = null;

function upsertRemotePlayer(p) {
  if (!p || !p.id || p.id === net.playerId) return;
  let rp = remotePlayers.get(p.id);
  if (p.alive === false) {
    if (rp) { rp.alive = false; rp.group.visible = false; }
    return;
  }
  if (!rp) {
    const group = new THREE.Group();
    const torso = new THREE.Mesh(remoteTorsoGeo, remoteTorsoMat);
    torso.position.y = 1.1;
    torso.userData.remotePlayerId = p.id;
    group.add(torso);
    const head = new THREE.Mesh(remoteHeadGeo, remoteHeadMat);
    head.position.y = 1.9;
    head.userData.remotePlayerId = p.id;
    head.userData.headshot = true;
    group.add(head);
    scene.add(group);
    rp = { id: p.id, group, hits: [torso, head], alive: true };
    remotePlayers.set(p.id, rp);
  }
  rp.alive = true;
  rp.group.visible = true;
  const px = Number(p.x) || 0, pz = Number(p.z) || 0;
  const py = Number.isFinite(p.y) ? p.y - 1.5 : groundY(px, pz);
  rp.group.position.set(px, py, pz);
  rp.group.rotation.y = Number(p.ry) || 0;
}

function removeRemotePlayer(id) {
  const rp = remotePlayers.get(id);
  if (!rp) return;
  scene.remove(rp.group);
  remotePlayers.delete(id);
}

function clearRemotePlayers() {
  for (const rp of remotePlayers.values()) scene.remove(rp.group);
  remotePlayers.clear();
}

function makeLoot(x, z, title, contents, id = null) { const group = new THREE.Group(), y = groundY(x, z); makeBox(group, 0, .55, 0, 1.25, 1.1, 1.05, crateMat); makeBox(group, 0, 1.14, 0, 1.34, .12, 1.12, glowMat); const lamp = new THREE.PointLight('#70d4d7', .8, 7); lamp.position.y = 1.7; group.add(lamp); group.position.set(x, y, z); scene.add(group); const entry = { id: id || `loot_${loot.length}`, x, z, title, items: contents.map((v) => ({ ...v })), group, empty: contents.length === 0 }; group.visible = !entry.empty; loot.push(entry); return entry; }
function resetLoot() { for (const e of loot) scene.remove(e.group); loot.length = 0; makeLoot(-25, -30, 'RESEARCH LOCKER', [{ itemId: 'intel', count: 1 }, { itemId: 'cell', count: 1 }, { itemId: 'medkit', count: 1 }], 'locker_research'); makeLoot(30, -15, 'FIELD CACHE', [{ itemId: 'plate', count: 1 }, { itemId: 'optic', count: 1 }], 'cache_field'); makeLoot(34, 43, 'TRANSFER CRATE', [{ itemId: 'intel', count: 1 }, { itemId: 'stimulant', count: 2 }], 'crate_transfer'); makeLoot(-61, 20, 'SIGNAL CASE', [{ itemId: 'cell', count: 2 }, { itemId: 'suppressor', count: 1 }], 'case_signal'); }
function addGuard(id, name, type, x, z) { const group = new THREE.Group(), heavy = type === 'JUGGERNAUT', scale = heavy ? 1.15 : type === 'SPECTRE' ? .88 : 1; const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.42 * scale, .7 * scale, 4, 7), enemyMat); torso.position.y = 1.1 * scale; torso.userData.guardId = id; group.add(torso); const head = new THREE.Mesh(new THREE.SphereGeometry(.25 * scale, 10, 8), glowMat); head.position.y = 1.9 * scale; head.userData.guardId = id; head.userData.headshot = true; group.add(head); group.position.set(x, groundY(x, z), z); scene.add(group); guards.push({ id, name, type, group, hp: heavy ? 175 : type === 'SPECTRE' ? 78 : 110, alive: true, cooldown: 1, speed: heavy ? 1.2 : type === 'SPECTRE' ? 2.6 : 1.8, hits: [torso, head], waypoint: new THREE.Vector3(x + 10, 0, z - 8) }); }
function spawnGuards() { for (const g of guards) scene.remove(g.group); guards.length = 0; addGuard('a', 'Bastion', 'JUGGERNAUT', -28, -21); addGuard('b', 'Wraith', 'SPECTRE', 31, -4); addGuard('c', 'Patrol Cell 01', 'SQUAD', 48, 32); addGuard('d', 'Patrol Cell 02', 'SQUAD', 54, 35); addGuard('e', 'Patrol Cell 03', 'SQUAD', 42, 38); }
function weapon() { return weapons.find((w) => w.id === profile.loadout.weaponId) || weapons[0]; }
function computeLocalStashScore(list) { return (list || []).reduce((sum, e) => sum + (items[e.itemId]?.value || 0) * (e.count || 0), 0); }
function renderBase() { const score = Number.isFinite(profile.stashScore) && profile.stashScore > 0 ? profile.stashScore : computeLocalStashScore(profile.stash); const scoreEl = $('profile-stash-score'); if (scoreEl) scoreEl.textContent = `${score.toLocaleString()} CR`; $('profile-xp').textContent = `${(profile.xp || 0).toLocaleString()} XP`; $('profile-raids').textContent = `${profile.raids || 0} RUNS`; $('stash-list').innerHTML = profile.stash.map((e) => `<div class="stash-row"><i class="item-mark" style="--item:${items[e.itemId]?.color || '#93a7aa'}"></i><span>${items[e.itemId]?.name || e.itemId}</span><b>x${e.count}</b><small>${items[e.itemId]?.weight || 0} kg</small></div>`).join('') || '<div class="empty-note">STASH EMPTY</div>'; const selected = weapon(); $('selected-weapon').textContent = selected.name; $('loadout-weapon').innerHTML = weapons.map((w) => `<button class="weapon-choice ${w.id === selected.id ? 'selected' : ''}" data-w="${w.id}"><span>${w.type}</span><b>${w.name}</b><small>${w.damage} DMG · ${w.mag} MAG</small></button>`).join(''); $('loadout-weapon').querySelectorAll('[data-w]').forEach((b) => b.onclick = () => { profile.loadout.weaponId = b.dataset.w; persist(true); }); for (const [id, key, on, off] of [['optic-toggle', 'optic', 'PRISM OPTIC · INSTALLED', 'INSTALL PRISM OPTIC'], ['suppressor-toggle', 'suppressor', 'SOUND SHROUD · INSTALLED', 'INSTALL SOUND SHROUD']]) { $(id).setAttribute('aria-pressed', String(profile.loadout[key])); $(id).textContent = profile.loadout[key] ? on : off; } $('contract-toggle').setAttribute('aria-pressed', String(profile.contract)); $('contract-toggle').textContent = profile.contract ? 'CONTRACT ACTIVE · SECURE 3 CORES' : 'ACCEPT · SECURE 3 CORES'; $('base-status').textContent = net.connected ? 'ONLINE // SECTOR 04 LINKED' : (profile.raids ? 'OPERATIONS READY' : 'FIRST DEPLOYMENT // KIT RISK: HIGH'); }
function persist(syncServer = false) { try { localStorage.setItem(SAVE, JSON.stringify(profile)); } catch {} renderBase(); if (syncServer && net.connected) net.send({ type: 'profile_update', playerId: net.playerId, loadout: profile.loadout, contract: profile.contract }); }
function applyServerProfile(prof) { if (!prof) return; profile = { ...freshProfile(), ...prof, loadout: { ...freshProfile().loadout, ...(prof.loadout || {}) } }; if (!Array.isArray(profile.stash)) profile.stash = freshProfile().stash; persist(false); }
function syncExtractionSnapshot(msg) {
  if (!msg) return;
  if (typeof msg.matchRemaining === 'number') state.time = msg.matchRemaining;
  if (typeof msg.elapsed === 'number') state.elapsed = msg.elapsed;
  if (typeof msg.anomalyRadius === 'number') state.radius = msg.anomalyRadius;
  if (Number.isInteger(msg.activeSite)) { state.site = msg.activeSite % sites.length; $('extraction-readout').textContent = sites[state.site].name; }
  if (typeof msg.flareActive === 'boolean') state.flare = msg.flareActive;
  if (typeof msg.extractProgress === 'number') state.extract = msg.extractProgress;
  if (Array.isArray(msg.lootContainers)) {
    for (const e of loot) scene.remove(e.group);
    loot.length = 0;
    for (const c of msg.lootContainers) makeLoot(c.x, c.z, c.title, c.items || [], c.id);
  }
  if (Array.isArray(msg.guards)) {
    for (const sg of msg.guards) {
      const lg = guards.find((g) => g.id === sg.id);
      if (!lg) continue;
      lg.hp = sg.hp;
      lg.alive = Boolean(sg.alive);
      lg.group.visible = lg.alive;
      if (typeof sg.x === 'number' && typeof sg.z === 'number') lg.group.position.set(sg.x, groundY(sg.x, sg.z), sg.z);
    }
  }
  if (Array.isArray(msg.players)) {
    for (const p of msg.players) upsertRemotePlayer(p);
  }
}

const net = new NetworkClient((msg) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'welcome') {
    net.send({ type: 'profile_sync', playerId: net.playerId });
    if (Array.isArray(msg.players)) for (const p of msg.players) upsertRemotePlayer(p);
    renderBase();
  } else if (msg.type === 'profile_state') {
    applyServerProfile(msg.profile);
  } else if (msg.type === 'raid_deployed') {
    if (msg.profile) applyServerProfile(msg.profile);
    syncExtractionSnapshot(msg);
  } else if (msg.type === 'extraction_snapshot' || msg.type === 'room_snapshot') {
    syncExtractionSnapshot(msg);
  } else if (msg.type === 'extraction_tick') {
    state.time = msg.matchRemaining ?? state.time;
    state.elapsed = msg.elapsed ?? state.elapsed;
    state.radius = msg.anomalyRadius ?? state.radius;
    if (Number.isInteger(msg.activeSite)) state.site = msg.activeSite % sites.length;
    state.flare = Boolean(msg.flareActive);
    if (typeof msg.extractProgress === 'number') state.extract = msg.extractProgress;
  } else if (msg.type === 'bag_updated') {
    if (Array.isArray(msg.bag)) state.bag = msg.bag.map((v) => ({ ...v }));
  } else if (msg.type === 'loot_rejected') {
    notify(msg.reason || 'PACK FULL // EXTRACT OR LEAVE ITEMS');
  } else if (msg.type === 'loot_updated' && msg.container) {
    const c = msg.container;
    const local = loot.find((e) => e.id === c.id);
    if (local) {
      local.items = (c.items || []).map((v) => ({ ...v }));
      local.empty = Boolean(c.empty) || local.items.length === 0;
      local.group.visible = !local.empty;
      if (!$('loot-panel').hidden && openLootId === local.id) {
        if (local.empty) closeLoot(); else showLoot(local);
      }
    }
  } else if (msg.type === 'guard_damaged') {
    const g = guards.find((v) => v.id === msg.guardId);
    if (g) g.hp = msg.hp;
  } else if (msg.type === 'guard_eliminated') {
    const g = guards.find((v) => v.id === msg.guardId);
    if (g && g.alive) {
      g.alive = false;
      g.group.visible = false;
      if (msg.by === net.playerId) state.kills++;
      notify(`${g.name.toUpperCase()} NEUTRALIZED // CACHE MARKED`);
    }
    if (msg.container && !loot.some((e) => e.id === msg.container.id)) {
      makeLoot(msg.container.x, msg.container.z, msg.container.title, msg.container.items || [], msg.container.id);
    }
  } else if (msg.type === 'flare_deployed') {
    state.flare = true;
    if (Number.isInteger(msg.siteIndex)) state.site = msg.siteIndex % sites.length;
    $('extraction-readout').textContent = sites[state.site].name;
    notify('FLARE DEPLOYED // HOLD THE SITE');
  } else if (msg.type === 'extraction_confirmed') {
    if (msg.profile) applyServerProfile(msg.profile);
    if (Array.isArray(msg.extractedBag)) state.bag = msg.extractedBag.map((v) => ({ ...v }));
    if (typeof msg.kills === 'number') state.kills = msg.kills;
    endRun(true, '', true);
  } else if (msg.type === 'raid_lost') {
    if (msg.profile) applyServerProfile(msg.profile);
    endRun(false, msg.reason || 'Contractor down.', true);
  } else if (msg.type === 'player_joined' && msg.player) {
    upsertRemotePlayer(msg.player);
  } else if (msg.type === 'player_state') {
    upsertRemotePlayer(msg);
  } else if (msg.type === 'player_damaged' && msg.id === net.playerId) {
    state.hp = msg.hp ?? state.hp;
    state.armor = msg.shield ?? state.armor;
    $('damage-flash').classList.add('active');
    setTimeout(() => $('damage-flash').classList.remove('active'), 160);
  } else if (msg.type === 'player_eliminated') {
    if (msg.id === net.playerId) {
      endRun(false, 'Eliminated by hostile contractor.');
    } else {
      const rp = remotePlayers.get(msg.id);
      if (rp) { rp.alive = false; rp.group.visible = false; }
      if (msg.by === net.playerId) { state.kills++; notify('HOSTILE CONTRACTOR NEUTRALIZED'); }
    }
  } else if (msg.type === 'player_extracted' || msg.type === 'player_left') {
    removeRemotePlayer(msg.id || msg.playerId);
  }
}, () => { renderBase(); }, () => { clearRemotePlayers(); renderBase(); });

function lockPointer() { try { const r = canvas.requestPointerLock?.(); if (r && typeof r.catch === 'function') r.catch(() => {}); } catch {} }
function notify(text, seconds = 2.5) { $('toast').textContent = text; $('toast').classList.add('show'); state.toast = seconds; }
function beginRun() { if (state.mode === 'raid') return; state.mode = 'raid'; state.hp = 100; state.armor = profile.loadout.armor ? 60 : 0; state.stamina = 100; state.time = 360; state.elapsed = 0; state.radius = 96; state.flare = false; state.extract = 0; state.extractSent = false; state.bag = []; state.kills = 0; state.scan = 0; state.scanCd = 0; state.supportCd = 0; state.reload = 0; state.shotCd = 0; state.site = (profile.raids + Math.floor(Math.random() * sites.length)) % sites.length; state.ammo = weapon().mag; state.reserve = weapon().reserve; resetLoot(); spawnGuards(); teleport(0, 73); if (net.connected) net.send({ type: 'deploy_raid', roomId: 'sector_04', weaponId: profile.loadout.weaponId, playerId: net.playerId }); $('base-screen').hidden = true; $('results-screen').hidden = true; $('raid-hud').hidden = false; $('hud-weather').textContent = weather[state.weather]; $('extraction-readout').textContent = sites[state.site].name; notify('INSERTION COMPLETE // RECOVER WHAT YOU CAN'); lockPointer(); updateHud(); }
function nearestLoot(max = 3.2) { const p = position(); return loot.filter((e) => !e.empty).map((e) => [e, Math.hypot(e.x - p.x, e.z - p.z)]).filter((v) => v[1] < max).sort((a, b) => a[1] - b[1])[0]?.[0] || null; }
function nearestSite(max = 6) { const p = position(), s = sites[state.site]; return Math.hypot(s.x - p.x, s.z - p.z) < max ? s : null; }
function showLoot(e) { if (!e || e.empty) return; openLootId = e.id; $('loot-title').textContent = e.title; $('loot-items').innerHTML = e.items.length ? e.items.map((v, i) => `<button class="loot-row" data-take="${i}"><i class="item-mark" style="--item:${items[v.itemId]?.color}"></i><span>${items[v.itemId]?.name}</span><b>x${v.count}</b><small>${items[v.itemId]?.value} cr</small><em>TAKE</em></button>`).join('') : '<div class="empty-note">CONTAINER EMPTY</div>'; $('loot-items').querySelectorAll('[data-take]').forEach((b) => b.onclick = () => takeItem(e, Number(b.dataset.take))); $('loot-panel').hidden = false; document.exitPointerLock?.(); }
function takeItem(e, i) { const item = e.items[i]; if (!item) return; const weight = state.bag.reduce((n, v) => n + (items[v.itemId]?.weight || 0) * v.count, 0); if (weight + (items[item.itemId]?.weight || 0) * item.count > 30) return notify('PACK FULL // EXTRACT OR LEAVE ITEMS'); if (net.connected) { net.send({ type: 'loot_take', containerId: e.id, itemIndex: i }); return; } state.bag.push({ ...item }); e.items.splice(i, 1); if (!e.items.length) { e.empty = true; e.group.visible = false; } showLoot(e); }
function closeLoot() { openLootId = null; $('loot-panel').hidden = true; if (state.mode === 'raid') lockPointer(); }
function endRun(success, reason = '', serverHandled = false) { if (state.mode !== 'raid') return; if (net.connected && !serverHandled) { if (success) { if (!state.extractSent) { state.extractSent = true; net.send({ type: 'extract_confirm' }); } return; } net.send({ type: 'raid_death', reason }); } state.mode = 'results'; document.exitPointerLock?.(); $('raid-hud').hidden = true; $('loot-panel').hidden = true; const count = success ? state.bag.reduce((n, e) => n + e.count, 0) : 0, value = success ? state.bag.reduce((n, e) => n + (items[e.itemId]?.value || 0) * e.count, 0) : 0; if (!serverHandled) { if (success) { profile.stash.push(...state.bag.map((e) => ({ ...e }))); profile.xp += 180 + state.kills * 45 + Math.round(value * .04); if (profile.contract && state.kills >= 3) { profile.xp += 500; profile.stash.push({ itemId: 'intel', count: 2 }); } profile.stashScore = computeLocalStashScore(profile.stash); } else { profile.loadout.armor = false; profile.loadout.optic = false; profile.loadout.suppressor = false; } profile.raids++; persist(false); } $('results-kicker').textContent = success ? 'EXTRACTION CONFIRMED' : 'RUN LOST'; $('results-title').textContent = success ? 'LOOT SECURED' : 'CONTRACTOR DOWN'; $('results-copy').textContent = success ? `You recovered ${count} item stacks worth ${value.toLocaleString()} credits and returned with ${state.kills} neutralizations.` : `${reason || 'The extraction window closed.'} Carried loot was not banked.`; $('results-items').innerHTML = success && state.bag.length ? state.bag.map((e) => `<div class="result-row"><span>${items[e.itemId]?.name}</span><b>x${e.count}</b></div>`).join('') : '<div class="empty-note">NO ITEMS BANKED // STASH UNCHANGED</div>'; $('results-stats').innerHTML = `<span><b>${state.kills}</b> NEUTRALIZATIONS</span><span><b>${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}</b> IN SECTOR</span><span><b>${value.toLocaleString()}</b> RECOVERED VALUE</span>`; $('results-screen').hidden = false; }
function shoot() { if (state.mode !== 'raid' || state.reload > 0 || state.shotCd > 0) return; if (state.ammo <= 0) return notify('MAGAZINE EMPTY // R TO RELOAD'); const w = weapon(); state.ammo--; state.shotCd = w.rate; state.recoil = Math.min(.09, state.recoil + .018); ray.setFromCamera(new THREE.Vector2((Math.random() - .5) * .025, (Math.random() - .5) * .025), camera); const targets = [...guards.filter((g) => g.alive).flatMap((g) => g.hits), ...Array.from(remotePlayers.values()).filter((rp) => rp.alive).flatMap((rp) => rp.hits)]; const hit = ray.intersectObjects(targets, false)[0]; if (hit) { const dmg = w.damage * (hit.object.userData.headshot ? 2 : 1); if (hit.object.userData.remotePlayerId && net.connected) { net.send({ type: 'hit_player', targetId: hit.object.userData.remotePlayerId, damage: dmg, hitZone: hit.object.userData.headshot ? 'head' : 'torso', weapon: w.id }); return; } const g = guards.find((v) => v.id === hit.object.userData.guardId); if (g) { if (net.connected) { net.send({ type: 'guard_hit', guardId: g.id, damage: dmg, x: g.group.position.x, z: g.group.position.z }); } else { g.hp -= dmg; if (g.hp <= 0) { g.alive = false; g.group.visible = false; state.kills++; makeLoot(g.group.position.x, g.group.position.z, `${g.name} // RECOVERY`, [{ itemId: Math.random() > .5 ? 'intel' : 'cell', count: 1 }, { itemId: 'plate', count: 1 }]); notify(`${g.name.toUpperCase()} NEUTRALIZED // CACHE MARKED`); } } } } }
function reload() { const w = weapon(); if (state.ammo < w.mag && state.reserve > 0 && !state.reload) { state.reload = 1.8; notify('RELOADING // HOLD POSITION'); } }
function scan() { if (state.scanCd > 0) return; state.scan = 12; state.scanCd = 28; notify('UAV PULSE // CONTACTS MARKED'); updateHud(); }
function support() { if (state.supportCd > 0) return; state.supportCd = 45; const p = position(), target = guards.filter((g) => g.alive).sort((a, b) => a.group.position.distanceTo(p) - b.group.position.distanceTo(p))[0]; if (target) for (const g of guards) if (g.alive && g.group.position.distanceTo(target.group.position) < 11) { if (net.connected) { net.send({ type: 'guard_hit', guardId: g.id, damage: 60, x: g.group.position.x, z: g.group.position.z }); } else { g.hp -= 60; if (g.hp <= 0) { g.alive = false; g.group.visible = false; state.kills++; makeLoot(g.group.position.x, g.group.position.z, `${g.name} // RECOVERY`, [{ itemId: 'intel', count: 1 }]); } } } notify('SUPPORT STRIKE // GRID MARKED'); updateHud(); }
function updateAI(dt) { const p = position(); for (const g of guards) { if (!g.alive) continue; const d = Math.hypot(p.x - g.group.position.x, p.z - g.group.position.z); g.cooldown -= dt; let dx = 0, dz = 0; if (d < 43) { if (d > 12) { dx = (p.x - g.group.position.x) / d; dz = (p.z - g.group.position.z) / d; } if (d < 30 && g.cooldown <= 0) { g.cooldown = 1.2; if (Math.random() < clamp(.58 - d / 90, .17, .5)) { const dmg = g.type === 'JUGGERNAUT' ? 15 : 10, absorbed = Math.min(state.armor, dmg); state.armor -= absorbed; state.hp = Math.max(0, state.hp - dmg + absorbed); $('damage-flash').classList.add('active'); setTimeout(() => $('damage-flash').classList.remove('active'), 160); if (state.hp <= 0) { endRun(false, 'Eliminated by hostile fire.'); return; } } } } else { const wx = g.waypoint.x - g.group.position.x, wz = g.waypoint.z - g.group.position.z, wd = Math.hypot(wx, wz); if (wd < 2.5) g.waypoint.set(g.group.position.x + (Math.random() - .5) * 24, 0, g.group.position.z + (Math.random() - .5) * 24); else { dx = wx / wd * .45; dz = wz / wd * .45; } } g.group.position.x = clamp(g.group.position.x + dx * g.speed * dt, -100, 100); g.group.position.z = clamp(g.group.position.z + dz * g.speed * dt, -100, 100); g.group.position.y = groundY(g.group.position.x, g.group.position.z); if (d > .5) g.group.rotation.y = Math.atan2(p.x - g.group.position.x, p.z - g.group.position.z); } }
function drawRadar() { const c = $('tactical-radar'), ctx = c.getContext('2d'), n = c.width / 2, p = position(), k = c.width / 220; ctx.clearRect(0, 0, c.width, c.height); ctx.fillStyle = '#0a1216'; ctx.fillRect(0, 0, c.width, c.height); ctx.strokeStyle = 'rgba(120,186,186,.25)'; for (const r of [.25, .5, .75]) { ctx.beginPath(); ctx.arc(n, n, r * c.width, 0, Math.PI * 2); ctx.stroke(); } ctx.strokeStyle = '#83d8d0'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(n, n, state.radius * k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); const map = (x, z) => [n + (x - p.x) * k, n + (z - p.z) * k]; const s = sites[state.site], [sx, sy] = map(s.x, s.z); ctx.strokeStyle = '#82e3d0'; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.stroke(); for (const g of guards) if (g.alive && (state.scan > 0 || Math.hypot(g.group.position.x - p.x, g.group.position.z - p.z) < 38)) { const [x, y] = map(g.group.position.x, g.group.position.z); ctx.fillStyle = '#f07464'; ctx.fillRect(x - 2, y - 2, 4, 4); } for (const rp of remotePlayers.values()) if (rp.alive && (state.scan > 0 || Math.hypot(rp.group.position.x - p.x, rp.group.position.z - p.z) < 60)) { const [x, y] = map(rp.group.position.x, rp.group.position.z); ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = '#e5eeec'; ctx.beginPath(); ctx.arc(n, n, 3, 0, Math.PI * 2); ctx.fill(); }
function updateHud() { if (state.mode !== 'raid') return; $('hud-timer').textContent = `${String(Math.floor(state.time / 60)).padStart(2, '0')}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`; $('hud-hp').textContent = `${Math.ceil(state.hp)}%`; $('hud-armor').textContent = `${Math.ceil(state.armor)}%`; $('hp-bar').style.width = `${state.hp}%`; $('armor-bar').style.width = `${state.armor / 60 * 100}%`; $('stamina-bar').style.width = `${state.stamina}%`; $('hud-ammo').textContent = state.reload > 0 ? 'RELOAD' : `${state.ammo} / ${state.reserve}`; $('hud-weapon').textContent = weapon().name; $('hud-weapon-type').textContent = weapon().type; $('anomaly-readout').textContent = `${Math.round(state.radius)}m SAFE RADIUS`; $('anomaly-bar').style.width = `${(state.radius - 24) / 72 * 100}%`; $('objective-status').textContent = state.flare ? `EXTRACTION ${Math.floor(state.extract / 15 * 100)}%` : 'RECOVER INTEL // REACH ACTIVE SITE'; $('contract-status').textContent = `GUARDS ${state.kills}/3`; $('ks-uav').textContent = state.scan > 0 ? `[4] UAV ${Math.ceil(state.scan)}s` : state.scanCd > 0 ? `[4] UAV (${Math.ceil(state.scanCd)}s)` : '[4] UAV READY'; $('ks-arty').textContent = state.supportCd > 0 ? `[5] Arty (${Math.ceil(state.supportCd)}s)` : '[5] Arty READY'; $('ks-uav').classList.toggle('ready', state.scan <= 0 && state.scanCd <= 0); $('ks-arty').classList.toggle('ready', state.supportCd <= 0); $('anomaly-alert').classList.toggle('visible', Math.hypot(position().x, position().z) > state.radius); drawRadar(); }
function updateRun(dt) { if (!net.connected) { state.elapsed += dt; state.time = Math.max(0, 360 - state.elapsed); state.radius = Math.max(24, 96 - state.elapsed * .18); } anomaly.scale.setScalar(state.radius); const p = position(), outside = Math.hypot(p.x, p.z) > state.radius; $('anomaly-overlay').style.opacity = outside ? String(clamp((Math.hypot(p.x, p.z) - state.radius) / 14, 0, .6)) : '0'; if (outside) state.hp = Math.max(0, state.hp - dt * 5); if (state.hp <= 0) return endRun(false, 'Lost to anomaly exposure.'); if (state.flare) { const s = sites[state.site], on = Math.hypot(s.x - p.x, s.z - p.z) < 7.5, contested = guards.some((g) => g.alive && Math.hypot(g.group.position.x - s.x, g.group.position.z - s.z) < 15); if (!net.connected && on && !contested) state.extract += dt; $('extract-progress-label').textContent = !on ? 'RETURN TO FLARE // SIGNAL PAUSED' : contested ? 'SITE CONTESTED // CLEAR HOSTILES' : 'HOLD ZONE // EXTRACTION IN PROGRESS'; $('extract-progress').style.width = `${clamp(state.extract / 15 * 100, 0, 100)}%`; if (state.extract >= 15) return endRun(true); } if (state.time <= 0) return endRun(false, 'Extraction window closed.'); state.scan = Math.max(0, state.scan - dt); state.scanCd = Math.max(0, state.scanCd - dt); state.supportCd = Math.max(0, state.supportCd - dt); state.shotCd = Math.max(0, state.shotCd - dt); if (state.reload > 0 && (state.reload -= dt) <= 0) { const n = Math.min(weapon().mag - state.ammo, state.reserve); state.ammo += n; state.reserve -= n; } state.recoil = Math.max(0, state.recoil - dt * .06); const e = nearestLoot(), s = nearestSite(), hint = $('interaction-hint'); if (e) { hint.textContent = `E // SEARCH ${e.title}`; hint.classList.add('visible'); } else if (s) { hint.textContent = `F // ${state.flare ? 'EXTRACTION ACTIVE' : 'DEPLOY EXTRACTION FLARE'}`; hint.classList.add('visible'); } else hint.classList.remove('visible'); if (state.toast > 0 && (state.toast -= dt) <= 0) $('toast').classList.remove('show'); }
function move(dt) { if (state.mode !== 'raid' || !document.pointerLockElement) return; const f = new THREE.Vector3(-Math.sin(mouse.yaw), 0, -Math.cos(mouse.yaw)), r = new THREE.Vector3(Math.cos(mouse.yaw), 0, -Math.sin(mouse.yaw)), v = new THREE.Vector3(); if (keys.has('KeyW')) v.add(f); if (keys.has('KeyS')) v.sub(f); if (keys.has('KeyD')) v.add(r); if (keys.has('KeyA')) v.sub(r); if (v.lengthSq()) v.normalize(); const sprint = keys.has('ShiftLeft') && state.stamina > 1, speed = sprint ? 8 : state.crouch ? 2.6 : 5.2; state.stamina = clamp(state.stamina + (sprint ? -18 : 9) * dt, 0, 100); if (player) { const old = player.linvel(); player.setLinvel({ x: v.x * speed, y: old.y, z: v.z * speed }, true); if (keys.has('Space') && Math.abs(old.y) < .22) player.setLinvel({ x: v.x * speed, y: 5.7, z: v.z * speed }, true); } else { spawn.x = clamp(spawn.x + v.x * speed * dt, -105, 105); spawn.z = clamp(spawn.z + v.z * speed * dt, -105, 105); spawn.y = groundY(spawn.x, spawn.z) + 1.5; } }
function interact() { if (state.mode !== 'raid') return; if (!$('loot-panel').hidden) return closeLoot(); const e = nearestLoot(); if (e) return showLoot(e); if (nearestSite()) { state.flare = true; if (net.connected) net.send({ type: 'flare_deploy' }); $('extraction-readout').textContent = sites[state.site].name; notify('FLARE DEPLOYED // HOLD THE SITE'); } }
function onKeyDown(e) { if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); keys.add(e.code); if (e.repeat) return; if (e.code === 'KeyE' || (e.code === 'KeyF' && nearestSite())) interact(); if (e.code === 'KeyR') reload(); if (e.code === 'KeyC') state.crouch = !state.crouch; if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') { profile.loadout.weaponId = weapons[Number(e.code.slice(-1)) - 1].id; state.ammo = weapon().mag; state.reserve = weapon().reserve; } if (e.code === 'Digit4') scan(); if (e.code === 'Digit5') support(); if (e.code === 'Digit6') { state.weather = (state.weather + 1) % weather.length; $('hud-weather').textContent = weather[state.weather]; notify(`ATMOSPHERE // ${weather[state.weather]}`); } }
window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', (e) => keys.delete(e.code));
canvas.addEventListener('click', () => { if (state.mode === 'raid' && $('loot-panel').hidden) lockPointer(); });
document.addEventListener('pointerlockchange', () => { mouse.locked = document.pointerLockElement === canvas; });
document.addEventListener('mousemove', (e) => { if (!mouse.locked) return; mouse.yaw -= e.movementX * .0021; mouse.pitch = clamp(mouse.pitch - e.movementY * .0018, -1.25, 1.25); });
document.addEventListener('mousedown', (e) => { if (state.mode === 'raid' && mouse.locked && e.button === 0) shoot(); if (e.button === 2) camera.fov = 58; }); document.addEventListener('mouseup', (e) => { if (e.button === 2) camera.fov = 72; }); document.addEventListener('contextmenu', (e) => e.preventDefault());
$('deploy-btn').addEventListener('click', beginRun); $('loot-close').addEventListener('click', closeLoot); $('optic-toggle').addEventListener('click', () => { profile.loadout.optic = !profile.loadout.optic; persist(true); }); $('suppressor-toggle').addEventListener('click', () => { profile.loadout.suppressor = !profile.loadout.suppressor; persist(true); }); $('contract-toggle').addEventListener('click', () => { profile.contract = !profile.contract; persist(true); });
$('return-base').addEventListener('click', () => { $('results-screen').hidden = true; $('base-screen').hidden = false; state.mode = 'base'; state.flare = false; renderBase(); }); $('reset-profile').addEventListener('click', () => { if (confirm('Reset Zero-Zone local progression and stash?')) { profile = freshProfile(); persist(true); } });
function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer?.setSize(innerWidth, innerHeight); } window.addEventListener('resize', resize);
function frame() { requestAnimationFrame(frame); const dt = Math.min(clock.getDelta(), .05); if (state.mode === 'raid') { move(dt); if (world) { world.timestep = 1 / 60; world.step(); } updateRun(dt); if (state.mode === 'raid') updateAI(dt); const p = position(); camera.position.set(p.x, p.y + (state.crouch ? .22 : .55), p.z); camera.rotation.order = 'YXZ'; camera.rotation.y = mouse.yaw; camera.rotation.x = clamp(mouse.pitch + state.recoil, -1.32, 1.32); camera.updateProjectionMatrix(); if (net.connected && performance.now() - lastNetSync >= 50) { lastNetSync = performance.now(); net.send({ type: 'state', x: p.x, y: p.y, z: p.z, ry: mouse.yaw, weapon: weapon().id, isCrouching: state.crouch }); } updateHud(); } else { const t = clock.elapsedTime; camera.position.set(112 + Math.sin(t * .05) * 4, 76, 122); camera.lookAt(0, 2, 0); camera.fov = 52; camera.updateProjectionMatrix(); for (const s of sites) s.mesh.material.opacity = .56 + Math.sin(t * 2 + s.x) * .16; } if (composer) composer.render(dt); else renderer.render(scene, camera); }
const clock = new THREE.Clock();
async function boot() { resetLoot(); renderBase(); $('hud-weather').textContent = weather[state.weather]; $('hud-timer').textContent = '06:00'; const wsUrl = (new URLSearchParams(location.search).get('ws') || import.meta.env.VITE_WS_URL || '').trim(); if (wsUrl) net.connect(wsUrl, 'sector_04', 'vanguard'); await initPhysics(); $('physics-status').textContent = physicsOK ? 'RAPIER PHYSICS ONLINE' : 'KINEMATIC FALLBACK'; frame(); }
boot();
