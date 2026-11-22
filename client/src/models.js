import * as THREE from 'three';
import { applyBattlefieldPBRShader } from './pbr_shaders.js';
import { UPPER_COMBAT_NETWORK } from './bridge_network.js';

const SPECTRE_CLOAK_VERT = `
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewPos = -mvPos.xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const SPECTRE_CLOAK_FRAG = `
  uniform vec3 uBaseColor;
  uniform vec3 uRimColor;
  uniform float uCloak;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vec3 n = length(vNormal) > 0.0001 ? normalize(vNormal) : vec3(0.0, 1.0, 0.0);
    vec3 v = length(vViewPos) > 0.0001 ? normalize(vViewPos) : vec3(0.0, 0.0, 1.0);
    float fresnel = pow(max(0.0001, 1.0 - clamp(dot(n, v), 0.0, 1.0)), 2.4);
    vec3 col = uBaseColor + uRimColor * fresnel * (1.1 + uCloak * 1.8);
    gl_FragColor = vec4(col, 1.0 - uCloak * 0.72);
  }
`;

const SKY_VERT = `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAG = `
  varying vec3 vWorldPos;
  void main() {
    float h = normalize(vWorldPos).y;
    vec3 zenith = vec3(0.106, 0.157, 0.220);
    vec3 mid = vec3(0.185, 0.278, 0.388);
    vec3 horizon = vec3(0.36, 0.31, 0.29);
    vec3 col = mix(horizon, mid, smoothstep(-0.04, 0.24, h));
    col = mix(col, zenith, smoothstep(0.20, 0.78, h));
    gl_FragColor = vec4(col, 1.0);
  }
`;

// --- Procedural PBR Canvas Textures ---
const _texCache = {};

function makeCanvasTexture(key, size, drawFn, repeatX = 1, repeatY = 1) {
  if (_texCache[key]) return _texCache[key];
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  _texCache[key] = tex;
  return tex;
}

