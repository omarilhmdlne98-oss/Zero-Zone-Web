export class NetworkClient {
  constructor(onMessage, onStatus, onOffline) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.onOffline = onOffline;
    this.ws = null;
    this.url = '';
    this.roomId = 'alpha';
    this.kit = 'vanguard';
    this.playerId = localStorage.getItem('zz_player_id') || '';
    this.shouldReconnect = false;
    this.connected = false;
    this._connectTimer = null;
  }

  connect(url, roomId, kit) {
    this.url = (url || '').trim();
    this.roomId = roomId;
    this.kit = kit;
    this.connected = false;

    if (!this.url) {
      this.shouldReconnect = false;
      this.onStatus?.('Solo / AI Bot Arena');
      this.onOffline?.();
      return;
    }

    this.shouldReconnect = true;
    this._open(false);
  }

  _clearTimers() {
    if (this._connectTimer) {
      clearTimeout(this._connectTimer);
      this._connectTimer = null;
    }
  }

  _open(isRejoin) {
    this._clearTimers();
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
    this.onStatus?.(`Connecting to ${this.url}...`);
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.onStatus?.('Server unreachable — Solo / AI Bot Arena');
      this.onOffline?.();
      return;
    }

    this._connectTimer = setTimeout(() => {
      if (!this.connected) {
        this.onStatus?.('Server timeout — Solo / AI Bot Arena');
        this.onOffline?.();
      }
    }, 1800);

    this.ws.onopen = () => {
      this.connected = true;
      this._clearTimers();
      this.send({
        type: isRejoin ? 'rejoin' : 'join',
        roomId: this.roomId,
        kit: this.kit,
        playerId: this.playerId || undefined
      });
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'welcome' && msg.playerId) {
          this.playerId = msg.playerId;
          localStorage.setItem('zz_player_id', this.playerId);
        }
        this.onMessage(msg);
      } catch {}
    };

    this.ws.onclose = () => {
      this._clearTimers();
      this.connected = false;
      this.onStatus?.('Disconnected — Solo / AI Bot Arena');
      this.onOffline?.();
      if (this.shouldReconnect) {
        setTimeout(() => this._open(true), 4000);
      }
    };

    this.ws.onerror = () => {
      this._clearTimers();
      this.connected = false;
      this.onStatus?.('Server unreachable — Solo / AI Bot Arena');
      this.onOffline?.();
    };
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}
