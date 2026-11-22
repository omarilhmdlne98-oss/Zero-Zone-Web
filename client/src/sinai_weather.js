// Live 1973 Sinai Front Weather & Solar Cycle (Zero-Key Open-Meteo API)
// Mirrors docs/FREE_INFRA_AND_APIS.md & Zero-Zone-UE5 GetSinaiAtmospherePresets()
import * as THREE from 'three';

export const TIME_OF_DAY_MODES = ['LIVE', 'DAWN', 'NOON', 'DUSK', 'NIGHT'];

const OPEN_METEO_SUEZ_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=30.58&longitude=32.27&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=Africa%2FCairo';

const DEFAULT_LIVE_WEATHER = {
  hour: 17.5,
  timeLabel: '17:30',
  tempC: 24,
  windKmh: 16,
  weatherCode: 0,
  conditionLabel: 'CLEAR',
  isLive: false
};

function decodeWmoCode(code) {
  if (code === 0) return 'CLEAR';
  if (code <= 3) return 'PARTLY CLOUDY';
  if (code === 45 || code === 48) return 'DESERT HAZE';
  if (code >= 51 && code <= 67) return 'LIGHT RAIN';
  if (code >= 80 && code <= 99) return 'STORM';
  return 'WINDY';
}

export async function fetchLiveSinaiWeather() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(OPEN_METEO_SUEZ_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const cur = data?.current || {};
    let hour = 17.5;
    let timeLabel = '17:30';
    if (typeof cur.time === 'string' && cur.time.includes('T')) {
      const hm = cur.time.split('T')[1].slice(0, 5);
      const [hh, mm] = hm.split(':').map(Number);
      if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
        hour = hh + mm / 60;
        timeLabel = hm;
      }
    }
    return {
      hour,
      timeLabel,
      tempC: Math.round(cur.temperature_2m ?? 24),
      windKmh: Math.round(cur.wind_speed_10m ?? 16),
      weatherCode: cur.weather_code ?? 0,
      conditionLabel: decodeWmoCode(cur.weather_code ?? 0),
      isLive: true
    };
  } catch {
    return { ...DEFAULT_LIVE_WEATHER };
  } finally {
    clearTimeout(timer);
  }
}

const PRESETS = {
  DAWN: {
    hour: 6.25,
    timeLabel: '06:15',
    sunPos: new THREE.Vector3(64, 22, 36),
    sunColor: 0xffb982,
    sunIntensity: 1.55,
    hemiSky: 0xffd7b5,
    hemiGround: 0x8f6b48,
    hemiIntensity: 1.1,
    zenith: 0x2c568c,
    horizon: 0xdca47a,
    fogDensity: 0.0046
  },
  NOON: {
    hour: 12.5,
    timeLabel: '12:30',
    sunPos: new THREE.Vector3(24, 92, 18),
    sunColor: 0xfff8e8,
    sunIntensity: 2.35,
    hemiSky: 0xfff8eb,
    hemiGround: 0xc89e68,
    hemiIntensity: 1.45,
    zenith: 0x2974c4,
    horizon: 0xe3c898,
    fogDensity: 0.0034
  },
  DUSK: {
    hour: 17.5,
    timeLabel: '17:30',
    sunPos: new THREE.Vector3(42, 34, 32),
    sunColor: 0xffcf96,
    sunIntensity: 1.95,
    hemiSky: 0xffe4be,
    hemiGround: 0xb08250,
    hemiIntensity: 1.3,
    zenith: 0x2f5a92,
    horizon: 0xd8b480,
    fogDensity: 0.0042
  },
  NIGHT: {
    hour: 22.5,
    timeLabel: '22:30',
    sunPos: new THREE.Vector3(-38, 48, -28),
    sunColor: 0x9bb8e8,
    sunIntensity: 0.72,
    hemiSky: 0x3b5278,
    hemiGround: 0x26211c,
    hemiIntensity: 0.78,
    zenith: 0x091326,
    horizon: 0x1d2d44,
    fogDensity: 0.0052
  }
};

function selectPresetForHour(hour) {
  if (hour >= 5.0 && hour < 8.5) return 'DAWN';
  if (hour >= 8.5 && hour < 16.0) return 'NOON';
  if (hour >= 16.0 && hour < 19.5) return 'DUSK';
  return 'NIGHT';
}

export function computeSinaiAtmosphere(mode = 'LIVE', liveWeather = DEFAULT_LIVE_WEATHER) {
  const weather = liveWeather || DEFAULT_LIVE_WEATHER;
  const presetKey = mode === 'LIVE' ? selectPresetForHour(weather.hour) : mode;
  const p = PRESETS[presetKey] || PRESETS.DUSK;

  const isHazy = weather.weatherCode >= 45;
  const fogDensity = p.fogDensity + (isHazy ? 0.0014 : 0.0);
  const dustSpeedMult = THREE.MathUtils.clamp((weather.windKmh || 16) / 14.0, 0.7, 2.8);

  const prefix = mode === 'LIVE' ? (weather.isLive ? 'SUEZ LIVE' : 'SUEZ SIM') : mode;
  const displayTime = mode === 'LIVE' ? weather.timeLabel : p.timeLabel;
  const label = `${prefix} // ${displayTime} • ${weather.tempC}°C ${weather.conditionLabel}`;

  return {
    mode,
    presetKey,
    label,
    sunPos: p.sunPos.clone(),
    sunDir: p.sunPos.clone().normalize(),
    sunColor: p.sunColor,
    sunIntensity: p.sunIntensity,
    hemiSky: p.hemiSky,
    hemiGround: p.hemiGround,
    hemiIntensity: p.hemiIntensity,
    zenithColor: new THREE.Color(p.zenith),
    horizonColor: new THREE.Color(p.horizon),
    fogDensity,
    dustSpeedMult
  };
}
