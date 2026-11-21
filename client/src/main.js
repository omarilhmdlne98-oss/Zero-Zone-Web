import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from 'postprocessing';
import { sfx } from './audio.js';
import { DualControls } from './controls.js';
import {
  animateOperatorRig,
  createArenaEnvironment,
  createDestructibleCrate,
  createFirstPersonViewmodel,
  createJumpPad,
  createOperatorModel,
  createSkyDome,
  createVaultStructure
} from './models.js';
import { NetworkClient } from './network.js';

// --- Renderer & Cinematic ACES Filmic Lighting ---
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1220);
scene.fog = new THREE.FogExp2(0x131d2c, 0.0155);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 160);
scene.add(camera);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new EffectPass(camera, new BloomEffect({ intensity: 0.45, luminanceThreshold: 0.82 })));

// Sky Dome + Sun + Hemisphere Fill + Tactical Rim Light
scene.add(createSkyDome());
scene.add(new THREE.HemisphereLight(0x88b4e6, 0x262328, 0.85));

const sun = new THREE.DirectionalLight(0xffdfb8, 2.0);
sun.position.set(22, 34, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 4;
sun.shadow.camera.far = 90;
sun.shadow.camera.left = -28;
sun.shadow.camera.right = 28;
sun.shadow.camera.top = 28;
sun.shadow.camera.bottom = -28;
sun.shadow.bias = -0.0005;
scene.add(sun);

const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
rimLight.position.set(-20, 14, -22);
scene.add(rimLight);

// --- Arena Environment, Vault, Jump-Pads & Crates ---
const arenaEnv = createArenaEnvironment();
scene.add(arenaEnv.group);

const vault = createVaultStructure();
scene.add(vault);

const jumpPads = [createJumpPad(-10, 0), createJumpPad(10, 0)];
jumpPads.forEach((p) => scene.add(p));

const crateDefs = [
  { id: 'crate_nw', x: -6.5, z: -6.5 },
  { id: 'crate_ne', x: 6.5, z: -6.5 },
  { id: 'crate_sw', x: -6.5, z: 6.5 },
  { id: 'crate_se', x: 6.5, z: 6.5 }
];
const crates = new Map();

// --- Operator Class Configs ---
const OPERATOR_STATS = {
  vanguard: { maxHp: 100, maxShield: 50, walk: 5.4, sprint: 8.6, crouch: 3.1, ads: 3.4, dmgRed: 0.0, silent: false, abilityName: 'Tactical Dash' },
  spectre: { maxHp: 90, maxShield: 40, walk: 5.7, sprint: 8.2, crouch: 3.4, ads: 3.6, dmgRed: 0.0, silent: true, abilityName: 'Optical Cloak' },
  juggernaut: { maxHp: 150, maxShield: 100, walk: 4.3, sprint: 6.2, crouch: 2.5, ads: 2.7, dmgRed: 0.2, silent: false, abilityName: 'Kinetic Barrier' }
};

// --- Weapons with Realistic Ballistics, Mag Capacity, Reload & Recoil ---
const WEAPONS = [
  {
    id: 'rifle',
    name: 'VX-47 Assault Rifle',
    auto: true,
    fireInterval: 0.11,
    damage: 24,
    muzzleVelocity: 120,
    gravity: 9.81,
    recoilPitch: 0.022,
    recoilYaw: 0.008,
    tracerColor: 0x22d3ee,
    pellets: 1,
    hipSpread: 0.014,
    adsSpread: 0.003,
    adsFov: 50,
    magSize: 30,
    maxReserve: 150,
    reloadTime: 1.8
  },
  {
    id: 'railgun',
    name: 'XR-9 Railgun',
    auto: false,
    fireInterval: 0.85,
    damage: 68,
    muzzleVelocity: 260,
    gravity: 3.2,
    recoilPitch: 0.072,
    recoilYaw: 0.015,
    tracerColor: 0xc084fc,
    pellets: 1,
    hipSpread: 0.008,
    adsSpread: 0.0005,
    adsFov: 32,
    magSize: 6,
    maxReserve: 30,
    reloadTime: 2.3
  },
  {
    id: 'shotgun',
    name: 'M-12 Heavy Shotgun',
    auto: false,
    fireInterval: 0.62,
    damage: 14,
    muzzleVelocity: 95,
    gravity: 11.5,
    recoilPitch: 0.062,
    recoilYaw: 0.024,
    tracerColor: 0xfb923c,
    pellets: 6,
    hipSpread: 0.068,
    adsSpread: 0.042,
    adsFov: 56,
    magSize: 8,
    maxReserve: 40,
    reloadTime: 2.1
  }
];

const HIT_ZONE_MULT = { head: 2.2, torso: 1.0, limb: 0.75 };

const controls = new DualControls(canvas);
const remotePlayers = new Map();
const localBots = [];
const projectiles = [];
const particles = [];
const shellCasings = [];
const killFeedEntries = [];

let world = null;
let playerBody = null;
let viewmodel = null;
let net = null;
let running = false;
let lastBreachSent = false;
let localMode = false;
let localKills = 0;
let localMatchResetting = false;
let currentRoomName = 'alpha';

let currentWeaponIdx = 0;
let weaponAmmo = WEAPONS.map((w) => ({ mag: w.magSize, reserve: w.maxReserve }));
let fireCooldown = 0;
let reloadTimer = 0;
let isReloading = false;

let recoilKickBack = 0;
let recoilKickPitch = 0;
let muzzleFlashTimer = 0;
let hitmarkerTimer = 0;
let stepAccum = 0;
let heartbeatAccum = 0;
let bobPhase = 0;
let currentLean = 0;
let currentEyeHeight = 1.68;
let shieldRegenDelay = 0;

let localState = {
  kit: 'vanguard',
  hp: 100,
  maxHp: 100,
  shield: 50,
  maxShield: 50,
  stamina: 100,
  abilityCd: 0,
  abilityTimer: 0,
  cloakTimer: 0,
  barrierTimer: 0,
  crouching: false,
  sliding: false,
  slideTimer: 0,
  ads: false,
  alive: true,
  matchRemaining: 300,
  breachProgress: 0
};

// --- Viewmodel Management ---
function rebuildViewmodel(weaponId) {
  if (viewmodel) {
    camera.remove(viewmodel);
  }
  viewmodel = createFirstPersonViewmodel(weaponId);
  viewmodel.position.set(0.24, -0.22, -0.44);
  camera.add(viewmodel);
}

function selectWeapon(idx) {
  if (idx < 0 || idx >= WEAPONS.length || idx === currentWeaponIdx) return;
  isReloading = false;
  reloadTimer = 0;
  currentWeaponIdx = idx;
  rebuildViewmodel(WEAPONS[idx].id);
  for (let i = 0; i < WEAPONS.length; i++) {
    const el = document.getElementById(`wpn-${i}`);
    if (el) el.classList.toggle('active', i === idx);
  }
}

function startReload() {
  const wpn = WEAPONS[currentWeaponIdx];
  const ammo = weaponAmmo[currentWeaponIdx];
  if (isReloading || ammo.mag >= wpn.magSize || ammo.reserve <= 0) return;
  isReloading = true;
  reloadTimer = wpn.reloadTime;
  sfx.reload();
}

// --- Visual FX: Impact Sparks, Concrete Dust, Shell Casings, Hitmarker, Kill Feed ---
function spawnImpactFX(point, normal, isMetallic = false) {
  const count = isMetallic ? 7 : 5;
  const color = isMetallic ? 0xfbbf24 : 0x9ca3af;
  const geo = new THREE.BoxGeometry(0.045, 0.045, 0.045);
  const mat = new THREE.MeshBasicMaterial({ color });
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(point);
    const vel = normal.clone().multiplyScalar(2.5 + Math.random() * 3.5);
    vel.x += (Math.random() - 0.5) * 4.5;
    vel.y += Math.random() * 3.2;
    vel.z += (Math.random() - 0.5) * 4.5;
    scene.add(m);
    particles.push({ mesh: m, vel, life: 0.25 + Math.random() * 0.22, gravity: 14 });
  }
}

