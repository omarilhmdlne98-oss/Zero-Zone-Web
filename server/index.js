import http from 'http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8080);
const MATCH_DURATION_SEC = 300; // 5-minute match timer
const VAULT_BREACH_TARGET_SEC = 20; // 20-second Vault Breach event
const RESPAWN_DELAY_MS = 3000;

const KIT_MAX_HP = { vanguard: 100, spectre: 85, juggernaut: 160 };

const rooms = new Map();

function createRoom(roomId) {
  const room = {
    id: roomId,
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

function getOrCreateRoom(roomId) {
  return rooms.get(roomId) || createRoom(roomId);
}

function broadcast(room, payload, excludeId = null) {
  const msg = JSON.stringify(payload);
  for (const [id, p] of room.players.entries()) {
    if (id !== excludeId && p.ws && p.ws.readyState === 1) {
      p.ws.send(msg);
    }
  }
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
      hp: p.hp,
      maxHp: p.maxHp,
      alive: p.alive,
      score: p.score,
      x: p.x,
      y: p.y,
      z: p.z,
      ry: p.ry
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

wss.on('connection', (ws) => {
  let currentRoom = null;
  let playerId = null;

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (data.type === 'join' || data.type === 'rejoin') {
      const roomId = String(data.roomId || 'alpha').slice(0, 24);
      const kit = KIT_MAX_HP[data.kit] ? data.kit : 'vanguard';
      playerId = String(data.playerId || `op_${Math.random().toString(36).slice(2, 8)}`);
      currentRoom = getOrCreateRoom(roomId);

      const maxHp = KIT_MAX_HP[kit];
      const existing = currentRoom.players.get(playerId);
      const player = existing
        ? { ...existing, ws, kit, maxHp, hp: Math.min(existing.hp, maxHp) }
        : {
            id: playerId,
            ws,
            kit,
            hp: maxHp,
            maxHp,
            alive: true,
            score: 0,
            x: (Math.random() - 0.5) * 10,
            y: 1.5,
            z: 10,
            ry: 0,
            lastFireAt: 0
          };

      currentRoom.players.set(playerId, player);
      ws.send(JSON.stringify({ type: 'welcome', playerId, roomId, ...serializeRoomState(currentRoom) }));
      broadcast(currentRoom, { type: 'player_joined', player: { id: player.id, kit: player.kit, hp: player.hp, maxHp: player.maxHp, alive: player.alive, x: player.x, y: player.y, z: player.z, ry: player.ry } }, playerId);
      return;
    }

    if (!currentRoom || !playerId) return;
    const player = currentRoom.players.get(playerId);
    if (!player) return;

    if (data.type === 'state' && player.alive) {
      player.x = Number(data.x) || 0;
      player.y = Number(data.y) || 0;
      player.z = Number(data.z) || 0;
      player.ry = Number(data.ry) || 0;
      broadcast(currentRoom, { type: 'player_state', id: playerId, x: player.x, y: player.y, z: player.z, ry: player.ry }, playerId);
    } else if (data.type === 'fire' && player.alive) {
      const now = Date.now();
      if (now - player.lastFireAt < 140) return; // server fire-rate guard
      player.lastFireAt = now;
      broadcast(currentRoom, { type: 'player_fired', id: playerId, origin: data.origin, dir: data.dir }, playerId);
    } else if (data.type === 'hit_player' && player.alive) {
      const target = currentRoom.players.get(String(data.targetId));
      if (!target || !target.alive || target.id === playerId) return;
      const dist = Math.hypot(target.x - player.x, target.y - player.y, target.z - player.z);
      if (dist > 85) return; // sanity range check
      const dmg = Math.min(40, Math.max(10, Number(data.damage) || 22));
      target.hp = Math.max(0, target.hp - dmg);
      broadcast(currentRoom, { type: 'player_damaged', id: target.id, hp: target.hp, by: playerId });
      if (target.hp === 0) {
        target.alive = false;
        player.score += 1;
        broadcast(currentRoom, { type: 'player_eliminated', id: target.id, by: playerId, score: player.score });
        setTimeout(() => {
          if (!currentRoom.players.has(target.id)) return;
          target.alive = true;
          target.hp = target.maxHp;
          target.x = (Math.random() - 0.5) * 12;
          target.y = 2.0;
          target.z = 11;
          broadcast(currentRoom, { type: 'player_respawned', id: target.id, hp: target.hp, x: target.x, y: target.y, z: target.z });
        }, RESPAWN_DELAY_MS);
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
    if (currentRoom && playerId) {
      if (currentRoom.breachingPlayerId === playerId) {
        currentRoom.breachingPlayerId = null;
      }
      currentRoom.players.delete(playerId);
      broadcast(currentRoom, { type: 'player_left', id: playerId });
      if (currentRoom.players.size === 0) {
        rooms.delete(currentRoom.id);
      }
    }
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
