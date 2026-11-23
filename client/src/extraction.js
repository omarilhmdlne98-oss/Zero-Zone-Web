import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { EffectComposer, EffectPass, RenderPass, BloomEffect, VignetteEffect } from 'postprocessing';

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const SAVE_KEY = 'zerozone.profile.v1';
const RAID_SECONDS = 360;
const WORLD_SIZE = 220;
const HALF_WORLD = WORLD_SIZE / 2;
const FIXED_STEP = 1 / 60;
const MATERIALS = {};
const state = {
  mode: 'base',
  hp: 100,
  armor: 60,
  stamina: 100,
  ammo: 0,
  reserve: 0,
  timer: RAID_SECONDS,
  elapsed: 0,
  safeRadius: 96,
  extractionProgress: 0,
  extractionStarted: false,
  extractionSiteIndex: 0,
  activeLoot: null,
  scanner: 0,
  scannerCooldown: 0,
  artyCooldown: 0,
  weather: 0,
  kills: 0,
  contractKills: 0,
  bag: [],
  weaponIndex: 0,
  reload: 0,
  shotCooldown: 0,
  recoil: 0,
  ads: false,
  crouch: false,
  messageTimer: 0,
  anomalyTick: 0,
  lastRun: null
};

const WEATHER = ['NIGHT // RADIO STATIC', 'DAWN // DUST FRONT', 'NOON // HARD LIGHT', 'DUSK // LOW VIS'];
const WEAPONS = [
  { id: 'ar9', name: 'AR-9 CARBINE', type: 'ASSAULT RIFLE', damage: 27, velocity: 185, gravity: 9.81, cadence: 0.105, magazine: 30, reserve: 120, reload: 1.8, spread: 0.008, recoil: 0.010, color: 0x7ce8ff, pellets: 1 },
  { id: 'dmr4', name: 'DMR-4 MARKSMAN', type: 'DESIGNATED MARKSMAN', damage: 58, velocity: 265, gravity: 5.5, cadence: 0.52, magazine: 8, reserve: 48, reload: 2.2, spread: 0.002, recoil: 0.028, color: 0xb9a2ff, pellets: 1 },
  { id: 'c12', name: 'C-12 BREACHER', type: 'COMBAT SHOTGUN', damage: 13, velocity: 115, gravity: 12, cadence: 0.68, magazine: 7, reserve: 42, reload: 2.4, spread: 0.055, recoil: 0.035, color: 0xffb46a, pellets: 7 }
];
const ITEM_DEFS = {
  medkit: { name: 'Trauma Kit', kind: 'medical', weight: 1.2, value: 420, color: '#78d8ba' },
  plate: { name: 'Composite Plate', kind: 'armor', weight: 2.5, value: 680, color: '#a6b8c5' },
  intel: { name: 'Intel Core', kind: 'intel', weight: 0.4, value: 1800, color: '#ffd27a' },
  cell: { name: 'Power Cell', kind: 'crafting', weight: 0.7, value: 560, color: '#78cfff' },
  optic: { name: 'Prism Optic', kind: 'attachment', weight: 0.3, value: 740, color: '#c4a4ff' },
  suppressor: { name: 'Sound Shroud', kind: 'attachment', weight: 0.8, value: 920, color: '#9eabb7' },
  stimulant: { name: 'Focus Ampoule', kind: 'medical', weight: 0.2, value: 290, color: '#f2a4a0' }
};
const DEFAULT_PROFILE = {
  xp: 0,
  raids: 0,
  stash: [
    { itemId: 'medkit', count: 2 },
    { itemId: 'plate', count: 1 },
    { itemId: 'cell', count: 2 },
    { itemId: 'optic', count: 1 },
    { itemId: 'stimulant', count: 2 }
  ],
  loadout: { weaponId: 'ar9', armor: true, optic: false, suppressor: false },
  contract: true
};
function loadProfile() {
  try {
    const stored = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!stored || !Array.isArray(stored.stash)) return structuredClone(DEFAULT_PROFILE);
    return { ...structuredClone(DEFAULT_PROFILE), ...stored, loadout: { ...DEFAULT_PROFILE.loadout, ...(stored.loadout || {}) } };
  } catch {
    return structuredClone(DEFAULT_PROFILE);
  }
}
let profile = loadProfile();
function saveProfile() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile)); } catch { toast('Local save unavailable — this run will not persist.'); }
  renderBase();
}

const canvas = $('game-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#a9a28d');
scene.fog = new THREE.FogExp2('#a9a28d', 0.0048);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 420);
let renderer;
let composer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new EffectPass(camera, new BloomEffect({ intensity: 0.48, luminanceThreshold: 0.76 }), new VignetteEffect({ offset: 0.24, darkness: 0.72 })));
  } catch (err) {
    console.warn('[Zero-Zone] Post-processing fallback:', err);
  }
} catch (err) {
  $('arena-error').hidden = false;
  $('arena-error').textContent = `WebGL could not start: ${err?.message || 'unsupported graphics device'}`;
  throw err;
}

const hemi = new THREE.HemisphereLight(0xc9d9e3, 0x6b5942, 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffdfb1, 3.1);
sun.position.set(-42, 75, 38);
sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
sun.shadow.camera.left = -118;
sun.shadow.camera.right = 118;
sun.shadow.camera.top = 118;
sun.shadow.camera.bottom = -118;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 210;
sun.shadow.bias = -0.0004;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x87a9c5, 0.8);
fill.position.set(45, 28, -55);
scene.add(fill);

