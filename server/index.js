import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const MATCH_DURATION_SEC = 300; // Legacy Arena 5-minute timer
const EXTRACTION_DURATION_SEC = 360; // Extraction Battle Royale 6-minute window
const VAULT_BREACH_TARGET_SEC = 20;
const EXTRACT_HOLD_TARGET_SEC = 15;
const RESPAWN_DELAY_MS = 3000;
const PROFILES_DIR = path.join(__dirname, 'data');
const PROFILES_FILE = path.join(PROFILES_DIR, 'profiles.json');

const KIT_MAX_HP = { vanguard: 100, spectre: 90, juggernaut: 150 };
const KIT_MAX_SHIELD = { vanguard: 50, spectre: 40, juggernaut: 100 };
const OPERATOR_CLASS_NAMES = {
  vanguard: 'Vanguard',
  spectre: 'Spectre',
  juggernaut: 'Juggernaut'
};

const EXTRACTION_ITEMS = {
  intel: { name: 'Intel Core', weight: 0.4, value: 1800 },
  medkit: { name: 'Trauma Kit', weight: 1.2, value: 420 },
  plate: { name: 'Composite Plate', weight: 2.5, value: 680 },
  cell: { name: 'Power Cell', weight: 0.7, value: 560 },
  optic: { name: 'Prism Optic', weight: 0.3, value: 740 },
  suppressor: { name: 'Sound Shroud', weight: 0.8, value: 920 },
  stimulant: { name: 'Focus Ampoule', weight: 0.2, value: 290 }
};

const EXTRACTION_SITES = [
  { x: 73, z: 0, name: 'NORTH RELAY' },
  { x: -70, z: -18, name: 'DRY DOCK' },
  { x: 3, z: 76, name: 'SOUTH CUT' }
];

function makeInitialLootContainers() {
  return [
    {
      id: 'loot_research',
      x: -25,
      z: -30,
      title: 'RESEARCH LOCKER',
      empty: false,
      items: [
        { itemId: 'intel', count: 1 },
        { itemId: 'cell', count: 1 },
        { itemId: 'medkit', count: 1 }
      ]
    },
    {
      id: 'loot_field',
      x: 30,
      z: -15,
      title: 'FIELD CACHE',
      empty: false,
      items: [
        { itemId: 'plate', count: 1 },
        { itemId: 'optic', count: 1 }
      ]
    },
    {
      id: 'loot_transfer',
      x: 34,
      z: 43,
      title: 'TRANSFER CRATE',
      empty: false,
      items: [
        { itemId: 'intel', count: 1 },
        { itemId: 'stimulant', count: 2 }
      ]
    },
    {
      id: 'loot_signal',
      x: -61,
      z: 20,
      title: 'SIGNAL CASE',
      empty: false,
      items: [
        { itemId: 'cell', count: 2 },
        { itemId: 'suppressor', count: 1 }
      ]
    }
  ];
}

function makeInitialGuards() {
  return [
    { id: 'a', name: 'Bastion', type: 'JUGGERNAUT', x: -28, z: -21, hp: 175, maxHp: 175, alive: true },
    { id: 'b', name: 'Wraith', type: 'SPECTRE', x: 31, z: -4, hp: 78, maxHp: 78, alive: true },
    { id: 'c', name: 'Patrol Cell 01', type: 'SQUAD', x: 48, z: 32, hp: 110, maxHp: 110, alive: true },
    { id: 'd', name: 'Patrol Cell 02', type: 'SQUAD', x: 54, z: 35, hp: 110, maxHp: 110, alive: true },
    { id: 'e', name: 'Patrol Cell 03', type: 'SQUAD', x: 42, z: 38, hp: 110, maxHp: 110, alive: true }
  ];
}

function computeStashScore(stash = []) {
  return stash.reduce((sum, entry) => {
    const def = EXTRACTION_ITEMS[entry.itemId];
    return sum + (def ? def.value * (Number(entry.count) || 0) : 0);
  }, 0);
}

function createFreshProfile(playerId) {
  const stash = [
    { itemId: 'medkit', count: 2 },
    { itemId: 'plate', count: 1 },
    { itemId: 'cell', count: 2 },
    { itemId: 'optic', count: 1 },
    { itemId: 'stimulant', count: 2 }
  ];
  return {
    playerId,
    xp: 0,
    raids: 0,
    extractions: 0,
    stashScore: computeStashScore(stash),
    stash,
    loadout: { weaponId: 'ar9', armor: true, optic: false, suppressor: false },
    contract: true,
    inRaid: false
  };
}