function spawnShellCasing() {
  if (!viewmodel) return;
  const geo = new THREE.CylinderGeometry(0.008, 0.008, 0.036, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.85, roughness: 0.25 });
  const mesh = new THREE.Mesh(geo, mat);
  const worldPos = new THREE.Vector3(0.14, -0.05, -0.32).applyMatrix4(camera.matrixWorld);
  mesh.position.copy(worldPos);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const vel = right.multiplyScalar(2.2 + Math.random() * 0.8).addScaledVector(up, 1.4 + Math.random() * 0.6);
  scene.add(mesh);
  shellCasings.push({ mesh, vel, life: 0.85 });
}

function showHitmarker(isHeadshot = false) {
  hitmarkerTimer = isHeadshot ? 0.26 : 0.16;
  const hm = document.getElementById('hitmarker');
  const hc = document.getElementById('hit-callout');
  if (hm) {
    hm.style.color = isHeadshot ? '#f87171' : '#ffffff';
    hm.style.opacity = '1';
  }
  if (hc && isHeadshot) {
    hc.style.opacity = '1';
  }
}

function pushKillFeed(killer, victim, weaponName, isHeadshot = false) {
  killFeedEntries.unshift({ killer, victim, weaponName, isHeadshot, time: performance.now() });
  if (killFeedEntries.length > 5) killFeedEntries.pop();
  renderKillFeed();
}

function renderKillFeed() {
  const container = document.getElementById('kill-feed');
  if (!container) return;
  const now = performance.now();
  while (killFeedEntries.length > 0 && now - killFeedEntries[killFeedEntries.length - 1].time > 7000) {
    killFeedEntries.pop();
  }
  container.innerHTML = killFeedEntries
    .map(
      (e) =>
        `<div class="kf-entry${e.isHeadshot ? ' hs' : ''}">[${e.killer}] eliminated [${e.victim}] with ${e.weaponName}${
          e.isHeadshot ? '<span class="kf-hs-tag">[HEADSHOT]</span>' : ''
        }</div>`
    )
    .join('');
}

// --- True Ballistic Projectile Spawner ---
function spawnBallisticProjectile(origin, dir, weapon, ownerType, ownerId, ownerName) {
  const geo = new THREE.CylinderGeometry(0.018, 0.018, 1.35, 6);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: weapon.tracerColor });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(origin);
  mesh.lookAt(origin.clone().add(dir));
  scene.add(mesh);

  projectiles.push({
    mesh,
    pos: origin.clone(),
    vel: dir.clone().multiplyScalar(weapon.muzzleVelocity),
    gravity: weapon.gravity,
    damage: weapon.damage,
    weaponId: weapon.id,
    weaponName: weapon.name,
    ownerType, // 'local' | 'bot' | 'remote'
    ownerId,
    ownerName,
    life: 1.8
  });
}

// --- HUD Update ---
function updateLocalHudBanner(statusOverride = null) {
  const roomEl = document.getElementById('hud-room');
  if (!roomEl) return;
  if (localMode) {
    roomEl.textContent = statusOverride || `Solo AI Arena | KOs: ${localKills}`;
  } else {
    roomEl.textContent = `Room: ${currentRoomName}`;
  }
}

function updateHUD() {
  const m = Math.floor(localState.matchRemaining / 60);
  const s = Math.floor(localState.matchRemaining % 60);
  document.getElementById('hud-timer').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  document.getElementById('hud-hp-text').textContent = `HP: ${Math.ceil(localState.hp)} / ${localState.maxHp}`;
  document.getElementById('hud-hp-bar').style.width = `${(localState.hp / localState.maxHp) * 100}%`;
  document.getElementById('hud-shd-text').textContent = `Shield: ${Math.ceil(localState.shield)} / ${localState.maxShield}`;
  document.getElementById('hud-shd-bar').style.width = `${(localState.shield / Math.max(1, localState.maxShield)) * 100}%`;
  document.getElementById('hud-stam-text').textContent = `Stamina: ${Math.round(localState.stamina)}`;
  document.getElementById('hud-stam-bar').style.width = `${localState.stamina}%`;

  const op = OPERATOR_STATS[localState.kit];
  document.getElementById('hud-cd-text').textContent =
    localState.abilityCd > 0 ? `${op.abilityName} [G]: ${localState.abilityCd.toFixed(1)}s` : `${op.abilityName} [G]: Ready`;
  document.getElementById('hud-cd-bar').style.width = `${Math.max(0, (1 - localState.abilityCd / 8) * 100)}%`;

  document.getElementById('hud-vault-text').textContent = `Vault Breach: ${localState.breachProgress.toFixed(0)} / 20s`;
  document.getElementById('hud-vault-bar').style.width = `${(localState.breachProgress / 20) * 100}%`;

  // Stance / Lean indicator
  const stanceEl = document.getElementById('hud-stance');
  if (stanceEl) {
    let tag = localState.sliding ? 'SLIDE' : (localState.crouching ? 'CROUCH' : 'STAND');
    if (localState.ads) tag += ' • ADS';
    if (Math.abs(currentLean) > 0.25) tag += currentLean < 0 ? ' • LEAN L' : ' • LEAN R';
    stanceEl.textContent = tag;
  }

  // Ammo & Reload
  const wpn = WEAPONS[currentWeaponIdx];
  const ammo = weaponAmmo[currentWeaponIdx];
  document.getElementById('hud-wpn-name').textContent = isReloading ? `Reloading ${wpn.name}...` : wpn.name;
  document.getElementById('hud-ammo-text').textContent = `${ammo.mag} / ${ammo.reserve}`;
  const rBar = document.getElementById('hud-reload-bar');
  if (rBar) {
    rBar.style.width = isReloading
      ? `${((wpn.reloadTime - reloadTimer) / wpn.reloadTime) * 100}%`
      : `${(ammo.mag / wpn.magSize) * 100}%`;
  }

  // Dynamic Crosshair spread & ADS Railgun Scope
  const ch = document.getElementById('crosshair');
  if (ch) {
    const spreadPx = localState.ads ? 10 : (localState.crouching ? 18 : 24 + recoilKickBack * 90);
    ch.style.width = `${spreadPx}px`;
    ch.style.height = `${spreadPx}px`;
    ch.style.opacity = localState.ads && wpn.id === 'railgun' ? '0.45' : '1';
  }
  const scopeEl = document.getElementById('scope-overlay');
  if (scopeEl) {
    scopeEl.style.opacity = localState.ads && wpn.id === 'railgun' ? '1' : '0';
  }

  // Low HP Vignette
  const vig = document.getElementById('vignette-lowhp');
  if (vig) {
    const lowRatio = localState.hp < localState.maxHp * 0.35 ? 1 - localState.hp / (localState.maxHp * 0.35) : 0;
    vig.style.opacity = `${Math.min(1, lowRatio * 0.95)}`;
  }

  renderKillFeed();
}

