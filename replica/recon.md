# Zero-Zone: Clean-room extraction-shooter recon

## Scope and evidence boundary

**Product/platform:** Zero-Zone, browser-first first-person WebGL game.

**First slice:** A polished, original, single-player PvPvE extraction loop with one compact island sector: base, stash/loadout, deployment, movement/combat, loot, anomaly pressure, contested extraction, death/extraction results, and local progression. This is a prototype scope—not a claim of AAA production quality or 45-player online readiness.

**Audience:** Players who enjoy tactical first-person survival and extraction loops. This is an inferred audience for Zero-Zone, not a confirmed target segment.

The reference game's public Steam page describes high-level concepts, not a complete playable reference. Its store notice says it is no longer available on Steam and its release date is unannounced. No game binary, private API, account, network traffic, proprietary art, or source was used. Exact target HUD, gun math, NPC tactics, inventories, extraction timings, and screens remain **unknown**. All detailed Zero-Zone mechanics below are original proposals unless explicitly described as project baseline.

## Sources


| Source                                      | URL                                                                                                                                                                    | What it establishes                                                                                                                                                                                                                                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public Steam listing for PUBG: Black Budget | [https://store.steampowered.com/app/4077740/PUBG\_Black\_Budget/](https://store.steampowered.com/app/4077740/PUBG_Black_Budget/)                                       | Public high-level premise/features and availability notice only. It describes an FPP-first island extraction game, anomaly/time-loop framing, persistent inventory, PvPvE, squads, factions, base, research, customization, and a shrinking play area. It does not expose detailed interaction or combat behavior. |
| Current Zero-Zone client entry              | [https://github.com/omarilhmdlne98-oss/Zero-Zone-Web/blob/main/client/src/main.js](https://github.com/omarilhmdlne98-oss/Zero-Zone-Web/blob/main/client/src/main.js)   | Project baseline: Three.js/Rapier scene, desert arena, local bots, classes, projectile weapons, HUD/radar, match timers, and respawning. This is the user's codebase, not reference-game evidence.                                                                                                                 |
| Current Zero-Zone server                    | [https://github.com/omarilhmdlne98-oss/Zero-Zone-Web/blob/main/server/index.js](https://github.com/omarilhmdlne98-oss/Zero-Zone-Web/blob/main/server/index.js)         | Project baseline: WebSocket rooms, short arena rounds, respawns, crates, and a vault-breach objective; no persistent extraction/stash loop is represented in the inspected server file.                                                                                                                            |
| Current client markup                       | [https://github.com/omarilhmdlne98-oss/Zero-Zone-Web/blob/main/client/index.html](https://github.com/omarilhmdlne98-oss/Zero-Zone-Web/blob/main/client/index.html)     | Current arena HUD and operator/loadout controls; not the reference game's UI.                                                                                                                                                                                                                                      |
| Client package manifest                     | [https://github.com/omarilhmdlne98-oss/Zero-Zone-Web/blob/main/client/package.json](https://github.com/omarilhmdlne98-oss/Zero-Zone-Web/blob/main/client/package.json) | Existing Three.js, Rapier3D, postprocessing, and Vite foundation available for a browser prototype.                                                                                                                                                                                                                |


## Publicly documented target facts

These are listing-level statements, not independent observations of gameplay:

- First-person-first tactical extraction premise; a contractor searches a mysterious island for classified technology/artifacts.
- Anomaly/time-loop setting and a shrinking playable area.
- Listing claims a 2.5 km by 2.5 km island and sessions up to 30 minutes.
- Listing describes persistent inventory: extracted items are kept; carried gear is lost on death.
- Listing describes PvPvE, up to three-player squads, and up to 45 players in a session.
- Listing describes three factions, contracts/rewards, a personal base, crafting, skills/proficiencies, research, weapon/gear customization, healing items, and stimulants.
- The listing says the product is no longer available on the Steam store and its release is unannounced. Fine-grained behavior and screens cannot be validated from this source.

## Screen inventory

All rows below are **Zero-Zone prototype proposals**, not observed reference screens. Stable IDs are used for later implementation/test mapping.


| ID  | Screen                   | Route/entry                                    | Purpose                                                                          | Key components                                                                                                    | States to build/test                                                            | Evidence status                                                                     |
| --- | ------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| S01 | Boot / connection        | Open game URL                                  | Initialize WebGL, load profile, explain input and recover from unsupported WebGL | Logo, loading status, error panel, play CTA                                                                       | Loading, ready, WebGL error, local-save error                                   | Proposed; project already has a canvas/error pattern                                |
| S02 | Base / operations hub    | Successful extraction, death, or fresh profile | Choose next raid and surface progression                                         | Operator panel, base status, contract summary, deploy CTA                                                         | First run, returning, no contract, saved progression                            | Base concept is listing-level; layout inferred                                      |
| S03 | Stash and loadout        | Base → Stash                                   | Equip carried kit; show risk/value before deployment                             | Gear slots, weapon slots, attachment sockets, consumables, carry weight, stash grid                               | Empty stash, equipped, item conflict, insufficient space, death-loss warning    | Persistent inventory/customization are listing-level; exact UI unknown              |
| S04 | Contract / faction board | Base → Contracts                               | Select an optional objective and reward                                          | Faction cards, objective details, reward preview, accept/decline                                                  | Available, accepted, expired, completed                                         | Factions/contracts are listing-level; implementation detail inferred                |
| S05 | Deployment brief         | Base → Deploy                                  | Choose a sector and understand the current anomaly/extraction forecast           | Sector map, POI legend, weather/anomaly readout, loadout recap                                                    | Solo entry, unavailable sector, risk warning                                    | Island/Anomaly are listing-level; exact map/UI unknown                              |
| S06 | Insertion                | Confirm deploy                                 | Establish raid start and orient the player                                       | Short original drop-in transition, compass, controls prompt                                                       | Inserting, skip/continue, ready                                                 | Proposed transition; no reference cutscene copied                                   |
| S07 | Raid / extraction HUD    | Active raid                                    | Support navigation, combat, survival, loot, and extraction decisions             | Crosshair, health/armor, stamina, ammo, objective, compass, 2D radar, anomaly edge, extraction status, event feed | Normal, combat, low health, anomaly warning, extraction contested, disconnected | General play is listing-level; HUD is original design                               |
| S08 | Container / ground loot  | Interact with crate, pack, or dropped kit      | Compare and transfer loot under pressure                                         | Two-column loot grid, item details, quick transfer, capacity indicator                                            | Empty, found items, full inventory, interrupted, death-cache                    | Loot/inventory loop inferred from listing and user brief; exact target grid unknown |
| S09 | Extraction site          | Enter active zone and interact                 | Signal, hold the site, and decide whether to stay                                | Beacon/flare, hold progress, contest indicator, countdown, cancel                                                 | Inactive, charging, contested, interrupted, success                             | Extraction is publicly stated; flare/hold semantics are a Zero-Zone proposal        |
| S10 | Death / raid failure     | Player eliminated or raid ends in failure      | Make loss legible and return to operations                                       | Lost-gear summary, recovered intel, return CTA                                                                    | Death, anomaly kill, disconnect, partial objective                              | Gear loss on death is listing-level; failure details inferred                       |
| S11 | Extraction telemetry     | Successful extraction                          | Show what was banked and why the run mattered                                    | Extracted/lost list, value, XP, contract progress, threat events, continue CTA                                    | Success, partial extraction, no loot, contract completion                       | Post-run telemetry is a requested Zero-Zone feature; target presentation unknown    |
| S12 | Research / progression   | Base → Research                                | Spend extracted intel/materials on persistent growth                             | Research tree, skill/proficiency nodes, base station status                                                       | Locked, affordable, purchased, maxed                                            | Research/base/skills are listing-level; node content is original                    |


## User flows

Happy-path interactions are design targets, not measured click counts from the unavailable reference.

- **F01 Prepare and deploy:** S02 Base → S03 Stash/loadout → S04 Contract (optional) → S05 Deployment brief → S06 Insertion → S07 Raid. Goal: enter with a deliberate risk/reward kit; surface warnings before the irreversible deployment.
- **F02 Loot and extract:** S07 Raid → S08 Container/ground loot → S07 navigate to active site → S09 signal and hold extraction → S11 telemetry → S02 Base/S03 Stash. Edge cases: pack full, site contested, hold interrupted, anomaly closes the route, no loot banked.
- **F03 Combat and loss:** S07 Raid → combat against original AI and/or other players when multiplayer is later enabled → death → S10 loss summary → S02 Base. Edge cases: death while looting, dropped-kit ownership/expiry, disconnect, carried-vs-secured inventory distinction. The prototype should clearly disclose irreversible losses.
- **F04 Anomaly pressure:** S05 forecast → S07 perimeter changes over time → hazard warning/damage and visual distortion → route to S09 extraction or safer zone. Edge cases: player at boundary, map marker stale, extraction outside the safe area.
- **F05 Long-term progression:** S11 extracted intel/materials → S02 Base → S12 Research/upgrade → S03 updated loadout → next F01. Unextracted raid items must not silently enter persistent storage.
- **F06 Contract loop:** S04 select an original faction-style contract → complete its condition in S07/S09 → see result in S11/S12. Stretch goal for the first slice unless time permits.

## Reusable components

- Tactical top bar: raid phase, elapsed time, sector, anomaly status.
- Compact 2D radar with player heading, POIs, extraction marker, and bounded threat pings; avoid claiming hidden-player detection without an explicit game mechanic.
- Peripheral HUD: health/armor/stamina, ammo/reload, current objective, status effects; keep center sightline unobstructed.
- Stash/loot grid: item icon, rarity, weight/value, condition, stack count, slot compatibility, selected/hover state, full-capacity feedback.
- Weapon/loadout card: original weapon names/stats, attachment slots, durability/ammo, risk-value summary.
- Extraction objective card: site state, hold progress, contest/interruption feedback.
- Raid event feed and post-run telemetry rows.
- Modal/toast system for warnings, confirmations, and error states; keyboard-accessible focus, visible focus rings, reduced-motion alternative.

## Inferred data model

Confidence means confidence in the **prototype need**, not certainty about the target's internal schema.


| Entity           | Candidate fields / relationships                                                                 | Evidence and confidence                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Profile          | profileId, level, XP, secured stash, unlocks, settings                                           | Persistent base/skills in public listing; high that a profile is needed, exact fields inferred                                           |
| ItemDefinition   | itemId, label, category, stackLimit, weight, baseValue, tags, iconKey                            | Inventory/customization listing plus requested grid; medium, all content original                                                        |
| InventoryEntry   | instanceId, itemId, quantity, condition, attachmentRefs, containerId                             | Persistent inventory and customization; medium, schema inferred                                                                          |
| Loadout          | profileId, weaponSlots, armorSlot, consumables, insured/at-risk entries                          | User-requested prep screen and listing's gear loss; medium                                                                               |
| WeaponDefinition | weaponId, damage, cadence, projectileSpeed, gravity, spread, recoil, magazine, reload, hit zones | Existing project demonstrates these tunable fields; target values unknown. High need for a prototype, low confidence in exact parameters |
| RaidRun          | runId, seed, sectorId, phase, startTime, anomalyPhase, squadIds, objectiveIds, outcome           | Listing-level sessions and anomaly; medium                                                                                               |
| WorldEntity      | entityId, kind, position, health, lootTableId, state                                             | User-requested crates/guards/extraction plus existing world objects; medium                                                              |
| LootTransfer     | runId, itemInstanceId, sourceEntityId, destination, timestamp                                    | Needed to prevent duplicate banking and explain extraction; prototype inference                                                          |
| ExtractionSite   | siteId, position, activationState, holdProgress, contestState, eligiblePlayers                   | Extraction is listing-level; flare/hold behavior is user-requested proposal; medium                                                      |
| ThreatAgent      | agentId, archetype, behaviorState, health, alertness, patrolRoute, lootDrop                      | PvPvE is listing-level; named archetypes and detailed AI are original proposal; medium                                                   |
| Contract         | contractId, factionId, objectiveType, progress, rewardRefs, state                                | Factions/contracts in listing; exact objectives/rewards unknown; medium                                                                  |
| RaidResult       | runId, extractedItems, lostItems, kills, damage, duration, XP, contractDeltas                    | Requested telemetry and persistent loop; high need, exact fields inferred                                                                |


## Clean-room boundary: out of scope

- Do not use the target's binaries, source code, JavaScript bundles, private APIs, network logs, account-only content, or non-public assets.
- Do not copy the target's title, logos, faction names, narrative/SAPIENS terminology, named characters, map layout, art, audio, weapon names, or exact UI. Use original Zero-Zone branding, locations, enemy names, item names, and visual language.
- Exact target ballistics, NPC archetypes, loot tables, anomaly timings, extraction rules, player counts, and UI states are unknown; do not present invented details as target facts.
- Licensed live-service population, matchmaking network, actual player data, commercial voice/content, and server operations cannot be reproduced by a client-only prototype.
- The user-requested photo-real asset library, full island, extensive destructibility, 45-player production networking, and AAA polish are not commitments of this first vertical slice.

## Sizing and implementation priority

**Overall product size: XL.** The requested complete extraction shooter requires substantial art, game design, backend persistence, authoritative simulation, anti-cheat, networking, QA, and operations. The agreed first slice is still a large prototype; keep the iteration bounded to one sector and local AI, and reuse the repo's existing Vite/Three/Rapier foundation. The current WebSocket server is an arena-room baseline, not a verified authoritative extraction backend.

Three hardest parts: (1) server-authoritative item ownership and extraction/death transactions for multiplayer; (2) readable FPS combat/AI and robust physics across varied browser hardware; (3) production-quality environment, animation, lighting, and performance at the requested visual bar.

## Five-line summary

- **Core loop:** prepare a risky kit → deploy → explore/fight/loot under anomaly pressure → hold an extraction → bank loot or lose exposed gear → research and prepare again.
- **Screens/flows:** 12 proposed screens; 6 flows, with only the broad loop grounded in public listing text.
- **Hardest parts:** authoritative persistence/networking; readable combat/AI physics; production art and browser performance.
- **Out of scope:** target assets/code/private data, exact proprietary mechanics, full-scale 45-player live service, and AAA asset production in the first slice.
- **Next step:** build and test the Zero-Zone vertical slice; expand networking/content in later milestones.