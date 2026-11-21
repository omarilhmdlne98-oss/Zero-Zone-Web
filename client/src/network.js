export class NetworkClient {
  constructor(onMessage, onStatus) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.ws = null;
    this.url = '';
    this.roomId = 'alpha';
    this.kit = 'vanguard';
    this.playerId = localStorage.getItem('zz_player_id') || '';
    this.shouldReconnect = false;
  }

  connect(url, roomId, kit) {
    this.url = url;
    this.roomId = roomId;
    this.kit = kit;
    this.shouldReconnect = true;
    this._open(false);
  }

  _open(isRejoin) {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
    this.onStatus(`Connecting to ${this.url}...`);
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.onStatus('Offline / Local Arena Mode');
      return;
    }

    this.ws.onopen = () => {
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
      this.onStatus('Disconnected — retrying...');
      if (this.shouldReconnect) {
        setTimeout(() => this._open(true), 2500);
      }
    };

    this.ws.onerror = () => {
      this.onStatus('Server unreachable — running Local Arena Mode');
    };
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}