// --- Remote Multiplayer Operators ---
function upsertRemotePlayer(p) {
  if (net && p.id === net.playerId) return;
  let entry = remotePlayers.get(p.id);
  if (!entry) {
    const mesh = createOperatorModel(p.kit || 'vanguard', p.weaponId || 'rifle');
    mesh.userData.playerId = p.id;
    mesh.traverse((c) => { c.userData.playerId = p.id; });
    scene.add(mesh);
    entry = {
      mesh,
      targetPos: new THREE.Vector3(p.x, (p.y || 1) - 0.95, p.z),
      prevPos: new THREE.Vector3(p.x, (p.y || 1) - 0.95, p.z),
      ry: p.ry || 0,
      isCrouching: false,
      alive: p.alive !== false,
      deathTimer: 0
    };
    remotePlayers.set(p.id, entry);
  }
  entry.targetPos.set(p.x, Math.max(0, (p.y || 1) - 0.95), p.z);
  entry.ry = p.ry || 0;
  entry.isCrouching = Boolean(p.isCrouching);
  entry.alive = p.alive !== false;
  entry.mesh.visible = true;
}

// --- Intelligent Tactical AI Bots (Vision Cone, Hearing, Cover, Flanking, Abilities) ---
function spawnLocalBots() {
  for (const b of localBots) {
    scene.remove(b.mesh);
  }
  localBots.length = 0;

  const botConfigs = [
    { id: 'bot_0', name: 'Vanguard-01', kit: 'vanguard', weaponIdx: 0, x: -13, z: -12 },
    { id: 'bot_1', name: 'Spectre-02', kit: 'spectre', weaponIdx: 1, x: 13, z: -12 },
    { id: 'bot_2', name: 'Juggernaut-03', kit: 'juggernaut', weaponIdx: 2, x: -13, z: 3 },
    { id: 'bot_3', name: 'Vanguard-04', kit: 'vanguard', weaponIdx: 0, x: 13, z: 3 }
  ];

  for (const cfg of botConfigs) {
    const stats = OPERATOR_STATS[cfg.kit];
    const wpn = WEAPONS[cfg.weaponIdx];
    const mesh = createOperatorModel(cfg.kit, wpn.id);
    mesh.userData.botId = cfg.id;
    mesh.traverse((c) => { c.userData.botId = cfg.id; });
    mesh.position.set(cfg.x, 0, cfg.z);
    scene.add(mesh);

    localBots.push({
      id: cfg.id,
      name: cfg.name,
      kit: cfg.kit,
      weaponIdx: cfg.weaponIdx,
      mesh,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      shield: stats.maxShield,
      maxShield: stats.maxShield,
      dmgRed: stats.dmgRed,
      moveSpeed: stats.walk * 0.86,
      alive: true,
      deathTimer: 0,
      respawnTimer: 0,
      state: 'PATROL',
      waypoint: new THREE.Vector3((Math.random() - 0.5) * 24, 0, (Math.random() - 0.5) * 24),
      alertPos: null,
      alertTimer: 0,
      strafeDir: Math.random() < 0.5 ? 1 : -1,
      strafeSwitchTimer: 1.5,
      crouching: false,
      abilityCd: 3 + Math.random() * 4,
      cloakTimer: 0,
      barrierTimer: 0,
      fireCd: 1.0 + Math.random(),
      flashTimer: 0,
      vy: 0
    });
  }
}

function alertBotsToGunshot(soundPos) {
  if (!localMode) return;
  for (const bot of localBots) {
    if (!bot.alive) continue;
    if (bot.mesh.position.distanceTo(soundPos) <= 36) {
      bot.alertPos = soundPos.clone();
      bot.alertTimer = 4.5;
    }
  }
}

const losRay = new THREE.Raycaster();
function hasBotLineOfSight(bot, targetPos) {
  const eye = bot.mesh.position.clone().add(new THREE.Vector3(0, bot.crouching ? 1.15 : 1.58, 0));
  const toTarget = targetPos.clone().sub(eye);
  const dist = toTarget.length();
  if (dist > 34) return false;
  const dir = toTarget.normalize();
  // 120-degree vision cone check (unless alerted)
  if (bot.alertTimer <= 0) {
    const fwd = new THREE.Vector3(Math.sin(bot.mesh.rotation.y), 0, Math.cos(bot.mesh.rotation.y));
    if (fwd.dot(new THREE.Vector3(dir.x, 0, dir.z).normalize()) < 0.35) {
      return false;
    }
  }
  losRay.set(eye, dir);
  losRay.far = dist - 0.45;
  const occluders = [arenaEnv.group, vault, ...Array.from(crates.values()).filter((c) => c.mesh.visible).map((c) => c.mesh)];
  return losRay.intersectObjects(occluders, true).length === 0;
}

function findNearestCoverPoint(botPos, threatPos) {
  const candidates = [
    ...arenaEnv.coverPoints,
    ...Array.from(crates.values())
      .filter((c) => c.mesh.visible)
      .map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z }))
  ];
  let best = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const dBot = Math.hypot(c.x - botPos.x, c.z - botPos.z);
    const awayDir = new THREE.Vector2(c.x - threatPos.x, c.z - threatPos.z).normalize();
    const coverSpot = new THREE.Vector3(c.x + awayDir.x * 1.9, 0, c.z + awayDir.y * 1.9);
    const score = dBot;
    if (score < bestScore) {
      bestScore = score;
      best = coverSpot;
    }
  }
  return best || new THREE.Vector3(-12, 0, -7);
}

