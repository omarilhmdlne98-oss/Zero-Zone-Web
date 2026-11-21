import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from 'postprocessing';
import { sfx } from './audio.js';
import { DualControls } from './controls.js';
import { createDestructibleCrate, createJumpPad, createOperatorModel, createVaultStructure } from './models.js';
import { NetworkClient } from './network.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090e16);
scene.fog = new THREE.Fog(0x090e16, 22, 68);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 120);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new EffectPass(camera, new BloomEffect({ intensity: 0.65, luminanceThreshold: 0.72 })));

scene.add(new THREE.AmbientLight(0x9cb4d8, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.25);
sun.position.set(14, 24, 12);
scene.add(sun);

// Floor & Perimeter
const floorMesh = new THREE.Mesh(
  new THREE.BoxGeometry(40, 1, 40),
  new THREE.MeshStandardMaterial({ color: 0x161c24, roughness: 0.85 })
);
floorMesh.position.y = -0.5;
scene.add(floorMesh);

const grid = new THREE.GridHelper(40, 20, 0x22d3ee, 0x1e293b);
grid.position.y = 0.01;
scene.add(grid);

const vault = createVaultStructure();
scene.add(vault);

const jumpPads = [createJumpPad(-10, 0), createJumpPad(10, 0)];
jumpPads.forEach((p) => scene.add(p));

const crateDefs = [
  { id: 'crate_nw', x: -6, z: -6 },
  { id: 'crate_ne', x: 6, z: -6 },
  { id: 'crate_sw', x: -6, z: 6 },
  { id: 'crate_se', x: 6, z: 6 }
];
const crates = new Map();

const controls = new DualControls(canvas);
const remotePlayers = new Map();
const tracers = [];

let world = null;
let playerBody = null;
let localMesh = null;
let localState = { kit: 'vanguard', hp: 100, maxHp: 100, stamina: 100, abilityCd: 0, cloakTimer: 0, alive: true, matchRemaining: 300, breachProgress: 0 };
let net = null;
let running = false;
let lastBreachSent = false;

function spawnTracer(from, dir, color = 0x38bdf8) {
  const geo = new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6);
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
  mesh.position.copy(from).addScaledVector(dir, 1.2);
  mesh.lookAt(from.clone().addScaledVector(dir, 5));
  scene.add(mesh);
  tracers.push({ mesh, dir: dir.clone(), life: 0.25 });
}

function updateHUD() {
  const m = Math.floor(localState.matchRemaining / 60);
  const s = Math.floor(localState.matchRemaining % 60);
  document.getElementById('hud-timer').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  document.getElementById('hud-hp-text').textContent = `HP: ${localState.hp} / ${localState.maxHp}`;
  document.getElementById('hud-hp-bar').style.width = `${(localState.hp / localState.maxHp) * 100}%`;
  document.getElementById('hud-stam-text').textContent = `Stamina: ${Math.round(localState.stamina)}`;
  document.getElementById('hud-stam-bar').style.width = `${localState.stamina}%`;
  document.getElementById('hud-cd-text').textContent = localState.abilityCd > 0 ? `Ability [E]: ${localState.abilityCd.toFixed(1)}s` : 'Ability [E]: Ready';
  document.getElementById('hud-cd-bar').style.width = `${Math.max(0, (1 - localState.abilityCd / 6) * 100)}%`;
  document.getElementById('hud-vault-text').textContent = `Vault Breach: ${localState.breachProgress.toFixed(0)} / 20s`;
  document.getElementById('hud-vault-bar').style.width = `${(localState.breachProgress / 20) * 100}%`;
}

function upsertRemotePlayer(p) {
  if (net && p.id === net.playerId) return;
  let entry = remotePlayers.get(p.id);
  if (!entry) {
    const mesh = createOperatorModel(p.kit || 'vanguard');
    mesh.userData.playerId = p.id;
    mesh.traverse((c) => { c.userData.playerId = p.id; });
    scene.add(mesh);
    entry = { mesh, targetPos: new THREE.Vector3(p.x, p.y, p.z), ry: p.ry || 0 };
    remotePlayers.set(p.id, entry);
  }
  entry.targetPos.set(p.x, p.y, p.z);
  entry.ry = p.ry || 0;
  entry.mesh.visible = p.alive !== false;
}