function makeNoiseTexture(kind, seed = 1) {
  const size = kind === 'normal' ? 128 : 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const image = ctx.createImageData(size, size);
  let s = seed >>> 0;
  const rand = () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < size * size; i++) {
    const n = rand();
    if (kind === 'normal') {
      image.data[i * 4] = 116 + Math.round(n * 24);
      image.data[i * 4 + 1] = 116 + Math.round(rand() * 24);
      image.data[i * 4 + 2] = 238 + Math.round(rand() * 17);
      image.data[i * 4 + 3] = 255;
    } else if (kind === 'rough') {
      const v = 165 + Math.round(n * 85);
      image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = v;
      image.data[i * 4 + 3] = 255;
    } else if (kind === 'metal') {
      const v = n > 0.987 ? 180 : 8 + Math.round(n * 18);
      image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = v;
      image.data[i * 4 + 3] = 255;
    } else {
      const base = n > 0.93 ? 166 : 124 + Math.round(n * 36);
      image.data[i * 4] = base + 15;
      image.data[i * 4 + 1] = base + 9;
      image.data[i * 4 + 2] = base - 4;
      image.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(kind === 'albedo' ? 10 : 8, kind === 'albedo' ? 10 : 8);
  if (kind === 'albedo') t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return t;
}
MATERIALS.sand = new THREE.MeshStandardMaterial({ map: makeNoiseTexture('albedo', 5), normalMap: makeNoiseTexture('normal', 12), roughnessMap: makeNoiseTexture('rough', 19), metalnessMap: makeNoiseTexture('metal', 27), roughness: 0.94, metalness: 0.08 });
MATERIALS.concrete = new THREE.MeshStandardMaterial({ color: '#77776d', map: makeNoiseTexture('albedo', 33), roughnessMap: makeNoiseTexture('rough', 41), roughness: 0.9, metalness: 0.08 });
MATERIALS.darkMetal = new THREE.MeshStandardMaterial({ color: '#303a42', metalness: 0.76, roughness: 0.34 });
MATERIALS.rust = new THREE.MeshStandardMaterial({ color: '#8b5a3d', metalness: 0.44, roughness: 0.72 });
MATERIALS.glass = new THREE.MeshStandardMaterial({ color: '#8dd8dc', emissive: '#1e525d', emissiveIntensity: 0.45, metalness: 0.38, roughness: 0.2 });
MATERIALS.foliage = new THREE.MeshStandardMaterial({ color: '#536a4c', roughness: 0.97 });
MATERIALS.trunk = new THREE.MeshStandardMaterial({ color: '#594638', roughness: 1 });
MATERIALS.crate = new THREE.MeshStandardMaterial({ color: '#aa8451', roughness: 0.84, metalness: 0.08 });
MATERIALS.enemy = new THREE.MeshStandardMaterial({ color: '#374a50', roughness: 0.68, metalness: 0.16 });
MATERIALS.enemyAccent = new THREE.MeshStandardMaterial({ color: '#d18148', emissive: '#401708', emissiveIntensity: 0.35, roughness: 0.62 });

function terrainHeight(x, z) {
  return Math.sin(x * 0.035) * 1.7 + Math.cos(z * 0.029) * 1.45 + Math.sin((x + z) * 0.018) * 1.8 + Math.cos((x - z) * 0.044) * 0.65;
}
function addBox(parent, x, y, z, sx, sy, sz, material, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const staticBoxes = [];
const occluders = [];
function makeTerrain() {
  const seg = 100;
  const verts = new Float32Array((seg + 1) * (seg + 1) * 3);
  const idx = [];
  let p = 0;
  for (let iz = 0; iz <= seg; iz++) {
    const z = -HALF_WORLD + WORLD_SIZE * iz / seg;
    for (let ix = 0; ix <= seg; ix++) {
      const x = -HALF_WORLD + WORLD_SIZE * ix / seg;
      verts[p++] = x;
      verts[p++] = terrainHeight(x, z);
      verts[p++] = z;
    }
  }
  for (let iz = 0; iz < seg; iz++) for (let ix = 0; ix < seg; ix++) {
    const a = iz * (seg + 1) + ix;
    const b = a + 1;
    const c = a + seg + 1;
    const d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const indices = new Uint32Array(idx);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, MATERIALS.sand);
  ground.receiveShadow = true;
  scene.add(ground);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: '#263e42', roughness: 0.38, metalness: 0.18 }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -4.8;
  ocean.receiveShadow = true;
  scene.add(ocean);
  return { verts, indices, ground };
}
const terrain = makeTerrain();

function makeWorldLabel(text, color = '#d8e3e1') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(7,12,16,.78)';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(110,220,221,.55)';
  ctx.lineWidth = 3; ctx.strokeRect(2, 2, c.width - 4, c.height - 4);
  ctx.font = '700 32px ui-monospace, monospace';
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(15, 2.8, 1);
  return sprite;
}
const buildingDefs = [
  { x: -47, z: -35, w: 24, d: 17, floors: 2, label: 'RESEARCH ANNEX' },
  { x: 41, z: -28, w: 21, d: 15, floors: 2, label: 'RELAY YARD' },
  { x: -38, z: 42, w: 19, d: 14, floors: 1, label: 'QUARANTINE DEPOT' },
  { x: 48, z: 43, w: 23, d: 17, floors: 2, label: 'TRANSFER STATION' },
  { x: 0, z: -4, w: 15, d: 12, floors: 2, label: 'FIELD CONTROL' }
];
function makeBuilding(def) {
  const group = new THREE.Group();
  const floorH = 3.3;
  const h = floorH * def.floors;
  const baseY = terrainHeight(def.x, def.z);
  const bodyMat = MATERIALS.concrete;
  addBox(group, 0, h / 2, 0, def.w, h, def.d, bodyMat);
  addBox(group, 0, h + 0.18, 0, def.w + 1, 0.36, def.d + 1, MATERIALS.darkMetal);
  for (let floor = 0; floor < def.floors; floor++) {
    const y = floor * floorH + 1.65;
    for (const side of [-1, 1]) {
      for (let j = -1; j <= 1; j++) {
        const wx = j * def.w * 0.28;
        const win = addBox(group, wx, y, side * (def.d / 2 + 0.012), 2.15, 1.15, 0.04, MATERIALS.glass, false);
        win.userData.glow = true;
      }
      const wz = side * def.d * 0.28;
      addBox(group, side * (def.w / 2 + 0.012), y, wz, 0.04, 1.15, 2.0, MATERIALS.glass, false);
    }
  }
  addBox(group, 0, 0.22, def.d / 2 + 0.04, 3.0, 0.44, 0.18, MATERIALS.rust);
  const label = makeWorldLabel(def.label);
  label.position.set(0, h + 4.4, 0);
  group.add(label);
  group.position.set(def.x, baseY, def.z);
  scene.add(group);
  occluders.push(group);
  staticBoxes.push({ x: def.x, y: baseY + h / 2, z: def.z, hx: def.w / 2, hy: h / 2, hz: def.d / 2 });
}
buildingDefs.forEach(makeBuilding);

function addFoliage() {
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 2.2, 6);
  const crownGeo = new THREE.ConeGeometry(1.25, 3.2, 7);
  const trunks = new THREE.InstancedMesh(trunkGeo, MATERIALS.trunk, 64);
  const crowns = new THREE.InstancedMesh(crownGeo, MATERIALS.foliage, 64);
  const dummy = new THREE.Object3D();
  let count = 0;
  for (let i = 0; i < 160 && count < 64; i++) {
    const a = i * 2.399;
    const r = 30 + (i % 7) * 8;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (buildingDefs.some((b) => Math.abs(x - b.x) < b.w / 2 + 4 && Math.abs(z - b.z) < b.d / 2 + 4)) continue;
    const y = terrainHeight(x, z);
    dummy.position.set(x, y + 1.1, z); dummy.rotation.set(0, a, 0); dummy.scale.setScalar(0.75 + (i % 3) * 0.18); dummy.updateMatrix(); trunks.setMatrixAt(count, dummy.matrix);
    dummy.position.set(x, y + 3.5, z); dummy.rotation.set(0, a, 0); dummy.updateMatrix(); crowns.setMatrixAt(count, dummy.matrix);
    count++;
  }
  trunks.count = crowns.count = count;
  trunks.castShadow = crowns.castShadow = true;
  trunks.receiveShadow = crowns.receiveShadow = true;
  scene.add(trunks, crowns);
}
addFoliage();