function applyDamageToLocalPlayer(rawDmg, attackerName, weaponName, isHeadshot = false) {
  if (!localState.alive) return;
  const stats = OPERATOR_STATS[localState.kit];
  const bonusRed = localState.barrierTimer > 0 ? 0.55 : 0;
  let dmg = rawDmg * (1 - Math.min(0.85, stats.dmgRed + bonusRed));
  shieldRegenDelay = 4.0;

  if (localState.shield > 0) {
    const abs = Math.min(localState.shield, dmg);
    localState.shield -= abs;
    dmg -= abs;
  }
  if (dmg > 0) {
    localState.hp = Math.max(0, localState.hp - dmg);
  }

  if (localState.hp <= 0) {
    localState.alive = false;
    pushKillFeed(attackerName, 'You', weaponName, isHeadshot);
    sfx.radioCue();
    setTimeout(() => {
      if (!localMode) return;
      localState.alive = true;
      localState.hp = localState.maxHp;
      localState.shield = localState.maxShield;
      playerBody.setTranslation({ x: 0, y: 2.0, z: 14 }, true);
      playerBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }, 3000);
  }
}

function applyDamageToBot(bot, rawDmg, hitZone, attackerName, weaponName) {
  if (!bot.alive) return;
  const mult = HIT_ZONE_MULT[hitZone] || 1.0;
  const isHeadshot = hitZone === 'head';
  const bonusRed = bot.barrierTimer > 0 ? 0.5 : 0;
  let dmg = rawDmg * mult * (1 - Math.min(0.85, bot.dmgRed + bonusRed));

  if (bot.shield > 0) {
    const abs = Math.min(bot.shield, dmg);
    bot.shield -= abs;
    dmg -= abs;
  }
  if (dmg > 0) {
    bot.hp = Math.max(0, bot.hp - dmg);
  }

  if (bot.hp <= 0) {
    bot.alive = false;
    bot.deathTimer = 0;
    bot.respawnTimer = 4.0;
    if (attackerName === 'You') {
      localKills += 1;
      updateLocalHudBanner();
    }
    pushKillFeed(attackerName, bot.name, weaponName, isHeadshot);
    sfx.radioCue();
  }
}

function resetLocalArenaMatch() {
  localMatchResetting = false;
  localState.matchRemaining = 300;
  localState.breachProgress = 0;
  localState.hp = localState.maxHp;
  localState.shield = localState.maxShield;
  localState.alive = true;
  weaponAmmo = WEAPONS.map((w) => ({ mag: w.magSize, reserve: w.maxReserve }));
  if (playerBody) {
    playerBody.setTranslation({ x: 0, y: 2.0, z: 14 }, true);
    playerBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }
  for (const cr of crates.values()) {
    cr.hp = 100;
    cr.mesh.visible = true;
    cr.collider?.setEnabled(true);
  }
  spawnLocalBots();
  updateLocalHudBanner();
}

function enableLocalArenaMode() {
  if (localMode) return;
  localMode = true;
  localMatchResetting = false;
  if (localBots.length === 0) {
    spawnLocalBots();
  }
  updateLocalHudBanner();
}

function disableLocalArenaMode() {
  if (!localMode) return;
  localMode = false;
  localMatchResetting = false;
  for (const b of localBots) {
    scene.remove(b.mesh);
  }
  localBots.length = 0;
  updateLocalHudBanner();
}

// --- Network Message Handler ---
function handleNetMessage(msg) {
  if (msg.type === 'welcome' || msg.type === 'room_snapshot') {
    disableLocalArenaMode();
    localState.matchRemaining = msg.matchRemaining ?? 300;
    localState.breachProgress = msg.breachProgress ?? 0;
    (msg.players || []).forEach(upsertRemotePlayer);
    (msg.crates || []).forEach((c) => {
      const cr = crates.get(c.id);
      if (cr && c.destroyed) {
        cr.mesh.visible = false;
        cr.collider?.setEnabled(false);
      }
    });
  } else if (msg.type === 'player_joined') {
    upsertRemotePlayer(msg.player);
  } else if (msg.type === 'player_state') {
    const r = remotePlayers.get(msg.id || msg.playerId);
    if (r) {
      r.targetPos.set(msg.x, Math.max(0, (msg.y || 1) - 0.95), msg.z);
      r.ry = msg.ry ?? msg.yaw ?? 0;
      r.isCrouching = Boolean(msg.isCrouching);
    }
  } else if (msg.type === 'player_left') {
    const r = remotePlayers.get(msg.id || msg.playerId);
    if (r) { scene.remove(r.mesh); remotePlayers.delete(msg.id || msg.playerId); }
  } else if (msg.type === 'player_fired') {
    const wpn = WEAPONS.find((w) => w.id === msg.weapon) || WEAPONS[0];
    if (Array.isArray(msg.origin) && Array.isArray(msg.dir)) {
      spawnBallisticProjectile(
        new THREE.Vector3(...msg.origin),
        new THREE.Vector3(...msg.dir).normalize(),
        wpn,
        'remote',
        msg.id,
        msg.id
      );
    }
  } else if (msg.type === 'player_damaged') {
    if (net && msg.id === net.playerId) {
      localState.hp = msg.hp;
      if (typeof msg.shield === 'number') localState.shield = msg.shield;
    }
  } else if (msg.type === 'player_eliminated') {
    if (net && msg.id === net.playerId) {
      localState.alive = false;
    } else {
      const r = remotePlayers.get(msg.id);
      if (r) { r.alive = false; r.deathTimer = 0; }
    }
  } else if (msg.type === 'player_respawned') {
    if (net && msg.id === net.playerId && playerBody) {
      localState.alive = true;
      localState.hp = msg.hp;
      if (typeof msg.shield === 'number') localState.shield = msg.shield;
      playerBody.setTranslation({ x: msg.x, y: msg.y, z: msg.z }, true);
    } else {
      const r = remotePlayers.get(msg.id);
      if (r) { r.alive = true; r.deathTimer = 0; }
    }
  } else if (msg.type === 'kill_feed') {
    pushKillFeed(msg.killer, msg.victim, msg.weapon || 'VX-47 Assault Rifle', Boolean(msg.isHeadshot));
    sfx.radioCue();
  } else if (msg.type === 'crate_updated') {
    const cr = crates.get(msg.crate.id);
    if (cr && msg.crate.destroyed) {
      cr.mesh.visible = false;
      cr.collider?.setEnabled(false);
      sfx.crateBreak();
    }
  } else if (msg.type === 'tick') {
    localState.matchRemaining = msg.matchRemaining;
    localState.breachProgress = msg.breachProgress;
  }
}

// --- Rapier3D Physics Init (1.80m Human Capsule + Multi-Tier Arena Colliders) ---
async function initPhysics(kitId) {
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -18.5, z: 0 });

  const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(24, 0.5, 24), floorBody);

  const vaultBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 2.3, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(2.15, 2.3, 2.15), vaultBody);

  // Register every multi-tier arena wall, catwalk, stair step, and jersey barrier collider
  for (const col of arenaEnv.colliders) {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(col.x, col.y, col.z));
    world.createCollider(RAPIER.ColliderDesc.cuboid(col.hx, col.hy, col.hz), b);
  }

  for (const def of crateDefs) {
    const mesh = createDestructibleCrate(def.id, def.x, def.z);
    scene.add(mesh);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(def.x, 0.75, def.z));
    const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(0.9, 0.75, 0.9), body);
    crates.set(def.id, { mesh, collider, hp: 100 });
  }

  const stats = OPERATOR_STATS[kitId] || OPERATOR_STATS.vanguard;
  localState.kit = kitId;
  localState.maxHp = stats.maxHp;
  localState.hp = stats.maxHp;
  localState.maxShield = stats.maxShield;
  localState.shield = stats.maxShield;

  // 1.80m human capsule: halfHeight=0.56 + radius=0.34 => total 1.80m
  playerBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.4, 14).lockRotations()
  );
  world.createCollider(RAPIER.ColliderDesc.capsule(0.56, 0.34), playerBody);

  rebuildViewmodel(WEAPONS[currentWeaponIdx].id);
}

