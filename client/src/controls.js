export class DualControls {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = -0.15;
    this.firePressed = false;
    this.jumpPressed = false;
    this.abilityPressed = false;
    this.breachHeld = false;
    this.moveVec = { x: 0, y: 0 };
    this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    this._bindKeyboardMouse();
    if (this.isTouch) this._bindTouch();
  }

  _bindKeyboardMouse() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') this.jumpPressed = true;
      if (e.code === 'KeyE') this.abilityPressed = true;
      if (e.code === 'KeyF') this.breachHeld = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyF') this.breachHeld = false;
    });

    this.canvas.addEventListener('click', () => {
      if (!this.isTouch && document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock?.();
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.yaw -= e.movementX * 0.0024;
        this.pitch = Math.max(-0.75, Math.min(0.45, this.pitch - e.movementY * 0.0024));
      }
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && document.pointerLockElement === this.canvas) {
        this.firePressed = true;
      }
    });
  }

  _bindTouch() {
    const touchRoot = document.getElementById('touch-controls');
    if (touchRoot) touchRoot.style.display = 'block';

    const bindStick = (zoneId, knobId, onMove) => {
      const zone = document.getElementById(zoneId);
      const knob = document.getElementById(knobId);
      if (!zone || !knob) return;
      let activeId = null;

      const update = (clientX, clientY) => {
        const rect = zone.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const maxR = rect.width * 0.36;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const len = Math.hypot(dx, dy);
        if (len > maxR) {
          dx = (dx / len) * maxR;
          dy = (dy / len) * maxR;
        }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        onMove(dx / maxR, dy / maxR);
      };

      zone.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        activeId = t.identifier;
        update(t.clientX, t.clientY);
      }, { passive: true });
      zone.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === activeId) update(t.clientX, t.clientY);
        }
      }, { passive: true });
      const reset = () => {
        activeId = null;
        knob.style.transform = 'translate(-50%, -50%)';
        onMove(0, 0);
      };
      zone.addEventListener('touchend', reset);
      zone.addEventListener('touchcancel', reset);
    };

    bindStick('joy-move', 'knob-move', (nx, ny) => {
      this.moveVec.x = nx;
      this.moveVec.y = ny;
    });
    bindStick('joy-look', 'knob-look', (nx, ny) => {
      this.yaw -= nx * 0.045;
      this.pitch = Math.max(-0.75, Math.min(0.45, this.pitch - ny * 0.035));
    });

    const btnFire = document.getElementById('t-fire');
    const btnJump = document.getElementById('t-jump');
    const btnAbility = document.getElementById('t-ability');
    const btnBreach = document.getElementById('t-breach');
    btnFire?.addEventListener('touchstart', () => { this.firePressed = true; }, { passive: true });
    btnJump?.addEventListener('touchstart', () => { this.jumpPressed = true; }, { passive: true });
    btnAbility?.addEventListener('touchstart', () => { this.abilityPressed = true; }, { passive: true });
    btnBreach?.addEventListener('touchstart', () => { this.breachHeld = true; }, { passive: true });
    btnBreach?.addEventListener('touchend', () => { this.breachHeld = false; }, { passive: true });
  }

  getMoveInput() {
    let x = this.moveVec.x;
    let z = this.moveVec.y;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    return { x, z, sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') };
  }

  consumeActions() {
    const out = {
      fire: this.firePressed,
      jump: this.jumpPressed,
      ability: this.abilityPressed,
      breach: this.breachHeld
    };
    this.firePressed = false;
    this.jumpPressed = false;
    this.abilityPressed = false;
    return out;
  }
}