const poiMarkers = [];
for (const def of buildingDefs) {
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 10, 8), new THREE.MeshBasicMaterial({ color: '#68dce2', transparent: true, opacity: 0.24 }));
  beacon.position.set(def.x, terrainHeight(def.x, def.z) + 6, def.z);
  scene.add(beacon);
  poiMarkers.push({ x: def.x, z: def.z, name: def.label });
}
const anomaly = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), new THREE.MeshBasicMaterial({ color: '#b7fbff', transparent: true, opacity: 0.36, side: THREE.DoubleSide, depthWrite: false }));
anomaly.rotation.x = -Math.PI / 2;
anomaly.position.y = -0.8;
anomaly.scale.setScalar(96);
scene.add(anomaly);

const extractionSites = [
  { x: 73, z: 0, name: 'NORTH RELAY', mesh: null },
  { x: -70, z: -18, name: 'DRY DOCK', mesh: null },
  { x: 3, z: 76, name: 'SOUTH CUT', mesh: null }
];
for (const site of extractionSites) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.0, 4.6, 40), new THREE.MeshBasicMaterial({ color: '#7de2d1', transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(site.x, terrainHeight(site.x, site.z) + 0.22, site.z);
  site.mesh = ring;
  scene.add(ring);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 4.5, 8), MATERIALS.darkMetal);
  mast.position.set(site.x, terrainHeight(site.x, site.z) + 2.25, site.z);
  scene.add(mast);
  const lamp = new THREE.PointLight('#80e8d5', 2.0, 18);
  lamp.position.set(site.x, terrainHeight(site.x, site.z) + 4.8, site.z);
  scene.add(lamp);
}

const worldLoot = [];
function makeLootEntity(x, z, title, items, kind = 'crate') {
  const group = new THREE.Group();
  const baseY = terrainHeight(x, z);
  const body = addBox(group, 0, 0.55, 0, kind === 'cache' ? 1.1 : 1.35, 1.1, kind === 'cache' ? 0.85 : 1.1, kind === 'cache' ? MATERIALS.darkMetal : MATERIALS.crate);
  addBox(group, 0, 1.13, 0, 1.42, 0.12, 1.16, MATERIALS.rust);
  const light = new THREE.PointLight(kind === 'cache' ? '#ffd178' : '#70d4d7', 0.75, 7);
  light.position.set(0, 1.7, 0); group.add(light);
  group.position.set(x, baseY, z);
  group.userData.kind = kind;
  scene.add(group);
  const entity = { x, z, title, items: items.map((i) => ({ ...i })), group, light, empty: false };
  body.userData.entity = entity;
  worldLoot.push(entity);
  return entity;
}
function resetLoot() {
  for (const e of [...worldLoot]) scene.remove(e.group);
  worldLoot.length = 0;
  makeLootEntity(-25, -30, 'RESEARCH LOCKER', [{ itemId: 'intel', count: 1 }, { itemId: 'cell', count: 1 }, { itemId: 'medkit', count: 1 }]);
  makeLootEntity(30, -15, 'FIELD CACHE', [{ itemId: 'plate', count: 1 }, { itemId: 'optic', count: 1 }]);
  makeLootEntity(34, 43, 'TRANSFER CRATE', [{ itemId: 'intel', count: 1 }, { itemId: 'stimulant', count: 2 }]);
  makeLootEntity(-61, 20, 'SIGNAL CASE', [{ itemId: 'cell', count: 2 }, { itemId: 'suppressor', count: 1 }]);
}
resetLoot();

let physics = null;
let playerBody = null;
let physicsAccumulator = 0;
let physicsReady = false;
let fallbackPos = new THREE.Vector3(0, terrainHeight(0, 73) + 1.35, 73);
async function initPhysics() {
  try {
    await RAPIER.init();
    physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const groundBody = physics.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    physics.createCollider(RAPIER.ColliderDesc.trimesh(terrain.verts, terrain.indices), groundBody);
    for (const box of staticBoxes) {
      const body = physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(box.x, box.y, box.z));
      physics.createCollider(RAPIER.ColliderDesc.cuboid(box.hx, box.hy, box.hz), body);
    }
    playerBody = physics.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(fallbackPos.x, fallbackPos.y, fallbackPos.z).lockRotations().setLinearDamping(4.0));
    const playerCollider = RAPIER.ColliderDesc.capsule(0.55, 0.34).setFriction(0.0).setRestitution(0.0);
    physics.createCollider(playerCollider, playerBody);
    physicsReady = true;
  } catch (err) {
    console.warn('[Zero-Zone] Rapier unavailable; using local kinematic fallback.', err);
    $('physics-status').textContent = 'KINEMATIC FALLBACK';
  }
}
function getPlayerPosition() {
  if (playerBody) {
    const p = playerBody.translation();
    return new THREE.Vector3(p.x, p.y, p.z);
  }
  return fallbackPos.clone();
}
function setPlayerPosition(x, z) {
  const y = terrainHeight(x, z) + 1.35;
  fallbackPos.set(x, y, z);
  if (playerBody) {
    playerBody.setTranslation({ x, y, z }, true);
    playerBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }
}