// --- Main Loop ---
const segRay = new THREE.Raycaster();
const clock = new THREE.Clock();
let netSyncAccum = 0;

function updateProjectiles(dt, pNew) {
  const envObjects = [arenaEnv.group, vault];
  const activeCrates = Array.from(crates.values()).filter((c) => c.mesh.visible).map((c) => c.mesh);
  const remoteMeshes = Array.from(remotePlayers.values()).filter((r) => r.alive).map((r) => r.mesh);
  const botMeshes = localBots.filter((b) => b.alive).map((b) => b.mesh);

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.life -= dt;
    if (pr.life <= 0) {
      scene.remove(pr.mesh);
      projectiles.splice(i, 1);
      continue;
    }

    const prevPos = pr.pos.clone();
    pr.vel.y -= pr.gravity * dt;
    const step = pr.vel.clone().multiplyScalar(dt);
    const stepLen = step.length();
    const stepDir = step.clone().normalize();
    const nextPos = prevPos.clone().add(step);

    // Check hit against local player if fired by AI bot
    if (pr.ownerType === 'bot' && localState.alive) {
      const playerCenter = new THREE.Vector3(pNew.x, pNew.y, pNew.z);
      const distToLine = new THREE.Line3(prevPos, nextPos).closestPointToPoint(playerCenter, true, new THREE.Vector3()).distanceTo(playerCenter);
      if (distToLine < 0.52) {
        const isHead = nextPos.y > pNew.y + 0.42;
        applyDamageToLocalPlayer(pr.damage * (isHead ? 1.4 : 0.45), pr.ownerName, pr.weaponName, isHead);
        scene.remove(pr.mesh);
        projectiles.splice(i, 1);
        continue;
      }
    }

    // Raycast this ballistic segment against bots, remote players, crates, and arena geometry
    const targets = [...envObjects, ...activeCrates];
    if (pr.ownerType === 'local') {
      targets.push(...remoteMeshes, ...botMeshes);
    } else if (pr.ownerType === 'bot') {
      targets.push(...botMeshes.filter((m) => m.userData.botId !== pr.ownerId));
    }

    segRay.set(prevPos, stepDir);
    segRay.far = stepLen + 0.12;
    const hits = segRay.intersectObjects(targets, true);

    if (hits.length > 0) {
      const hit = hits[0];
      const obj = hit.object;
      const hitNorm = hit.face ? hit.face.normal.clone().transformDirection(obj.matrixWorld) : new THREE.Vector3(0, 1, 0);
      const hitZone = obj.userData.hitZone || 'torso';
      const isHead = hitZone === 'head';

      if (obj.userData.playerId && pr.ownerType === 'local') {
        if (isHead) sfx.headshot(); else sfx.hit();
        showHitmarker(isHead);
        spawnImpactFX(hit.point, hitNorm, true);
        net?.send({
          type: 'hit_player',
          targetId: obj.userData.playerId,
          damage: pr.damage,
          hitZone,
          weapon: pr.weaponId
        });
      } else if (obj.userData.botId) {
        const bot = localBots.find((b) => b.id === obj.userData.botId);
        if (bot && bot.alive) {
          if (pr.ownerType === 'local') {
            if (isHead) sfx.headshot(); else sfx.hit();
            showHitmarker(isHead);
          }
          spawnImpactFX(hit.point, hitNorm, true);
          applyDamageToBot(bot, pr.damage, hitZone, pr.ownerName, pr.weaponName);
        }
      } else if (obj.userData.crateId) {
        if (pr.ownerType === 'local') { sfx.hit(); showHitmarker(false); }
        spawnImpactFX(hit.point, hitNorm, false);
        const cr = crates.get(obj.userData.crateId);
        if (cr) {
          cr.hp -= pr.damage;
          if (cr.hp <= 0) {
            cr.mesh.visible = false;
            cr.collider?.setEnabled(false);
            sfx.crateBreak();
          }
        }
        if (pr.ownerType === 'local') {
          net?.send({ type: 'hit_crate', crateId: obj.userData.crateId });
        }
      } else {
        // Arena concrete / steel impact sparks & ricochet
        spawnImpactFX(hit.point, hitNorm, Math.random() < 0.45);
        if (pr.ownerType === 'local' && Math.random() < 0.35) sfx.ricochet();
      }

      scene.remove(pr.mesh);
      projectiles.splice(i, 1);
      continue;
    }

    pr.pos.copy(nextPos);
    pr.mesh.position.copy(nextPos);
    pr.mesh.lookAt(nextPos.clone().add(pr.vel));
  }
}

