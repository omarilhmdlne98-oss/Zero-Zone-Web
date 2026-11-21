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
    vec3 col = uBaseColor + uRimColor * fresnel * (1.2 + uCloak * 1.4);
    gl_FragColor = vec4(col, 1.0 - uCloak * 0.55);
  }
`;

export function createTacticalRifle() {
  const gun = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x20252d, metalness: 0.7, roughness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.8 });

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.48), bodyMat);
  receiver.position.set(0, 0, -0.18);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.42, 8), bodyMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.58);
  const optic = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.16), accentMat);
  optic.position.set(0, 0.09, -0.18);

  gun.add(receiver, barrel, optic);
  return gun;
}

export function createOperatorModel(kitId = 'vanguard') {
  const root = new THREE.Group();
  let cloakMat = null;

  if (kitId === 'spectre') {
    const obsidian = new THREE.MeshStandardMaterial({ color: 0x12121a, roughness: 0.65 });
    const opticMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 2.5 });
    cloakMat = new THREE.ShaderMaterial({
      uniforms: {
        uBaseColor: { value: new THREE.Color(0x140f1f) },
        uRimColor: { value: new THREE.Color(0xa855f7) },
        uCloak: { value: 0.0 }
      },
      vertexShader: SPECTRE_CLOAK_VERT,
      fragmentShader: SPECTRE_CLOAK_FRAG,
      transparent: true
    });

    const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 1.22, 12), cloakMat);
    cloak.position.y = 0.92;
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), obsidian);
    hood.position.y = 1.62;
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.06), opticMat);
    slit.position.set(0, 1.63, -0.2);
    root.add(cloak, hood, slit);
  } else if (kitId === 'juggernaut') {
    const gunmetal = new THREE.MeshStandardMaterial({ color: 0x383c44, metalness: 0.72, roughness: 0.35 });
    const amber = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 2.2 });

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.82, 0.48), gunmetal);
    chest.position.y = 1.1;
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.38), gunmetal);
    helm.position.y = 1.66;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.06), amber);
    visor.position.set(0, 1.67, -0.19);
    const pL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.42), gunmetal);
    pL.position.set(-0.5, 1.38, 0);
    const pR = pL.clone();
    pR.position.x = 0.5;
    const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.2, 12), amber);
    emitter.rotation.x = Math.PI / 2;
    emitter.position.set(0, 1.18, -0.26);
    root.add(chest, helm, visor, pL, pR, emitter);
  } else {
    const slate = new THREE.MeshStandardMaterial({ color: 0x2c3846, metalness: 0.48, roughness: 0.4 });
    const cyan = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 2.2 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.34), slate);
    torso.position.y = 1.08;
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.34, 0.35), slate);
    helm.position.y = 1.64;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.1, 0.08), cyan);
    visor.position.set(0, 1.65, -0.17);
    const padL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.32), slate);
    padL.position.set(-0.39, 1.32, 0);
    const padR = padL.clone();
    padR.position.x = 0.39;
    const thrL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.32, 10), cyan);
    thrL.rotation.x = 0.32;
    thrL.position.set(-0.16, 1.12, 0.24);
    const thrR = thrL.clone();
    thrR.position.x = 0.16;
    root.add(torso, helm, visor, padL, padR, thrL, thrR);
  }

  const rifle = createTacticalRifle();
  rifle.position.set(0.36, 1.12, -0.2);
  root.add(rifle);
  root.userData.cloakMat = cloakMat;
  return root;
}

export function createVaultStructure() {
  const group = new THREE.Group();
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x262d38, metalness: 0.65, roughness: 0.38 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x2dd4bf, emissive: 0x2dd4bf, emissiveIntensity: 2.2 });

  const core = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.5, 4.2), armorMat);
  core.position.y = 2.25;
  const ringLow = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.14, 10, 32), ringMat);
  ringLow.rotation.x = Math.PI / 2;
  ringLow.position.y = 1.4;
  const ringHigh = ringLow.clone();
  ringHigh.position.y = 3.2;

  group.add(core, ringLow, ringHigh);
  group.userData.rings = [ringLow, ringHigh];
  return group;
}

export function createJumpPad(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e2530, metalness: 0.6 });
  const chevMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 2.0 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.18, 18), baseMat);
  base.position.y = 0.09;
  const chevA = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.22), chevMat);
  chevA.position.set(0, 0.2, -0.3);
  const chevB = chevA.clone();
  chevB.position.z = 0.3;

  group.add(base, chevA, chevB);
  group.userData.chevMat = chevMat;
  return group;
}

export function createDestructibleCrate(id, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.userData.crateId = id;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9c6b3b, roughness: 0.72 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x3a404a, metalness: 0.55 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.5, 1.8), woodMat);
  body.position.y = 0.75;
  body.userData.crateId = id;
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.18, 1.86), bandMat);
  band.position.y = 0.75;
  band.userData.crateId = id;

  group.add(body, band);
  return group;
}