const npcList = [];
const projectiles = [];
const bulletRay = new THREE.Raycaster();
const enemyRay = new THREE.Raycaster();
const keys = new Set();
const mouse = { yaw: 0, pitch: 0, look: false };
let audioContext = null;
function sound(freq = 220, duration = 0.06, type = 'triangle', pan = 0) {
  try {
    audioContext ||= new AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const panner = audioContext.createStereoPanner();
    osc.type = type; osc.frequency.value = freq; panner.pan.value = clamp(pan, -1, 1);
    gain.gain.setValueAtTime(0.055, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    osc.connect(gain); gain.connect(panner); panner.connect(audioContext.destination);
    osc.start(); osc.stop(audioContext.currentTime + duration);
  } catch { /* Audio is an enhancement; gameplay remains available. */ }
}
function toast(text, seconds = 2.4) {
  const el = $('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  state.messageTimer = seconds;
}

function makeEnemy(config) {
  const group = new THREE.Group();
  const heavy = config.type === 'JUGGERNAUT';
  const scale = heavy ? 1.16 : config.type === 'SPECTRE' ? 0.88 : 1.0;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42 * scale, 0.7 * scale, 4, 7), MATERIALS.enemy);
  torso.position.y = 1.12 * scale; torso.castShadow = true; torso.userData.npcId = config.id; torso.userData.hitZone = 'torso'; group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26 * scale, 10, 8), MATERIALS.enemyAccent);
  head.position.y = 1.92 * scale; head.castShadow = true; head.userData.npcId = config.id; head.userData.hitZone = 'head'; group.add(head);
  const pack = addBox(group, 0, 1.17 * scale, 0.36 * scale, 0.48 * scale, 0.62 * scale, 0.22 * scale, MATERIALS.darkMetal);
  pack.userData.npcId = config.id; pack.userData.hitZone = 'torso';
  const lamp = new THREE.PointLight(heavy ? '#ffb36b' : '#e16e5c', 0.8, 6);
  lamp.position.set(0, 2.05 * scale, 0); group.add(lamp);
  group.position.set(config.x, terrainHeight(config.x, config.z), config.z);
  scene.add(group);
  const npc = { ...config, group, hp: heavy ? 175 : config.type === 'SPECTRE' ? 78 : 110, maxHp: heavy ? 175 : config.type === 'SPECTRE' ? 78 : 110, speed: heavy ? 1.25 : config.type === 'SPECTRE' ? 2.7 : 1.8, state: 'PATROL', cooldown: 1 + Math.random(), alive: true, waypoint: new THREE.Vector3(config.x + (Math.random() - .5) * 22, 0, config.z + (Math.random() - .5) * 22), alert: 0, hitMeshes: [torso, head, pack] };
  npcList.push(npc);
  return npc;
}
function spawnGuards() {
  for (const n of npcList) scene.remove(n.group);
  npcList.length = 0;
  makeEnemy({ id: 'g-01', name: 'Bastion', type: 'JUGGERNAUT', x: -28, z: -21 });
  makeEnemy({ id: 'g-02', name: 'Wraith', type: 'SPECTRE', x: 31, z: -4 });
  makeEnemy({ id: 'g-03', name: 'Patrol Cell 01', type: 'SQUAD', x: 48, z: 32 });
  makeEnemy({ id: 'g-04', name: 'Patrol Cell 02', type: 'SQUAD', x: 54, z: 35 });
  makeEnemy({ id: 'g-05', name: 'Patrol Cell 03', type: 'SQUAD', x: 42, z: 38 });
}
function dropGuardLoot(npc) {
  const item = Math.random() > 0.55 ? 'intel' : Math.random() > 0.5 ? 'cell' : 'medkit';
  makeLootEntity(npc.group.position.x, npc.group.position.z, `${npc.name} // RECOVERY`, [{ itemId: item, count: 1 }, { itemId: 'plate', count: 1 }], 'cache');
}
function damageGuard(npc, damage, hitZone) {
  if (!npc?.alive) return;
  const actual = damage * (hitZone === 'head' ? 2.0 : hitZone === 'limb' ? 0.72 : 1);
  npc.hp = Math.max(0, npc.hp - actual);
  npc.state = 'ENGAGE'; npc.alert = 10;
  sound(hitZone === 'head' ? 820 : 420, 0.06, 'sine');
  if (npc.hp <= 0) {
    npc.alive = false;
    npc.group.visible = false;
    state.kills++;
    state.contractKills++;
    dropGuardLoot(npc);
    toast(`${npc.name} neutralized // recovery cache marked`);
  }
}

function weapon() { return WEAPONS[state.weaponIndex]; }
function setWeapon(index) {
  state.weaponIndex = (index + WEAPONS.length) % WEAPONS.length;
  const w = weapon();
  state.ammo = Math.min(state.ammo || w.magazine, w.magazine);
  state.reserve = Math.max(state.reserve, w.reserve);
  $('hud-weapon').textContent = w.name;
  $('hud-weapon-type').textContent = w.type;
  updateHUD();
}
function addTracer(a, b, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.88 }));
  line.frustumCulled = false;
  scene.add(line);
  setTimeout(() => { scene.remove(line); geo.dispose(); line.material.dispose(); }, 115);
}
function fireWeapon() {
  if (state.mode !== 'raid' || state.reload > 0 || state.shotCooldown > 0) return;
  const w = weapon();
  if (state.ammo <= 0) { toast('MAGAZINE EMPTY // R TO RELOAD'); sound(110, 0.08, 'square'); return; }
  state.ammo--;
  state.shotCooldown = w.cadence;
  state.recoil = Math.min(0.08, state.recoil + w.recoil);
  sound(92 + Math.random() * 20, 0.09, 'sawtooth', Math.sin(mouse.yaw) * 0.25);
  const origin = camera.position.clone();
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const spread = w.spread * (state.ads ? 0.36 : 1) * (state.crouch ? 0.74 : 1);
  direction.x += (Math.random() - 0.5) * spread;
  direction.y += (Math.random() - 0.5) * spread;
  direction.z += (Math.random() - 0.5) * spread;
  direction.normalize();
  for (let i = 0; i < w.pellets; i++) {
    const d = direction.clone();
    if (w.pellets > 1) { d.x += (Math.random() - .5) * spread * 1.6; d.y += (Math.random() - .5) * spread * 1.6; d.normalize(); }
    const velocity = d.multiplyScalar(w.velocity);
    projectiles.push({ pos: origin.clone(), velocity, gravity: w.gravity, damage: w.damage, life: 1.5, color: w.color, owner: 'player' });
  }
  updateHUD();
}
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    if (p.life <= 0) { projectiles.splice(i, 1); continue; }
    const previous = p.pos.clone();
    p.velocity.y -= p.gravity * dt;
    p.pos.addScaledVector(p.velocity, dt);
    const segment = p.pos.clone().sub(previous);
    const length = segment.length();
    if (length < 0.001) continue;
    bulletRay.set(previous, segment.normalize());
    bulletRay.far = length + 0.05;
    const targets = [terrain.ground, ...occluders, ...worldLoot.filter((e) => !e.empty).map((e) => e.group), ...npcList.filter((n) => n.alive).flatMap((n) => n.hitMeshes)];
    const hit = bulletRay.intersectObjects(targets, true)[0];
    addTracer(previous, p.pos, p.color);
    if (hit) {
      const npcId = hit.object.userData.npcId;
      const npc = npcId ? npcList.find((n) => n.id === npcId) : null;
      if (npc) damageGuard(npc, p.damage, hit.object.userData.hitZone || 'torso');
      projectiles.splice(i, 1);
      continue;
    }
  }
}
function reload() {
  if (state.mode !== 'raid' || state.reload > 0) return;
  const w = weapon();
  if (state.ammo >= w.magazine || state.reserve <= 0) return;
  state.reload = w.reload;
  toast('RELOADING // HOLD POSITION');
  sound(260, 0.1, 'triangle');
}
function finishReload() {
  const w = weapon();
  const amount = Math.min(w.magazine - state.ammo, state.reserve);
  state.ammo += amount; state.reserve -= amount; state.reload = 0;
  sound(380, 0.06, 'sine');
}