const profiles = new Map();

function loadProfiles() {
  try {
    if (!fs.existsSync(PROFILES_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      for (const [id, prof] of Object.entries(raw)) {
        if (prof && typeof prof === 'object') {
          profiles.set(id, {
            ...createFreshProfile(id),
            ...prof,
            stashScore: Number.isFinite(prof.stashScore) ? prof.stashScore : computeStashScore(prof.stash || [])
          });
        }
      }
    }
  } catch (err) {
    console.warn('Could not load profiles.json, starting fresh:', err.message);
  }
}

function saveProfiles() {
  try {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
    const obj = Object.fromEntries(profiles.entries());
    const tmpFile = `${PROFILES_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmpFile, PROFILES_FILE);
  } catch (err) {
    console.warn('Could not persist profiles.json:', err.message);
  }
}

loadProfiles();

function getOrCreateProfile(playerId) {
  let prof = profiles.get(playerId);
  if (!prof) {
    prof = createFreshProfile(playerId);
    profiles.set(playerId, prof);
    saveProfiles();
  }
  return prof;
}

function normalizeKit(rawKit) {
  if (typeof rawKit !== 'string') return 'vanguard';
  const key = rawKit.trim().toLowerCase();
  return KIT_MAX_HP[key] ? key : 'vanguard';
}

function toOperatorClass(kit) {
  return OPERATOR_CLASS_NAMES[normalizeKit(kit)] || 'Vanguard';
}

const rooms = new Map();

function createRoom(roomId, options = {}) {
  const isExtraction = String(options.gameMode || '').toLowerCase() === 'extraction' || roomId.startsWith('sector');
  const room = {
    id: roomId,
    roomName: String(options.roomName || roomId).slice(0, 48),
    gameMode: String(options.gameMode || (isExtraction ? 'Extraction' : 'Arena')).slice(0, 32),
    maxPlayers: Math.max(2, Number(options.maxPlayers) || 10),
    serverAddress: String(options.serverAddress || ''),
    players: new Map(),
    crates: {
      crate_nw: { id: 'crate_nw', hp: 100, destroyed: false },
      crate_ne: { id: 'crate_ne', hp: 100, destroyed: false },
      crate_sw: { id: 'crate_sw', hp: 100, destroyed: false },
      crate_se: { id: 'crate_se', hp: 100, destroyed: false }
    },
    matchRemaining: isExtraction ? EXTRACTION_DURATION_SEC : MATCH_DURATION_SEC,
    elapsed: 0,
    breachProgress: 0,
    breachingPlayerId: null,
    matchEnded: false,
    // Extraction Battle Royale authoritative state
    anomalyRadius: 96,
    activeSite: Math.floor(Math.random() * EXTRACTION_SITES.length),
    flareActive: false,
    extractProgress: 0,
    lootContainers: makeInitialLootContainers(),
    guards: makeInitialGuards()
  };
  rooms.set(roomId, room);
  return room;
}

function getOrCreateRoom(roomId, options = {}) {
  return rooms.get(roomId) || createRoom(roomId, options);
}

function serializeRoomInfo(room, defaultServerAddress = '') {
  return {
    roomId: room.id,
    roomName: room.roomName,
    gameMode: room.gameMode,
    currentPlayers: room.players.size,
    maxPlayers: room.maxPlayers,
    serverAddress: room.serverAddress || defaultServerAddress
  };
}

function broadcast(room, payload, excludeId = null) {
  const msg = JSON.stringify(payload);
  for (const [id, p] of room.players.entries()) {
    if (id !== excludeId && p.ws && p.ws.readyState === 1) {
      p.ws.send(msg);
    }
  }
}

function serializePlayerState(player) {
  return {
    type: 'player_state',
    id: player.id,
    x: player.x,
    y: player.y,
    z: player.z,
    ry: player.ry,
    weapon: player.weaponId,
    playerId: player.id,
    operatorClass: toOperatorClass(player.kit),
    weaponId: player.weaponId,
    pitch: player.pitch,
    yaw: player.yaw,
    roll: player.roll,
    health: player.hp,
    shield: player.shield,
    isFiring: player.isFiring,
    isAbilityActive: player.isAbilityActive,
    isADS: player.isADS,
    isCrouching: player.isCrouching,
    leanAngle: player.leanAngle
  };
}

function serializeExtractionSnapshot(room) {
  return {
    type: 'extraction_snapshot',
    roomId: room.id,
    matchRemaining: room.matchRemaining,
    elapsed: room.elapsed,
    anomalyRadius: room.anomalyRadius,
    activeSite: room.activeSite,
    flareActive: room.flareActive,
    extractProgress: room.extractProgress,
    lootContainers: room.lootContainers,
    guards: room.guards
  };
}

function serializeRoomState(room) {
  return {
    type: 'room_snapshot',
    roomId: room.id,
    gameMode: room.gameMode,
    matchRemaining: room.matchRemaining,
    breachProgress: room.breachProgress,
    breachingPlayerId: room.breachingPlayerId,
    matchEnded: room.matchEnded,
    anomalyRadius: room.anomalyRadius,
    activeSite: room.activeSite,
    flareActive: room.flareActive,
    extractProgress: room.extractProgress,
    lootContainers: room.lootContainers,
    guards: room.guards,
    crates: Object.values(room.crates),
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      kit: p.kit,
      operatorClass: toOperatorClass(p.kit),
      weaponId: p.weaponId,
      hp: p.hp,
      maxHp: p.maxHp,
      shield: p.shield,
      alive: p.alive,
      score: p.score,
      kills: p.kills || 0,
      x: p.x,
      y: p.y,
      z: p.z,
      ry: p.ry,
      pitch: p.pitch,
      yaw: p.yaw,
      roll: p.roll
    }))
  };
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, profiles: profiles.size }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Zero-Zone Authoritative Extraction & Arena WebSocket Server');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  let currentRoom = null;
  let playerId = null;
  let pendingKit = 'vanguard';
  let pendingPlayerId = null;

  const hostHeader = req?.headers?.host || '';
  const isLocalHost = hostHeader.startsWith('localhost') || hostHeader.startsWith('127.0.0.1');
  const defaultServerAddress = hostHeader ? `${isLocalHost ? 'ws' : 'wss'}://${hostHeader}` : '';

  function handlePlayerDeathInExtraction(room, target, reason) {
    if (!target || !target.alive) return;
    target.alive = false;
    target.hp = 0;
    const prof = getOrCreateProfile(target.id);
    if (prof.inRaid) {
      prof.inRaid = false;
      prof.raids += 1;
      // Gear loss on death: lose carried bag + installed attachments/armor
      target.bag = [];
      prof.loadout.armor = false;
      prof.loadout.optic = false;
      prof.loadout.suppressor = false;
      saveProfiles();
    }
    if (target.ws && target.ws.readyState === 1) {
      target.ws.send(
        JSON.stringify({
          type: 'raid_lost',
          reason: reason || 'Contractor eliminated in sector.',
          profile: prof
        })
      );
    }
  }

  function handlePlayerExtraction(room, player) {
    if (!player || !player.alive) return false;
    const site = EXTRACTION_SITES[room.activeSite] || EXTRACTION_SITES[0];
    const dist = Math.hypot(site.x - player.x, site.z - player.z);
    if (!room.flareActive || dist > 9.5 || room.extractProgress < EXTRACT_HOLD_TARGET_SEC - 1.5) {
      return false;
    }
    const prof = getOrCreateProfile(player.id);
    const bag = Array.isArray(player.bag) ? player.bag : [];
    const recoveredValue = computeStashScore(bag);
    const recoveredCount = bag.reduce((n, e) => n + (Number(e.count) || 0), 0);

    for (const item of bag) {
      const existing = prof.stash.find((s) => s.itemId === item.itemId);
      if (existing) existing.count += item.count;
      else prof.stash.push({ itemId: item.itemId, count: item.count });
    }

    let bonusApplied = false;
    if (prof.contract && (player.kills || 0) >= 3) {
      const intelSlot = prof.stash.find((s) => s.itemId === 'intel');
      if (intelSlot) intelSlot.count += 2;
      else prof.stash.push({ itemId: 'intel', count: 2 });
      prof.xp += 500;
      bonusApplied = true;
    }

    prof.xp += 180 + (player.kills || 0) * 45 + Math.round(recoveredValue * 0.04);
    prof.raids += 1;
    prof.extractions = (prof.extractions || 0) + 1;
    prof.stashScore = computeStashScore(prof.stash);
    prof.inRaid = false;
    player.bag = [];
    player.alive = false;
    saveProfiles();

    if (player.ws && player.ws.readyState === 1) {
      player.ws.send(
        JSON.stringify({
          type: 'extraction_confirmed',
          recoveredCount,
          recoveredValue,
          kills: player.kills || 0,
          bonusApplied,
          extractedBag: bag,
          profile: prof
        })
      );
    }
    broadcast(room, { type: 'player_extracted', id: player.id }, player.id);
    return true;
  }

  function leaveCurrentRoom() {
    if (!currentRoom || !playerId) return;
    const p = currentRoom.players.get(playerId);
    if (p && currentRoom.gameMode === 'Extraction' && p.alive) {
      const prof = getOrCreateProfile(playerId);
      if (prof.inRaid) {
        handlePlayerDeathInExtraction(currentRoom, p, 'Connection lost inside active sector.');
      }
    }
    if (currentRoom.breachingPlayerId === playerId) {
      currentRoom.breachingPlayerId = null;
    }
    currentRoom.players.delete(playerId);
    broadcast(currentRoom, { type: 'player_left', id: playerId, playerId });
    if (currentRoom.players.size === 0) {
      rooms.delete(currentRoom.id);
    }
    currentRoom = null;
  }

  function joinRoom(room, requestedKit, requestedPlayerId) {
    const kit = normalizeKit(requestedKit || pendingKit);
    const resolvedId = String(
      requestedPlayerId || playerId || pendingPlayerId || `op_${Math.random().toString(36).slice(2, 8)}`
    );

    if (currentRoom && currentRoom.id !== room.id) {
      leaveCurrentRoom();
    }

    playerId = resolvedId;
    pendingPlayerId = resolvedId;
    pendingKit = kit;
    currentRoom = room;

    const prof = getOrCreateProfile(playerId);
    const maxHp = KIT_MAX_HP[kit];
    const existing = room.players.get(playerId);
    const player = existing
      ? { ...existing, ws, kit, maxHp, hp: Math.min(existing.hp, maxHp) }
      : {
          id: playerId,
          ws,
          kit,
          weaponId: prof.loadout?.weaponId || 'ar9',
          hp: maxHp,
          maxHp,
          shield: room.gameMode === 'Extraction' ? (prof.loadout?.armor ? 60 : 0) : 50,
          alive: true,
          score: 0,
          kills: 0,
          bag: [],
          x: room.gameMode === 'Extraction' ? 0 : (Math.random() - 0.5) * 10,
          y: 1.5,
          z: room.gameMode === 'Extraction' ? 73 : 10,
          ry: 0,
          pitch: 0,
          yaw: 0,
          roll: 0,
          isFiring: false,
          isAbilityActive: false,
          lastFireAt: 0
        };

    room.players.set(playerId, player);
    ws.send(
      JSON.stringify({
        type: 'welcome',
        playerId,
        roomId: room.id,
        profile: prof,
        ...serializeRoomState(room)
      })
    );
    broadcast(
      room,
      {
        type: 'player_joined',
        player: {
          id: player.id,
          kit: player.kit,
          operatorClass: toOperatorClass(player.kit),
          weaponId: player.weaponId,
          hp: player.hp,
          maxHp: player.maxHp,
          alive: player.alive,
          x: player.x,
          y: player.y,
          z: player.z,
          ry: player.ry
        }
      },
      playerId
    );
    return player;
  }

  function applyDamageToPlayer(room, attacker, target, rawDamage) {
    if (!target || !target.alive || target.id === attacker.id) return;
    const dist = Math.hypot(target.x - attacker.x, target.y - attacker.y, target.z - attacker.z);
    if (dist > 110) return;
    const dmg = Math.min(68, Math.max(8, Number(rawDamage) || 22));
    const absorbed = Math.min(target.shield || 0, dmg);
    target.shield = Math.max(0, (target.shield || 0) - absorbed);
    target.hp = Math.max(0, target.hp - (dmg - absorbed));
    broadcast(room, { type: 'player_damaged', id: target.id, hp: target.hp, shield: target.shield, by: attacker.id });
    broadcast(room, {
      type: 'combat_event',
      event: 'damage',
      playerId: attacker.id,
      targetId: target.id,
      value: dmg
    });
    if (target.hp === 0) {
      attacker.score += 1;
      attacker.kills = (attacker.kills || 0) + 1;
      broadcast(room, { type: 'player_eliminated', id: target.id, by: attacker.id, score: attacker.score });
      if (room.gameMode === 'Extraction') {
        handlePlayerDeathInExtraction(room, target, `Eliminated by contractor ${attacker.id}.`);
      } else {
        target.alive = false;
        setTimeout(() => {
          if (!room.players.has(target.id)) return;
          target.alive = true;
          target.hp = target.maxHp;
          target.x = (Math.random() - 0.5) * 12;
          target.y = 2.0;
          target.z = 11;
          broadcast(room, { type: 'player_respawned', id: target.id, hp: target.hp, x: target.x, y: target.y, z: target.z });
        }, RESPAWN_DELAY_MS);
      }
    }
  }

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // --- Contractor Profile Sync & Operations Hub Loadout Updates ---
    if (data.type === 'profile_sync' || data.type === 'profile_update') {
      const id = String(data.playerId || playerId || pendingPlayerId || `op_${Math.random().toString(36).slice(2, 8)}`);
      playerId = id;
      pendingPlayerId = id;
      const prof = getOrCreateProfile(id);
      if (data.type === 'profile_update') {
        if (data.loadout && typeof data.loadout === 'object') {
          prof.loadout = {
            weaponId: ['ar9', 'dmr4', 'c12'].includes(data.loadout.weaponId) ? data.loadout.weaponId : prof.loadout.weaponId,
            armor: Boolean(data.loadout.armor),
            optic: Boolean(data.loadout.optic),
            suppressor: Boolean(data.loadout.suppressor)
          };
        }
        if (typeof data.contract === 'boolean') prof.contract = data.contract;
        saveProfiles();
      }
      ws.send(JSON.stringify({ type: 'profile_state', playerId: id, profile: prof }));
      return;
    }

    // --- Deploy into Authoritative Extraction Battle Royale Sector ---
    if (data.type === 'deploy_raid') {
      const roomId = String(data.roomId || 'sector_04').slice(0, 24);
      const room = getOrCreateRoom(roomId, {
        roomName: 'Sector 04 // Relay',
        gameMode: 'Extraction',
        maxPlayers: 12,
        serverAddress: defaultServerAddress
      });
      if (room.matchEnded || room.matchRemaining <= 15) {
        // Fresh sector instance if previous raid ended
        rooms.delete(roomId);
      }
      const activeRoom = getOrCreateRoom(roomId, {
        roomName: 'Sector 04 // Relay',
        gameMode: 'Extraction',
        maxPlayers: 12,
        serverAddress: defaultServerAddress
      });
      const player = joinRoom(activeRoom, data.kit || 'vanguard', data.playerId);
      const prof = getOrCreateProfile(player.id);
      prof.inRaid = true;
      player.alive = true;
      player.hp = 100;
      player.maxHp = 100;
      player.shield = prof.loadout?.armor ? 60 : 0;
      player.kills = 0;
      player.bag = [];
      player.x = 0;
      player.y = 1.5;
      player.z = 73;
      if (data.weaponId) player.weaponId = String(data.weaponId).slice(0, 24);
      saveProfiles();

      ws.send(JSON.stringify({ ...serializeExtractionSnapshot(activeRoom), type: 'raid_deployed', playerId: player.id, profile: prof }));
      return;
    }

    // --- Web client join / rejoin ---
    if (data.type === 'join' || data.type === 'rejoin') {
      const roomId = String(data.roomId || 'alpha').slice(0, 24);
      const room = getOrCreateRoom(roomId, { serverAddress: defaultServerAddress });
      joinRoom(room, data.kit, data.playerId);
      return;
    }

    // --- UE5 Matchmaking Subsystem messages ---
    if (data.type === 'mm_list_rooms') {
      const roomList = Array.from(rooms.values()).map((r) => serializeRoomInfo(r, defaultServerAddress));
      ws.send(JSON.stringify({ type: 'mm_room_list', rooms: roomList }));
      return;
    }

    if (data.type === 'mm_create_room') {
      const roomName = String(data.roomName || 'Zero-Zone Arena').slice(0, 48);
      const baseSlug = roomName.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 16) || 'room';
      const roomId = rooms.has(baseSlug) ? `${baseSlug}_${Math.random().toString(36).slice(2, 6)}` : baseSlug;
      const room = createRoom(roomId, {
        roomName,
        gameMode: data.gameMode || 'Arena',
        maxPlayers: data.maxPlayers || 10,
        serverAddress: defaultServerAddress
      });
      joinRoom(room, data.kit || pendingKit, data.playerId);
      ws.send(JSON.stringify({ type: 'mm_room_joined', room: serializeRoomInfo(room, defaultServerAddress) }));
      return;
    }

    if (data.type === 'mm_join_room') {
      const roomId = String(data.roomId || 'alpha').slice(0, 24);
      const room = getOrCreateRoom(roomId, { serverAddress: defaultServerAddress });
      joinRoom(room, data.kit || pendingKit, data.playerId);
      ws.send(JSON.stringify({ type: 'mm_room_joined', room: serializeRoomInfo(room, defaultServerAddress) }));
      return;
    }

    if (data.type === 'mm_leave_room') {
      leaveCurrentRoom();
      return;
    }

    if (data.type === 'mm_queue_join') {
      pendingKit = normalizeKit(data.preferredOperator || pendingKit);
      let targetRoom = null;
      for (const r of rooms.values()) {
        if (!r.matchEnded && r.players.size < r.maxPlayers) {
          targetRoom = r;
          break;
        }
      }
      if (!targetRoom) {
        targetRoom = getOrCreateRoom('alpha', {
          roomName: 'Alpha Arena',
          gameMode: 'Arena',
          maxPlayers: 10,
          serverAddress: defaultServerAddress
        });
      }
      joinRoom(targetRoom, pendingKit, data.playerId);
      ws.send(JSON.stringify({ type: 'mm_match_found', room: serializeRoomInfo(targetRoom, defaultServerAddress) }));
      return;
    }

    if (data.type === 'mm_queue_cancel') {
      return;
    }

    if (data.type === 'operator_select') {
      const kit = normalizeKit(data.operatorClass || data.kit);
      pendingKit = kit;
      if (data.playerId) pendingPlayerId = String(data.playerId);
      if (currentRoom && playerId) {
        const p = currentRoom.players.get(playerId);
        if (p) {
          const oldMax = p.maxHp;
          p.kit = kit;
          p.maxHp = KIT_MAX_HP[kit];
          p.hp = p.hp === oldMax ? p.maxHp : Math.min(p.hp, p.maxHp);
        }
      }
      return;
    }

    if ((!currentRoom || !playerId) && (data.type === 'player_state' || data.type === 'combat_event')) {
      const room = getOrCreateRoom('alpha', { serverAddress: defaultServerAddress });
      joinRoom(room, data.operatorClass || pendingKit, data.playerId);
    }

    if (!currentRoom || !playerId) return;
    const player = currentRoom.players.get(playerId);
    if (!player) return;

    // --- State updates (Web 'state' & UE5 'player_state') ---
    if (data.type === 'state' && player.alive) {
      player.x = Number(data.x) || 0;
      player.y = Number(data.y) || 0;
      player.z = Number(data.z) || 0;
      player.ry = Number(data.ry) || 0;
      player.yaw = player.ry;
      if (data.weapon || data.weaponId) {
        player.weaponId = String(data.weapon || data.weaponId).slice(0, 24);
      }
      if (typeof data.isADS === 'boolean') player.isADS = data.isADS;
      if (typeof data.isCrouching === 'boolean') player.isCrouching = data.isCrouching;
      if (Number.isFinite(Number(data.leanAngle))) player.leanAngle = Number(data.leanAngle);
      broadcast(currentRoom, serializePlayerState(player), playerId);
    } else if (data.type === 'player_state' && player.alive) {
      if (data.operatorClass) {
        player.kit = normalizeKit(data.operatorClass);
        player.maxHp = KIT_MAX_HP[player.kit];
        player.maxShield = KIT_MAX_SHIELD[player.kit];
      }
      if (data.weaponId || data.weapon) {
        player.weaponId = String(data.weaponId || data.weapon).slice(0, 24);
      }
      player.x = Number(data.x) || 0;
      player.y = Number(data.y) || 0;
      player.z = Number(data.z) || 0;
      player.pitch = Number(data.pitch) || 0;
      player.yaw = Number(data.yaw) || 0;
      player.roll = Number(data.roll) || 0;
      player.ry = Number.isFinite(Number(data.ry)) ? Number(data.ry) : player.yaw;
      if (Number.isFinite(Number(data.shield))) player.shield = Number(data.shield);
      player.isFiring = Boolean(data.isFiring);
      player.isAbilityActive = Boolean(data.isAbilityActive);
      player.isADS = Boolean(data.isADS);
      player.isCrouching = Boolean(data.isCrouching);
      player.leanAngle = Number(data.leanAngle) || 0;
      broadcast(currentRoom, serializePlayerState(player), playerId);
    } else if (data.type === 'loot_take' && player.alive) {
      const container = currentRoom.lootContainers.find((c) => c.id === String(data.containerId));
      const idx = Number(data.itemIndex);
      if (!container || container.empty || !Number.isInteger(idx) || idx < 0 || idx >= container.items.length) return;
      if (Math.hypot(container.x - player.x, container.z - player.z) > 8.0) return;

      const item = container.items[idx];
      const def = EXTRACTION_ITEMS[item.itemId];
      if (!def) return;
      const curWeight = (player.bag || []).reduce((n, v) => n + (EXTRACTION_ITEMS[v.itemId]?.weight || 0) * v.count, 0);
      if (curWeight + def.weight * item.count > 30) {
        ws.send(JSON.stringify({ type: 'loot_rejected', reason: 'PACK FULL' }));
        return;
      }

      container.items.splice(idx, 1);
      if (container.items.length === 0) container.empty = true;
      player.bag.push({ itemId: item.itemId, count: item.count });
      ws.send(JSON.stringify({ type: 'bag_updated', bag: player.bag }));
      broadcast(currentRoom, { type: 'loot_updated', container });
    } else if (data.type === 'guard_hit' && player.alive) {
      const guard = currentRoom.guards.find((g) => g.id === String(data.guardId));
      if (!guard || !guard.alive) return;
      const dmg = Math.min(120, Math.max(5, Number(data.damage) || 25));
      guard.hp = Math.max(0, guard.hp - dmg);
      if (guard.hp === 0) {
        guard.alive = false;
        player.kills = (player.kills || 0) + 1;
        const drop = {
          id: `drop_${guard.id}_${Date.now().toString(36)}`,
          x: Number(data.x ?? guard.x),
          z: Number(data.z ?? guard.z),
          title: `${guard.name} // RECOVERY`,
          empty: false,
          items: [
            { itemId: Math.random() > 0.4 ? 'intel' : 'cell', count: 1 },
            { itemId: 'plate', count: 1 }
          ]
        };
        currentRoom.lootContainers.push(drop);
        broadcast(currentRoom, { type: 'guard_eliminated', guardId: guard.id, by: playerId, container: drop });
      } else {
        broadcast(currentRoom, { type: 'guard_damaged', guardId: guard.id, hp: guard.hp });
      }
    } else if (data.type === 'flare_deploy' && player.alive) {
      const site = EXTRACTION_SITES[currentRoom.activeSite] || EXTRACTION_SITES[0];
      if (Math.hypot(site.x - player.x, site.z - player.z) <= 9.0) {
        currentRoom.flareActive = true;
        broadcast(currentRoom, { type: 'flare_deployed', siteIndex: currentRoom.activeSite, by: playerId });
      }
    } else if (data.type === 'extract_confirm' && player.alive) {
      handlePlayerExtraction(currentRoom, player);
    } else if (data.type === 'raid_death' && player.alive) {
      handlePlayerDeathInExtraction(currentRoom, player, String(data.reason || 'Contractor down.'));
    } else if (data.type === 'fire' && player.alive) {
      const now = Date.now();
      if (now - player.lastFireAt < 95) return;
      player.lastFireAt = now;
      const weaponId = String(data.weapon || player.weaponId || 'rifle');
      broadcast(currentRoom, { type: 'player_fired', id: playerId, origin: data.origin, dir: data.dir, weapon: weaponId, color: data.color }, playerId);
      broadcast(currentRoom, { type: 'combat_event', event: 'fire', playerId, targetId: '', value: 1, weapon: weaponId, hitZone: 'none' }, playerId);
    } else if (data.type === 'hit_player' && player.alive) {
      const target = currentRoom.players.get(String(data.targetId));
      applyDamageToPlayer(currentRoom, player, target, data.damage, data.hitZone || 'torso', data.weapon || player.weaponId);
    } else if (data.type === 'combat_event' && player.alive) {
      const eventName = String(data.event || '');
      const eventLower = eventName.toLowerCase();
      const weaponId = String(data.weapon || player.weaponId || 'rifle');
      const hitZone = String(data.hitZone || 'torso');
      broadcast(
        currentRoom,
        {
          type: 'combat_event',
          event: eventName,
          playerId,
          targetId: String(data.targetId || ''),
          value: Number(data.value) || 0,
          weapon: weaponId,
          hitZone
        },
        playerId
      );
      if (eventLower === 'fire' || eventLower === 'shoot') {
        const now = Date.now();
        if (now - player.lastFireAt >= 95) {
          player.lastFireAt = now;
          broadcast(
            currentRoom,
            {
              type: 'player_fired',
              id: playerId,
              origin: data.origin || [player.x, player.y, player.z],
              dir: data.dir || [0, 0, -1],
              weapon: weaponId
            },
            playerId
          );
        }
      } else if ((eventLower === 'hit' || eventLower === 'damage' || eventLower === 'hit_player') && data.targetId) {
        const target = currentRoom.players.get(String(data.targetId));
        applyDamageToPlayer(currentRoom, player, target, data.value, hitZone, weaponId);
      }
    } else if (data.type === 'hit_crate' && player.alive) {
      const crate = currentRoom.crates[String(data.crateId)];
      if (!crate || crate.destroyed) return;
      crate.hp = Math.max(0, crate.hp - 25);
      if (crate.hp === 0) crate.destroyed = true;
      broadcast(currentRoom, { type: 'crate_updated', crate });
    } else if (data.type === 'breach_hold' && player.alive) {
      const distToVault = Math.hypot(player.x, player.z);
      if (distToVault <= 5.5) {
        currentRoom.breachingPlayerId = data.active ? playerId : null;
      } else if (currentRoom.breachingPlayerId === playerId) {
        currentRoom.breachingPlayerId = null;
      }
    }
  });

  ws.on('close', () => {
    leaveCurrentRoom();
  });
});

