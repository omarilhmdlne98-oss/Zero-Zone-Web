import * as THREE from 'three';

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
    float fresnel = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPos)), 0.0, 1.0), 2.4);
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
    vec3 zenith = vec3(0.04, 0.08, 0.16);
    vec3 mid = vec3(0.14, 0.21, 0.32);
    vec3 horizon = vec3(0.42, 0.26, 0.18);
    vec3 col = mix(horizon, mid, smoothstep(-0.05, 0.22, h));
    col = mix(col, zenith, smoothstep(0.18, 0.75, h));
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

// --- Detailed 3D Tactical Weapons ---
export function createWeaponMesh(weaponId = 'rifle') {
  const gun = new THREE.Group();
  const gunmetal = new THREE.MeshStandardMaterial({ color: 0x1d232b, metalness: 0.78, roughness: 0.32 });
  const darkPolymer = new THREE.MeshStandardMaterial({ color: 0x12151a, metalness: 0.25, roughness: 0.75 });
  const accentHex = weaponId === 'railgun' ? 0xc084fc : (weaponId === 'shotgun' ? 0xfb923c : 0x22d3ee);
  const accentMat = new THREE.MeshStandardMaterial({ color: accentHex, emissive: accentHex, emissiveIntensity: 2.2 });

  let muzzleZ = -0.68;

  if (weaponId === 'railgun') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.13, 0.56), gunmetal);
    body.position.set(0, 0, -0.14);
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.032, 0.62), gunmetal);
    railTop.position.set(0, 0.045, -0.58);
    const railBot = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.032, 0.62), gunmetal);
    railBot.position.set(0, -0.025, -0.58);
    const plasmaCore = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.028, 0.58), accentMat);
    plasmaCore.position.set(0, 0.01, -0.56);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.28, 12), darkPolymer);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.105, -0.18);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), accentMat);
    lens.position.set(0, 0.105, -0.039);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.12, 0.26), darkPolymer);
    stock.position.set(0, -0.02, 0.24);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.13, 0.07), darkPolymer);
    grip.position.set(0, -0.1, 0.04);
    grip.rotation.x = 0.28;
    gun.add(body, railTop, railBot, plasmaCore, scope, lens, stock, grip);
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
    gun.add(receiver, barrel, magTube, pump, sight, stock);
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
    // Holographic Reflex Sight
    const opticHousing = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.056, 0.11), gunmetal);
    opticHousing.position.set(0, 0.085, -0.12);
    const reticleDot = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 8), accentMat);
    reticleDot.position.set(0, 0.088, -0.12);
    const railGlow = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.24), accentMat);
    railGlow.position.set(0, 0.052, -0.44);
    gun.add(receiver, handguard, barrel, mag, grip, stock, opticHousing, reticleDot, railGlow);
    muzzleZ = -0.78;
  }

  // Muzzle Flash Cone + Light
  const flashMat = new THREE.MeshBasicMaterial({ color: accentHex, transparent: true, opacity: 0.92 });
  const flashMesh = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.28, 7), flashMat);
  flashMesh.rotation.x = -Math.PI / 2;
  flashMesh.position.set(0, 0.018, muzzleZ - 0.12);
  flashMesh.visible = false;
  gun.add(flashMesh);

  const flashLight = new THREE.PointLight(accentHex, 0, 7);
  flashLight.position.set(0, 0.02, muzzleZ - 0.15);
  gun.add(flashLight);

  gun.userData.flashMesh = flashMesh;
  gun.userData.flashLight = flashLight;
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

  const armorMat = new THREE.MeshStandardMaterial({ map: steelTex, color: 0x303946, metalness: 0.72, roughness: 0.36 });
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

  const concreteMat = new THREE.MeshStandardMaterial({ map: getConcreteTexture(10, 10), roughness: 0.86, metalness: 0.06 });
  const wallMat = new THREE.MeshStandardMaterial({ map: getConcreteTexture(6, 2), color: 0x86919e, roughness: 0.84, metalness: 0.1 });
  const steelMat = new THREE.MeshStandardMaterial({ map: getSteelTexture(3, 1), color: 0x4b5666, roughness: 0.42, metalness: 0.76 });
  const cautionMat = new THREE.MeshStandardMaterial({ map: getCautionTexture(4, 1), roughness: 0.55, metalness: 0.22 });
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 2.4 });

  // Main Tactical Floor (48x48m)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(48, 1, 48), concreteMat);
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  group.add(floor);

  const addStaticBox = (x, y, z, w, h, d, mat, registerCollider = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (registerCollider) {
      colliders.push({ x, y, z, hx: w / 2, hy: h / 2, hz: d / 2 });
    }
    return mesh;
  };

  // Perimeter Armored Concrete Compound Walls
  addStaticBox(0, 3.0, -24, 48, 6.0, 1.0, wallMat);
  addStaticBox(0, 3.0, 24, 48, 6.0, 1.0, wallMat);
  addStaticBox(-24, 3.0, 0, 1.0, 6.0, 48, wallMat);
  addStaticBox(24, 3.0, 0, 1.0, 6.0, 48, wallMat);

  // Elevated North & South Sniper Perches / Industrial Catwalks (y = 3.2m)
  for (const side of [-1, 1]) {
    const zDeck = side * 17.5;
    addStaticBox(0, 3.1, zDeck, 18, 0.35, 4.2, steelMat);
    // Guardrails (waist-high tactical cover on sniper deck)
    addStaticBox(-5.5, 3.85, zDeck - side * 1.95, 6.2, 1.05, 0.24, cautionMat);
    addStaticBox(5.5, 3.85, zDeck - side * 1.95, 6.2, 1.05, 0.24, cautionMat);
    // Support pillars
    addStaticBox(-8.2, 1.55, zDeck, 0.65, 3.1, 0.65, steelMat);
    addStaticBox(8.2, 1.55, zDeck, 0.65, 3.1, 0.65, steelMat);
    // Access Stairs/Stepped Ramps on East & West ends
    for (let step = 0; step < 6; step++) {
      const sy = 0.26 + step * 0.52;
      const sx = 9.8 + (5 - step) * 0.95;
      addStaticBox(sx, sy / 2, zDeck, 0.95, sy, 3.2, steelMat);
      addStaticBox(-sx, sy / 2, zDeck, 0.95, sy, 3.2, steelMat);
    }
    // Emissive Tactical Strip under deck
    addStaticBox(0, 2.88, zDeck - side * 2.05, 16, 0.09, 0.08, beaconMat, false);
  }

  // Tactical Jersey Barriers & Reinforced Cover Walls around choke points
  const barriers = [
    { x: -12, z: -7, w: 3.8, h: 1.55, d: 0.75 },
    { x: 12, z: -7, w: 3.8, h: 1.55, d: 0.75 },
    { x: -12, z: 7, w: 3.8, h: 1.55, d: 0.75 },
    { x: 12, z: 7, w: 3.8, h: 1.55, d: 0.75 },
    { x: 0, z: -10.5, w: 4.4, h: 1.65, d: 0.8 },
    { x: 0, z: 10.5, w: 4.4, h: 1.65, d: 0.8 }
  ];
  for (const b of barriers) {
    addStaticBox(b.x, b.h / 2, b.z, b.w, b.h, b.d, wallMat);
    addStaticBox(b.x, b.h + 0.08, b.z, b.w, 0.14, b.d * 0.95, cautionMat, false);
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