function drawRadar() {
  const radar = $('tactical-radar');
  const ctx = radar.getContext('2d');
  const size = radar.width;
  const mid = size / 2;
  const pos = getPlayerPosition();
  const scale = size / 210;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#0a1216'; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(120,186,186,.18)'; ctx.lineWidth = 1;
  for (const r of [0.24, 0.48, 0.72]) { ctx.beginPath(); ctx.arc(mid, mid, r * size, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(113,225,209,.35)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(mid, mid, state.safeRadius * scale, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  const mapPoint = (x, z) => [mid + (x - pos.x) * scale, mid + (z - pos.z) * scale];
  for (const p of poiMarkers) {
    const [x, y] = mapPoint(p.x, p.z); ctx.fillStyle = 'rgba(138,174,166,.7)'; ctx.fillRect(x - 2, y - 2, 4, 4);
  }
  const site = extractionSites[state.extractionSiteIndex];
  const [sx, sy] = mapPoint(site.x, site.z);
  ctx.strokeStyle = '#82e3d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.stroke();
  for (const n of npcList) {
    if (!n.alive) continue;
    const d = Math.hypot(n.group.position.x - pos.x, n.group.position.z - pos.z);
    if (state.scanner > 0 || d < 38 || n.state === 'ENGAGE') {
      const [x, y] = mapPoint(n.group.position.x, n.group.position.z);
      ctx.fillStyle = '#f07464'; ctx.beginPath(); ctx.arc(x, y, 2.7, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.save(); ctx.translate(mid, mid); ctx.rotate(-mouse.yaw); ctx.fillStyle = '#d6f1e8';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4.5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill(); ctx.restore();
}
function updateHUD() {
  if (state.mode !== 'raid') return;
  const m = Math.floor(state.timer / 60); const s = Math.floor(state.timer % 60);
  $('hud-timer').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  $('hud-hp').textContent = `${Math.ceil(state.hp)}%`;
  $('hud-armor').textContent = `${Math.ceil(state.armor)}%`;
  $('hp-bar').style.width = `${clamp(state.hp, 0, 100)}%`;
  $('armor-bar').style.width = `${clamp(state.armor / 60 * 100, 0, 100)}%`;
  $('stamina-bar').style.width = `${state.stamina}%`;
  $('hud-ammo').textContent = state.reload > 0 ? 'RELOAD' : `${state.ammo} / ${state.reserve}`;
  $('hud-weapon').textContent = weapon().name;
  $('anomaly-readout').textContent = `${Math.round(state.safeRadius)}m SAFE RADIUS`;
  $('anomaly-bar').style.width = `${clamp((state.safeRadius - 24) / 72 * 100, 0, 100)}%`;
  $('objective-status').textContent = state.extractionStarted ? `EXTRACTION ${Math.floor(state.extractionProgress / 15 * 100)}%` : 'RECOVER INTEL // REACH ACTIVE SITE';
  $('contract-status').textContent = `GUARDS ${state.contractKills}/3`;
  $('ks-uav').textContent = state.scanner > 0 ? `[4] UAV ${Math.ceil(state.scanner)}s` : state.scannerCooldown > 0 ? `[4] UAV (${Math.ceil(state.scannerCooldown)}s)` : '[4] UAV READY';
  $('ks-arty').textContent = state.artyCooldown > 0 ? `[5] Arty (${Math.ceil(state.artyCooldown)}s)` : '[5] Arty READY';
  $('ks-uav').classList.toggle('ready', state.scanner <= 0 && state.scannerCooldown <= 0);
  $('ks-arty').classList.toggle('ready', state.artyCooldown <= 0);
  $('anomaly-alert').classList.toggle('visible', new THREE.Vector2(getPlayerPosition().x, getPlayerPosition().z).length() > state.safeRadius);
  drawRadar();
}

function renderBase() {
  $('profile-xp').textContent = `${profile.xp.toLocaleString()} XP`;
  $('profile-raids').textContent = `${profile.raids} RUNS`;
  const stash = $('stash-list');
  stash.innerHTML = profile.stash.length ? profile.stash.map((e) => {
    const d = ITEM_DEFS[e.itemId];
    return `<div class="stash-row"><span class="item-mark" style="--item:${d?.color || '#93a7aa'}"></span><span>${d?.name || e.itemId}</span><b>×${e.count}</b><small>${d?.weight || 0} kg</small></div>`;
  }).join('') : '<div class="empty-note">STASH EMPTY // EXTRACT TO RECOVER ITEMS</div>';
  const w = WEAPONS.find((x) => x.id === profile.loadout.weaponId) || WEAPONS[0];
  $('selected-weapon').textContent = w.name;
  $('loadout-weapon').innerHTML = WEAPONS.map((x) => `<button class="weapon-choice ${x.id === w.id ? 'selected' : ''}" data-weapon="${x.id}"><span>${x.type}</span><b>${x.name}</b><small>${x.damage} DMG · ${x.magazine} MAG</small></button>`).join('');
  $('loadout-weapon').querySelectorAll('[data-weapon]').forEach((btn) => btn.addEventListener('click', () => { profile.loadout.weaponId = btn.dataset.weapon; saveProfile(); }));
  $('optic-toggle').setAttribute('aria-pressed', String(profile.loadout.optic));
  $('optic-toggle').textContent = profile.loadout.optic ? 'PRISM OPTIC · INSTALLED' : 'INSTALL PRISM OPTIC';
  $('suppressor-toggle').setAttribute('aria-pressed', String(profile.loadout.suppressor));
  $('suppressor-toggle').textContent = profile.loadout.suppressor ? 'SOUND SHROUD · INSTALLED' : 'INSTALL SOUND SHROUD';
  $('contract-toggle').setAttribute('aria-pressed', String(profile.contract));
  $('contract-toggle').textContent = profile.contract ? 'CONTRACT ACTIVE · SECURE 3 CORES' : 'ACCEPT · SECURE 3 CORES';
  $('base-status').textContent = profile.raids ? 'OPERATIONS READY' : 'FIRST DEPLOYMENT // KIT RISK: HIGH';
}

function startRaid() {
  if (state.mode === 'raid') return;
  state.mode = 'raid';
  state.hp = 100; state.armor = profile.loadout.armor ? 60 : 0; state.stamina = 100;
  state.timer = RAID_SECONDS; state.elapsed = 0; state.safeRadius = 96;
  state.extractionStarted = false; state.extractionProgress = 0;
  state.extractionSiteIndex = (profile.raids + Math.floor(Math.random() * extractionSites.length)) % extractionSites.length;
  state.kills = 0; state.contractKills = 0; state.bag = [];
  state.reload = 0; state.shotCooldown = 0; state.recoil = 0;
  const w = WEAPONS.find((x) => x.id === profile.loadout.weaponId) || WEAPONS[0];
  state.weaponIndex = WEAPONS.indexOf(w); state.ammo = w.magazine; state.reserve = w.reserve;
  resetLoot(); spawnGuards(); setPlayerPosition(0, 73);
  $('base-screen').hidden = true; $('results-screen').hidden = true; $('raid-hud').hidden = false;
  $('hud-weather').textContent = WEATHER[state.weather];
  $('mission-label').textContent = 'RAID // SECTOR 04';
  $('interaction-hint').classList.remove('visible');
  toast('INSERTION COMPLETE // RECOVER WHAT YOU CAN');
  sound(420, 0.14, 'sine');
  updateHUD();
  canvas.focus();
  canvas.requestPointerLock?.();
}

function openLoot(entity) {
  if (!entity || entity.empty) return;
  state.activeLoot = entity;
  $('loot-title').textContent = entity.title;
  const list = $('loot-items');
  list.innerHTML = entity.items.length ? entity.items.map((it, i) => {
    const d = ITEM_DEFS[it.itemId];
    return `<button class="loot-row" data-take="${i}"><span class="item-mark" style="--item:${d?.color || '#92a5a7'}"></span><span>${d?.name || it.itemId}</span><b>×${it.count}</b><small>${d?.value || 0} cr</small><em>TAKE</em></button>`;
  }).join('') : '<div class="empty-note">CONTAINER EMPTY</div>';
  list.querySelectorAll('[data-take]').forEach((btn) => btn.addEventListener('click', () => takeLoot(Number(btn.dataset.take))));
  $('loot-panel').hidden = false;
  document.exitPointerLock?.();
}
function closeLoot() {
  $('loot-panel').hidden = true;
  state.activeLoot = null;
  if (state.mode === 'raid') canvas.requestPointerLock?.();
}
function takeLoot(index) {
  const entity = state.activeLoot;
  if (!entity || !entity.items[index]) return;
  const item = entity.items[index];
  const def = ITEM_DEFS[item.itemId];
  const currentWeight = state.bag.reduce((sum, e) => sum + (ITEM_DEFS[e.itemId]?.weight || 0) * e.count, 0);
  if (currentWeight + (def?.weight || 0) * item.count > 30) { toast('PACK FULL // DROP OR SECURE ITEMS'); return; }
  state.bag.push({ ...item });
  entity.items.splice(index, 1);
  if (entity.items.length === 0) { entity.empty = true; entity.group.visible = false; }
  openLoot(entity);
  sound(620, 0.05, 'sine');
}
function nearestLoot(maxDistance = 3.2) {
  const p = getPlayerPosition();
  let best = null; let bestDist = maxDistance;
  for (const e of worldLoot) {
    if (e.empty || !e.group.visible) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}
function nearestSite(maxDistance = 6) {
  const p = getPlayerPosition();
  const site = extractionSites[state.extractionSiteIndex];
  return Math.hypot(site.x - p.x, site.z - p.z) < maxDistance ? site : null;
}
function interact() {
  if (state.mode !== 'raid') return;
  if (! $('loot-panel').hidden) { closeLoot(); return; }
  const crate = nearestLoot();
  if (crate) { openLoot(crate); return; }
  const site = nearestSite();
  if (site) { startExtraction(); return; }
  toast('NO INTERACTABLE IN RANGE');
}
function startExtraction() {
  if (state.extractionStarted) { toast('EXTRACTION SIGNAL ALREADY ACTIVE'); return; }
  state.extractionStarted = true;
  state.extractionProgress = 0;
  toast('FLARE DEPLOYED // HOLD THE SITE');
  sound(760, 0.18, 'triangle');
  $('extraction-readout').textContent = extractionSites[state.extractionSiteIndex].name;
}
function spawnDeathCache() {
  const p = getPlayerPosition();
  const items = [...state.bag.map((e) => ({ ...e })), { itemId: 'intel', count: 1 }];
  makeLootEntity(p.x + 1.4, p.z + 1.2, 'CONTRACTOR // LOSS CACHE', items, 'cache');
  toast('OPERATOR DOWN // INTEL CORE DROPPED');
}
function finishRaid(extracted, reason = '') {
  if (state.mode !== 'raid') return;
  state.mode = 'results';
  document.exitPointerLock?.();
  $('raid-hud').hidden = true;
  $('loot-panel').hidden = true;
  const secured = extracted ? state.bag.reduce((sum, e) => sum + e.count, 0) : 0;
  const value = extracted ? state.bag.reduce((sum, e) => sum + (ITEM_DEFS[e.itemId]?.value || 0) * e.count, 0) : 0;
  if (extracted) {
    profile.stash.push(...state.bag.map((e) => ({ ...e })));
    profile.xp += 180 + state.kills * 45 + Math.round(value * 0.04);
    profile.raids++;
    if (profile.contract && state.contractKills >= 3) { profile.xp += 500; profile.stash.push({ itemId: 'intel', count: 2 }); }
    saveProfile();
  } else {
    profile.raids++;
    saveProfile();
  }
  state.lastRun = { extracted, reason, secured, value, kills: state.kills, duration: Math.floor(state.elapsed), items: extracted ? state.bag.map((e) => ({ ...e })) : [] };
  $('results-kicker').textContent = extracted ? 'EXTRACTION CONFIRMED' : 'RUN LOST';
  $('results-title').textContent = extracted ? 'LOOT SECURED' : 'CONTRACTOR DOWN';
  $('results-copy').textContent = extracted ? `You recovered ${secured} item stacks worth ${value.toLocaleString()} credits and returned with ${state.kills} confirmed neutralizations.` : `${reason || 'The raid ended before extraction.'} Carried items and the deployed kit remain outside the stash.`;
  $('results-items').innerHTML = extracted && state.bag.length ? state.bag.map((e) => `<div class="result-row"><span>${ITEM_DEFS[e.itemId]?.name || e.itemId}</span><b>×${e.count}</b></div>`).join('') : '<div class="empty-note">NO ITEMS BANKED // STASH UNCHANGED</div>';
  $('results-stats').innerHTML = `<span><b>${state.kills}</b> NEUTRALIZATIONS</span><span><b>${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}</b> IN SECTOR</span><span><b>${value.toLocaleString()}</b> RECOVERED VALUE</span>`;
  $('results-screen').hidden = false;
  sound(extracted ? 690 : 130, 0.35, extracted ? 'sine' : 'sawtooth');
}

function triggerScanner() {
  if (state.scannerCooldown > 0) return;
  state.scanner = 12; state.scannerCooldown = 28;
  toast('UAV PULSE // HOSTILE CONTACTS MARKED');
  sound(840, 0.2, 'sine');
}
function triggerArty() {
  if (state.artyCooldown > 0) return;
  state.artyCooldown = 45;
  const p = getPlayerPosition();
  const target = npcList.filter((n) => n.alive).sort((a, b) => a.group.position.distanceTo(p) - b.group.position.distanceTo(p))[0];
  if (target) {
    const center = target.group.position.clone();
    for (const n of npcList) if (n.alive && n.group.position.distanceTo(center) < 11) damageGuard(n, 54, 'torso');
    const flash = new THREE.PointLight('#ff9d59', 18, 26); flash.position.copy(center).add(new THREE.Vector3(0, 4, 0)); scene.add(flash);
    setTimeout(() => scene.remove(flash), 380);
    toast('SUPPORT STRIKE // IMPACT GRID MARKED');
  } else toast('SUPPORT STRIKE READY // NO HOSTILES MARKED');
  sound(120, 0.32, 'sawtooth');
}

function updateNPCs(dt) {
  const p = getPlayerPosition();
  for (const n of npcList) {
    if (!n.alive) continue;
    const pos = n.group.position;
    const dx = p.x - pos.x, dz = p.z - pos.z;
    const dist = Math.hypot(dx, dz);
    n.cooldown -= dt;
    if (dist < 47) { n.state = 'ENGAGE'; n.alert = 8; }
    else if (n.alert > 0) n.alert -= dt;
    else n.state = 'PATROL';
    let vx = 0, vz = 0;
    if (n.state === 'ENGAGE') {
      if (dist > 12) { vx = dx / Math.max(1, dist); vz = dz / Math.max(1, dist); }
      else { vx = -dz / Math.max(1, dist) * 0.35; vz = dx / Math.max(1, dist) * 0.35; }
      if (dist < 31 && n.cooldown <= 0) {
        n.cooldown = n.type === 'JUGGERNAUT' ? 1.35 : n.type === 'SPECTRE' ? 0.92 : 1.15;
        const accuracy = clamp(0.58 - dist / 90, 0.17, 0.5);
        if (Math.random() < accuracy) {
          const damage = n.type === 'JUGGERNAUT' ? 15 : n.type === 'SPECTRE' ? 9 : 11;
          const absorbed = Math.min(state.armor, damage);
          state.armor -= absorbed;
          state.hp = Math.max(0, state.hp - (damage - absorbed));
          $('damage-flash').classList.add('active');
          setTimeout(() => $('damage-flash').classList.remove('active'), 180);
          toast(`CONTACT // ${n.name.toUpperCase()}`, 0.8);
          sound(96, 0.08, 'square', clamp((pos.x - p.x) / 30, -1, 1));
          if (state.hp <= 0) { spawnDeathCache(); finishRaid(false, 'Eliminated by hostile fire.'); return; }
        }
      }
    } else {
      const wx = n.waypoint.x - pos.x, wz = n.waypoint.z - pos.z;
      const wd = Math.hypot(wx, wz);
      if (wd < 2.8) {
        n.waypoint.set(n.x + (Math.random() - .5) * 26, 0, n.z + (Math.random() - .5) * 26);
      } else { vx = wx / wd * 0.45; vz = wz / wd * 0.45; }
    }
    const speed = n.speed * (n.type === 'SPECTRE' && dist < 20 ? 1.2 : 1);
    pos.x = clamp(pos.x + vx * speed * dt, -HALF_WORLD + 6, HALF_WORLD - 6);
    pos.z = clamp(pos.z + vz * speed * dt, -HALF_WORLD + 6, HALF_WORLD - 6);
    pos.y = terrainHeight(pos.x, pos.z);
    if (dist > 0.5) n.group.rotation.y = Math.atan2(dx, dz);
  }
}

function updateMovement(dt) {
  if (state.mode !== 'raid' || !document.pointerLockElement) return;
  const forward = new THREE.Vector3(-Math.sin(mouse.yaw), 0, -Math.cos(mouse.yaw));
  const right = new THREE.Vector3(Math.cos(mouse.yaw), 0, -Math.sin(mouse.yaw));
  const move = new THREE.Vector3();
  if (keys.has('KeyW')) move.add(forward);
  if (keys.has('KeyS')) move.sub(forward);
  if (keys.has('KeyD')) move.add(right);
  if (keys.has('KeyA')) move.sub(right);
  if (move.lengthSq() > 0) move.normalize();
  const sprinting = keys.has('ShiftLeft') && state.stamina > 1 && move.lengthSq() > 0;
  const speed = sprinting ? 8.1 : state.crouch ? 2.6 : 5.2;
  if (sprinting) state.stamina = Math.max(0, state.stamina - dt * 18);
  else state.stamina = Math.min(100, state.stamina + dt * 9);
  if (playerBody) {
    const old = playerBody.linvel();
    playerBody.setLinvel({ x: move.x * speed, y: old.y, z: move.z * speed }, true);
    if (keys.has('Space') && Math.abs(old.y) < 0.22) playerBody.setLinvel({ x: move.x * speed, y: 5.7, z: move.z * speed }, true);
  } else {
    fallbackPos.x = clamp(fallbackPos.x + move.x * speed * dt, -HALF_WORLD + 3, HALF_WORLD - 3);
    fallbackPos.z = clamp(fallbackPos.z + move.z * speed * dt, -HALF_WORLD + 3, HALF_WORLD - 3);
    fallbackPos.y = terrainHeight(fallbackPos.x, fallbackPos.z) + 1.35;
  }
}
function updateCamera() {
  if (state.mode === 'raid') {
    const p = getPlayerPosition();
    camera.position.set(p.x, p.y + (state.crouch ? 0.22 : 0.55), p.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = mouse.yaw;
    camera.rotation.x = clamp(mouse.pitch + state.recoil, -1.32, 1.32);
    const baseFov = state.ads ? (profile.loadout.optic ? 54 : 62) : 72;
    camera.fov = mix(camera.fov, baseFov, 0.18);
    camera.updateProjectionMatrix();
  }
}
function updateRun(dt) {
  state.elapsed += dt;
  state.timer = Math.max(0, RAID_SECONDS - state.elapsed);
  state.safeRadius = Math.max(24, 96 - state.elapsed * 0.18);
  if (state.scanner > 0) state.scanner = Math.max(0, state.scanner - dt);
  if (state.scannerCooldown > 0) state.scannerCooldown = Math.max(0, state.scannerCooldown - dt);
  if (state.artyCooldown > 0) state.artyCooldown = Math.max(0, state.artyCooldown - dt);
  if (state.shotCooldown > 0) state.shotCooldown -= dt;
  if (state.reload > 0) { state.reload -= dt; if (state.reload <= 0) finishReload(); }
  state.recoil = Math.max(0, state.recoil - dt * 0.055);
  const p = getPlayerPosition();
  const distFromCore = Math.hypot(p.x, p.z);
  anomaly.scale.setScalar(state.safeRadius);
  anomaly.material.opacity = 0.24 + Math.sin(state.elapsed * 3.6) * 0.12;
  if (distFromCore > state.safeRadius) {
    state.anomalyTick += dt;
    $('anomaly-overlay').style.opacity = String(clamp((distFromCore - state.safeRadius) / 14, 0, 0.62));
    if (state.anomalyTick >= 1.4) { state.anomalyTick = 0; state.hp = Math.max(0, state.hp - 5); toast('ANOMALY EXPOSURE // MOVE INSIDE THE PERIMETER', 1); }
    if (state.hp <= 0) { finishRaid(false, 'Lost to anomaly exposure.'); return; }
  } else { state.anomalyTick = 0; $('anomaly-overlay').style.opacity = '0'; }
  if (state.extractionStarted) {
    const site = extractionSites[state.extractionSiteIndex];
    const onSite = Math.hypot(site.x - p.x, site.z - p.z) < 7.5;
    const contested = npcList.some((n) => n.alive && Math.hypot(n.group.position.x - site.x, n.group.position.z - site.z) < 15);
    if (onSite && !contested) state.extractionProgress += dt;
    if (!onSite) $('extract-progress-label').textContent = 'RETURN TO FLARE // SIGNAL PAUSED';
    else if (contested) $('extract-progress-label').textContent = 'SITE CONTESTED // CLEAR HOSTILES';
    else $('extract-progress-label').textContent = 'HOLD ZONE // EXTRACTION IN PROGRESS';
    $('extract-progress').style.width = `${clamp(state.extractionProgress / 15 * 100, 0, 100)}%`;
    if (state.extractionProgress >= 15) { finishRaid(true); return; }
  }
  if (state.timer <= 0) { finishRaid(false, 'Extraction window closed.'); return; }
  const closeContainer = nearestLoot(3.2);
  const closeSite = nearestSite(6);
  const hint = $('interaction-hint');
  if (closeContainer && $('loot-panel').hidden) { hint.textContent = `E  //  SEARCH ${closeContainer.title}`; hint.classList.add('visible'); }
  else if (closeSite) { hint.textContent = `F  //  ${state.extractionStarted ? 'EXTRACTION SIGNAL ACTIVE' : 'DEPLOY EXTRACTION FLARE'}`; hint.classList.add('visible'); }
  else hint.classList.remove('visible');
  if (state.messageTimer > 0) { state.messageTimer -= dt; if (state.messageTimer <= 0) $('toast').classList.remove('show'); }
}

function renderResultsContinue() {
  $('results-screen').hidden = true;
  $('base-screen').hidden = false;
  state.mode = 'base';
  state.extractionStarted = false;
  $('anomaly-overlay').style.opacity = '0';
  mouse.yaw = 0; mouse.pitch = 0;
  renderBase();
}

function onKeyDown(ev) {
  const code = ev.code;
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(code)) ev.preventDefault();
  keys.add(code);
  if (ev.repeat) return;
  if (code === 'Escape' && state.mode === 'raid' && !$('loot-panel').hidden) { closeLoot(); return; }
  if (code === 'KeyE') interact();
  if (code === 'KeyF' && state.mode === 'raid') { if (nearestSite()) startExtraction(); }
  if (code === 'KeyR') reload();
  if (code === 'KeyC') state.crouch = !state.crouch;
  if (code === 'Digit1') setWeapon(0);
  if (code === 'Digit2') setWeapon(1);
  if (code === 'Digit3') setWeapon(2);
  if (code === 'Digit4') triggerScanner();
  if (code === 'Digit5') triggerArty();
  if (code === 'Digit6') { state.weather = (state.weather + 1) % WEATHER.length; $('hud-weather').textContent = WEATHER[state.weather]; toast(`ATMOSPHERE // ${WEATHER[state.weather]}`); }
}
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', (ev) => keys.delete(ev.code));
canvas.addEventListener('click', () => { if (state.mode === 'raid' && $('loot-panel').hidden) canvas.requestPointerLock?.(); });
document.addEventListener('pointerlockchange', () => { mouse.look = document.pointerLockElement === canvas; });
document.addEventListener('mousemove', (ev) => {
  if (!mouse.look || state.mode !== 'raid') return;
  mouse.yaw -= ev.movementX * 0.0021;
  mouse.pitch -= ev.movementY * 0.0018;
  mouse.pitch = clamp(mouse.pitch, -1.25, 1.25);
});
document.addEventListener('mousedown', (ev) => { if (state.mode === 'raid' && mouse.look && $('loot-panel').hidden) { if (ev.button === 0) fireWeapon(); if (ev.button === 2) state.ads = true; } });
document.addEventListener('mouseup', (ev) => { if (ev.button === 2) state.ads = false; });
document.addEventListener('contextmenu', (ev) => ev.preventDefault());
$('deploy-btn').addEventListener('click', startRaid);
$('return-base').addEventListener('click', renderResultsContinue);
$('loot-close').addEventListener('click', closeLoot);
$('optic-toggle').addEventListener('click', () => { profile.loadout.optic = !profile.loadout.optic; saveProfile(); });
$('suppressor-toggle').addEventListener('click', () => { profile.loadout.suppressor = !profile.loadout.suppressor; saveProfile(); });
$('contract-toggle').addEventListener('click', () => { profile.contract = !profile.contract; saveProfile(); });
$('reset-profile').addEventListener('click', () => { if (confirm('Reset Zero-Zone local progression and stash?')) { profile = structuredClone(DEFAULT_PROFILE); saveProfile(); toast('LOCAL PROFILE RESET'); } });

function drawRadarInitial() { $('tactical-radar').getContext('2d').fillStyle = '#0a1216'; $('tactical-radar').getContext('2d').fillRect(0, 0, 160, 160); }
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
}
window.addEventListener('resize', resize);

const clock = new THREE.Clock();
let lastUi = 0;
let physicsAccumulator = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state.mode === 'raid') {
    updateMovement(dt);
    if (physics) {
      physicsAccumulator += dt;
      while (physicsAccumulator >= FIXED_STEP) { physics.timestep = FIXED_STEP; physics.step(); physicsAccumulator -= FIXED_STEP; }
    }
    updateRun(dt);
    if (state.mode === 'raid') { updateNPCs(dt); updateProjectiles(dt); }
    updateCamera();
    const now = performance.now();
    if (now - lastUi > 80) { updateHUD(); lastUi = now; }
  } else {
    const t = clock.elapsedTime;
    camera.position.set(112 + Math.sin(t * 0.05) * 4, 76, 122);
    camera.lookAt(0, 2, 0);
    camera.fov = 52; camera.updateProjectionMatrix();
    for (const site of extractionSites) site.mesh.material.opacity = 0.56 + Math.sin(t * 2.3 + site.x) * 0.16;
  }
  const render = composer ? () => composer.render(dt) : () => renderer.render(scene, camera);
  render();
}

async function boot() {
  drawRadarInitial();
  renderBase();
  $('hud-weather').textContent = WEATHER[state.weather];
  $('hud-timer').textContent = '06:00';
  await initPhysics();
  $('physics-status').textContent = physicsReady ? 'RAPIER PHYSICS ONLINE' : 'KINEMATIC FALLBACK';
  frame();
}
boot();