// 1-second authoritative match, Extraction Anomaly & Vault Breach tick
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.matchEnded) continue;

    room.elapsed += 1;
    if (room.matchRemaining > 0) {
      room.matchRemaining -= 1;
    }

    if (room.gameMode === 'Extraction') {
      room.anomalyRadius = Math.max(24, 96 - room.elapsed * 0.18);

      // Server-side Extraction Flare hold & Anomaly exposure checks
      if (room.flareActive) {
        const site = EXTRACTION_SITES[room.activeSite] || EXTRACTION_SITES[0];
        const anyHolder = Array.from(room.players.values()).some(
          (p) => p.alive && Math.hypot(site.x - p.x, site.z - p.z) < 8.0
        );
        const contested = room.guards.some(
          (g) => g.alive && Math.hypot(g.x - site.x, g.z - site.z) < 15.0
        );
        if (anyHolder && !contested) {
          room.extractProgress = Math.min(EXTRACT_HOLD_TARGET_SEC, room.extractProgress + 1);
        }
      }

      if (room.matchRemaining <= 0) {
        room.matchEnded = true;
        broadcast(room, { type: 'match_over', reason: 'EXTRACTION_WINDOW_CLOSED', winnerId: null });
      } else {
        broadcast(room, {
          type: 'extraction_tick',
          matchRemaining: room.matchRemaining,
          elapsed: room.elapsed,
          anomalyRadius: room.anomalyRadius,
          activeSite: room.activeSite,
          flareActive: room.flareActive,
          extractProgress: room.extractProgress
        });
      }
      continue;
    }

    // Legacy Arena tick
    if (room.breachingPlayerId) {
      const breacher = room.players.get(room.breachingPlayerId);
      if (breacher && breacher.alive && Math.hypot(breacher.x, breacher.z) <= 5.5) {
        room.breachProgress = Math.min(VAULT_BREACH_TARGET_SEC, room.breachProgress + 1);
      } else {
        room.breachingPlayerId = null;
      }
    } else if (room.breachProgress > 0) {
      room.breachProgress = Math.max(0, room.breachProgress - 0.5);
    }

    if (room.breachProgress >= VAULT_BREACH_TARGET_SEC || room.matchRemaining <= 0) {
      room.matchEnded = true;
      broadcast(room, {
        type: 'match_over',
        reason: room.breachProgress >= VAULT_BREACH_TARGET_SEC ? 'VAULT_BREACHED' : 'TIME_EXPIRED',
        winnerId: room.breachingPlayerId
      });
    } else {
      broadcast(room, {
        type: 'tick',
        matchRemaining: room.matchRemaining,
        breachProgress: room.breachProgress,
        breachingPlayerId: room.breachingPlayerId
      });
    }
  }
}, 1000);

server.listen(PORT, () => {
  console.log(`Zero-Zone Authoritative WebSocket server listening on port ${PORT}`);
});
