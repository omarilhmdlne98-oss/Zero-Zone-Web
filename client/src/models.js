import * as THREE from 'three';
import { applyBattlefieldPBRShader } from './pbr_shaders.js';
import { SINAI_SHELL_CRATERS, UPPER_COMBAT_NETWORK, getSinaiTerrainHeight } from './bridge_network.js';

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
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  varying vec3 vWorldPos;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec3 dir = normalize(vWorldPos);
    float h = clamp(dir.y, -0.05, 1.0);
    vec3 sunDir = normalize(uSunDir);
    float sunDot = max(0.0, dot(dir, sunDir));

    // Rayleigh / Mie Sinai Desert Scattering Gradient
    vec3 zenith = uZenithColor;
    vec3 dustHorizon = uHorizonColor;
    vec3 midSky = mix(dustHorizon, zenith, 0.48) + vec3(0.08, 0.08, 0.07);

    vec3 col = mix(dustHorizon, midSky, smoothstep(0.0, 0.28, max(0.0, h)));
    col = mix(col, zenith, smoothstep(0.24, 0.88, max(0.0, h)));

    // Subtle high-altitude drifting desert cirrus clouds
    if (h > 0.06) {
      vec2 cloudUV = dir.xz / (h + 0.18) * 1.35 + vec2(uTime * 0.012, -uTime * 0.006);
      float c1 = noise2D(cloudUV * 2.2);
      float c2 = noise2D(cloudUV * 4.8 + 3.7);
      float cloud = smoothstep(0.56, 0.86, c1 * 0.65 + c2 * 0.35) * smoothstep(0.06, 0.28, h);
      col = mix(col, mix(dustHorizon, vec3(1.0), 0.72), cloud * 0.26);
    }

    // Mie forward-scattering golden solar aureole & crisp sun disc
    float mieHalo = pow(sunDot, 7.0) * 0.36 + pow(sunDot, 42.0) * 0.45;
    float sunDisc = smoothstep(0.9982, 0.9996, sunDot);
    col += mix(dustHorizon, vec3(1.0, 0.92, 0.72), 0.6) * mieHalo + vec3(1.0, 0.98, 0.88) * sunDisc * 1.35;

    // Warm desert dust band right at the horizon
    float horizonDust = pow(1.0 - clamp(abs(h) * 3.4, 0.0, 1.0), 2.4);
    col = mix(col, dustHorizon, horizonDust * 0.45);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const SUEZ_WATER_VERT = `
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SUEZ_WATER_FRAG = `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uCameraPos;
  uniform vec3 uHorizonColor;
  uniform float uFogDensity;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  float waveLayer(vec2 p, float t) {
    float w1 = sin(p.x * 1.45 + t * 1.85 + cos(p.y * 1.15 - t * 1.1));
    float w2 = cos(p.x * 2.75 - t * 1.45 + sin(p.y * 2.35 + t * 1.65));
    float w3 = sin((p.x + p.y) * 4.1 - t * 2.2);
    return (w1 * 0.45 + w2 * 0.35 + w3 * 0.20);
  }

  void main() {
    vec2 p = vWorldPos.xz;
    // Dual-layer flowing Suez Canal current ripples
    float e = 0.14;
    float h0 = waveLayer(p * 0.85, uTime);
    float hx = waveLayer((p + vec2(e, 0.0)) * 0.85, uTime);
    float hz = waveLayer((p + vec2(0.0, e)) * 0.85, uTime);
    vec3 n = normalize(vec3((h0 - hx) * 1.25, 1.0, (h0 - hz) * 1.25));

    vec3 v = normalize(uCameraPos - vWorldPos);
    vec3 l = normalize(uSunDir);
    vec3 hVec = normalize(l + v);

    float fresnel = pow(max(0.001, 1.0 - clamp(dot(n, v), 0.0, 1.0)), 3.2);
    float spec = pow(max(0.0, dot(n, hVec)), 72.0) * 1.35 + pow(max(0.0, dot(n, hVec)), 18.0) * 0.25;

    // Deep canal center vs turquoise shallow banks
    float bankDist = abs(vWorldPos.z) / 8.2;
    vec3 deepCol = vec3(0.07, 0.28, 0.35);
    vec3 shallowCol = vec3(0.18, 0.48, 0.52);
    vec3 skyReflect = mix(vec3(0.35, 0.48, 0.62), uHorizonColor, 0.72);

    vec3 waterCol = mix(deepCol, shallowCol, smoothstep(0.35, 0.95, bankDist) + h0 * 0.08);
    waterCol = mix(waterCol, skyReflect, fresnel * 0.58);
    waterCol += vec3(1.0, 0.94, 0.78) * spec;

    // Shoreline foam along East & West Canal banks + wake foam around 3 Pontoon Bridges (x = -28, 0, +28)
    float bankFoam = smoothstep(0.82, 0.99, bankDist + h0 * 0.045);
    float bridgeDist = min(abs(vWorldPos.x), min(abs(vWorldPos.x + 28.0), abs(vWorldPos.x - 28.0)));
    float pontoonFoam = (1.0 - smoothstep(2.1, 3.3, bridgeDist)) * (0.45 + 0.55 * abs(h0));
    float totalFoam = clamp(bankFoam + pontoonFoam * 0.75, 0.0, 1.0);

    waterCol = mix(waterCol, vec3(0.92, 0.90, 0.82), totalFoam * 0.72);

    // Distance fog blend matching scene.fog
    float camDist = length(uCameraPos - vWorldPos);
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * camDist * camDist);
    waterCol = mix(waterCol, uHorizonColor, clamp(fogFactor, 0.0, 1.0));

    gl_FragColor = vec4(waterCol, 0.91);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// --- Procedural PBR Canvas Textures ---
const _texCache = {};

function makeCanvasTexture(key, size, drawFn, repeatX = 1, repeatY = 1, isLinear = false) {
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
  tex.colorSpace = isLinear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  _texCache[key] = tex;
  return tex;
}

