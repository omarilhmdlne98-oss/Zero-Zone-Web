// 1973 Sinai Front / Suez Canal Crossing Battlefield Navigation & Multi-Tier Surface Network
// Synchronized with Zero-Zone-UE5 UZeroZoneBattlefieldAssetLibrary::GetSinaiBattlefieldSpecs()

export const UPPER_COMBAT_NETWORK = {
  sources: [
    '1973 Sinai Front / Suez Canal Crossing Tactical Layout',
    'East Bank Sand Berm Rampart (2 breached assault corridors + 4.2m sniper crest)',
    '2 Tactical Pontoon Bridges + Central Command Relay Causeway',
    '4 Reinforced Desert Concrete Bunkers + 4 Walkable Access Ramps'
  ],
  upper_deck_y: 4.2,
  pontoon_deck_y: 0.42,
  canal_bed_y: -0.52,
  ramp_pitch_rad: 0.37725,
  ramp_pitch_deg: 21.61,
  segments: [
    // 4 Corner Overwatch / Communications & Radar Towers (y = 4.2m)
    { id: 'radar_tower_nw', kind: 'tower', x: -19.5, y: 4.2, z: -19.5, width: 4.0, height: 0.32, depth: 4.0, rx: 0, rz: 0 },
    { id: 'radar_tower_ne', kind: 'tower', x: 19.5, y: 4.2, z: -19.5, width: 4.0, height: 0.32, depth: 4.0, rx: 0, rz: 0 },
    { id: 'obs_tower_sw', kind: 'tower', x: -19.5, y: 4.2, z: 19.5, width: 4.0, height: 0.32, depth: 4.0, rx: 0, rz: 0 },
    { id: 'obs_tower_se', kind: 'tower', x: 19.5, y: 4.2, z: 19.5, width: 4.0, height: 0.32, depth: 4.0, rx: 0, rz: 0 },

    // East Bank Sand Berm Crest (3 Berm Sections + 2 Over-Breach Catwalks at z = -13.5, y = 4.2m)
    { id: 'berm_crest_w', kind: 'berm_crest', x: -16.8, y: 4.2, z: -13.5, width: 8.8, height: 0.36, depth: 3.2, rx: 0, rz: 0 },
    { id: 'berm_crest_c', kind: 'berm_crest', x: 0.0, y: 4.2, z: -13.5, width: 13.6, height: 0.36, depth: 3.2, rx: 0, rz: 0 },
    { id: 'berm_crest_e', kind: 'berm_crest', x: 16.8, y: 4.2, z: -13.5, width: 8.8, height: 0.36, depth: 3.2, rx: 0, rz: 0 },
    { id: 'breach_overpass_w', kind: 'catwalk', x: -9.5, y: 4.2, z: -13.5, width: 5.8, height: 0.26, depth: 2.6, rx: 0, rz: 0 },
    { id: 'breach_overpass_e', kind: 'catwalk', x: 9.5, y: 4.2, z: -13.5, width: 5.8, height: 0.26, depth: 2.6, rx: 0, rz: 0 },

    // East Bank Rear Perimeter Walkway & Berm Connectors (y = 4.2m)
    { id: 'east_rear_catwalk', kind: 'catwalk', x: 0.0, y: 4.2, z: -19.5, width: 35.0, height: 0.28, depth: 3.0, rx: 0, rz: 0 },
    { id: 'east_link_w', kind: 'catwalk', x: -19.5, y: 4.2, z: -16.5, width: 3.0, height: 0.28, depth: 3.2, rx: 0, rz: 0 },
    { id: 'east_link_e', kind: 'catwalk', x: 19.5, y: 4.2, z: -16.5, width: 3.0, height: 0.28, depth: 3.2, rx: 0, rz: 0 },

    // West Bank Staging Overlook Walkway (z = 19.5, y = 4.2m)
    { id: 'west_overlook_catwalk', kind: 'catwalk', x: 0.0, y: 4.2, z: 19.5, width: 35.0, height: 0.28, depth: 3.0, rx: 0, rz: 0 },

    // 4 Smooth 21.61-deg Inclined Access Ramps (2 on East Bank Berm flanks, 2 on West Bank Overlook flanks)
    { id: 'east_berm_ramp_w', kind: 'ramp', x: -19.5, y: 2.1, z: -8.2, width: 2.8, height: 0.26, depth: 11.40175425099138, rx: 0.37724905964235905, rz: 0 },
    { id: 'east_berm_ramp_e', kind: 'ramp', x: 19.5, y: 2.1, z: -8.2, width: 2.8, height: 0.26, depth: 11.40175425099138, rx: 0.37724905964235905, rz: 0 },
    { id: 'west_bank_ramp_w', kind: 'ramp', x: -19.5, y: 2.1, z: 12.2, width: 2.8, height: 0.26, depth: 11.40175425099138, rx: -0.37724905964235905, rz: 0 },
    { id: 'west_bank_ramp_e', kind: 'ramp', x: 19.5, y: 2.1, z: 12.2, width: 2.8, height: 0.26, depth: 11.40175425099138, rx: -0.37724905964235905, rz: 0 },

    // 2 Suez Canal Tactical Pontoon Bridges + Gentle Approach Ramps (deck y = 0.42m)
    { id: 'pontoon_bridge_w', kind: 'pontoon', x: -9.5, y: 0.42, z: 0.0, width: 4.2, height: 0.24, depth: 10.2, rx: 0, rz: 0 },
    { id: 'pontoon_bridge_e', kind: 'pontoon', x: 9.5, y: 0.42, z: 0.0, width: 4.2, height: 0.24, depth: 10.2, rx: 0, rz: 0 },
    { id: 'canal_causeway_w', kind: 'pontoon', x: -5.1, y: 0.42, z: 0.0, width: 4.8, height: 0.24, depth: 2.6, rx: 0, rz: 0 },
    { id: 'canal_causeway_e', kind: 'pontoon', x: 5.1, y: 0.42, z: 0.0, width: 4.8, height: 0.24, depth: 2.6, rx: 0, rz: 0 }
  ],
  ramp_navs: [
    // Upper 4.2m Berm & Overlook Ramps
    { id: 'east_berm_ramp_w', x: -19.5, halfWidth: 1.48, zBottom: -2.9, zTop: -13.5, topY: 4.2 },
    { id: 'east_berm_ramp_e', x: 19.5, halfWidth: 1.48, zBottom: -2.9, zTop: -13.5, topY: 4.2 },
    { id: 'west_bank_ramp_w', x: -19.5, halfWidth: 1.48, zBottom: 6.9, zTop: 17.5, topY: 4.2 },
    { id: 'west_bank_ramp_e', x: 19.5, halfWidth: 1.48, zBottom: 6.9, zTop: 17.5, topY: 4.2 },
    // Pontoon Bridge Approach Ramps (y = 0 -> 0.42m)
    { id: 'pontoon_ramp_sw', x: -9.5, halfWidth: 2.15, zBottom: 6.7, zTop: 5.1, topY: 0.42 },
    { id: 'pontoon_ramp_nw', x: -9.5, halfWidth: 2.15, zBottom: -6.7, zTop: -5.1, topY: 0.42 },
    { id: 'pontoon_ramp_se', x: 9.5, halfWidth: 2.15, zBottom: 6.7, zTop: 5.1, topY: 0.42 },
    { id: 'pontoon_ramp_ne', x: 9.5, halfWidth: 2.15, zBottom: -6.7, zTop: -5.1, topY: 0.42 }
  ],
  upper_waypoints: [
    { x: -19.5, y: 4.2, z: -19.5 },
    { x: 0.0, y: 4.2, z: -19.5 },
    { x: 19.5, y: 4.2, z: -19.5 },
    { x: -16.8, y: 4.2, z: -13.5 },
    { x: -9.5, y: 4.2, z: -13.5 },
    { x: 0.0, y: 4.2, z: -13.5 },
    { x: 9.5, y: 4.2, z: -13.5 },
    { x: 16.8, y: 4.2, z: -13.5 },
    { x: -19.5, y: 4.2, z: 19.5 },
    { x: 0.0, y: 4.2, z: 19.5 },
    { x: 19.5, y: 4.2, z: 19.5 }
  ],
  crossing_waypoints: [
    { x: -9.5, y: 0.42, z: 4.5 },
    { x: -9.5, y: 0.42, z: 0.0 },
    { x: -9.5, y: 0.42, z: -4.5 },
    { x: -9.5, y: 0.0, z: -11.5 },
    { x: 9.5, y: 0.42, z: 4.5 },
    { x: 9.5, y: 0.42, z: 0.0 },
    { x: 9.5, y: 0.42, z: -4.5 },
    { x: 9.5, y: 0.0, z: -11.5 },
    { x: 0.0, y: 0.0, z: 9.5 },
    { x: 0.0, y: 0.0, z: -9.5 }
  ]
};