function updateTacticalBots(dt, pNew) {
  const playerPos = new THREE.Vector3(pNew.x, pNew.y + 0.45, pNew.z);

  for (const bot of localBots) {
    if (bot.flashTimer > 0) {
      bot.flashTimer -= dt;
      if (bot.flashTimer <= 0) {
        if (bot.mesh.userData.flashMesh) bot.mesh.userData.flashMesh.visible = false;
        if (bot.mesh.userData.flashLight) bot.mesh.userData.flashLight.intensity = 0;
      }
    }

    if (!bot.alive) {
      bot.deathTimer += dt;
      animateOperatorRig(bot.mesh, dt, 0, false, true, bot.deathTimer);
      bot.respawnTimer -= dt;
      if (bot.respawnTimer <= 0) {
        bot.alive = true;
        bot.hp = bot.maxHp;
        bot.shield = bot.maxShield;
        bot.deathTimer = 0;
        const a = Math.random() * Math.PI * 2;
        bot.mesh.position.set(Math.cos(a) * 14, 0, Math.sin(a) * 14);
        bot.state = 'PATROL';
      }
      continue;
    }

    if (bot.abilityCd > 0) bot.abilityCd -= dt;
    if (bot.cloakTimer > 0) bot.cloakTimer -= dt;
    if (bot.barrierTimer > 0) bot.barrierTimer -= dt;
    if (bot.alertTimer > 0) bot.alertTimer -= dt;
    if (bot.mesh.userData.cloakMat) {
      bot.mesh.userData.cloakMat.uniforms.uCloak.value = bot.cloakTimer > 0 ? 1.0 : 0.0;
    }

    // Target acquisition: Player (if alive & not cloaked)
    const canSeePlayer = localState.alive && localState.cloakTimer <= 0 && hasBotLineOfSight(bot, playerPos);
    const lowVitals = bot.shield <= 0 || bot.hp < bot.maxHp * 0.4;

    let desiredMove = new THREE.Vector3();
    let lookTarget = null;
    bot.crouching = false;

    if (canSeePlayer) {
      lookTarget = playerPos;
      const dist = bot.mesh.position.distanceTo(playerPos);

      // Deploy class ability tactically when hurt or engaging
      if (bot.abilityCd <= 0 && (lowVitals || Math.random() < 0.015)) {
        bot.abilityCd = 11;
        if (bot.kit === 'spectre') bot.cloakTimer = 3.5;
        else if (bot.kit === 'juggernaut') {
          bot.barrierTimer = 4.5;
          bot.shield = Math.min(bot.maxShield, bot.shield + 35);
        } else {
          // Vanguard quick lateral burst
          bot.strafeDir *= -1;
        }
      }

      if (lowVitals) {
        bot.state = 'TAKE_COVER';
        bot.crouching = true;
        const coverSpot = findNearestCoverPoint(bot.mesh.position, playerPos);
        desiredMove.subVectors(coverSpot, bot.mesh.position);
        desiredMove.y = 0;
      } else if (dist > 17) {
        bot.state = 'FLANK';
        const toP = new THREE.Vector3().subVectors(playerPos, bot.mesh.position).setY(0).normalize();
        const side = new THREE.Vector3(-toP.z, 0, toP.x).multiplyScalar(bot.strafeDir);
        desiredMove.addScaledVector(toP, 0.7).addScaledVector(side, 0.75);
      } else {
        bot.state = 'ENGAGE';
        bot.crouching = bot.kit === 'spectre';
        bot.strafeSwitchTimer -= dt;
        if (bot.strafeSwitchTimer <= 0) {
          bot.strafeSwitchTimer = 1.2 + Math.random() * 1.4;
          bot.strafeDir *= -1;
        }
        const toP = new THREE.Vector3().subVectors(playerPos, bot.mesh.position).setY(0).normalize();
        const side = new THREE.Vector3(-toP.z, 0, toP.x).multiplyScalar(bot.strafeDir);
        desiredMove.copy(side);
      }

      // Fire realistic ballistic projectile
      bot.fireCd -= dt;
      if (bot.fireCd <= 0 && dist < 30) {
        const wpn = WEAPONS[bot.weaponIdx];
        bot.fireCd = wpn.fireInterval * (wpn.id === 'rifle' ? 2.4 : 1.7) + Math.random() * 0.45;
        const muzzlePos = bot.mesh.position.clone().add(new THREE.Vector3(0, bot.crouching ? 1.1 : 1.48, 0));
        const aimDir = new THREE.Vector3().subVectors(playerPos, muzzlePos).normalize();
        const spread = 0.055;
        aimDir.x += (Math.random() - 0.5) * spread;
        aimDir.y += (Math.random() - 0.5) * spread;
        aimDir.z += (Math.random() - 0.5) * spread;
        aimDir.normalize();
        spawnBallisticProjectile(muzzlePos, aimDir, wpn, 'bot', bot.id, bot.name);
        bot.flashTimer = 0.06;
        if (bot.mesh.userData.flashMesh) bot.mesh.userData.flashMesh.visible = true;
        if (bot.mesh.userData.flashLight) bot.mesh.userData.flashLight.intensity = 2.5;
      }
    } else if (bot.alertTimer > 0 && bot.alertPos) {
      bot.state = 'INVESTIGATE';
      desiredMove.subVectors(bot.alertPos, bot.mesh.position).setY(0);
      lookTarget = bot.alertPos;
    } else {
      bot.state = 'PATROL';
      desiredMove.subVectors(bot.waypoint, bot.mesh.position).setY(0);
      if (desiredMove.length() < 1.5) {
        const a = Math.random() * Math.PI * 2;
        const rad = 6 + Math.random() * 13;
        bot.waypoint.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
      }
      lookTarget = bot.waypoint;
    }

    // Apply movement with vault & perimeter bounds avoidance
    let actualSpeed = 0;
    if (desiredMove.lengthSq() > 0.04) {
      desiredMove.normalize();
      const spd = bot.crouching ? bot.moveSpeed * 0.62 : bot.moveSpeed;
      const nx = THREE.MathUtils.clamp(bot.mesh.position.x + desiredMove.x * spd * dt, -21, 21);
      const nz = THREE.MathUtils.clamp(bot.mesh.position.z + desiredMove.z * spd * dt, -21, 21);
      if (Math.hypot(nx, nz) > 3.2) {
        bot.mesh.position.x = nx;
        bot.mesh.position.z = nz;
        actualSpeed = spd;
      }
    }

    // Bot jump-pad bounce
    for (const pad of jumpPads) {
      if (Math.hypot(bot.mesh.position.x - pad.position.x, bot.mesh.position.z - pad.position.z) < 1.5 && bot.mesh.position.y <= 0.15) {
        bot.vy = 11.5;
      }
    }
    bot.vy -= 18.5 * dt;
    bot.mesh.position.y = Math.max(0, bot.mesh.position.y + bot.vy * dt);
    if (bot.mesh.position.y <= 0) bot.vy = 0;

    if (lookTarget) {
      const dx = lookTarget.x - bot.mesh.position.x;
      const dz = lookTarget.z - bot.mesh.position.z;
      if (dx * dx + dz * dz > 0.01) {
        const targetYaw = Math.atan2(dx, dz) + Math.PI;
        bot.mesh.rotation.y = targetYaw;
      }
    }

    animateOperatorRig(bot.mesh, dt, actualSpeed, bot.crouching, false, 0);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());

  if (running && world && playerBody) {
    const move = controls.getMoveInput();
    const act = controls.consumeActions();
    const stats = OPERATOR_STATS[localState.kit];

    if (act.weaponSwitch !== null) {
      selectWeapon(act.weaponSwitch);
    }
    if (act.reload) {
      startReload();
    }
    if (fireCooldown > 0) fireCooldown = Math.max(0, fireCooldown - dt);

    // Reload Timer
    if (isReloading) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) {
        const wpn = WEAPONS[currentWeaponIdx];
        const ammo = weaponAmmo[currentWeaponIdx];
        const needed = wpn.magSize - ammo.mag;
        const loaded = Math.min(needed, ammo.reserve);
        ammo.mag += loaded;
        ammo.reserve -= loaded;
        isReloading = false;
      }
    }

    // Shield Regeneration out of combat
    if (shieldRegenDelay > 0) {
      shieldRegenDelay -= dt;
    } else if (localState.alive && localState.shield < localState.maxShield) {
      localState.shield = Math.min(localState.maxShield, localState.shield + 8 * dt);
    }

    const pos = playerBody.translation();
    const vel = playerBody.linvel();
    const horizSpeed = Math.hypot(vel.x, vel.z);
    const grounded = Math.abs(vel.y) < 0.28;

    // ADS & Crouch / Slide State
    localState.ads = act.ads && !isReloading;
    if (act.crouch) {
      if (move.sprint && horizSpeed > 5.0 && grounded && !localState.sliding) {
        localState.sliding = true;
        localState.crouching = true;
        localState.slideTimer = 0.6;
      } else {
        localState.crouching = !localState.crouching;
        localState.sliding = false;
      }
    }
    if (localState.sliding) {
      localState.slideTimer -= dt;
      if (localState.slideTimer <= 0) localState.sliding = false;
    }

    const sprinting = move.sprint && !localState.ads && !localState.crouching && localState.stamina > 5 && (move.x !== 0 || move.z !== 0);
    localState.stamina = sprinting ? Math.max(0, localState.stamina - 24 * dt) : Math.min(100, localState.stamina + 18 * dt);
    if (localState.abilityCd > 0) localState.abilityCd = Math.max(0, localState.abilityCd - dt);
    if (localState.cloakTimer > 0) localState.cloakTimer = Math.max(0, localState.cloakTimer - dt);
    if (localState.barrierTimer > 0) localState.barrierTimer = Math.max(0, localState.barrierTimer - dt);

    const speed = localState.sliding
      ? stats.sprint * 1.15
      : localState.ads
        ? stats.ads
        : localState.crouching
          ? stats.crouch
          : sprinting
            ? stats.sprint
            : stats.walk;

    const forward = new THREE.Vector3(-Math.sin(controls.yaw), 0, -Math.cos(controls.yaw));
    const right = new THREE.Vector3(Math.cos(controls.yaw), 0, -Math.sin(controls.yaw));
    const wish = new THREE.Vector3().addScaledVector(right, move.x).addScaledVector(forward, -move.z);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    let vy = vel.y;
    if (act.jump && grounded) {
      vy = 8.4;
      localState.crouching = false;
      localState.sliding = false;
    }

    // Kinetic Jump-Pad Check
    for (const pad of jumpPads) {
      if (Math.hypot(pos.x - pad.position.x, pos.z - pad.position.z) < 1.5 && pos.y < 1.8) {
        vy = 14.5;
        sfx.jumpPad();
      }
      if (pad.userData.chevMat) {
        pad.userData.chevMat.emissiveIntensity = 1.6 + Math.sin(clock.elapsedTime * 5) * 0.8;
      }
    }

    // Operator Tactical Ability [G]
    if (act.ability && localState.abilityCd <= 0 && localState.alive) {
      localState.abilityCd = 8.0;
      sfx.ability();
      if (localState.kit === 'vanguard') {
        wish.addScaledVector(forward, 19);
      } else if (localState.kit === 'spectre') {
        localState.cloakTimer = 4.0;
      } else {
        localState.barrierTimer = 5.0;
        localState.shield = Math.min(localState.maxShield, localState.shield + 45);
      }
    }

    if (localState.alive) {
      playerBody.setLinvel({ x: wish.x, y: vy, z: wish.z }, true);
    }
    world.step();

    const pNew = playerBody.translation();

    // Footsteps synced to stride speed (Spectre is silent!)
    if (grounded && horizSpeed > 1.2 && localState.alive) {
      bobPhase += dt * (sprinting ? 13 : (localState.crouching ? 6.5 : 9.5));
      stepAccum += dt * horizSpeed;
      if (stepAccum > 2.65) {
        stepAccum = 0;
        if (!stats.silent) sfx.footstep(sprinting, localState.crouching);
      }
    }

    // Low-HP Heartbeat
    if (localState.alive && localState.hp < localState.maxHp * 0.35) {
      heartbeatAccum += dt;
      if (heartbeatAccum >= 0.95) {
        heartbeatAccum = 0;
        sfx.heartbeat();
      }
    }

    // First-Person Eye Camera with Crouch, Lean [Q/E], Recoil & ADS FOV
    const targetEye = localState.crouching ? 0.32 : 0.78;
    currentEyeHeight = THREE.MathUtils.lerp(currentEyeHeight, targetEye, Math.min(1, dt * 12));
    currentLean = THREE.MathUtils.lerp(currentLean, move.lean, Math.min(1, dt * 12));

    const wpn = WEAPONS[currentWeaponIdx];
    const targetFov = localState.ads ? wpn.adsFov : (sprinting ? 80 : 74);
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, dt * 14));
    camera.updateProjectionMatrix();

    // Recoil recovery
    recoilKickBack = THREE.MathUtils.lerp(recoilKickBack, 0, Math.min(1, dt * 14));
    recoilKickPitch = THREE.MathUtils.lerp(recoilKickPitch, 0, Math.min(1, dt * 12));

    const leanOffset = right.clone().multiplyScalar(currentLean * 0.42);
    const bobY = grounded && horizSpeed > 0.8 ? Math.sin(bobPhase) * (localState.ads ? 0.01 : 0.035) : 0;
    camera.position.set(pNew.x + leanOffset.x, pNew.y + currentEyeHeight + bobY, pNew.z + leanOffset.z);

    camera.rotation.order = 'YXZ';
    camera.rotation.y = controls.yaw;
    camera.rotation.x = THREE.MathUtils.clamp(controls.pitch + recoilKickPitch, -1.35, 1.35);
    camera.rotation.z = -currentLean * 0.16;

    // First-Person Viewmodel Sway, ADS Alignment, Recoil & Reload Animation
    if (viewmodel) {
      const targetPos = localState.ads
        ? new THREE.Vector3(0.0, -0.105, -0.34)
        : new THREE.Vector3(0.24, -0.22, -0.44);
      const swayX = Math.cos(bobPhase * 0.5) * (localState.ads ? 0.002 : 0.012);
      const swayY = Math.sin(bobPhase) * (localState.ads ? 0.002 : 0.012) + Math.sin(clock.elapsedTime * 2.1) * 0.003;
      const reloadDrop = isReloading ? -0.18 : 0;
      viewmodel.position.x = THREE.MathUtils.lerp(viewmodel.position.x, targetPos.x + swayX, Math.min(1, dt * 16));
      viewmodel.position.y = THREE.MathUtils.lerp(viewmodel.position.y, targetPos.y + swayY + reloadDrop, Math.min(1, dt * 16));
      viewmodel.position.z = THREE.MathUtils.lerp(viewmodel.position.z, targetPos.z + recoilKickBack, Math.min(1, dt * 20));
      viewmodel.rotation.x = isReloading ? -0.45 : recoilKickBack * 1.4;
      viewmodel.rotation.z = isReloading ? 0.4 : 0;
      viewmodel.visible = localState.alive && !(localState.ads && wpn.id === 'railgun');

      if (muzzleFlashTimer > 0) {
        muzzleFlashTimer -= dt;
        if (muzzleFlashTimer <= 0) {
          if (viewmodel.userData.flashMesh) viewmodel.userData.flashMesh.visible = false;
          if (viewmodel.userData.flashLight) viewmodel.userData.flashLight.intensity = 0;
        }
      }
    }

    // Fire Weapon (supports Full-Auto Rifle & Semi-Auto Railgun/Shotgun)
    const wantsFire = wpn.auto ? (act.fire || act.fireHeld) : act.fire;
    if (wantsFire && localState.alive && !isReloading && fireCooldown <= 0) {
      const ammo = weaponAmmo[currentWeaponIdx];
      if (ammo.mag <= 0) {
        startReload();
      } else {
        ammo.mag -= 1;
        fireCooldown = wpn.fireInterval;
        sfx.fire(wpn.id);

        const recoilScale = localState.ads ? 0.62 : (localState.crouching ? 0.78 : 1.0);
        recoilKickBack = Math.min(0.14, recoilKickBack + wpn.recoilPitch * 1.8);
        recoilKickPitch += wpn.recoilPitch * recoilScale;
        controls.pitch = Math.min(1.25, controls.pitch + wpn.recoilPitch * 0.45 * recoilScale);
        controls.yaw += (Math.random() - 0.5) * wpn.recoilYaw * recoilScale;

        muzzleFlashTimer = 0.045;
        if (viewmodel?.userData?.flashMesh) {
          viewmodel.userData.flashMesh.visible = true;
          viewmodel.userData.flashMesh.rotation.z = Math.random() * Math.PI * 2;
        }
        if (viewmodel?.userData?.flashLight) viewmodel.userData.flashLight.intensity = 3.2;
        if (wpn.id !== 'railgun') spawnShellCasing();

        const baseDir = new THREE.Vector3();
        camera.getWorldDirection(baseDir);
        const spread = localState.ads ? wpn.adsSpread : (localState.crouching ? wpn.hipSpread * 0.65 : wpn.hipSpread);

        for (let p = 0; p < wpn.pellets; p++) {
          const dir = baseDir.clone();
          if (spread > 0) {
            dir.x += (Math.random() - 0.5) * spread * 2;
            dir.y += (Math.random() - 0.5) * spread * 2;
            dir.z += (Math.random() - 0.5) * spread * 2;
            dir.normalize();
          }
          const origin = camera.position.clone().addScaledVector(dir, 0.75);
          spawnBallisticProjectile(origin, dir, wpn, 'local', net?.playerId || 'local', 'You');
          if (p === 0) {
            net?.send({ type: 'fire', origin: origin.toArray(), dir: dir.toArray(), weapon: wpn.id, color: wpn.tracerColor });
          }
        }

        alertBotsToGunshot(new THREE.Vector3(pNew.x, pNew.y, pNew.z));
        if (ammo.mag === 0 && ammo.reserve > 0) startReload();
      }
    }

    if (act.breach !== lastBreachSent) {
      lastBreachSent = act.breach;
      net?.send({ type: 'breach_hold', active: act.breach });
    }

    if (localMode) {
      if (!localMatchResetting) {
        localState.matchRemaining = Math.max(0, localState.matchRemaining - dt);
        const nearVault = Math.hypot(pNew.x, pNew.z) <= 5.5;
        if (localState.alive && act.breach && nearVault) {
          localState.breachProgress = Math.min(20, localState.breachProgress + dt);
        } else if (localState.breachProgress > 0) {
          localState.breachProgress = Math.max(0, localState.breachProgress - 0.5 * dt);
        }

        if (localState.breachProgress >= 20 || localState.matchRemaining <= 0) {
          localMatchResetting = true;
          const reason = localState.breachProgress >= 20 ? 'VAULT BREACHED!' : 'TIME UP!';
          updateLocalHudBanner(`Solo AI Arena | ${reason} Resetting...`);
          sfx.radioCue();
          setTimeout(() => {
            if (localMode) resetLocalArenaMatch();
          }, 3000);
        }
      }
      updateTacticalBots(dt, pNew);
    } else {
      netSyncAccum += dt;
      if (netSyncAccum >= 0.05) {
        netSyncAccum = 0;
        net?.send({
          type: 'state',
          x: pNew.x,
          y: pNew.y,
          z: pNew.z,
          ry: controls.yaw,
          weapon: wpn.id,
          isADS: localState.ads,
          isCrouching: localState.crouching,
          leanAngle: currentLean * 16
        });
      }
    }

    updateProjectiles(dt, pNew);

    // Animate Remote Players
    for (const r of remotePlayers.values()) {
      r.prevPos.copy(r.mesh.position);
      r.mesh.position.lerp(r.targetPos, 0.25);
      r.mesh.rotation.y = r.ry;
      const spd = r.mesh.position.distanceTo(r.prevPos) / Math.max(0.001, dt);
      if (!r.alive) r.deathTimer += dt;
      animateOperatorRig(r.mesh, dt, spd, r.isCrouching, !r.alive, r.deathTimer);
    }

    // Rotate Vault Rings
    if (vault.userData.rings) {
      vault.userData.rings[0].rotation.z += dt * 0.6;
      vault.userData.rings[1].rotation.z -= dt * 0.85;
    }

    // Hitmarker decay
    if (hitmarkerTimer > 0) {
      hitmarkerTimer -= dt;
      if (hitmarkerTimer <= 0) {
        const hm = document.getElementById('hitmarker');
        const hc = document.getElementById('hit-callout');
        if (hm) hm.style.opacity = '0';
        if (hc) hc.style.opacity = '0';
      }
    }

    updateHUD();
  }

  // Update Impact Particles & Shell Casings
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.vel.y -= pt.gravity * dt;
    pt.mesh.position.addScaledVector(pt.vel, dt);
    pt.life -= dt;
    if (pt.life <= 0) { scene.remove(pt.mesh); particles.splice(i, 1); }
  }
  for (let i = shellCasings.length - 1; i >= 0; i--) {
    const sh = shellCasings[i];
    sh.vel.y -= 14 * dt;
    sh.mesh.position.addScaledVector(sh.vel, dt);
    sh.mesh.rotation.x += 12 * dt;
    sh.mesh.rotation.z += 9 * dt;
    sh.life -= dt;
    if (sh.life <= 0) { scene.remove(sh.mesh); shellCasings.splice(i, 1); }
  }

  composer.render();
}

// --- Lobby Startup ---
const DEFAULT_WS_URL = (import.meta.env.VITE_WS_URL || '').trim();
const wsInputEl = document.getElementById('ws-input');
if (wsInputEl) wsInputEl.value = DEFAULT_WS_URL;

document.getElementById('btn-play').addEventListener('click', async () => {
  const kit = document.getElementById('kit-select').value;
  const room = document.getElementById('room-input').value.trim() || 'alpha';
  currentRoomName = room;
  const wsUrl = (wsInputEl?.value || '').trim() || DEFAULT_WS_URL;

  document.getElementById('lobby').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  document.getElementById('hud-room').textContent = wsUrl ? `Room: ${room}` : 'Solo AI Arena | KOs: 0';

  await initPhysics(kit);
  net = new NetworkClient(
    handleNetMessage,
    (st) => {
      document.getElementById('lobby-status').textContent = st;
    },
    () => {
      enableLocalArenaMode();
    }
  );
  net.connect(wsUrl, room, kit);
  sfx.radioCue();
  running = true;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

animate();