function handleNetMessage(msg) {
  if (msg.type === 'welcome' || msg.type === 'room_snapshot') {
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
    const r = remotePlayers.get(msg.id);
    if (r) {
      r.targetPos.set(msg.x, msg.y, msg.z);
      r.ry = msg.ry;
    }
  } else if (msg.type === 'player_left') {
    const r = remotePlayers.get(msg.id);
    if (r) { scene.remove(r.mesh); remotePlayers.delete(msg.id); }
  } else if (msg.type === 'player_fired') {
    spawnTracer(new THREE.Vector3(...msg.origin), new THREE.Vector3(...msg.dir), 0xf59e0b);
  } else if (msg.type === 'player_damaged') {
    if (net && msg.id === net.playerId) localState.hp = msg.hp;
  } else if (msg.type === 'player_eliminated') {
    if (net && msg.id === net.playerId) { localState.alive = false; localMesh.visible = false; }
  } else if (msg.type === 'player_respawned') {
    if (net && msg.id === net.playerId && playerBody) {
      localState.alive = true;
      localState.hp = msg.hp;
      localMesh.visible = true;
      playerBody.setTranslation({ x: msg.x, y: msg.y, z: msg.z }, true);
    }
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

async function initPhysics(kitId) {
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -18.0, z: 0 });

  const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.5, 20), floorBody);

  const vaultBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 2.25, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(2.1, 2.25, 2.1), vaultBody);

  for (const def of crateDefs) {
    const mesh = createDestructibleCrate(def.id, def.x, def.z);
    scene.add(mesh);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(def.x, 0.75, def.z));
    const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(0.9, 0.75, 0.9), body);
    crates.set(def.id, { mesh, collider, hp: 100 });
  }

  localState.kit = kitId;
  localState.maxHp = kitId === 'juggernaut' ? 160 : (kitId === 'spectre' ? 85 : 100);
  localState.hp = localState.maxHp;

  playerBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2.0, 12).lockRotations()
  );
  world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.4), playerBody);

  localMesh = createOperatorModel(kitId);
  scene.add(localMesh);
}

