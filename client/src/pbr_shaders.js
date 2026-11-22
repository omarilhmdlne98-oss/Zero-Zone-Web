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
  },
  "sinai_sand": {
    "id": "sinai_sand",
    "name": "Sinai Desert Sand",
    "base_color_hex": "#d9b984",
    "roughness": 0.92,
    "metallic": 0.02,
    "rim_strength": 0.12,
    "ao_strength": 0.94,
    "emissive_hex": "#f5deb3"
  },
  "berm_earth": {
    "id": "berm_earth",
    "name": "Compacted East Bank Berm Earth",
    "base_color_hex": "#c29b61",
    "roughness": 0.94,
    "metallic": 0.02,
    "rim_strength": 0.10,
    "ao_strength": 0.95,
    "emissive_hex": "#e8c488"
  },
  "desert_concrete": {
    "id": "desert_concrete",
    "name": "Bar-Lev Reinforced Desert Concrete",
    "base_color_hex": "#b7a58b",
    "roughness": 0.86,
    "metallic": 0.08,
    "rim_strength": 0.15,
    "ao_strength": 0.90,
    "emissive_hex": "#f0dfc0"
  },
  "pontoon_steel": {
    "id": "pontoon_steel",
    "name": "Olive Tactical Pontoon Steel",
    "base_color_hex": "#5f6852",
    "roughness": 0.46,
    "metallic": 0.68,
    "rim_strength": 0.24,
    "ao_strength": 0.86,
    "emissive_hex": "#e2c893"
  },
  "suez_water": {
    "id": "suez_water",
    "name": "Suez Canal Flowing Water",
    "base_color_hex": "#1d6370",
    "roughness": 0.14,
    "metallic": 0.25,
    "rim_strength": 0.42,
    "ao_strength": 0.88,
    "emissive_hex": "#7dd3fc"
  },
  "sinai_limestone": {
    "id": "sinai_limestone",
    "name": "Weathered Sinai Limestone Rock",
    "base_color_hex": "#a88f6c",
    "roughness": 0.88,
    "metallic": 0.04,
    "rim_strength": 0.16,
    "ao_strength": 0.94,
    "emissive_hex": "#e8cfa4"
  },
  "oasis_palm_foliage": {
    "id": "oasis_palm_foliage",
    "name": "West Bank Oasis Date Palm Foliage",
    "base_color_hex": "#4c6b3c",
    "roughness": 0.78,
    "metallic": 0.02,
    "rim_strength": 0.18,
    "ao_strength": 0.90,
    "emissive_hex": "#a3e635"
  },
  "desert_camo_net": {
    "id": "desert_camo_net",
    "name": "Bar-Lev Desert Camouflage Netting",
    "base_color_hex": "#9b8459",
    "roughness": 0.90,
    "metallic": 0.02,
    "rim_strength": 0.12,
    "ao_strength": 0.92,
    "emissive_hex": "#d6be92"
  },
  "charred_tank_armor": {
    "id": "charred_tank_armor",
    "name": "Charred 1973 Sinai Tank Hull Steel",
    "base_color_hex": "#3d3830",
    "roughness": 0.64,
    "metallic": 0.72,
    "rim_strength": 0.28,
    "ao_strength": 0.92,
    "emissive_hex": "#f97316"
  },
  "field_tent_canvas": {
    "id": "field_tent_canvas",
    "name": "Desert Olive Field Tent Canvas",
    "base_color_hex": "#8a7955",
    "roughness": 0.92,
    "metallic": 0.02,
    "rim_strength": 0.14,
    "ao_strength": 0.90,
    "emissive_hex": "#e5cfa3"
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
 * Enhances a Three.js MeshStandardMaterial with Fresnel tactical rim lighting,
 * micro-grain desert quartz sparkle, and wind-ripple contrast tuned for 2GB VRAM GPUs.
 */
export function applyBattlefieldPBRShader(material, presetId = 'brushed_steel') {
  const preset = BATTLEFIELD_PBR_PRESETS[presetId] || BATTLEFIELD_PBR_PRESETS.brushed_steel;
  material.roughness = preset.roughness;
  material.metalness = preset.metallic;
  material.userData.pbrPreset = preset.id;

  const rimColor = new THREE.Color(preset.emissive_hex !== '#000000' ? preset.emissive_hex : '#38bdf8');
  const rimStrength = preset.rim_strength;
  const isSand = presetId === 'sinai_sand' || presetId === 'berm_earth';

  try {
    material.customProgramCacheKey = () => (isSand ? 'zero_zone_pbr_sinai_sand_v4' : 'zero_zone_pbr_fresnel_v4');
    material.onBeforeCompile = (shader) => {
      try {
        if (
          !shader.fragmentShader.includes('#include <common>') ||
          !shader.fragmentShader.includes('#include <dithering_fragment>')
        ) {
          return;
        }
        shader.uniforms.uRimColor = { value: rimColor };
        shader.uniforms.uRimStrength = { value: rimStrength };
        shader.uniforms.uIsSand = { value: isSand ? 1.0 : 0.0 };
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
             uniform vec3 uRimColor;
             uniform float uRimStrength;
             uniform float uIsSand;`
          )
          .replace(
            '#include <dithering_fragment>',
            `#if !defined(FLAT_SHADED)
             vec3 zzN = length(vNormal) > 0.0001 ? normalize(vNormal) : vec3(0.0, 1.0, 0.0);
             vec3 zzV = length(vViewPosition) > 0.0001 ? normalize(vViewPosition) : vec3(0.0, 0.0, 1.0);
             float zzFresnel = pow(max(0.0001, 1.0 - clamp(dot(zzN, zzV), 0.0, 1.0)), 2.8);
             gl_FragColor.rgb += uRimColor * zzFresnel * uRimStrength * 0.45;
             if (uIsSand > 0.5) {
               float zzGlint = fract(sin(dot(floor(gl_FragCoord.xy * 0.65), vec2(12.9898, 78.233))) * 43758.5453);
               float zzSparkle = smoothstep(0.958, 0.999, zzGlint) * (0.35 + 0.65 * zzFresnel);
               gl_FragColor.rgb += vec3(1.0, 0.94, 0.78) * zzSparkle * 0.28;
             }
             #endif
             #include <dithering_fragment>`
          );
      } catch (err) {
        console.warn('[Zero-Zone] PBR shader patch fallback:', err);
      }
    };
    material.needsUpdate = true;
  } catch (err) {
    console.warn('[Zero-Zone] Custom PBR shader skipped, using standard MeshStandardMaterial:', err);
  }
  return material;
}