export function getSmokePuffTexture() {
  if (_texCache.smoke_puff) return _texCache.smoke_puff;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0.0, 'rgba(255,255,255,0.92)');
  grad.addColorStop(0.42, 'rgba(220,214,205,0.52)');
  grad.addColorStop(0.75, 'rgba(160,152,142,0.16)');
  grad.addColorStop(1.0, 'rgba(120,115,108,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _texCache.smoke_puff = tex;
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

export function getSandTexture(repX = 12, repY = 6) {
  return makeCanvasTexture(`sinai_sand_${repX}_${repY}`, 256, (ctx, s) => {
    ctx.fillStyle = '#d4b27c';
    ctx.fillRect(0, 0, s, s);
    // Wind-blown desert dune ripples with sinusoidal micro-ridges
    for (let y = 0; y < s; y += 4) {
      const wave = Math.sin((y / s) * Math.PI * 16);
      const alpha = 0.16 + Math.abs(wave) * 0.18;
      ctx.fillStyle = wave > 0 ? `rgba(238,208,154,${alpha.toFixed(2)})` : `rgba(164,126,74,${alpha.toFixed(2)})`;
      ctx.fillRect(0, y, s, 2);
    }
    for (let i = 0; i < 2800; i++) {
      const shade = 165 + Math.floor(Math.random() * 62);
      ctx.fillStyle = `rgb(${shade},${Math.floor(shade * 0.84)},${Math.floor(shade * 0.58)})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 3, 2);
    }
  }, repX, repY);
}

export function getSandNormalTexture(repX = 36, repY = 36) {
  return makeCanvasTexture(`sinai_sand_norm_${repX}_${repY}`, 128, (ctx, s) => {
    for (let y = 0; y < s; y++) {
      const ny = Math.floor(128 + Math.cos((y / s) * Math.PI * 16) * 34);
      for (let x = 0; x < s; x += 4) {
        const nx = Math.floor(128 + Math.sin((x / s) * Math.PI * 8 + (y / s) * 6.0) * 14);
        ctx.fillStyle = `rgb(${nx},${ny},255)`;
        ctx.fillRect(x, y, 4, 1);
      }
    }
  }, repX, repY, true);
}

export function getCamoNetTexture(repX = 3, repY = 2) {
  return makeCanvasTexture(`camo_net_${repX}_${repY}`, 128, (ctx, s) => {
    ctx.fillStyle = '#9c8357';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#78633e' : '#b89f6f';
      ctx.fillRect(Math.random() * s, Math.random() * s, 10 + Math.random() * 14, 6 + Math.random() * 10);
    }
    ctx.strokeStyle = 'rgba(42,34,21,0.45)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= s; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i, s);
      ctx.moveTo(0, i); ctx.lineTo(s, i);
      ctx.stroke();
    }
  }, repX, repY);
}

export function getWaterTexture(repX = 10, repY = 2) {
  return makeCanvasTexture(`suez_water_${repX}_${repY}`, 256, (ctx, s) => {
    ctx.fillStyle = '#1e5c68';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 420; i++) {
      ctx.fillStyle = i % 3 === 0 ? 'rgba(125,211,224,0.22)' : 'rgba(15,62,74,0.3)';
      ctx.fillRect(Math.random() * s, Math.random() * s, 14 + Math.random() * 24, 2);
    }
  }, repX, repY);
}

export function getSandbagTexture(repX = 4, repY = 2) {
  return makeCanvasTexture(`sandbag_${repX}_${repY}`, 128, (ctx, s) => {
    ctx.fillStyle = '#b99d6e';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#755e3b';
    ctx.lineWidth = 2;
    for (let y = 0; y < s; y += 24) {
      const offset = (y / 24) % 2 === 0 ? 0 : 16;
      for (let x = -16; x < s + 16; x += 32) {
        ctx.strokeRect(x + offset, y + 1, 30, 22);
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

// --- 1973 Sinai Desert Open-World Terrain (400m x 400m) ---
export function createSkyDome() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uSunDir: { value: new THREE.Vector3(42, 68, 32).normalize() },
      uZenithColor: { value: new THREE.Color(0x2f5a92) },
      uHorizonColor: { value: new THREE.Color(0xd8b480) }
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(320, 28, 18), mat);
  mesh.userData.skyMaterial = mat;
  return mesh;
}

export function createVaultStructure() {
  const group = new THREE.Group();
  const baseH = getSinaiTerrainHeight(0, -14.5);
  group.position.set(0, baseH, -14.5);

  const steelTex = getSteelTexture(2, 2);
  const cautionTex = getCautionTexture(4, 1);

  const armorMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({ map: steelTex, color: 0x5c6452 }),
    'pontoon_steel'
  );
  const trimMat = new THREE.MeshStandardMaterial({ map: cautionTex, roughness: 0.55, metalness: 0.2 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 2.0 });

  const core = new THREE.Mesh(new THREE.BoxGeometry(3.8, 4.2, 3.8), armorMat);
  core.position.y = 2.25;
  core.castShadow = true;
  core.receiveShadow = true;

  const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.35, 4.6), trimMat);
  basePlinth.position.y = 0.18;
  basePlinth.receiveShadow = true;

  const cap = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.38, 4.2), armorMat);
  cap.position.y = 4.52;
  cap.castShadow = true;

  const ringLow = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.11, 10, 28), ringMat);
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
  const radarDishes = [];
  const stanchionPositions = [];
  const sandbagInstances = [];
  const rockInstances = [];

  const sandMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({
      map: getSandTexture(36, 36),
      normalMap: getSandNormalTexture(44, 44),
      normalScale: new THREE.Vector2(0.45, 0.45),
      color: 0xffffff,
      vertexColors: true
    }),
    'sinai_sand'
  );
  const bermMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({
      map: getSandTexture(10, 3),
      normalMap: getSandNormalTexture(16, 6),
      normalScale: new THREE.Vector2(0.38, 0.38),
      color: 0xd1ac72
    }),
    'berm_earth'
  );
  const bunkerMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({ map: getConcreteTexture(4, 2), color: 0xc2b092 }),
    'desert_concrete'
  );
  const pontoonMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({ map: getSteelTexture(3, 2), color: 0x626b54 }),
    'pontoon_steel'
  );
  const steelMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({ map: getSteelTexture(3, 1), color: 0x726d60 }),
    'brushed_steel'
  );
  const grateMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({ map: getCatwalkGrateTexture(6, 2), color: 0x7a7465 }),
    'catwalk_grate'
  );
  const rockMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({
      map: getConcreteTexture(2, 2),
      color: 0xa68c67
    }),
    'sinai_limestone'
  );
  const palmTrunkMat = new THREE.MeshStandardMaterial({
    map: getSandbagTexture(2, 4),
    color: 0x6e5337,
    roughness: 0.92,
    metalness: 0.02
  });
  const palmCrownMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({ color: 0x4c6b3c }),
    'oasis_palm_foliage'
  );
  const scrubMat = new THREE.MeshStandardMaterial({
    color: 0x786d46,
    roughness: 0.94,
    metalness: 0.02
  });
  const camoNetMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({
      map: getCamoNetTexture(3, 2),
      color: 0xa89064,
      side: THREE.DoubleSide
    }),
    'desert_camo_net'
  );
  const sandbagMat = new THREE.MeshStandardMaterial({ map: getSandbagTexture(2, 1), color: 0xcbb07f, roughness: 0.9, metalness: 0.04 });
  const cautionMat = new THREE.MeshStandardMaterial({ map: getCautionTexture(4, 1), roughness: 0.55, metalness: 0.2 });
  const slitMat = new THREE.MeshBasicMaterial({ color: 0x151311 });
  const treadMat = new THREE.MeshStandardMaterial({ color: 0x6a573d, roughness: 0.95, metalness: 0.05 });
  const floatMat = new THREE.MeshStandardMaterial({ color: 0x434d3a, roughness: 0.6, metalness: 0.45 });
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 1.9 });
  const amberBeaconMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 1.8 });

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

  // --- 1. Continuous 400m x 400m Open-World Sinai Desert Heightfield with Slope-Blended Limestone & Wind Ripples ---
  const terrainSize = UPPER_COMBAT_NETWORK.terrain_size_m;
  const gridSegs = 112;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, gridSegs, gridSegs);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const trimeshVertices = new Float32Array(posAttr.count * 3);

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = getSinaiTerrainHeight(vx, vz);
    posAttr.setY(i, vy);

    trimeshVertices[i * 3] = vx;
    trimeshVertices[i * 3 + 1] = vy;
    trimeshVertices[i * 3 + 2] = vz;
  }

  terrainGeo.computeVertexNormals();
  const normAttr = terrainGeo.attributes.normal;

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = posAttr.getY(i);
    const ny = Math.abs(normAttr.getY(i));
    const slope = 1.0 - THREE.MathUtils.clamp(ny, 0.0, 1.0);
    const rockFactor = THREE.MathUtils.smoothstep(slope, 0.09, 0.34);

    // Base wind-rippled golden sand -> weathered Sinai limestone on steep slopes -> wet dark silt near canal
    let r = 0.90;
    let g = 0.78;
    let b = 0.59;
    if (vy < -0.05) {
      // Wet canal bank & bed silt
      const wetT = THREE.MathUtils.clamp((-0.05 - vy) / 1.2, 0.0, 1.0);
      r = THREE.MathUtils.lerp(0.76, 0.48, wetT);
      g = THREE.MathUtils.lerp(0.65, 0.42, wetT);
      b = THREE.MathUtils.lerp(0.48, 0.32, wetT);
    } else if (vy > 4.2) {
      // Distant desert mountain ridge rock
      const t = Math.min(1, (vy - 4.2) / 14.0);
      r = 0.84 - t * 0.20;
      g = 0.70 - t * 0.18;
      b = 0.52 - t * 0.15;
    } else {
      const crest = Math.min(1, Math.max(0, vy) / 3.8);
      r = 0.87 + crest * 0.09;
      g = 0.75 + crest * 0.09;
      b = 0.57 + crest * 0.08;
    }

    // Slope-based limestone rock exposure
    r = THREE.MathUtils.lerp(r, 0.64, rockFactor * 0.85);
    g = THREE.MathUtils.lerp(g, 0.55, rockFactor * 0.85);
    b = THREE.MathUtils.lerp(b, 0.42, rockFactor * 0.85);

    // Compacted Desert Assault Roads leading to all 3 Suez Pontoon Bridges (x = -28, 0, +28)
    const roadDist = Math.min(Math.abs(vx + 28.0), Math.abs(vx), Math.abs(vx - 28.0));
    if (roadDist < 4.2 && Math.abs(vz) > 8.6 && Math.abs(vz) < 52.0) {
      const roadBlend = 1.0 - THREE.MathUtils.smoothstep(roadDist, 1.6, 4.2);
      const trackGroove = Math.abs(roadDist - 1.15) < 0.45 ? 0.14 : 0.0;
      r = THREE.MathUtils.lerp(r, 0.64 - trackGroove, roadBlend * 0.75);
      g = THREE.MathUtils.lerp(g, 0.53 - trackGroove, roadBlend * 0.75);
      b = THREE.MathUtils.lerp(b, 0.38 - trackGroove * 0.8, roadBlend * 0.75);
    }

    // Scorched Artillery Shell Craters (dark ash bowl + charred ejecta rim)
    for (const cr of SINAI_SHELL_CRATERS) {
      const cd = Math.hypot(vx - cr.x, vz - cr.z);
      if (cd < cr.radius * 1.35) {
        const scorch = 1.0 - THREE.MathUtils.smoothstep(cd, cr.radius * 0.25, cr.radius * 1.35);
        r = THREE.MathUtils.lerp(r, 0.26, scorch * 0.82);
        g = THREE.MathUtils.lerp(g, 0.22, scorch * 0.82);
        b = THREE.MathUtils.lerp(b, 0.18, scorch * 0.82);
      }
    }

    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const rawIndex = terrainGeo.index.array;
  const trimeshIndices = new Uint32Array(rawIndex.length);
  for (let i = 0; i < rawIndex.length; i++) {
    trimeshIndices[i] = rawIndex[i];
  }

  const terrainMesh = new THREE.Mesh(terrainGeo, sandMat);
  terrainMesh.castShadow = false;
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // Tank Tread Tracks along the 3 Pontoon Bridge Assault Corridors (x = -28, 0, +28)
  for (const bx of [-28.0, 0.0, 28.0]) {
    for (const dx of [-1.1, 1.1]) {
      addStaticBox(bx + dx, 0.03, 21.0, 0.62, 0.03, 22.0, treadMat, false, 0, 0, false);
      addStaticBox(bx + dx, 0.03, -21.0, 0.62, 0.03, 22.0, treadMat, false, 0, 0, false);
    }
  }

  // --- 2. Animated Dual-Layer Normal-Mapped Suez Canal Water Shader (400m x 16.4m, z in [-8.2, 8.2]) ---
  const waterShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uSunDir: { value: new THREE.Vector3(42, 68, 32).normalize() },
      uCameraPos: { value: new THREE.Vector3(0, 2.0, 24.0) },
      uHorizonColor: { value: new THREE.Color(0xd8b480) },
      uFogDensity: { value: 0.0042 }
    },
    vertexShader: SUEZ_WATER_VERT,
    fragmentShader: SUEZ_WATER_FRAG,
    transparent: true,
    depthWrite: false
  });
  const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 16.4, 64, 8), waterShaderMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(0, -0.35, 0);
  waterMesh.receiveShadow = false;
  waterMesh.castShadow = false;
  group.add(waterMesh);

  // --- 3. Iconic East Bank Sand Berm Rampart (z = -22m, y = 4.5m crest, 3 wide assault breaches at x = -28, 0, +28) ---
  const bermSpans = [
    { x: -46.0, w: 24.0 },
    { x: -14.0, w: 16.5 },
    { x: 14.0, w: 16.5 },
    { x: 46.0, w: 24.0 }
  ];
  for (const bs of bermSpans) {
    addStaticBox(bs.x, 2.15, -22.0, bs.w, 4.3, 3.6, bermMat, true, 0, 0, false);
    addStaticBox(bs.x, 2.1, -19.2, bs.w, 0.75, 5.2, bermMat, false, -0.74, 0, false);
    addStaticBox(bs.x, 2.1, -24.8, bs.w, 0.75, 5.2, bermMat, false, 0.74, 0, false);
    for (let sx = bs.x - bs.w * 0.44; sx <= bs.x + bs.w * 0.44; sx += 1.8) {
      sandbagInstances.push([sx, 4.72, -20.3, 0]);
    }
  }

  // --- 4. 3 Suez Canal Pontoon Bridges, Over-Breach Catwalks, 4 Radar Towers & 4 Berm Ramps ---
  const topY = UPPER_COMBAT_NETWORK.upper_deck_y;
  for (const seg of UPPER_COMBAT_NETWORK.segments) {
    const mat =
      seg.kind === 'pontoon'
        ? pontoonMat
        : seg.kind === 'berm_crest'
          ? bermMat
          : seg.kind === 'tower'
            ? bunkerMat
            : grateMat;

    const deckCastsShadow = seg.kind === 'tower';
    const deckCenterY = seg.y - seg.height * 0.5;
    addStaticBox(seg.x, deckCenterY, seg.z, seg.width, seg.height, seg.depth, mat, true, seg.rx, seg.rz, deckCastsShadow);

    if (seg.kind === 'pontoon') {
      for (const fz of [-6.2, -3.1, 0, 3.1, 6.2]) {
        addStaticBox(seg.x, -0.1, fz, seg.width + 0.7, 0.42, 1.5, floatMat, false, 0, 0, false);
      }
      addStaticBox(seg.x, 0.16, 10.0, seg.width, 0.22, 2.6, pontoonMat, true, 0.18, 0, false);
      addStaticBox(seg.x, 0.16, -10.0, seg.width, 0.22, 2.6, pontoonMat, true, -0.18, 0, false);
      for (const side of [-1, 1]) {
        const rx = seg.x + side * (seg.width * 0.5 - 0.12);
        addStaticBox(rx, 0.68, 0, 0.16, 0.32, seg.depth - 0.4, cautionMat, false, 0, 0, false);
        for (const dz of [-7.2, -3.6, 0, 3.6, 7.2]) {
          stanchionPositions.push([rx, 0.74, dz]);
        }
      }
    } else if (seg.kind === 'tower') {
      const groundH = getSinaiTerrainHeight(seg.x, seg.z);
      const colH = Math.max(1.5, topY - groundH - 0.16);
      for (const ox of [-1.65, 1.65]) {
        for (const oz of [-1.65, 1.65]) {
          addStaticBox(seg.x + ox, groundH + colH * 0.5, seg.z + oz, 0.44, colH, 0.44, bunkerMat, true, 0, 0, true);
        }
      }
      if (seg.z < 0) {
        addStaticBox(seg.x, topY + 1.4, seg.z, 0.24, 2.8, 0.24, steelMat, false, 0, 0, false);
        const dishGroup = new THREE.Group();
        dishGroup.position.set(seg.x, topY + 2.85, seg.z);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.26, 0.14), steelMat);
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), beaconMat);
        tip.position.y = 0.26;
        dishGroup.add(bar, tip);
        group.add(dishGroup);
        radarDishes.push(dishGroup);
      } else {
        addStaticBox(seg.x, topY + 0.95, seg.z + 1.9, 3.8, 0.1, 0.1, amberBeaconMat, false, 0, 0, false);
      }
    } else if (seg.kind === 'catwalk') {
      const railZ = seg.z + 1.32;
      addStaticBox(seg.x, topY + 0.88, railZ, seg.width - 0.4, 0.09, 0.1, cautionMat, true, 0, 0, false);
      stanchionPositions.push([seg.x - seg.width * 0.4, topY + 0.44, railZ], [seg.x + seg.width * 0.4, topY + 0.44, railZ]);
    } else if (seg.kind === 'ramp') {
      for (const sideX of [-seg.width * 0.5 + 0.06, seg.width * 0.5 - 0.06]) {
        addStaticBox(seg.x + sideX, seg.y + 0.78, seg.z, 0.09, 0.09, seg.depth, cautionMat, true, seg.rx, seg.rz, false);
        addStaticBox(seg.x + sideX, seg.y + 0.36, seg.z, 0.07, 0.07, seg.depth, steelMat, false, seg.rx, seg.rz, false);
      }
    }
  }

  // Batch stanchions into 1 InstancedMesh (2GB VRAM optimal)
  if (stanchionPositions.length > 0) {
    const postGeo = new THREE.BoxGeometry(0.08, 0.88, 0.08);
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

  // --- 5. 6 Reinforced Bar-Lev Concrete Bunkers on Hills + Camouflage Netting Canopies ---
  const camoCanopyCoords = [];
  for (const bk of UPPER_COMBAT_NETWORK.bunker_hills) {
    const by = getSinaiTerrainHeight(bk.x, bk.z);
    addStaticBox(bk.x, by + 0.55, bk.z, 4.8, 1.1, 3.4, bunkerMat, true, 0, 0, true);
    addStaticBox(bk.x, by + 2.18, bk.z, 5.2, 0.44, 3.8, bunkerMat, true, 0, 0, true);
    addStaticBox(bk.x - 2.0, by + 1.52, bk.z, 0.75, 0.88, 3.2, bunkerMat, true, 0, 0, false);
    addStaticBox(bk.x + 2.0, by + 1.52, bk.z, 0.75, 0.88, 3.2, bunkerMat, true, 0, 0, false);
    addStaticBox(bk.x, by + 1.52, bk.z - bk.facingZ * 1.25, 3.2, 0.88, 0.7, bunkerMat, true, 0, 0, false);
    addStaticBox(bk.x, by + 1.52, bk.z + bk.facingZ * 0.48, 3.15, 0.64, 1.7, slitMat, false, 0, 0, false);
    for (let ox = -1.8; ox <= 1.8; ox += 0.9) {
      sandbagInstances.push([bk.x + ox, by + 0.24, bk.z + bk.facingZ * 2.0, 0]);
    }
    // Overhead desert camo netting canopy & support poles
    camoCanopyCoords.push([bk.x, by + 3.05, bk.z]);
    for (const px of [-2.7, 2.7]) {
      for (const pz of [-2.1, 2.1]) {
        stanchionPositions.push([bk.x + px, by + 2.6, bk.z + pz]);
      }
    }
    coverPoints.push({ x: bk.x, z: bk.z });
  }

  if (camoCanopyCoords.length > 0) {
    const canopyGeo = new THREE.BoxGeometry(6.2, 0.08, 4.8);
    const canopyInst = new THREE.InstancedMesh(canopyGeo, camoNetMat, camoCanopyCoords.length);
    const dummy = new THREE.Object3D();
    camoCanopyCoords.forEach(([cx, cy, cz], idx) => {
      dummy.position.set(cx, cy, cz);
      dummy.rotation.set(0.04 * (idx % 2 === 0 ? 1 : -1), 0, 0.03);
      dummy.updateMatrix();
      canopyInst.setMatrixAt(idx, dummy.matrix);
    });
    canopyInst.castShadow = false;
    canopyInst.receiveShadow = true;
    group.add(canopyInst);
  }

  // --- 6. Open-Field Tactical Trenches & Sandbag Emplacements Across +-80m Combat Zone ---
  const trenches = [
    { x: -14.0, z: 14.5, w: 5.2, h: 1.25, d: 0.95 },
    { x: 14.0, z: 14.5, w: 5.2, h: 1.25, d: 0.95 },
    { x: 0.0, z: 22.0, w: 5.6, h: 1.3, d: 0.95 },
    { x: -24.0, z: 28.0, w: 5.2, h: 1.25, d: 0.95 },
    { x: 24.0, z: 28.0, w: 5.2, h: 1.25, d: 0.95 },
    { x: -14.0, z: -13.0, w: 5.2, h: 1.25, d: 0.95 },
    { x: 14.0, z: -13.0, w: 5.2, h: 1.25, d: 0.95 },
    { x: -22.0, z: -38.0, w: 5.6, h: 1.3, d: 0.95 },
    { x: 22.0, z: -38.0, w: 5.6, h: 1.3, d: 0.95 }
  ];
  for (const tr of trenches) {
    const ty = getSinaiTerrainHeight(tr.x, tr.z);
    addStaticBox(tr.x, ty + tr.h * 0.5, tr.z, tr.w, tr.h, tr.d, bunkerMat, true, 0, 0, true);
    for (let sx = -tr.w * 0.42; sx <= tr.w * 0.42; sx += 0.85) {
      sandbagInstances.push([tr.x + sx, ty + tr.h + 0.18, tr.z, 0]);
    }
    coverPoints.push({ x: tr.x, z: tr.z });
  }

  // --- 7. Desert Rocky Outcrops (Batched in 1 InstancedMesh + Rapier Colliders) ---
  const rockCoords = [
    [-64, -48, 2.4], [64, -48, 2.5], [-52, 54, 2.2], [52, 54, 2.3],
    [-75, 14, 2.8], [75, 14, 2.7], [-72, -16, 2.6], [72, -16, 2.6],
    [-32, -56, 2.1], [32, -56, 2.1], [-30, 56, 2.0], [30, 56, 2.0],
    [-88, -75, 3.6], [88, -75, 3.5], [-88, 75, 3.4], [88, 75, 3.6]
  ];
  for (const [rx, rz, rScale] of rockCoords) {
    const ry = getSinaiTerrainHeight(rx, rz);
    rockInstances.push([rx, ry + rScale * 0.42, rz, rScale]);
    colliders.push({ x: rx, y: ry + rScale * 0.42, z: rz, hx: rScale * 0.72, hy: rScale * 0.55, hz: rScale * 0.72, rx: 0, rz: 0 });
    coverPoints.push({ x: rx, z: rz });
  }

  if (rockInstances.length > 0) {
    const rockGeo = new THREE.DodecahedronGeometry(0.95, 0);
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockInstances.length);
    const dummy = new THREE.Object3D();
    rockInstances.forEach(([rx, ry, rz, sc], idx) => {
      dummy.position.set(rx, ry, rz);
      dummy.rotation.set(idx * 0.7, idx * 1.3, 0);
      dummy.scale.set(sc * 1.15, sc * 0.75, sc);
      dummy.updateMatrix();
      rockInst.setMatrixAt(idx, dummy.matrix);
    });
    rockInst.castShadow = false;
    rockInst.receiveShadow = true;
    group.add(rockInst);
  }

  // --- 8. West Bank Canal Oasis Date Palm Trees (2 InstancedMeshes: Trunks + Frond Crowns, castShadow = false) ---
  const palmCoords = [
    [-44, 14, 1.05], [-36, 17, 0.95], [-18, 13, 1.0], [-9, 15, 0.92],
    [9, 15, 0.96], [19, 13, 1.04], [36, 17, 0.98], [45, 14, 1.08],
    [-54, 28, 1.12], [54, 28, 1.06], [-35, 44, 0.94], [35, 44, 1.0],
    [-62, 16, 1.02], [62, 16, 1.0]
  ];
  if (palmCoords.length > 0) {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 4.6, 7);
    const crownGeo = new THREE.ConeGeometry(2.15, 1.65, 7);
    const trunkInst = new THREE.InstancedMesh(trunkGeo, palmTrunkMat, palmCoords.length);
    const crownInst = new THREE.InstancedMesh(crownGeo, palmCrownMat, palmCoords.length * 2);
    const dummy = new THREE.Object3D();

    palmCoords.forEach(([px, pz, sc], idx) => {
      const py = getSinaiTerrainHeight(px, pz);
      const leanX = ((idx % 3) - 1) * 0.05;
      const leanZ = ((idx % 2) - 0.5) * 0.05;

      dummy.position.set(px, py + 2.25 * sc, pz);
      dummy.rotation.set(leanX, idx * 1.1, leanZ);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);

      // Lower & upper frond canopy tiers
      dummy.position.set(px + leanZ * 1.8, py + 4.45 * sc, pz + leanX * 1.8);
      dummy.rotation.set(leanX * 1.2, idx * 0.8, leanZ * 1.2);
      dummy.scale.set(sc * 1.15, sc * 0.72, sc * 1.15);
      dummy.updateMatrix();
      crownInst.setMatrixAt(idx * 2, dummy.matrix);

      dummy.position.set(px + leanZ * 2.1, py + 5.0 * sc, pz + leanX * 2.1);
      dummy.rotation.set(leanX * 1.4, idx * 0.8 + 0.45, leanZ * 1.4);
      dummy.scale.set(sc * 0.78, sc * 0.65, sc * 0.78);
      dummy.updateMatrix();
      crownInst.setMatrixAt(idx * 2 + 1, dummy.matrix);

      colliders.push({ x: px, y: py + 2.2 * sc, z: pz, hx: 0.32, hy: 2.2 * sc, hz: 0.32, rx: 0, rz: 0 });
    });

    trunkInst.castShadow = false;
    trunkInst.receiveShadow = true;
    crownInst.castShadow = false;
    crownInst.receiveShadow = false;
    group.add(trunkInst, crownInst);
  }

  // --- 9. Steel Czech-Hedgehog Anti-Tank Obstacles Along East Bank Berm & Canal Approaches (1 InstancedMesh) ---
  const hedgehogCoords = [
    [-38, -14], [-34, -15], [-21, -15], [-10, -16], [10, -16], [21, -15], [34, -15], [38, -14],
    [-23, -22], [23, -22], [-5, -22], [5, -22], [-33, 13], [33, 13]
  ];
  if (hedgehogCoords.length > 0) {
    const beamGeo = new THREE.BoxGeometry(0.14, 1.55, 0.14);
    const beamInst = new THREE.InstancedMesh(beamGeo, steelMat, hedgehogCoords.length * 3);
    const dummy = new THREE.Object3D();
    const beamAngles = [
      [0.62, 0.0, 0.55],
      [-0.62, 1.05, 0.55],
      [0.55, 2.1, -0.62]
    ];
    hedgehogCoords.forEach(([hx, hz], idx) => {
      const hy = getSinaiTerrainHeight(hx, hz) + 0.54;
      for (let b = 0; b < 3; b++) {
        dummy.position.set(hx, hy, hz);
        dummy.rotation.set(beamAngles[b][0], beamAngles[b][1] + idx * 0.3, beamAngles[b][2]);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        beamInst.setMatrixAt(idx * 3 + b, dummy.matrix);
      }
      colliders.push({ x: hx, y: hy, z: hz, hx: 0.58, hy: 0.58, hz: 0.58, rx: 0, rz: 0 });
    });
    beamInst.castShadow = false;
    beamInst.receiveShadow = false;
    group.add(beamInst);
  }

  // --- 10. Dry Sinai Desert Scrub Bushes Across Dunes (1 InstancedMesh, castShadow = false) ---
  const scrubCoords = [
    [-48, 36, 1.1], [-28, 42, 0.9], [-12, 34, 1.0], [12, 35, 0.95], [29, 41, 1.05], [48, 36, 1.15],
    [-58, -12, 1.0], [58, -12, 1.1], [-46, -54, 1.2], [-18, -48, 0.9], [18, -48, 0.95], [46, -54, 1.15],
    [-68, 38, 1.25], [68, 38, 1.2], [-66, -34, 1.1], [66, -34, 1.15], [-20, 12, 0.85], [20, 12, 0.88],
    [-38, -28, 0.92], [38, -28, 0.95], [-16, -68, 1.1], [16, -68, 1.05], [-14, 62, 1.05], [14, 62, 1.0]
  ];
  if (scrubCoords.length > 0) {
    const scrubGeo = new THREE.DodecahedronGeometry(0.55, 0);
    const scrubInst = new THREE.InstancedMesh(scrubGeo, scrubMat, scrubCoords.length);
    const dummy = new THREE.Object3D();
    scrubCoords.forEach(([sx, sz, sc], idx) => {
      const sy = getSinaiTerrainHeight(sx, sz);
      dummy.position.set(sx, sy + 0.24 * sc, sz);
      dummy.rotation.set(0, idx * 1.3, 0);
      dummy.scale.set(sc * 1.35, sc * 0.68, sc * 1.25);
      dummy.updateMatrix();
      scrubInst.setMatrixAt(idx, dummy.matrix);
    });
    scrubInst.castShadow = false;
    scrubInst.receiveShadow = false;
    group.add(scrubInst);
  }

  // --- 11. 6 Disabled / Charred 1973 Tank Hull Wrecks Near East Bank Sand Berm Breaches (Instanced + Solid Cover Colliders) ---
  const tankWrecks = UPPER_COMBAT_NETWORK.tank_wrecks || [];
  const tankArmorMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({
      map: getSteelTexture(3, 2),
      color: 0x453e34
    }),
    'charred_tank_armor'
  );
  if (tankWrecks.length > 0) {
    const hullGeo = new THREE.BoxGeometry(3.2, 1.25, 5.4);
    const turretGeo = new THREE.CylinderGeometry(1.18, 1.38, 0.82, 10);
    const barrelGeo = new THREE.CylinderGeometry(0.11, 0.13, 3.8, 8);
    barrelGeo.rotateX(Math.PI / 2);

    const hullInst = new THREE.InstancedMesh(hullGeo, tankArmorMat, tankWrecks.length);
    const turretInst = new THREE.InstancedMesh(turretGeo, tankArmorMat, tankWrecks.length);
    const barrelInst = new THREE.InstancedMesh(barrelGeo, tankArmorMat, tankWrecks.length);
    const dummy = new THREE.Object3D();

    tankWrecks.forEach((tk, idx) => {
      const ty = getSinaiTerrainHeight(tk.x, tk.z);
      const tiltX = (idx % 2 === 0 ? 1 : -1) * 0.05;
      const tiltZ = (idx % 3 === 0 ? 1 : -1) * 0.06;

      // Lower armored hull & treads
      dummy.position.set(tk.x, ty + 0.62, tk.z);
      dummy.rotation.set(tiltX, tk.yaw, tiltZ);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      hullInst.setMatrixAt(idx, dummy.matrix);

      // Offset canted turret dome
      const turYaw = tk.yaw + (idx % 2 === 0 ? 0.45 : -0.52);
      dummy.position.set(tk.x, ty + 1.54, tk.z - 0.25);
      dummy.rotation.set(tiltX * 1.2, turYaw, tiltZ * 1.2);
      dummy.updateMatrix();
      turretInst.setMatrixAt(idx, dummy.matrix);

      // Disabled main gun barrel
      const bx = tk.x + Math.sin(turYaw) * 2.2;
      const bz = tk.z - 0.25 + Math.cos(turYaw) * 2.2;
      dummy.position.set(bx, ty + 1.58, bz);
      dummy.rotation.set(-0.08, turYaw, 0);
      dummy.updateMatrix();
      barrelInst.setMatrixAt(idx, dummy.matrix);

      // Solid physics & AI cover box for tactical infantry firefights
      colliders.push({ x: tk.x, y: ty + 0.95, z: tk.z, hx: 1.9, hy: 1.0, hz: 2.6, rx: 0, rz: 0 });
      coverPoints.push({ x: tk.x, z: tk.z });
    });

    hullInst.castShadow = false;
    hullInst.receiveShadow = true;
    turretInst.castShadow = false;
    turretInst.receiveShadow = true;
    barrelInst.castShadow = false;
    barrelInst.receiveShadow = false;
    group.add(hullInst, turretInst, barrelInst);
  }

  // --- 12. Reinforced Concrete Dragon's Teeth Anti-Tank Pyramid Lines Along Flanks (1 InstancedMesh) ---
  const dragonTeethCoords = [];
  for (let x = -54; x <= -34; x += 2.5) {
    dragonTeethCoords.push([x, -17.5], [x + 1.25, -19.2]);
  }
  for (let x = 34; x <= 54; x += 2.5) {
    dragonTeethCoords.push([x, -17.5], [x - 1.25, -19.2]);
  }
  if (dragonTeethCoords.length > 0) {
    const toothGeo = new THREE.ConeGeometry(0.68, 1.15, 4);
    const toothInst = new THREE.InstancedMesh(toothGeo, bunkerMat, dragonTeethCoords.length);
    const dummy = new THREE.Object3D();
    dragonTeethCoords.forEach(([tx, tz], idx) => {
      const ty = getSinaiTerrainHeight(tx, tz);
      dummy.position.set(tx, ty + 0.52, tz);
      dummy.rotation.set(0, Math.PI * 0.25 + (idx % 3) * 0.08, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      toothInst.setMatrixAt(idx, dummy.matrix);
    });
    toothInst.castShadow = false;
    toothInst.receiveShadow = true;
    group.add(toothInst);
  }

  // --- 13. Military Field Command Tents & Supply Depots (1 InstancedMesh + Colliders) ---
  const depots = UPPER_COMBAT_NETWORK.field_depots || [];
  const tentMat = applyBattlefieldPBRShader(
    new THREE.MeshStandardMaterial({
      map: getCamoNetTexture(2, 2),
      color: 0x9b8862
    }),
    'field_tent_canvas'
  );
  if (depots.length > 0) {
    const tentBodyGeo = new THREE.BoxGeometry(5.4, 1.65, 3.8);
    const tentRoofGeo = new THREE.ConeGeometry(3.4, 1.15, 4);
    const bodyInst = new THREE.InstancedMesh(tentBodyGeo, tentMat, depots.length);
    const roofInst = new THREE.InstancedMesh(tentRoofGeo, tentMat, depots.length);
    const dummy = new THREE.Object3D();

    depots.forEach((dp, idx) => {
      const dy = getSinaiTerrainHeight(dp.x, dp.z);
      dummy.position.set(dp.x, dy + 0.82, dp.z);
      dummy.rotation.set(0, dp.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bodyInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(dp.x, dy + 2.15, dp.z);
      dummy.rotation.set(0, dp.yaw + Math.PI * 0.25, 0);
      dummy.scale.set(1.15, 1.0, 0.85);
      dummy.updateMatrix();
      roofInst.setMatrixAt(idx, dummy.matrix);

      colliders.push({ x: dp.x, y: dy + 1.15, z: dp.z, hx: 2.7, hy: 1.15, hz: 1.9, rx: 0, rz: 0 });
      coverPoints.push({ x: dp.x, z: dp.z });
    });

    bodyInst.castShadow = false;
    bodyInst.receiveShadow = true;
    roofInst.castShadow = false;
    roofInst.receiveShadow = true;
    group.add(bodyInst, roofInst);
  }

  // --- 14. 3 Rising Battlefield Smoke Plumes from Burning Tank Wrecks (Lightweight Pooled THREE.Points) ---
  const smokePlumeSources = tankWrecks.filter((t) => t.smokePlume);
  const smokeParticlesPerPlume = 28;
  const totalSmokeCount = smokePlumeSources.length * smokeParticlesPerPlume;
  let smokePlumes = null;
  if (totalSmokeCount > 0) {
    const smokeGeo = new THREE.BufferGeometry();
    const smokePositions = new Float32Array(totalSmokeCount * 3);
    const smokePhases = new Float32Array(totalSmokeCount);
    const smokeAnchors = [];

    smokePlumeSources.forEach((src, sIdx) => {
      const sy = getSinaiTerrainHeight(src.x, src.z) + 1.4;
      smokeAnchors.push({ x: src.x, y: sy, z: src.z });
      for (let p = 0; p < smokeParticlesPerPlume; p++) {
        const idx = sIdx * smokeParticlesPerPlume + p;
        const phase = p / smokeParticlesPerPlume;
        smokePhases[idx] = phase;
        smokePositions[idx * 3] = src.x + Math.sin(phase * 12.0 + sIdx) * (0.4 + phase * 2.4);
        smokePositions[idx * 3 + 1] = sy + phase * 16.5;
        smokePositions[idx * 3 + 2] = src.z + Math.cos(phase * 10.0 + sIdx) * (0.4 + phase * 2.0);
      }
    });

    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    const puffTex = getSmokePuffTexture();
    const smokeMat = new THREE.PointsMaterial({
      color: 0x3b352e,
      map: puffTex,
      size: 5.4,
      transparent: true,
      opacity: 0.46,
      alphaTest: 0.02,
      depthWrite: false
    });
    smokePlumes = new THREE.Points(smokeGeo, smokeMat);
    smokePlumes.userData = { smokeAnchors, smokePhases, smokeParticlesPerPlume };
    group.add(smokePlumes);
  }

  // --- 15. Drifting Golden Desert Sand-Dust Motes in the Air (Lightweight THREE.Points) ---
  const dustCount = 160;
  const dustGeo = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.sin(i * 12.9898) * 43758.5453 - Math.floor(Math.sin(i * 12.9898) * 43758.5453) - 0.5) * 150.0;
    dustPositions[i * 3 + 1] = 0.8 + ((i * 0.618034) % 1) * 9.5;
    dustPositions[i * 3 + 2] = (Math.cos(i * 78.233) * 19341.123 - Math.floor(Math.cos(i * 78.233) * 19341.123) - 0.5) * 150.0;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xf4dca8,
    map: getSmokePuffTexture(),
    size: 0.42,
    transparent: true,
    opacity: 0.44,
    alphaTest: 0.02,
    depthWrite: false
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  group.add(dustPoints);

  // Batch all Sandbag instances into a single InstancedMesh (2GB VRAM optimal)
  if (sandbagInstances.length > 0) {
    const bagGeo = new THREE.BoxGeometry(0.76, 0.34, 0.52);
    const bagInst = new THREE.InstancedMesh(bagGeo, sandbagMat, sandbagInstances.length);
    const dummy = new THREE.Object3D();
    sandbagInstances.forEach(([sx, sy, sz, ry], idx) => {
      dummy.position.set(sx, sy, sz);
      dummy.rotation.set(0, ry, 0);
      dummy.updateMatrix();
      bagInst.setMatrixAt(idx, dummy.matrix);
    });
    bagInst.castShadow = false;
    bagInst.receiveShadow = true;
    group.add(bagInst);
  }

  // Performance hardening (threejs-performance): freeze transforms on static meshes & instanced batches
  const dynamicSet = new Set([...radarDishes, dustPoints, smokePlumes].filter(Boolean));
  for (const child of group.children) {
    if (!dynamicSet.has(child)) {
      child.updateMatrix();
      child.matrixAutoUpdate = false;
    }
  }

  return {
    group,
    colliders,
    coverPoints,
    radarDishes,
    waterMaterial: waterShaderMat,
    dustPoints,
    smokePlumes,
    terrainTrimesh: { vertices: trimeshVertices, indices: trimeshIndices }
  };
}

export function createJumpPad(x, z) {
  const group = new THREE.Group();
  const y = getSinaiTerrainHeight(x, z);
  group.position.set(x, y, z);
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
  const y = getSinaiTerrainHeight(x, z);
  group.position.set(x, y, z);
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