export function getConcreteTexture(repX = 8, repY = 8) {
  return makeCanvasTexture(`concrete_${repX}_${repY}`, 256, (ctx, s) => {
    ctx.fillStyle = '#2d333b';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 3200; i++) {
      const v = 35 + Math.floor(Math.random() * 34);
      ctx.fillStyle = `rgb(${v},${v + 3},${v + 7})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    ctx.strokeStyle = 'rgba(12,16,22,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, s - 4, s - 4);
    ctx.beginPath();
    ctx.moveTo(0, s / 2); ctx.lineTo(s, s / 2);
    ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s);
    ctx.stroke();
  }, repX, repY);
}

export function getSteelTexture(repX = 2, repY = 2) {
  return makeCanvasTexture(`steel_${repX}_${repY}`, 256, (ctx, s) => {
    ctx.fillStyle = '#303842';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) {
      const v = 42 + Math.floor(Math.random() * 18);
      ctx.fillStyle = `rgba(${v},${v + 6},${v + 12},0.45)`;
      ctx.fillRect(0, y, s, 1);
    }
    ctx.fillStyle = '#1b2028';
    for (let x = 14; x < s; x += 64) {
      for (let y = 14; y < s; y += 64) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, repX, repY);
}

export function getCautionTexture(repX = 3, repY = 1) {
  return makeCanvasTexture(`caution_${repX}_${repY}`, 128, (ctx, s) => {
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#14171c';
    for (let i = -s; i < s * 2; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 16, 0);
      ctx.lineTo(i - s + 16, s);
      ctx.lineTo(i - s, s);
      ctx.closePath();
      ctx.fill();
    }
  }, repX, repY);
}

export function getKevlarTexture() {
  return makeCanvasTexture('kevlar', 128, (ctx, s) => {
    ctx.fillStyle = '#1f2630';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 8) {
      for (let x = 0; x < s; x += 8) {
        ctx.fillStyle = ((x + y) / 8) % 2 === 0 ? '#28313e' : '#181e26';
        ctx.fillRect(x, y, 7, 7);
      }
    }
  }, 3, 3);
}

export function getCatwalkGrateTexture(repX = 4, repY = 4) {
  return makeCanvasTexture(`grate_${repX}_${repY}`, 128, (ctx, s) => {
    ctx.fillStyle = '#242b35';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#4e5b6e';
    ctx.lineWidth = 3;
    for (let i = 0; i <= s; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i, s);
      ctx.moveTo(0, i); ctx.lineTo(s, i);
      ctx.stroke();
    }
    ctx.fillStyle = '#11161e';
    for (let y = 4; y < s; y += 16) {
      for (let x = 4; x < s; x += 16) {
        ctx.fillRect(x, y, 8, 8);
      }
    }
  }, repX, repY);
}

// --- Detailed 3D Tactical Weapons ---
export function createWeaponMesh(weaponId = 'rifle') {
  const gun = new THREE.Group();
  const gunmetal = new THREE.MeshStandardMaterial({ color: 0x1d232b, metalness: 0.78, roughness: 0.32 });
  const darkPolymer = new THREE.MeshStandardMaterial({ color: 0x12151a, metalness: 0.25, roughness: 0.75 });
  const accentHex = weaponId === 'railgun' ? 0xc084fc : (weaponId === 'shotgun' ? 0xfb923c : 0x22d3ee);
  const accentMat = new THREE.MeshStandardMaterial({ color: accentHex, emissive: accentHex, emissiveIntensity: 2.2 });

  let muzzleZ = -0.68;
  let laserBeam = null;

  if (weaponId === 'railgun') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.13, 0.56), gunmetal);
    body.position.set(0, 0, -0.14);
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.032, 0.62), gunmetal);
    railTop.position.set(0, 0.045, -0.58);
    const railBot = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.032, 0.62), gunmetal);
    railBot.position.set(0, -0.025, -0.58);
    const plasmaCore = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.028, 0.58), accentMat);
    plasmaCore.position.set(0, 0.01, -0.56);
    // Digital Rail Scope Assembly + Glowing Ocular Lens
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.034, 0.32, 12), darkPolymer);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.105, -0.18);
    const scopeRingF = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.005, 6, 12), gunmetal);
    scopeRingF.position.set(0, 0.105, -0.32);
    const scopeLensMat = new THREE.MeshBasicMaterial({ color: 0xd8b4fe, transparent: true, opacity: 0.78 });
    const lensRear = new THREE.Mesh(new THREE.CircleGeometry(0.024, 12), scopeLensMat);
    lensRear.position.set(0, 0.105, -0.018);
    const lensDot = new THREE.Mesh(new THREE.CircleGeometry(0.005, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    lensDot.position.set(0, 0.105, -0.016);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.12, 0.26), darkPolymer);
    stock.position.set(0, -0.02, 0.24);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.13, 0.07), darkPolymer);
    grip.position.set(0, -0.1, 0.04);
    grip.rotation.x = 0.28;
    gun.add(body, railTop, railBot, plasmaCore, scopeTube, scopeRingF, lensRear, lensDot, stock, grip);
    muzzleZ = -0.92;
  } else if (weaponId === 'shotgun') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.36), gunmetal);
    receiver.position.set(0, 0, -0.1);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.52, 10), gunmetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.028, -0.48);
    const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.46, 10), darkPolymer);
    magTube.rotation.x = Math.PI / 2;
    magTube.position.set(0, -0.024, -0.44);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.2), darkPolymer);
    pump.position.set(0, -0.024, -0.42);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.035, 0.08), accentMat);
    sight.position.set(0, 0.075, -0.12);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.11, 0.26), darkPolymer);
    stock.position.set(0, -0.03, 0.2);

    // Side-Mounted Green Tactical Laser Module + Emissive Beam
    const laserBox = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.11), darkPolymer);
    laserBox.position.set(0.056, 0.018, -0.46);
    const laserEmitterMat = new THREE.MeshBasicMaterial({ color: 0x22ff66 });
    const laserEmitter = new THREE.Mesh(new THREE.CircleGeometry(0.008, 8), laserEmitterMat);
    laserEmitter.rotation.y = Math.PI;
    laserEmitter.position.set(0.056, 0.018, -0.517);

    const beamGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 16.0, 5);
    beamGeo.rotateX(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x22ff66, transparent: true, opacity: 0.48, depthWrite: false });
    laserBeam = new THREE.Mesh(beamGeo, beamMat);
    laserBeam.position.set(0.056, 0.018, -8.52);
    laserBeam.castShadow = false;
    laserBeam.receiveShadow = false;

    gun.add(receiver, barrel, magTube, pump, sight, stock, laserBox, laserEmitter, laserBeam);
    muzzleZ = -0.76;
  } else {
    // VX-47 Assault Rifle
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.115, 0.42), gunmetal);
    receiver.position.set(0, 0, -0.14);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.088, 0.28), darkPolymer);
    handguard.position.set(0, 0.005, -0.46);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, 0.22, 10), gunmetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, -0.66);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.18, 0.075), darkPolymer);
    mag.position.set(0, -0.13, -0.2);
    mag.rotation.x = 0.22;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.12, 0.06), darkPolymer);
    grip.position.set(0, -0.1, 0.02);
    grip.rotation.x = 0.3;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.11, 0.24), darkPolymer);
    stock.position.set(0, -0.015, 0.18);

    // Open-Window Holographic Red-Dot Sight
    const holoBase = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.018, 0.11), gunmetal);
    holoBase.position.set(0, 0.066, -0.12);
    const holoLeft = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.048, 0.095), gunmetal);
    holoLeft.position.set(-0.024, 0.095, -0.12);
    const holoRight = holoLeft.clone();
    holoRight.position.x = 0.024;
    const holoTop = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.008, 0.095), gunmetal);
    holoTop.position.set(0, 0.118, -0.12);
    const holoGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.042, 0.038),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
    );
    holoGlass.position.set(0, 0.095, -0.12);
    const redDotMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const redDot = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 8, 8), redDotMat);
    redDot.position.set(0, 0.095, -0.118);
    const railGlow = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.24), accentMat);
    railGlow.position.set(0, 0.052, -0.44);

    gun.add(receiver, handguard, barrel, mag, grip, stock, holoBase, holoLeft, holoRight, holoTop, holoGlass, redDot, railGlow);
    muzzleZ = -0.78;
  }

  // Muzzle Flash Cone + Light
  const flashMat = new THREE.MeshBasicMaterial({ color: accentHex, transparent: true, opacity: 0.92 });
  const flashMesh = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.28, 7), flashMat);
  flashMesh.rotation.x = -Math.PI / 2;
  flashMesh.position.set(0, 0.018, muzzleZ - 0.12);
  flashMesh.visible = false;
  flashMesh.castShadow = false;
  gun.add(flashMesh);

  const flashLight = new THREE.PointLight(accentHex, 0, 7);
  flashLight.position.set(0, 0.02, muzzleZ - 0.15);
  gun.add(flashLight);

  gun.userData.flashMesh = flashMesh;
  gun.userData.flashLight = flashLight;
  gun.userData.laserBeam = laserBeam;
  gun.userData.muzzleZ = muzzleZ;
  return gun;
}

export function createTacticalRifle() {
  return createWeaponMesh('rifle');
}

// --- Detailed First-Person Weapon Viewmodel (Hands + Weapon + Reflex Sight) ---
export function createFirstPersonViewmodel(weaponId = 'rifle') {
  const vm = new THREE.Group();
  const sleeveMat = new THREE.MeshStandardMaterial({ map: getKevlarTexture(), color: 0x3b4858, roughness: 0.78, metalness: 0.15 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x16191f, roughness: 0.85, metalness: 0.1 });

  const weapon = createWeaponMesh(weaponId);
  vm.add(weapon);

  // Right forearm + gloved hand on pistol grip
  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.34, 10), sleeveMat);
  rArm.rotation.x = Math.PI / 2 - 0.25;
  rArm.rotation.z = -0.22;
  rArm.position.set(0.09, -0.18, 0.18);
  const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.085, 0.095), gloveMat);
  rGlove.position.set(0.015, -0.095, 0.02);

  // Left forearm + gloved support hand under handguard/pump
  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.046, 0.38, 10), sleeveMat);
  lArm.rotation.x = Math.PI / 2 - 0.2;
  lArm.rotation.z = 0.45;
  lArm.position.set(-0.18, -0.16, -0.12);
  const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.072, 0.11), gloveMat);
  lGlove.position.set(-0.02, -0.055, -0.34);

  vm.add(rArm, rGlove, lArm, lGlove);
  vm.userData.weapon = weapon;
  vm.userData.flashMesh = weapon.userData.flashMesh;
  vm.userData.flashLight = weapon.userData.flashLight;
  vm.userData.laserBeam = weapon.userData.laserBeam;
  return vm;
}

// --- Articulated Realistic Humanoid Tactical Operator Rig (1.80m tall) ---
function tagHitZone(obj, zone) {
  obj.userData.hitZone = zone;
  obj.castShadow = true;
  obj.receiveShadow = true;
  obj.traverse((c) => {
    c.userData.hitZone = zone;
    if (c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
}

export function createOperatorModel(kitId = 'vanguard', weaponId = 'rifle') {
  const root = new THREE.Group();
  const isJug = kitId === 'juggernaut';
  const isSpec = kitId === 'spectre';

  const kevlarTex = getKevlarTexture();
  const baseColor = isSpec ? 0x161722 : (isJug ? 0x353b44 : 0x2a3746);
  const accentHex = isSpec ? 0xa855f7 : (isJug ? 0xf59e0b : 0x22d3ee);
  const uniformMat = new THREE.MeshStandardMaterial({ map: kevlarTex, color: baseColor, roughness: 0.72, metalness: 0.22 });
  const armorMat = new THREE.MeshStandardMaterial({ color: isJug ? 0x454c57 : 0x222933, roughness: 0.38, metalness: 0.65 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x13161c, roughness: 0.85, metalness: 0.15 });
  const visorMat = new THREE.MeshStandardMaterial({ color: accentHex, emissive: accentHex, emissiveIntensity: 2.3, roughness: 0.2 });

  let cloakMat = null;
  if (isSpec) {
    cloakMat = new THREE.ShaderMaterial({
      uniforms: {
        uBaseColor: { value: new THREE.Color(0x161224) },
        uRimColor: { value: new THREE.Color(0xa855f7) },
        uCloak: { value: 0.0 }
      },
      vertexShader: SPECTRE_CLOAK_VERT,
      fragmentShader: SPECTRE_CLOAK_FRAG,
      transparent: true
    });
  }

  const bodyMat = cloakMat || uniformMat;
  const torsoWidth = isJug ? 0.54 : (isSpec ? 0.39 : 0.44);
  const limbScale = isJug ? 1.2 : (isSpec ? 0.92 : 1.0);

  // Pelvis anchor (moves vertically for crouch/stride)
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.94;
  root.add(pelvis);

  const hipMesh = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth * 0.88, 0.18, 0.24), bodyMat);
  tagHitZone(hipMesh, 'torso');
  pelvis.add(hipMesh);

  // Articulated Torso + Plate Carrier Vest + Pouches + Back Rig
  const torso = new THREE.Group();
  torso.position.y = 0.1;
  pelvis.add(torso);

  const chestCore = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth, 0.52, 0.26 * limbScale), bodyMat);
  chestCore.position.y = 0.26;
  const plateCarrier = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth * 1.05, 0.42, 0.31 * limbScale), armorMat);
  plateCarrier.position.y = 0.28;
  // Mag pouches on front of plate carrier
  for (let i = -1; i <= 1; i++) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.12, 0.06), bootMat);
    pouch.position.set(i * 0.11, 0.18, -0.17 * limbScale);
    torso.add(pouch);
  }
  // Class-specific silhouette gear
  if (isJug) {
    const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.3), armorMat);
    pauldronL.position.set(-torsoWidth * 0.65, 0.46, 0);
    const pauldronR = pauldronL.clone();
    pauldronR.position.x = torsoWidth * 0.65;
    const reactor = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.08, 12), visorMat);
    reactor.rotation.x = Math.PI / 2;
    reactor.position.set(0, 0.35, -0.19 * limbScale);
    torso.add(pauldronL, pauldronR, reactor);
  } else if (isSpec) {
    const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.58, 10, 1, true), cloakMat);
    mantle.position.y = 0.24;
    torso.add(mantle);
  } else {
    // Vanguard Recon Thrusters
    const thrL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.26, 10), armorMat);
    thrL.position.set(-0.12, 0.3, 0.18);
    const thrR = thrL.clone();
    thrR.position.x = 0.12;
    const thrGlow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.04), visorMat);
    thrGlow.position.set(0, 0.38, 0.21);
    torso.add(thrL, thrR, thrGlow);
  }
  torso.add(chestCore, plateCarrier);
  tagHitZone(torso, 'torso');

  // Neck + Tactical Helmet Head Group (Hit Zone = HEAD 2.2x)
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.58;
  torso.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.09, 10), bootMat);
  neck.position.y = 0.03;
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.135 * (isJug ? 1.08 : 1.0), 14, 12), armorMat);
  cranium.position.y = 0.17;
  const helmetShell = new THREE.Mesh(new THREE.SphereGeometry(0.15 * (isJug ? 1.12 : 1.0), 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), armorMat);
  helmetShell.position.y = 0.18;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.065, 0.07), visorMat);
  visor.position.set(0, 0.17, -0.12);
  headGroup.add(neck, cranium, helmetShell, visor);
  tagHitZone(headGroup, 'head');

  // Articulated Arms (Upper + Forearm + Weapon Mount)
  const armL = new THREE.Group();
  armL.position.set(-torsoWidth * 0.6, 0.46, 0);
  const upperArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * limbScale, 0.048 * limbScale, 0.32, 10), bodyMat);
  upperArmL.position.y = -0.14;
  const foreArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * limbScale, 0.038 * limbScale, 0.28, 10), bootMat);
  foreArmL.position.set(0.06, -0.26, -0.16);
  foreArmL.rotation.x = Math.PI * 0.42;
  armL.add(upperArmL, foreArmL);
  tagHitZone(armL, 'limb');
  torso.add(armL);

  const armR = new THREE.Group();
  armR.position.set(torsoWidth * 0.6, 0.46, 0);
  const upperArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * limbScale, 0.048 * limbScale, 0.32, 10), bodyMat);
  upperArmR.position.y = -0.14;
  const foreArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * limbScale, 0.038 * limbScale, 0.28, 10), bootMat);
  foreArmR.position.set(-0.04, -0.26, -0.16);
  foreArmR.rotation.x = Math.PI * 0.42;
  const weaponMesh = createWeaponMesh(weaponId);
  weaponMesh.position.set(-0.08, -0.24, -0.24);
  armR.add(upperArmR, foreArmR, weaponMesh);
  tagHitZone(armR, 'limb');
  torso.add(armR);

  // Articulated Legs (Thigh + Knee Pad + Shin + Tactical Boot + Holstered Sidearm on Right Thigh)
  const makeLeg = (side) => {
    const leg = new THREE.Group();
    leg.position.set(side * (torsoWidth * 0.28), -0.04, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.082 * limbScale, 0.068 * limbScale, 0.44, 10), bodyMat);
    thigh.position.y = -0.22;
    const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.11 * limbScale, 0.11, 0.07), armorMat);
    kneePad.position.set(0, -0.44, -0.065 * limbScale);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.064 * limbScale, 0.052 * limbScale, 0.42, 10), bodyMat);
    shin.position.y = -0.64;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.12 * limbScale, 0.11, 0.24), bootMat);
    boot.position.set(0, -0.84, -0.04);
    leg.add(thigh, kneePad, shin, boot);
    if (side > 0) {
      const holster = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.09), bootMat);
      holster.position.set(0.09 * limbScale, -0.2, 0);
      leg.add(holster);
    }
    tagHitZone(leg, 'limb');
    return leg;
  };

  const legL = makeLeg(-1);
  const legR = makeLeg(1);
  pelvis.add(legL, legR);

  root.userData.rig = {
    pelvis,
    torso,
    headGroup,
    armL,
    armR,
    legL,
    legR,
    weaponMesh,
    stridePhase: Math.random() * Math.PI * 2
  };
  root.userData.cloakMat = cloakMat;
  root.userData.flashMesh = weaponMesh.userData.flashMesh;
  root.userData.flashLight = weaponMesh.userData.flashLight;
  return root;
}

export function animateOperatorRig(root, dt, moveSpeed = 0, isCrouching = false, isDead = false, deathProgress = 0) {
  const rig = root?.userData?.rig;
  if (!rig) return;

  if (isDead) {
    const t = Math.min(1, deathProgress);
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, -Math.PI * 0.48, t * 0.35 + 0.08);
    rig.pelvis.position.y = THREE.MathUtils.lerp(rig.pelvis.position.y, 0.22, 0.2);
    return;
  }

  root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, 0, 0.25);

  const targetPelvisY = isCrouching ? 0.66 : 0.94;
  rig.pelvis.position.y = THREE.MathUtils.lerp(rig.pelvis.position.y, targetPelvisY, Math.min(1, dt * 12));
  rig.torso.rotation.x = THREE.MathUtils.lerp(rig.torso.rotation.x, isCrouching ? 0.22 : 0.04, Math.min(1, dt * 10));

  if (moveSpeed > 0.35) {
    rig.stridePhase += dt * Math.min(12, moveSpeed * 1.9);
    const amp = isCrouching ? 0.35 : Math.min(0.65, moveSpeed * 0.09);
    rig.legL.rotation.x = Math.sin(rig.stridePhase) * amp;
    rig.legR.rotation.x = -Math.sin(rig.stridePhase) * amp;
    rig.pelvis.position.y += Math.abs(Math.cos(rig.stridePhase)) * 0.035;
    rig.armL.rotation.x = -Math.sin(rig.stridePhase) * 0.14;
  } else {
    rig.legL.rotation.x = THREE.MathUtils.lerp(rig.legL.rotation.x, isCrouching ? -0.45 : 0, Math.min(1, dt * 10));
    rig.legR.rotation.x = THREE.MathUtils.lerp(rig.legR.rotation.x, isCrouching ? 0.35 : 0, Math.min(1, dt * 10));
    rig.armL.rotation.x = THREE.MathUtils.lerp(rig.armL.rotation.x, 0, Math.min(1, dt * 10));
  }
}

// --- Tactical Multi-Tier Urban Industrial Arena Environment ---
export function createSkyDome() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false
  });
  return new THREE.Mesh(new THREE.SphereGeometry(95, 24, 16), mat);
}

export function createVaultStructure() {
  const group = new THREE.Group();
  const steelTex = getSteelTexture(2, 2);
  const cautionTex = getCautionTexture(4, 1);

  const armorMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({ map: steelTex, color: 0x303946 }),
    'vault_core'
  );
  const trimMat = new THREE.MeshStandardMaterial({ map: cautionTex, roughness: 0.55, metalness: 0.2 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x2dd4bf, emissive: 0x2dd4bf, emissiveIntensity: 2.2 });

  const core = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.6, 4.2), armorMat);
  core.position.y = 2.3;
  core.castShadow = true;
  core.receiveShadow = true;

  const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.35, 4.8), trimMat);
  basePlinth.position.y = 0.175;
  basePlinth.receiveShadow = true;

  const cap = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.4, 4.6), armorMat);
  cap.position.y = 4.75;
  cap.castShadow = true;

  const ringLow = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.12, 12, 36), ringMat);
  ringLow.rotation.x = Math.PI / 2;
  ringLow.position.y = 1.45;
  const ringHigh = ringLow.clone();
  ringHigh.position.y = 3.35;

  group.add(core, basePlinth, cap, ringLow, ringHigh);
  group.userData.rings = [ringLow, ringHigh];
  return group;
}

export function createArenaEnvironment() {
  const group = new THREE.Group();
  const colliders = [];
  const coverPoints = [];
  const stanchionPositions = [];

  const concreteMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({ map: getConcreteTexture(10, 10) }),
    'weathered_concrete'
  );
  const wallMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({ map: getConcreteTexture(6, 2), color: 0x86919e }),
    'ballistic_bunker'
  );
  const steelMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({ map: getSteelTexture(3, 1), color: 0x4b5666 }),
    'brushed_steel'
  );
  const grateMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({ map: getCatwalkGrateTexture(6, 2), color: 0x627082 }),
    'catwalk_grate'
  );
  const towerMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({ map: getSteelTexture(2, 2), color: 0x364150 }),
    'overwatch_alloy'
  );
  const cautionMat = new THREE.MeshStandardMaterial({ map: getCautionTexture(4, 1), roughness: 0.55, metalness: 0.22 });
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 2.4 });
  const amberBeaconMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 2.1 });

  // Main Tactical Floor (48x48m)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(48, 1, 48), concreteMat);
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  group.add(floor);

  const addStaticBox = (x, y, z, w, h, d, mat, registerCollider = true, rx = 0, rz = 0, castsShadow = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    if (rx !== 0) mesh.rotation.x = rx;
    if (rz !== 0) mesh.rotation.z = rz;
    mesh.castShadow = castsShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (registerCollider) {
      colliders.push({ x, y, z, hx: w / 2, hy: h / 2, hz: d / 2, rx, rz });
    }
    return mesh;
  };

  // Perimeter Armored Concrete Compound Walls
  addStaticBox(0, 3.0, -24, 48, 6.0, 1.0, wallMat, true, 0, 0, false);
  addStaticBox(0, 3.0, 24, 48, 6.0, 1.0, wallMat, true, 0, 0, false);
  addStaticBox(-24, 3.0, 0, 1.0, 6.0, 48, wallMat, true, 0, 0, false);
  addStaticBox(24, 3.0, 0, 1.0, 6.0, 48, wallMat, true, 0, 0, false);

  // --- Interconnected Upper Combat Network (Exported from Static-Recomp-Native) ---
  // 4 Corner Towers, 4 Perimeter Catwalks, Vault Overpass Ring, 2 Central Cross-Bridges, 4 Smooth Inclined Ramps
  const topY = UPPER_COMBAT_NETWORK.upper_deck_y;

  for (const seg of UPPER_COMBAT_NETWORK.segments) {
    const mat =
      seg.kind === 'tower'
        ? towerMat
        : seg.kind === 'vault_overpass'
          ? steelMat
          : grateMat;

    // Disable real-time shadow casting on catwalk grating, cross-bridges, and ramps (2GB VRAM optimization)
    const deckCastsShadow = seg.kind === 'tower';
    const deckCenterY = seg.y - seg.height * 0.5;
    addStaticBox(seg.x, deckCenterY, seg.z, seg.width, seg.height, seg.depth, mat, true, seg.rx, seg.rz, deckCastsShadow);

    if (seg.kind === 'tower') {
      // 4 reinforced tower support columns + glowing tactical beacon
      for (const ox of [-1.6, 1.6]) {
        for (const oz of [-1.6, 1.6]) {
          addStaticBox(seg.x + ox, (topY - 0.16) * 0.5, seg.z + oz, 0.36, topY - 0.16, 0.36, towerMat, true, 0, 0, true);
        }
      }
      addStaticBox(seg.x, topY + 1.08, seg.z + (seg.z < 0 ? -1.85 : 1.85), 3.6, 0.1, 0.1, amberBeaconMat, false, 0, 0, false);
    } else if (seg.kind === 'catwalk') {
      // Under-deck tactical glow trim + support pillars at thirds
      const isNS = seg.width > seg.depth;
      if (isNS) {
        addStaticBox(seg.x, topY - 0.32, seg.z + (seg.z < 0 ? 1.55 : -1.55), seg.width - 2, 0.08, 0.08, beaconMat, false, 0, 0, false);
        for (const px of [-14, -5.5, 5.5, 14]) {
          addStaticBox(px, (topY - 0.28) * 0.5, seg.z, 0.45, topY - 0.28, 0.45, steelMat, true, 0, 0, false);
        }
        // Guardrail segments (castShadow = false for 2GB VRAM performance)
        const railZ = seg.z + (seg.z < 0 ? 1.52 : -1.52);
        for (const [rxStart, rxEnd] of [[-17.2, -13.4], [-10.0, -1.7], [1.7, 10.0], [13.4, 17.2]]) {
          const rw = rxEnd - rxStart;
          const rcx = (rxStart + rxEnd) * 0.5;
          addStaticBox(rcx, topY + 0.92, railZ, rw, 0.09, 0.1, cautionMat, true, 0, 0, false);
          addStaticBox(rcx, topY + 0.46, railZ, rw, 0.07, 0.08, steelMat, false, 0, 0, false);
          stanchionPositions.push([rxStart + 0.2, topY + 0.46, railZ], [rxEnd - 0.2, topY + 0.46, railZ]);
        }
      } else {
        addStaticBox(seg.x + (seg.x < 0 ? 1.55 : -1.55), topY - 0.32, seg.z, 0.08, 0.08, seg.depth - 2, beaconMat, false, 0, 0, false);
        for (const pz of [-13, -5.5, 5.5, 13]) {
          addStaticBox(seg.x, (topY - 0.28) * 0.5, pz, 0.45, topY - 0.28, 0.45, steelMat, true, 0, 0, false);
        }
        const railX = seg.x + (seg.x < 0 ? 1.52 : -1.52);
        for (const [rzStart, rzEnd] of [[-17.2, -1.7], [1.7, 17.2]]) {
          const rd = rzEnd - rzStart;
          const rcz = (rzStart + rzEnd) * 0.5;
          addStaticBox(railX, topY + 0.92, rcz, 0.1, 0.09, rd, cautionMat, true, 0, 0, false);
          addStaticBox(railX, topY + 0.46, rcz, 0.08, 0.07, rd, steelMat, false, 0, 0, false);
          stanchionPositions.push([railX, topY + 0.46, rzStart + 0.2], [railX, topY + 0.46, rzEnd - 0.2]);
        }
      }
    } else if (seg.kind === 'cross_bridge') {
      const isEW = seg.width > seg.depth;
      if (isEW) {
        for (const dz of [-1.42, 1.42]) {
          addStaticBox(seg.x, topY + 0.92, seg.z + dz, seg.width - 0.6, 0.08, 0.09, cautionMat, true, 0, 0, false);
          stanchionPositions.push(
            [seg.x - seg.width * 0.4, topY + 0.46, seg.z + dz],
            [seg.x, topY + 0.46, seg.z + dz],
            [seg.x + seg.width * 0.4, topY + 0.46, seg.z + dz]
          );
        }
        addStaticBox(seg.x, topY - 0.28, seg.z, seg.width - 0.8, 0.08, 0.12, beaconMat, false, 0, 0, false);
      } else {
        for (const dx of [-1.42, 1.42]) {
          addStaticBox(seg.x + dx, topY + 0.92, seg.z, 0.09, 0.08, seg.depth - 0.6, cautionMat, true, 0, 0, false);
          stanchionPositions.push(
            [seg.x + dx, topY + 0.46, seg.z - seg.depth * 0.4],
            [seg.x + dx, topY + 0.46, seg.z],
            [seg.x + dx, topY + 0.46, seg.z + seg.depth * 0.4]
          );
        }
        addStaticBox(seg.x, topY - 0.28, seg.z, 0.12, 0.08, seg.depth - 0.8, beaconMat, false, 0, 0, false);
      }
    } else if (seg.kind === 'ramp') {
      // Sloped steel side stringers + safety handrails aligned to ramp pitch (no real-time shadow casting)
      for (const sideX of [-seg.width * 0.5 + 0.06, seg.width * 0.5 - 0.06]) {
        addStaticBox(seg.x + sideX, seg.y + 0.78, seg.z, 0.09, 0.09, seg.depth, cautionMat, true, seg.rx, seg.rz, false);
        addStaticBox(seg.x + sideX, seg.y + 0.36, seg.z, 0.07, 0.07, seg.depth, steelMat, false, seg.rx, seg.rz, false);
      }
      addStaticBox(seg.x, seg.y + 0.03, seg.z, 0.16, 0.03, seg.depth - 0.8, beaconMat, false, seg.rx, seg.rz, false);
    }
  }

  // Batch all guardrail stanchions into a single InstancedMesh (castShadow = false for 2GB VRAM)
  if (stanchionPositions.length > 0) {
    const postGeo = new THREE.BoxGeometry(0.08, 0.92, 0.08);
    const postInst = new THREE.InstancedMesh(postGeo, steelMat, stanchionPositions.length);
    const dummy = new THREE.Object3D();
    stanchionPositions.forEach(([px, py, pz], idx) => {
      dummy.position.set(px, py, pz);
      dummy.updateMatrix();
      postInst.setMatrixAt(idx, dummy.matrix);
    });
    postInst.castShadow = false;
    postInst.receiveShadow = false;
    group.add(postInst);
  }

  // Reinforced Ballistic Shield Bunkers on East & West Mid-Lane Approaches
  for (const bx of [-15.8, 15.8]) {
    addStaticBox(bx, 0.92, 0, 2.0, 1.85, 4.4, wallMat, true, 0, 0, true);
    addStaticBox(bx, 2.05, 0, 2.35, 0.24, 4.7, steelMat, true, 0, 0, false);
    addStaticBox(bx + (bx < 0 ? 1.05 : -1.05), 1.45, 0, 0.08, 0.14, 3.4, beaconMat, false, 0, 0, false);
    coverPoints.push({ x: bx, z: 0 });
  }

  // Tactical Jersey Barriers placed around lower choke points (clear of all 4 ramp entrances)
  const barriers = [
    { x: -15.2, z: -5.2, w: 3.4, h: 1.5, d: 0.75 },
    { x: 15.2, z: -5.2, w: 3.4, h: 1.5, d: 0.75 },
    { x: -15.2, z: 5.2, w: 3.4, h: 1.5, d: 0.75 },
    { x: 15.2, z: 5.2, w: 3.4, h: 1.5, d: 0.75 },
    { x: 0, z: -10.5, w: 4.2, h: 1.6, d: 0.8 },
    { x: 0, z: 10.5, w: 4.2, h: 1.6, d: 0.8 }
  ];
  for (const b of barriers) {
    addStaticBox(b.x, b.h / 2, b.z, b.w, b.h, b.d, wallMat, true, 0, 0, true);
    addStaticBox(b.x, b.h + 0.08, b.z, b.w, 0.14, b.d * 0.95, cautionMat, false, 0, 0, false);
    coverPoints.push({ x: b.x, z: b.z });
  }

  return { group, colliders, coverPoints };
}

export function createJumpPad(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const baseMat = new THREE.MeshStandardMaterial({ map: getSteelTexture(1, 1), color: 0x252d3a, metalness: 0.75, roughness: 0.35 });
  const chevMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 2.2 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.48, 0.2, 20), baseMat);
  base.position.y = 0.1;
  base.receiveShadow = true;
  const chevA = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.22), chevMat);
  chevA.position.set(0, 0.22, -0.32);
  const chevB = chevA.clone();
  chevB.position.z = 0.32;

  group.add(base, chevA, chevB);
  group.userData.chevMat = chevMat;
  return group;
}

export function createDestructibleCrate(id, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.userData.crateId = id;
  const woodMat = new THREE.MeshStandardMaterial({ map: getConcreteTexture(2, 2), color: 0xb27a44, roughness: 0.75, metalness: 0.1 });
  const bandMat = new THREE.MeshStandardMaterial({ map: getCautionTexture(2, 1), roughness: 0.5, metalness: 0.4 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 1.8), woodMat);
  body.position.y = 0.75;
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.crateId = id;

  const band = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.22, 1.86), bandMat);
  band.position.y = 0.75;
  band.castShadow = true;
  band.userData.crateId = id;

  group.add(body, band);
  return group;
}

export function createExplosiveBarrel(id, x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.userData.barrelId = id;

  const redDrumMat = new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.42, metalness: 0.55 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x262c35, roughness: 0.35, metalness: 0.78 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: getCautionTexture(2, 1), roughness: 0.5, metalness: 0.25 });

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.24, 12), redDrumMat);
  drum.position.y = 0.62;
  drum.castShadow = false;
  drum.receiveShadow = true;
  drum.userData.barrelId = id;

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.435, 0.435, 0.24, 12), hazardMat);
  band.position.y = 0.68;
  band.castShadow = false;
  band.userData.barrelId = id;

  const topRim = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.035, 6, 12), rimMat);
  topRim.rotation.x = Math.PI / 2;
  topRim.position.y = 1.22;
  topRim.userData.barrelId = id;

  const botRim = topRim.clone();
  botRim.position.y = 0.04;
  botRim.userData.barrelId = id;

  group.add(drum, band, topRim, botRim);
  return group;
}
