// 1973 Sinai Desert Open-World Terrain (400m x 400m) + Suez Canal Crossing Navigation Network
// Open-source fBm / Simplex 2D heightfield patterns (inspired by josephg/noisejs, mrdoob/three.js terrain examples, and kaolti/monolith-terrain)
// Synchronized with Zero-Zone-UE5 UZeroZoneBattlefieldAssetLibrary::GetSinaiBattlefieldSpecs()

// Deterministic 2D Simplex / Value-Gradient Noise & Multi-Octave fBm
function hash2D(ix, iz) {
  let n = (ix * 374761393 + iz * 668265263) ^ 0x5bf03635;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise2D(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbmDesert2D(x, z) {
  let value = 0;
  let amp = 0.52;
  let freq = 0.022;
  for (let oct = 0; oct < 4; oct++) {
    const n = valueNoise2D(x * freq + oct * 17.3, z * freq + oct * 31.7);
    // Ridged dune shaping mixed with rolling valleys
    const ridge = 1.0 - Math.abs(n * 2.0 - 1.0);
    value += (n * 0.65 + ridge * 0.35) * amp;
    freq *= 2.08;
    amp *= 0.48;
  }
  return value;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Continuous 400m x 400m Sinai Desert Heightfield (y in meters).
 * Features:
 * - Wide Suez Canal water channel at z in [-8, 8] (bed y = -1.35m, water y = -0.35m)
 * - 3 flat Pontoon Bridge assault road corridors at x = -28, 0, +28
 * - 6 elevated tactical sniper hills / Bar-Lev bunker plateaus
 * - Rolling multi-octave fBm sand dunes across the +-90m combat zone
 * - Distant desert mountain ridges beyond 135m
 */
export function getSinaiTerrainHeight(x, z) {
  const absZ = Math.abs(z);
  const absX = Math.abs(x);

  // 1. Suez Canal Channel (z in [-8.0, 8.0]) with smooth bank transitions to z = +-10.8
  if (absZ < 10.8) {
    if (absZ <= 7.4) {
      return -1.35;
    }
    const bankT = smoothstep(7.4, 10.8, absZ);
    const bankEdgeH = getSinaiBaseDuneAndHills(x, z >= 0 ? 10.8 : -10.8);
    return -1.35 * (1 - bankT) + bankEdgeH * bankT;
  }

  return getSinaiBaseDuneAndHills(x, z);
}

export const SINAI_SHELL_CRATERS = [
  { x: -16.0, z: -18.0, radius: 3.4, depth: 0.72 },
  { x: 16.0, z: -18.0, radius: 3.4, depth: 0.72 },
  { x: -34.0, z: -27.0, radius: 3.8, depth: 0.82 },
  { x: 34.0, z: -27.0, radius: 3.8, depth: 0.82 },
  { x: 0.0, z: -38.0, radius: 4.2, depth: 0.88 },
  { x: -20.0, z: 18.0, radius: 3.3, depth: 0.68 },
  { x: 20.0, z: 18.0, radius: 3.3, depth: 0.68 },
  { x: 0.0, z: 42.0, radius: 3.9, depth: 0.78 }
];

function getSinaiBaseDuneAndHills(x, z) {
  const absZ = Math.abs(z);

  // Base multi-octave fBm desert dunes (0.0m to 2.6m rolling variation)
  const rawFbm = fbmDesert2D(x + 120, z + 120);
  let h = (rawFbm - 0.38) * 3.2;

  // Wind-sculpted longitudinal Sinai dune waves
  h += Math.sin(x * 0.045 + z * 0.025) * 0.55 + Math.cos(z * 0.06 - x * 0.02) * 0.35;
  h = Math.max(0.0, h);

  // 6 Strategic Bar-Lev Bunker & Sniper Hill Plateaus (flat top radius 5.5m, blend radius 14m)
  const hills = [
    { x: -42, z: -36, h: 3.2 },
    { x: 42, z: -36, h: 3.2 },
    { x: 0, z: -64, h: 3.8 },
    { x: -42, z: 36, h: 2.8 },
    { x: 42, z: 36, h: 2.8 },
    { x: 0, z: 66, h: 3.4 }
  ];
  for (const hill of hills) {
    const d = Math.hypot(x - hill.x, z - hill.z);
    if (d < 15.0) {
      const w = 1.0 - smoothstep(4.8, 15.0, d);
      h = h * (1 - w) + hill.h * w;
    }
  }

  // Flatten the 3 Pontoon Bridge Assault Road Corridors (x = -28, 0, +28) & East Bank Berm Breach lanes
  const roadDist = Math.min(Math.abs(x + 28), Math.abs(x), Math.abs(x - 28));
  if (roadDist < 6.5 && absZ < 52) {
    const roadKeep = smoothstep(2.8, 6.5, roadDist);
    h *= roadKeep;
  }

  // Carve 8 Artillery Shell Craters with raised ejecta rims
  for (const cr of SINAI_SHELL_CRATERS) {
    const cd = Math.hypot(x - cr.x, z - cr.z);
    if (cd < cr.radius * 1.45) {
      const u = cd / cr.radius;
      if (u < 1.0) {
        const bowl = (1.0 - u * u) * cr.depth;
        h -= bowl;
      } else {
        const rimT = 1.0 - Math.abs((u - 1.18) / 0.27);
        if (rimT > 0) h += rimT * cr.depth * 0.32;
      }
    }
  }

  // Keep immediate canal embankment apron (absZ in [10.8, 14.5]) gently graded for bridge approaches
  if (absZ < 14.5) {
    const quayT = smoothstep(10.8, 14.5, absZ);
    h *= quayT;
  }

  // Distant Sinai Mountain Ridge Ring beyond r > 128m (visual horizon framing without artificial box walls)
  const r = Math.hypot(x, z);
  if (r > 125) {
    const mT = smoothstep(125, 195, r);
    const ridgeNoise = fbmDesert2D(x * 1.4 - 50, z * 1.4 + 80);
    const mountainH = (8.0 + ridgeNoise * 18.0) * mT;
    // Keep canal exits east/west slightly lower so the canal visually continues to horizon
    const canalHorizonMask = smoothstep(6.0, 22.0, absZ);
    h += mountainH * (0.25 + 0.75 * canalHorizonMask);
  }

  return h;
}

export const UPPER_COMBAT_NETWORK = {
  sources: [
    '1973 Sinai Front Open-World Desert Terrain (400m x 400m fBm heightfield)',
    'Wide Suez Canal Channel (z in [-8, 8]) with 3 Tactical Pontoon Bridges (x = -28, 0, +28)',
    'East Bank Sand Berm Rampart (z = -22, y = 4.5m crest) with 3 Hydro-Breached Assault Corridors',
    '6 Reinforced Bar-Lev Concrete Bunkers, 6 Disabled Tank Wrecks, Dragons Teeth Traps & Field Depots'
  ],
  terrain_size_m: 400,
  combat_zone_radius_m: 90,
  soft_boundary_radius_m: 160,
  hard_boundary_radius_m: 188,
  upper_deck_y: 4.5,
  pontoon_deck_y: 0.45,
  canal_bed_y: -1.35,
  ramp_pitch_rad: 0.37725,
  ramp_pitch_deg: 21.61,
  bunker_hills: [
    { id: 'bunker_eb_west', x: -42, z: -36, y: 3.2, facingZ: 1 },
    { id: 'bunker_eb_east', x: 42, z: -36, y: 3.2, facingZ: 1 },
    { id: 'bunker_eb_cmd', x: 0, z: -64, y: 3.8, facingZ: 1 },
    { id: 'bunker_wb_west', x: -42, z: 36, y: 2.8, facingZ: -1 },
    { id: 'bunker_wb_east', x: 42, z: 36, y: 2.8, facingZ: -1 },
    { id: 'bunker_wb_stage', x: 0, z: 66, y: 3.4, facingZ: -1 }
  ],
  tank_wrecks: [
    { id: 'tank_wreck_eb_breach_w', x: -24.5, z: -26.5, yaw: 0.38, smokePlume: true },
    { id: 'tank_wreck_eb_breach_c', x: 4.8, z: -28.0, yaw: -0.44, smokePlume: true },
    { id: 'tank_wreck_eb_breach_e', x: 24.5, z: -26.5, yaw: -0.32, smokePlume: true },
    { id: 'tank_wreck_eb_flank_w', x: -36.0, z: -15.5, yaw: 0.62, smokePlume: false },
    { id: 'tank_wreck_eb_flank_e', x: 36.0, z: -15.5, yaw: -0.58, smokePlume: false },
    { id: 'tank_wreck_wb_center', x: -6.5, z: 16.5, yaw: 0.22, smokePlume: false }
  ],
  field_depots: [
    { id: 'depot_eb_north_w', x: -22.0, z: -52.0, yaw: 0.08 },
    { id: 'depot_eb_north_e', x: 22.0, z: -52.0, yaw: -0.08 },
    { id: 'depot_wb_south_w', x: -22.0, z: 48.0, yaw: -0.06 },
    { id: 'depot_wb_south_e', x: 22.0, z: 48.0, yaw: 0.06 }
  ],
  segments: [
    // 3 Wide Tactical Pontoon Bridges spanning the 16m Suez Canal (z in [-8.5, 8.5], deck y = 0.45m)
    { id: 'pontoon_bridge_west', kind: 'pontoon', x: -28.0, y: 0.45, z: 0.0, width: 4.6, height: 0.26, depth: 17.6, rx: 0, rz: 0 },
    { id: 'pontoon_bridge_center', kind: 'pontoon', x: 0.0, y: 0.45, z: 0.0, width: 5.2, height: 0.26, depth: 17.6, rx: 0, rz: 0 },
    { id: 'pontoon_bridge_east', kind: 'pontoon', x: 28.0, y: 0.45, z: 0.0, width: 4.6, height: 0.26, depth: 17.6, rx: 0, rz: 0 },

    // East Bank Sand Berm Rampart Crest (4 massive spans at z = -22.0, y = 4.5m leaving 3 wide breaches at x = -28, 0, +28)
    { id: 'berm_crest_far_w', kind: 'berm_crest', x: -46.0, y: 4.5, z: -22.0, width: 24.0, height: 0.4, depth: 3.8, rx: 0, rz: 0 },
    { id: 'berm_crest_mid_w', kind: 'berm_crest', x: -14.0, y: 4.5, z: -22.0, width: 16.5, height: 0.4, depth: 3.8, rx: 0, rz: 0 },
    { id: 'berm_crest_mid_e', kind: 'berm_crest', x: 14.0, y: 4.5, z: -22.0, width: 16.5, height: 0.4, depth: 3.8, rx: 0, rz: 0 },
    { id: 'berm_crest_far_e', kind: 'berm_crest', x: 46.0, y: 4.5, z: -22.0, width: 24.0, height: 0.4, depth: 3.8, rx: 0, rz: 0 },

    // Over-Breach Steel Catwalks linking the entire 116m East Bank Sand Berm Crest at y = 4.5m
    { id: 'breach_overpass_w', kind: 'catwalk', x: -28.0, y: 4.5, z: -22.0, width: 12.2, height: 0.26, depth: 2.8, rx: 0, rz: 0 },
    { id: 'breach_overpass_c', kind: 'catwalk', x: 0.0, y: 4.5, z: -22.0, width: 12.2, height: 0.26, depth: 2.8, rx: 0, rz: 0 },
    { id: 'breach_overpass_e', kind: 'catwalk', x: 28.0, y: 4.5, z: -22.0, width: 12.2, height: 0.26, depth: 2.8, rx: 0, rz: 0 },

    // 4 Communications & Radar Overwatch Towers on the open desert flanks (y = 4.5m)
    { id: 'radar_tower_nw', kind: 'tower', x: -58.0, y: 4.5, z: -22.0, width: 4.4, height: 0.34, depth: 4.4, rx: 0, rz: 0 },
    { id: 'radar_tower_ne', kind: 'tower', x: 58.0, y: 4.5, z: -22.0, width: 4.4, height: 0.34, depth: 4.4, rx: 0, rz: 0 },
    { id: 'obs_tower_sw', kind: 'tower', x: -56.0, y: 4.5, z: 24.0, width: 4.4, height: 0.34, depth: 4.4, rx: 0, rz: 0 },
    { id: 'obs_tower_se', kind: 'tower', x: 56.0, y: 4.5, z: 24.0, width: 4.4, height: 0.34, depth: 4.4, rx: 0, rz: 0 },

    // 4 Smooth Walkable Berm Assault Ramps leading from desert floor up to the 4.5m Berm Crest
    { id: 'berm_ramp_inner_w', kind: 'ramp', x: -14.0, y: 2.25, z: -29.2, width: 3.2, height: 0.28, depth: 12.2, rx: -0.37725, rz: 0 },
    { id: 'berm_ramp_inner_e', kind: 'ramp', x: 14.0, y: 2.25, z: -29.2, width: 3.2, height: 0.28, depth: 12.2, rx: -0.37725, rz: 0 },
    { id: 'berm_ramp_outer_w', kind: 'ramp', x: -58.0, y: 2.25, z: -14.8, width: 3.2, height: 0.28, depth: 12.2, rx: 0.37725, rz: 0 },
    { id: 'berm_ramp_outer_e', kind: 'ramp', x: 58.0, y: 2.25, z: -14.8, width: 3.2, height: 0.28, depth: 12.2, rx: 0.37725, rz: 0 }
  ],
  ramp_navs: [
    // 4 Berm Crest Assault Ramps (ground -> 4.5m)
    { id: 'berm_ramp_inner_w', x: -14.0, halfWidth: 1.75, zBottom: -34.8, zTop: -23.6, topY: 4.5 },
    { id: 'berm_ramp_inner_e', x: 14.0, halfWidth: 1.75, zBottom: -34.8, zTop: -23.6, topY: 4.5 },
    { id: 'berm_ramp_outer_w', x: -58.0, halfWidth: 1.75, zBottom: -9.2, zTop: -20.4, topY: 4.5 },
    { id: 'berm_ramp_outer_e', x: 58.0, halfWidth: 1.75, zBottom: -9.2, zTop: -20.4, topY: 4.5 },
    // 3 Pontoon Bridge Approach Ramps (North & South embankments -> 0.45m deck)
    { id: 'pontoon_ramp_sw', x: -28.0, halfWidth: 2.4, zBottom: 11.2, zTop: 8.8, topY: 0.45 },
    { id: 'pontoon_ramp_nw', x: -28.0, halfWidth: 2.4, zBottom: -11.2, zTop: -8.8, topY: 0.45 },
    { id: 'pontoon_ramp_sc', x: 0.0, halfWidth: 2.7, zBottom: 11.2, zTop: 8.8, topY: 0.45 },
    { id: 'pontoon_ramp_nc', x: 0.0, halfWidth: 2.7, zBottom: -11.2, zTop: -8.8, topY: 0.45 },
    { id: 'pontoon_ramp_se', x: 28.0, halfWidth: 2.4, zBottom: 11.2, zTop: 8.8, topY: 0.45 },
    { id: 'pontoon_ramp_ne', x: 28.0, halfWidth: 2.4, zBottom: -11.2, zTop: -8.8, topY: 0.45 }
  ],
  upper_waypoints: [
    { x: -58.0, y: 4.5, z: -22.0 },
    { x: -46.0, y: 4.5, z: -22.0 },
    { x: -28.0, y: 4.5, z: -22.0 },
    { x: -14.0, y: 4.5, z: -22.0 },
    { x: 0.0, y: 4.5, z: -22.0 },
    { x: 14.0, y: 4.5, z: -22.0 },
    { x: 28.0, y: 4.5, z: -22.0 },
    { x: 46.0, y: 4.5, z: -22.0 },
    { x: 58.0, y: 4.5, z: -22.0 }
  ],
  crossing_waypoints: [
    { x: -28.0, y: 0.45, z: 0.0 },
    { x: -28.0, y: 0.0, z: -18.0 },
    { x: -28.0, y: 0.0, z: 18.0 },
    { x: 0.0, y: 0.45, z: 0.0 },
    { x: 0.0, y: 0.0, z: -18.0 },
    { x: 0.0, y: 0.0, z: 18.0 },
    { x: 28.0, y: 0.45, z: 0.0 },
    { x: 28.0, y: 0.0, z: -18.0 },
    { x: 28.0, y: 0.0, z: 18.0 },
    { x: -38.0, y: 3.2, z: -32.0 },
    { x: 38.0, y: 3.2, z: -32.0 },
    { x: 0.0, y: 3.8, z: -58.0 },
    { x: -38.0, y: 2.8, z: 32.0 },
    { x: 38.0, y: 2.8, z: 32.0 }
  ]
};

/**
 * Exact walkable surface elevation at (x, z) combining the 400m x 400m procedural
 * Sinai desert heightfield, Suez Canal channel, 3 Pontoon Bridges, Berm Assault Ramps,
 * and 4.5m East Bank Sand Berm Crest.
 */
export function sampleCombatSurfaceY(x, z, currentY = 0) {
  const topY = UPPER_COMBAT_NETWORK.upper_deck_y;
  const pontoonY = UPPER_COMBAT_NETWORK.pontoon_deck_y;

  // 1. Check Berm & Pontoon approach ramps
  for (const r of UPPER_COMBAT_NETWORK.ramp_navs) {
    if (Math.abs(x - r.x) <= r.halfWidth) {
      const minZ = Math.min(r.zBottom, r.zTop);
      const maxZ = Math.max(r.zBottom, r.zTop);
      if (z >= minZ && z <= maxZ) {
        const t = (z - r.zBottom) / (r.zTop - r.zBottom);
        const baseH = getSinaiTerrainHeight(r.x, r.zBottom);
        return Math.max(baseH, baseH + t * (r.topY - baseH));
      }
    }
  }

  // 2. Elevated 4.5m East Bank Sand Berm Crest & Radar Towers
  if (currentY >= 2.2) {
    const onBermCrest = Math.abs(z + 22.0) <= 2.0 && Math.abs(x) <= 60.5;
    const onSouthTowers = Math.abs(z - 24.0) <= 2.3 && (Math.abs(x + 56.0) <= 2.3 || Math.abs(x - 56.0) <= 2.3);
    if (onBermCrest || onSouthTowers) {
      return topY;
    }
  }

  // 3. 3 Suez Canal Pontoon Bridges (x = -28, 0, +28, z in [-8.8, 8.8])
  const onWestBridge = Math.abs(x + 28.0) <= 2.35 && Math.abs(z) <= 8.85;
  const onCenterBridge = Math.abs(x) <= 2.65 && Math.abs(z) <= 8.85;
  const onEastBridge = Math.abs(x - 28.0) <= 2.35 && Math.abs(z) <= 8.85;
  if (onWestBridge || onCenterBridge || onEastBridge) {
    return pontoonY;
  }

  // 4. Continuous 400m x 400m fBm Sinai Desert & Suez Canal heightfield
  return getSinaiTerrainHeight(x, z);
}
