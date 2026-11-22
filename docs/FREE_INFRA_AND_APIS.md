# Zero-Cost Cloud Infrastructure & Public APIs Directory

Curated from `ripienaar/free-for-dev` and `public-apis/public-apis` for **Zero-Zone** and **Shopify Hub** (`shopifyhub.work`).

---

## 1. Zero-Cost Cloud Tiers

| Layer | Provider | Free Tier Spec | Project Usage |
| :--- | :--- | :--- | :--- |
| **Frontend / Edge** | **Vercel** | 100 GB bandwidth/mo, instant GitHub `origin/main` auto-deploy | `https://zero-zone-game.vercel.app` & `https://shopifyhub.work` |
| **WebSocket / Node** | **Render** | 750 free instance hours/mo, WebSocket support | Zero-Zone multiplayer room server (`render.yaml`) |
| **Serverless Postgres** | **Neon** | 0.5 GB storage, branching, autosuspend | Shopify Hub multi-tenant catalog & orders DB |
| **Auth / Storage / DB** | **Supabase** | 500 MB Postgres, 50k MAU, 1 GB storage | Shopify Hub auth, media buckets, RLS policies |
| **Redis / Rate Limit** | **Upstash** | 10,000 commands/day serverless Redis | API rate-limiting, session cache, room state |
| **Cloud LLM Inference** | **NVIDIA NIM / OmniRoute** | Free developer credits + OpenAI-compatible `/v1/chat/completions` | Offloads AI reasoning from local 2GB VRAM GPU |

---

## 2. Free Public APIs (No Heavy Keys / Zero-Cost)

### Shopify Hub (`shopifyhub.work`)
- **ExchangeRate / Frankfurter API** (`https://api.frankfurter.app/latest?from=USD&to=EGP,SAR,AED,EUR`): Zero-key ECB currency conversion for multi-currency Arabic storefronts.
- **OpenStreetMap Nominatim** (`https://nominatim.openstreetmap.org/search`): Free geocoding for regional shipping & delivery zone estimation.
- **REST Countries** (`https://restcountries.com/v3.1/all`): Country codes, currencies, and Arabic/English localization metadata.

### Zero-Zone (`https://zero-zone-game.vercel.app`)
- **Open-Meteo Sinai Weather & Solar Seed** (`https://api.open-meteo.com/v1/forecast?latitude=30.5852&longitude=32.2654&current=wind_speed_10m,cloud_cover,is_day`): Optional live Suez Canal wind/cloud/daylight seed for atmospheric sky & sand-dust drift without GPU cost.
- **WorldTimeAPI** (`https://worldtimeapi.org/api/timezone/Africa/Cairo`): Deterministic match-seed & server clock sync.
