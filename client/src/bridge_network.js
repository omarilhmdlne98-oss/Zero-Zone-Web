// Auto-exported from Static-Recomp-Native/tools/bridge_network_exporter.py
// Open-source patterns: dimforge/rapier.js sloped ramps, fps3ademo-saltline & ThreeJS_FPS_2.0 vertical catwalks, Three.js InstancedMesh batching

export const UPPER_COMBAT_NETWORK = {
  "sources": [
    "dimforge/rapier.js (rotated cuboid sloped ramp physics)",
    "realskyrin/fps3ademo-saltline (modular procedural FPS industrial catwalk architecture)",
    "Footprintarts/ThreeJS_FPS_2.0 (vertical arena sightlines & traversal)",
    "mrdoob/three.js (InstancedMesh low-VRAM guardrail & truss batching)"
  ],
  "upper_deck_y": 4.2,
  "ramp_pitch_rad": 0.37725,
  "ramp_pitch_deg": 21.61,
  "segments": [
    {
      "id": "overwatch_tower_nw",
      "kind": "tower",
      "x": -19.5,
      "y": 4.2,
      "z": -19.5,
      "width": 4.0,
      "height": 0.32,
      "depth": 4.0,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": "outer"
    },
    {
      "id": "overwatch_tower_ne",
      "kind": "tower",
      "x": 19.5,
      "y": 4.2,
      "z": -19.5,
      "width": 4.0,
      "height": 0.32,
      "depth": 4.0,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": "outer"
    },
    {
      "id": "overwatch_tower_sw",
      "kind": "tower",
      "x": -19.5,
      "y": 4.2,
      "z": 19.5,
      "width": 4.0,
      "height": 0.32,
      "depth": 4.0,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": "outer"
    },
    {
      "id": "overwatch_tower_se",
      "kind": "tower",
      "x": 19.5,
      "y": 4.2,
      "z": 19.5,
      "width": 4.0,
      "height": 0.32,
      "depth": 4.0,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": "outer"
    },
    {
      "id": "catwalk_north",
      "kind": "catwalk",
      "x": 0.0,
      "y": 4.2,
      "z": -19.5,
      "width": 35.0,
      "height": 0.28,
      "depth": 3.2,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": "s"
    },
    {
      "id": "catwalk_south",
      "kind": "catwalk",
      "x": 0.0,
      "y": 4.2,
      "z": 19.5,
      "width": 35.0,
      "height": 0.28,
      "depth": 3.2,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": "n"
    },
    {
      "id": "catwalk_west",
      "kind": "catwalk",
      "x": -19.5,
      "y": 4.2,
      "z": 0.0,
      "width": 3.2,
      "height": 0.28,
      "depth": 35.0,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": "e"
    },
    {
      "id": "catwalk_east",
      "kind": "catwalk",
      "x": 19.5,
      "y": 4.2,
      "z": 0.0,
      "width": 3.2,
      "height": 0.28,
      "depth": 35.0,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": "w"
    },
    {
      "id": "vault_overpass_n",
      "kind": "vault_overpass",
      "x": 0.0,
      "y": 4.2,
      "z": -3.5,
      "width": 9.2,
      "height": 0.28,
      "depth": 2.6,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": ""
    },
    {
      "id": "vault_overpass_s",
      "kind": "vault_overpass",
      "x": 0.0,
      "y": 4.2,
      "z": 3.5,
      "width": 9.2,
      "height": 0.28,
      "depth": 2.6,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": ""
    },
    {
      "id": "vault_overpass_w",
      "kind": "vault_overpass",
      "x": -3.5,
      "y": 4.2,
      "z": 0.0,
      "width": 2.6,
      "height": 0.28,
      "depth": 4.4,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": ""
    },
    {
      "id": "vault_overpass_e",
      "kind": "vault_overpass",
      "x": 3.5,
      "y": 4.2,
      "z": 0.0,
      "width": 2.6,
      "height": 0.28,
      "depth": 4.4,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": ""
    },
    {
      "id": "cross_bridge_n",
      "kind": "cross_bridge",
      "x": 0.0,
      "y": 4.2,
      "z": -11.35,
      "width": 3.0,
      "height": 0.26,
      "depth": 13.1,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": "e,w"
    },
    {
      "id": "cross_bridge_s",
      "kind": "cross_bridge",
      "x": 0.0,
      "y": 4.2,
      "z": 11.35,
      "width": 3.0,
      "height": 0.26,
      "depth": 13.1,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": "e,w"
    },
    {
      "id": "cross_bridge_w",
      "kind": "cross_bridge",
      "x": -11.35,
      "y": 4.2,
      "z": 0.0,
      "width": 13.1,
      "height": 0.26,
      "depth": 3.0,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": "n,s"
    },
    {
      "id": "cross_bridge_e",
      "kind": "cross_bridge",
      "x": 11.35,
      "y": 4.2,
      "z": 0.0,
      "width": 13.1,
      "height": 0.26,
      "depth": 3.0,
      "rx": 0.0,
      "rz": 0.0,
      "guardrail_sides": "n,s"
    },
    {
      "id": "access_ramp_nw",
      "kind": "ramp",
      "x": -11.8,
      "y": 2.1,
      "z": -12.6,
      "width": 2.8,
      "height": 0.24,
      "depth": 11.40175425099138,
      "rx": 0.37724905964235905,
      "rz": 0.0,
      "guardrail_sides": "e,w"
    },
    {
      "id": "access_ramp_ne",
      "kind": "ramp",
      "x": 11.8,
      "y": 2.1,
      "z": -12.6,
      "width": 2.8,
      "height": 0.24,
      "depth": 11.40175425099138,
      "rx": 0.37724905964235905,
      "rz": 0.0,
      "guardrail_sides": "e,w"
    },
    {
      "id": "access_ramp_sw",
      "kind": "ramp",
      "x": -11.8,
      "y": 2.1,
      "z": 12.6,
      "width": 2.8,
      "height": 0.24,
      "depth": 11.40175425099138,
      "rx": -0.37724905964235905,
      "rz": 0.0,
      "guardrail_sides": "e,w"
    },
    {
      "id": "access_ramp_se",
      "kind": "ramp",
      "x": 11.8,
      "y": 2.1,
      "z": 12.6,
      "width": 2.8,
      "height": 0.24,
      "depth": 11.40175425099138,
      "rx": -0.37724905964235905,
      "rz": 0.0,
      "guardrail_sides": "e,w"
    }
  ],
  "ramp_navs": [
    {
      "id": "access_ramp_nw",
      "x": -11.8,
      "halfWidth": 1.45,
      "zBottom": -7.3,
      "zTop": -17.9,
      "topY": 4.2
    },
    {
      "id": "access_ramp_ne",
      "x": 11.8,
      "halfWidth": 1.45,
      "zBottom": -7.3,
      "zTop": -17.9,
      "topY": 4.2
    },
    {
      "id": "access_ramp_sw",
      "x": -11.8,
      "halfWidth": 1.45,
      "zBottom": 7.3,
      "zTop": 17.9,
      "topY": 4.2
    },
    {
      "id": "access_ramp_se",
      "x": 11.8,
      "halfWidth": 1.45,
      "zBottom": 7.3,
      "zTop": 17.9,
      "topY": 4.2
    }
  ],
  "upper_waypoints": [
    {
      "x": -19.5,
      "y": 4.2,
      "z": -19.5
    },
    {
      "x": 0.0,
      "y": 4.2,
      "z": -19.5
    },
    {
      "x": 19.5,
      "y": 4.2,
      "z": -19.5
    },
    {
      "x": 19.5,
      "y": 4.2,
      "z": 0.0
    },
    {
      "x": 19.5,
      "y": 4.2,
      "z": 19.5
    },
    {
      "x": 0.0,
      "y": 4.2,
      "z": 19.5
    },
    {
      "x": -19.5,
      "y": 4.2,
      "z": 19.5
    },
    {
      "x": -19.5,
      "y": 4.2,
      "z": 0.0
    },
    {
      "x": 0.0,
      "y": 4.2,
      "z": -11.35
    },
    {
      "x": 0.0,
      "y": 4.2,
      "z": 11.35
    },
    {
      "x": -11.35,
      "y": 4.2,
      "z": 0.0
    },
    {
      "x": 11.35,
      "y": 4.2,
      "z": 0.0
    },
    {
      "x": 0.0,
      "y": 4.2,
      "z": -3.5
    },
    {
      "x": 0.0,
      "y": 4.2,
      "z": 3.5
    }
  ]
};

/**
 * Computes exact walkable floor height at (x, z) for AI navigation across ground, ramps, catwalks, and cross-bridges.
 */
export function sampleCombatSurfaceY(x, z, currentY = 0) {
  const topY = UPPER_COMBAT_NETWORK.upper_deck_y;

  // Check 4 inclined access ramps first
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

  // If already elevated (above 1.8m), snap to upper deck when on catwalks/towers/cross-bridges/vault overpass
  if (currentY >= 1.8) {
    const onPerim = Math.abs(x) >= 17.4 || Math.abs(z) >= 17.4;
    const onCrossNS = Math.abs(x) <= 1.75 && Math.abs(z) <= 21.0;
    const onCrossEW = Math.abs(z) <= 1.75 && Math.abs(x) <= 21.0;
    const onVaultRing = Math.abs(x) <= 4.7 && Math.abs(z) <= 4.7 && (Math.abs(x) >= 2.0 || Math.abs(z) >= 2.0);
    if (onPerim || onCrossNS || onCrossEW || onVaultRing) {
      return topY;
    }
  }

  return 0;
}
