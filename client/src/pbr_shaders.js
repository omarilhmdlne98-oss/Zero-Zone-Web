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
    "width_m": 3.6,
    "height_m": 5.8,
    "depth_m": 3.6,
    "material_preset": "overwatch_alloy",
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
  },
  {
    "id": "steel_gantry",
    "name": "Overhead Industrial Steel Gantry",
    "category": "SkyBridge",
    "width_m": 22.0,
    "height_m": 0.45,
    "depth_m": 3.0,
    "material_preset": "brushed_steel",
    "destructible": false
  },
  {
    "id": "sniper_catwalk",
    "name": "Elevated Sniper Perch Deck",
    "category": "HighGround",
    "width_m": 18.0,
    "height_m": 3.1,
    "depth_m": 4.2,
    "material_preset": "brushed_steel",
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