const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
let netSyncAccum = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());

  if (running && world && playerBody) {
    const move = controls.getMoveInput();
    const act = controls.consumeActions();
    const pos = playerBody.translation();
    const vel = playerBody.linvel();
    const grounded = pos.y <= 1.05 && Math.abs(vel.y) < 0.2;

    const sprinting = move.sprint && localState.stamina > 5 && (move.x !== 0 || move.z !== 0);
    localState.stamina = sprinting ? Math.max(0, localState.stamina - 28 * dt) : Math.min(100, localState.stamina + 18 * dt);
    if (localState.abilityCd > 0) localState.abilityCd = Math.max(0, localState.abilityCd - dt);
    if (localState.cloakTimer > 0) localState.cloakTimer = Math.max(0, localState.cloakTimer - dt);

    const speed = sprinting ? 9.5 : 6.2;
    const forward = new THREE.Vector3(-Math.sin(controls.yaw), 0, -Math.cos(controls.yaw));
    const right = new THREE.Vector3(Math.cos(controls.yaw), 0, -Math.sin(controls.yaw));
    const wish = new THREE.Vector3().addScaledVector(right, move.x).addScaledVector(forward, -move.z);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    let vy = vel.y;
    if (act.jump && grounded) vy = 8.2;

    // Kinetic Jump-Pad Check
    for (const pad of jumpPads) {
      if (Math.hypot(pos.x - pad.position.x, pos.z - pad.position.z) < 1.5 && pos.y < 1.6) {
        vy = 14.5;
        sfx.jumpPad();
      }
      if (pad.userData.chevMat) {
        pad.userData.chevMat.emissiveIntensity = 1.5 + Math.sin(clock.elapsedTime * 5) * 0.9;
      }
    }

    // Operator Ability [E]
    if (act.ability && localState.abilityCd <= 0) {
      localState.abilityCd = 6.0;
      sfx.ability();
      if (localState.kit === 'vanguard') {
        wish.addScaledVector(forward, 18);
      } else if (localState.kit === 'spectre') {
        localState.cloakTimer = 3.5;
      } else {
        localState.hp = Math.min(localState.maxHp, localState.hp + 25);
      }
    }

    if (localMesh.userData.cloakMat) {
      localMesh.userData.cloakMat.uniforms.uCloak.value = localState.cloakTimer > 0 ? 1.0 : 0.0;
    }

    if (localState.alive) {
      playerBody.setLinvel({ x: wish.x, y: vy, z: wish.z }, true);
    }
    world.step();

    const pNew = playerBody.translation();
    localMesh.position.set(pNew.x, pNew.y - 0.95, pNew.z);
    localMesh.rotation.y = controls.yaw;

    // Third-person camera orbit
    const camOffset = new THREE.Vector3(0, 2.2, 5.2).applyAxisAngle(new THREE.Vector3(1, 0, 0), controls.pitch).applyAxisAngle(new THREE.Vector3(0, 1, 0), controls.yaw);
    camera.position.set(pNew.x + camOffset.x, Math.max(0.8, pNew.y + camOffset.y), pNew.z + camOffset.z);
    camera.lookAt(pNew.x, pNew.y + 0.8, pNew.z);

    // Fire Weapon
    if (act.fire && localState.alive) {
      sfx.fire();
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const origin = camera.position.clone().addScaledVector(dir, 1.0);
      spawnTracer(origin, dir, 0x22d3ee);
      net?.send({ type: 'fire', origin: origin.toArray(), dir: dir.toArray() });

      raycaster.set(camera.position, dir);
      const targets = [
        ...Array.from(remotePlayers.values()).map((r) => r.mesh),
        ...Array.from(crates.values()).filter((c) => c.mesh.visible).map((c) => c.mesh)
      ];
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        if (hitObj.userData.playerId) {
          sfx.hit();
          net?.send({ type: 'hit_player', targetId: hitObj.userData.playerId, damage: 22 });
        } else if (hitObj.userData.crateId) {
          sfx.hit();
          const cr = crates.get(hitObj.userData.crateId);
          if (cr) {
            cr.hp -= 25;
            if (cr.hp <= 0) { cr.mesh.visible = false; cr.collider?.setEnabled(false); sfx.crateBreak(); }
          }
          net?.send({ type: 'hit_crate', crateId: hitObj.userData.crateId });
        }
      }
    }

    if (act.breach !== lastBreachSent) {
      lastBreachSent = act.breach;
      net?.send({ type: 'breach_hold', active: act.breach });
    }

    netSyncAccum += dt;
    if (netSyncAccum >= 0.05) {
      netSyncAccum = 0;
      net?.send({ type: 'state', x: pNew.x, y: pNew.y, z: pNew.z, ry: controls.yaw });
    }

    for (const r of remotePlayers.values()) {
      r.mesh.position.lerp(r.targetPos, 0.25);
      r.mesh.position.y -= 0.95;
      r.mesh.rotation.y = r.ry;
    }

    updateHUD();
  }

  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.mesh.position.addScaledVector(t.dir, 65 * dt);
    t.life -= dt;
    if (t.life <= 0) { scene.remove(t.mesh); tracers.splice(i, 1); }
  }

  composer.render();
}

const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
const wsInputEl = document.getElementById('ws-input');
if (wsInputEl) wsInputEl.value = DEFAULT_WS_URL;

document.getElementById('btn-play').addEventListener('click', async () => {
  const kit = document.getElementById('kit-select').value;
  const room = document.getElementById('room-input').value.trim() || 'alpha';
  const wsUrl = (wsInputEl?.value || '').trim() || DEFAULT_WS_URL;

  document.getElementById('lobby').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  document.getElementById('hud-room').textContent = `Room: ${room}`;

  await initPhysics(kit);
  net = new NetworkClient(handleNetMessage, (st) => {
    document.getElementById('lobby-status').textContent = st;
  });
  net.connect(wsUrl, room, kit);
  running = true;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

animate();