/**
 * Computes exact walkable floor height at (x, z) across West Bank, Suez Canal,
 * Pontoon Bridges, Central Causeway, Access Ramps, and East Bank Sand Berm Crest.
 */
export function sampleCombatSurfaceY(x, z, currentY = 0) {
  const topY = UPPER_COMBAT_NETWORK.upper_deck_y;
  const pontoonY = UPPER_COMBAT_NETWORK.pontoon_deck_y;

  // 1. Check inclined ramps (Berm/Overlook ramps + Pontoon approach ramps)
  for (const r of UPPER_COMBAT_NETWORK.ramp_navs) {
    if (Math.abs(x - r.x) <= r.halfWidth) {
      const minZ = Math.min(r.zBottom, r.zTop);
      const maxZ = Math.max(r.zBottom, r.zTop);
      if (z >= minZ && z <= maxZ) {
        const t = (z - r.zBottom) / (r.zTop - r.zBottom);
        return Math.max(0, Math.min(r.topY, t * r.topY));
      }
    }
  }

  // 2. Elevated 4.2m Berm Crest, Perimeter Towers & Overlook Catwalks
  if (currentY >= 1.8) {
    const onEastBermCrest = Math.abs(z + 13.5) <= 1.75 && Math.abs(x) <= 21.5;
    const onEastRear = Math.abs(z + 19.5) <= 1.65 && Math.abs(x) <= 21.5;
    const onEastLinks = (Math.abs(x + 19.5) <= 1.65 || Math.abs(x - 19.5) <= 1.65) && z >= -21.5 && z <= -12.0;
    const onWestOverlook = Math.abs(z - 19.5) <= 1.65 && Math.abs(x) <= 21.5;
    const onTowers = Math.abs(x) >= 17.4 && (Math.abs(z + 19.5) <= 2.2 || Math.abs(z - 19.5) <= 2.2);
    if (onEastBermCrest || onEastRear || onEastLinks || onWestOverlook || onTowers) {
      return topY;
    }
  }

  // 3. Pontoon Bridges (x = ±9.5, z ∈ [-5.1, 5.1]) & Central Command Causeway
  const onWestPontoon = Math.abs(x + 9.5) <= 2.15 && Math.abs(z) <= 5.15;
  const onEastPontoon = Math.abs(x - 9.5) <= 2.15 && Math.abs(z) <= 5.15;
  const onCauseway = Math.abs(z) <= 1.35 && Math.abs(x) <= 7.5;
  const onCentralIsland = Math.abs(x) <= 2.85 && Math.abs(z) <= 2.85;
  if (onWestPontoon || onEastPontoon || onCauseway || onCentralIsland) {
    return pontoonY;
  }

  // 4. Recessed Suez Canal water channel (z ∈ [-4.5, 4.5])
  if (Math.abs(z) <= 4.35) {
    return UPPER_COMBAT_NETWORK.canal_bed_y;
  }
  if (Math.abs(z) <= 4.95) {
    const bankDist = (Math.abs(z) - 4.35) / 0.6;
    return UPPER_COMBAT_NETWORK.canal_bed_y * (1 - bankDist);
  }

  return 0;
}
