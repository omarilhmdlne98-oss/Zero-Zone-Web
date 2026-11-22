// Auto-exported from Static-Recomp-Native (Leonida / XenonRecomp PBR Shader Bridge)
import * as THREE from 'three';

export const BATTLEFIELD_PBR_PRESETS = {
  "weathered_concrete": {
    "id": "weathered_concrete",
    "name": "Weathered Tactical Concrete",
    "base_color_hex": "#6e7782",
    "roughness": 0.86,
    "metallic": 0.06,
    "rim_strength": 0.14,
    "ao_strength": 0.92,
    "emissive_hex": "#000000"
  },
  "brushed_steel": {
    "id": "brushed_steel",
    "name": "Brushed Ballistic Steel",
    "base_color_hex": "#4c5868",
    "roughness": 0.34,
    "metallic": 0.84,
    "rim_strength": 0.32,
    "ao_strength": 0.85,
    "emissive_hex": "#000000"
  },
  "catwalk_grate": {
    "id": "catwalk_grate",
    "name": "Perforated Steel Catwalk Grate",
    "base_color_hex": "#3e4856",
    "roughness": 0.4,
    "metallic": 0.86,
    "rim_strength": 0.36,
    "ao_strength": 0.86,
    "emissive_hex": "#38bdf8"
  },
  "overwatch_alloy": {
    "id": "overwatch_alloy",
    "name": "Overwatch Tower Alloy",
    "base_color_hex": "#364150",
    "roughness": 0.38,
    "metallic": 0.78,
    "rim_strength": 0.38,
    "ao_strength": 0.88,
    "emissive_hex": "#38bdf8"
  },
  "ballistic_bunker": {
    "id": "ballistic_bunker",
    "name": "Reinforced Ballistic Bunker",
    "base_color_hex": "#586068",
    "roughness": 0.76,
    "metallic": 0.24,
    "rim_strength": 0.18,
    "ao_strength": 0.9,
    "emissive_hex": "#000000"
  },
  "vault_core": {
    "id": "vault_core",
    "name": "Armored Vault Core",
    "base_color_hex": "#2b3544",
    "roughness": 0.28,
    "metallic": 0.88,
    "rim_strength": 0.45,
    "ao_strength": 0.82,
    "emissive_hex": "#2dd4bf"
  }
};

export const TACTICAL_STRUCTURE_SPECS = [
  {
    "id": "overwatch_tower",
    "name": "Armored Overwatch Guard Tower",
    "category": "VerticalSightline",
    "width_m": 4.0,
    "height_m": 4.2,
    "depth_m": 4.0,
    "material_preset": "overwatch_alloy",
    "destructible": false
  },
  {
    "id": "perimeter_catwalk",
    "name": "Perimeter Steel Catwalk Loop (x4)",
    "category": "UpperCatwalk",
    "width_m": 35.0,
    "height_m": 0.28,
    "depth_m": 3.2,
    "material_preset": "catwalk_grate",
    "destructible": false
  },
  {
    "id": "central_cross_bridge",
    "name": "Vault Central Cross-Bridge (x2)",
    "category": "CrossBridge",
    "width_m": 13.1,
    "height_m": 0.26,
    "depth_m": 3.0,
    "material_preset": "catwalk_grate",
    "destructible": false
  },
  {
    "id": "vault_overpass",
    "name": "Armored Vault Overpass Ring",
    "category": "OverpassDeck",
    "width_m": 9.2,
    "height_m": 0.28,
    "depth_m": 9.2,
    "material_preset": "brushed_steel",
    "destructible": false
  },
  {
    "id": "inclined_ramp",
    "name": "Smooth 21.6-deg Steel Access Ramp (x4)",
    "category": "InclinedRamp",
    "width_m": 2.8,
    "height_m": 0.24,
    "depth_m": 11.4,
    "material_preset": "catwalk_grate",
    "destructible": false
  },
  {
    "id": "ballistic_bunker",
    "name": "Reinforced Ballistic Shield Bunker",
    "category": "MidLaneCover",
    "width_m": 4.6,
    "height_m": 1.85,
    "depth_m": 2.2,
    "material_preset": "ballistic_bunker",
    "destructible": false
  }
];

/**
 * Enhances a Three.js MeshStandardMaterial with Fresnel tactical rim lighting
 * and micro-contrast tuned for 2GB VRAM GPUs (mirrors battlefield_pbr_frag.glsl).
 */
export function applyBattlefieldPBRShader(material, presetId = 'brushed_steel') {
  const preset = BATTLEFIELD_PBR_PRESETS[presetId] || BATTLEFIELD_PBR_PRESETS.brushed_steel;
  material.roughness = preset.roughness;
  material.metalness = preset.metallic;
  material.userData.pbrPreset = preset.id;

  const rimColor = new THREE.Color(preset.emissive_hex !== '#000000' ? preset.emissive_hex : '#38bdf8');
  const rimStrength = preset.rim_strength;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: rimColor };
    shader.uniforms.uRimStrength = { value: rimStrength };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uRimColor;
         uniform float uRimStrength;`
      )
      .replace(
        '#include <dithering_fragment>',
        `float zzFresnel = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.2);
         gl_FragColor.rgb += uRimColor * zzFresnel * uRimStrength * 0.42;
         #include <dithering_fragment>`
      );
  };
  material.needsUpdate = true;
  return material;
}
