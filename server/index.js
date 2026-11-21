import http from 'http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8080);
const MATCH_DURATION_SEC = 300; // 5-minute match timer
const VAULT_BREACH_TARGET_SEC = 20; // 20-second Vault Breach event
const RESPAWN_DELAY_MS = 3000;

const KIT_MAX_HP = { vanguard: 100, spectre: 90, juggernaut: 150 };
const KIT_MAX_SHIELD = { vanguard: 50, spectre: 40, juggernaut: 100 };
const HIT_ZONE_MULTIPLIERS = { head: 2.2, torso: 1.0, limb: 0.75 };
const WEAPON_DISPLAY_NAMES = {
  rifle: 'VX-47 Assault Rifle',
  railgun: 'XR-9 Railgun',
  shotgun: 'M-12 Heavy Shotgun'
};
const OPERATOR_CLASS_NAMES = {
  vanguard: 'Vanguard',
  spectre: 'Spectre',
  juggernaut: 'Juggernaut'
};

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
  const room = {
    id: roomId,
    roomName: String(options.roomName || roomId).slice(0, 48),
    gameMode: String(options.gameMode || 'Arena').slice(0, 32),
    maxPlayers: Math.max(2, Number(options.maxPlayers) || 10),
    serverAddress: String(options.serverAddress || ''),
    players: new Map(),
    crates: {
      crate_nw: { id: 'crate_nw', hp: 100, destroyed: false },
      crate_ne: { id: 'crate_ne', hp: 100, destroyed: false },
      crate_sw: { id: 'crate_sw', hp: 100, destroyed: false },
      crate_se: { id: 'crate_se', hp: 100, destroyed: false }
    },
    matchRemaining: MATCH_DURATION_SEC,
    breachProgress: 0,
    breachingPlayerId: null,
    matchEnded: false
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
    // Web client fields
    id: player.id,
    x: player.x,
    y: player.y,
    z: player.z,
    ry: player.ry,
    weapon: player.weaponId,
    // UE5 C++ UZeroZoneWebSocketSubsystem fields
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

function serializeRoomState(room) {
  return {
    type: 'room_snapshot',
    roomId: room.id,
    matchRemaining: room.matchRemaining,
    breachProgress: room.breachProgress,
    breachingPlayerId: room.breachingPlayerId,
    matchEnded: room.matchEnded,
    crates: Object.values(room.crates),
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      kit: p.kit,
      operatorClass: toOperatorClass(p.kit),
      hp: p.hp,
      maxHp: p.maxHp,
      shield: p.shield,
      alive: p.alive,
      score: p.score,
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
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Zero-Zone WebSocket Multiplayer Server');
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

  function leaveCurrentRoom() {
    if (!currentRoom || !playerId) return;
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

    const maxHp = KIT_MAX_HP[kit];
    const existing = room.players.get(playerId);
    const player = existing
      ? { ...existing, ws, kit, maxHp, hp: Math.min(existing.hp, maxHp) }
      : {
          id: playerId,
          ws,
          kit,
          hp: maxHp,
          maxHp,
          shield: 50,
          alive: true,
          score: 0,
          x: (Math.random() - 0.5) * 10,
          y: 1.5,
          z: 10,
          ry: 0,
          pitch: 0,
          yaw: 0,
          roll: 0,
          isFiring: false,
          isAbilityActive: false,
          lastFireAt: 0
        };

    room.players.set(playerId, player);
    ws.send(JSON.stringify({ type: 'welcome', playerId, roomId: room.id, ...serializeRoomState(room) }));
    broadcast(
      room,
      {
        type: 'player_joined',
        player: {
          id: player.id,
          kit: player.kit,
          operatorClass: toOperatorClass(player.kit),
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
    if (dist > 85) return; // sanity range check
    const dmg = Math.min(40, Math.max(10, Number(rawDamage) || 22));
    target.hp = Math.max(0, target.hp - dmg);
    broadcast(room, { type: 'player_damaged', id: target.id, hp: target.hp, by: attacker.id });
    broadcast(room, {
      type: 'combat_event',
      event: 'damage',
      playerId: attacker.id,
      targetId: target.id,
      value: dmg
    });
    if (target.hp === 0) {
      target.alive = false;
      attacker.score += 1;
      broadcast(room, { type: 'player_eliminated', id: target.id, by: attacker.id, score: attacker.score });
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

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
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

    // --- UE5 operator_select ---
    if (data.type === 'operator_select') {
      const kit = normalizeKit(data.operatorClass || data.kit);
      pendingKit = kit;
      if (data.playerId) {
        pendingPlayerId = String(data.playerId);
      }
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

    // Auto-join default room if UE5 sends player_state or combat_event directly after Connect()
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
      if (Number.isFinite(Number(data.shield))) {
        player.shield = Number(data.shield);
      }
      player.isFiring = Boolean(data.isFiring);
      player.isAbilityActive = Boolean(data.isAbilityActive);
      player.isADS = Boolean(data.isADS);
      player.isCrouching = Boolean(data.isCrouching);
      player.leanAngle = Number(data.leanAngle) || 0;
      broadcast(currentRoom, serializePlayerState(player), playerId);
    } else if (data.type === 'fire' && player.alive) {
      const now = Date.now();
      if (now - player.lastFireAt < 95) return; // server fire-rate guard
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

// 1-second authoritative match & Vault Breach tick
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.matchEnded) continue;

    if (room.matchRemaining > 0) {
      room.matchRemaining -= 1;
    }

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
  console.log(`Zero-Zone WebSocket server listening on port ${PORT}`);
});
