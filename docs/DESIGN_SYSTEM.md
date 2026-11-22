# Unified Design System (`nexu-io/open-design` Inspired)

This document defines lightweight, zero-bloat CSS/UI design tokens and component rules shared across **Shopify Hub** (`https://shopifyhub.work`, RTL Arabic SaaS) and **Zero-Zone** (`https://zero-zone-game.vercel.app`, Tactical 3D FPS HUD).

---

## 1. Core Design Tokens

### Color Palette
| Token | Hex | Usage |
| :--- | :--- | :--- |
| `--bg-canvas` | `#070a0f` | Primary dark viewport / FPS backdrop |
| `--bg-surface` | `#0f1722` | Cards, HUD boxes, modals (`rgba(10, 15, 22, 0.78)`) |
| `--border-subtle` | `rgba(56, 226, 255, 0.28)` | Tactical HUD borders & active card outlines |
| `--accent-primary` | `#38e2ff` | Active weapon slot, UAV pulse, primary CTA |
| `--accent-amber` | `#f59e0b` | Vault breach objective, Artillery killstreak |
| `--accent-emerald` | `#10b981` | Health bar, verified store status, success toast |
| `--accent-crimson` | `#ef4444` | Directional damage arc, low-HP vignette, enemy blips |
| `--text-primary` | `#eef2f6` | High-contrast body & telemetry text |
| `--text-muted` | `#94a3b8` | Secondary labels & keyboard hints |

### Typography & Spacing
- **Latin / Telemetry**: `system-ui, -apple-system, sans-serif` for labels; `ui-monospace, SFMono-Regular, monospace` for radar coordinates, ammo, and timers.
- **Arabic RTL (Shopify Hub)**: `Cairo, Tajawal, system-ui, sans-serif` with `dir="rtl"` and logical CSS properties (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`) so LTR/RTL layouts never break.
- **4px Grid**: `4px`, `8px`, `12px`, `16px`, `24px`.

---

## 2. RTL Arabic SaaS Guidelines (Shopify Hub)
1. **Logical Properties Only**: Never hardcode `left` / `right` for directional icons or sidebars; use `inset-inline-start` / `inset-inline-end` and `border-inline-start`.
2. **Numeric Alignment**: Force `font-variant-numeric: tabular-nums;` and `direction: ltr; unicode-bidi: isolate;` on prices, SKUs, and order IDs inside RTL tables.
3. **Zero-Bloat Components**: Prefer CSS Grid/Flexbox + lightweight SVG icons over heavy UI runtime kits.

---

## 3. High-Contrast Tactical FPS HUD Guidelines (Zero-Zone)
1. **Non-Blocking Overlays**: `#hud` uses `pointer-events: none;` and `z-index: 10;` above `#game-canvas` (`z-index: 0`) so mouse-look and pointer-lock are never intercepted.
2. **2GB VRAM Budget**: Keep HUD animations CSS-only (`opacity`, `transform`) and render the tactical minimap on a `142x142` 2D `<canvas>` (`0` extra WebGL draw calls).
3. **Peripheral Anchoring**: Keep the center 35% of the viewport clear for iron sights, XR-9 digital scope reticle, and hitmarkers; anchor vitals bottom-left, ammo/killstreaks bottom-right, and radar top-left.
