export class DualControls {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0.0;
    this.firePressed = false;
    this.fireHeld = false;
    this.adsHeld = false;
    this.jumpPressed = false;
    this.crouchPressed = false;
    this.crouchHeld = false;
    this.abilityPressed = false;
    this.reloadPressed = false;
    this.inspectPressed = false;
    this.breachHeld = false;
    this.weaponSwitch = null;
    this.classSwitch = null;
    this.toggleMenuPressed = false;
    this.moveVec = { x: 0, y: 0 };
    this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    this._touchWeaponIdx = 0;

    this._bindKeyboardMouse();
    if (this.isTouch) this._bindTouch();
  }

  _bindKeyboardMouse() {
    window.addEventListener('keydown', (e) => {
      if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        return;
      }
      this.keys.add(e.code);
      if (e.code === 'Space') this.jumpPressed = true;
      if (e.code === 'KeyC' || e.code === 'ControlLeft') {
        if (!e.repeat) this.crouchPressed = true;
        this.crouchHeld = true;
      }
      if (e.code === 'KeyG' || e.code === 'KeyX') this.abilityPressed = true;
      if (e.code === 'KeyR') this.reloadPressed = true;
      if (e.code === 'KeyI' && !e.repeat) this.inspectPressed = true;
      if (e.code === 'KeyF') this.breachHeld = true;
      if (e.code === 'Digit1') { this.weaponSwitch = 0; this._touchWeaponIdx = 0; }
      if (e.code === 'Digit2') { this.weaponSwitch = 1; this._touchWeaponIdx = 1; }
      if (e.code === 'Digit3') { this.weaponSwitch = 2; this._touchWeaponIdx = 2; }
      if (e.code === 'F1') { e.preventDefault(); this.classSwitch = 'vanguard'; }
      if (e.code === 'F2') { e.preventDefault(); this.classSwitch = 'spectre'; }
      if (e.code === 'F3') { e.preventDefault(); this.classSwitch = 'juggernaut'; }
      if (e.code === 'Tab' && !e.repeat) { e.preventDefault(); this.toggleMenuPressed = true; }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyF') this.breachHeld = false;
      if (e.code === 'KeyC' || e.code === 'ControlLeft') this.crouchHeld = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('click', () => {
      if (!this.isTouch && document.pointerLockElement !== this.canvas) {
        try {
          const req = this.canvas.requestPointerLock?.();
          if (req && typeof req.catch === 'function') {
            req.catch(() => {});
          }
        } catch {}
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) {
        const sens = this.adsHeld ? 0.0014 : 0.0023;
        this.yaw -= e.movementX * sens;
        this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch - e.movementY * sens));
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      if (e.button === 0) {
        this.firePressed = true;
        this.fireHeld = true;
      } else if (e.button === 2) {
        this.adsHeld = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2) this.adsHeld = false;
    });

    window.addEventListener('wheel', (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      this._touchWeaponIdx = (this._touchWeaponIdx + dir + 3) % 3;
      this.weaponSwitch = this._touchWeaponIdx;
    }, { passive: true });
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
      this.yaw -= nx * 0.042;
      this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch - ny * 0.032));
    });

    const btnFire = document.getElementById('t-fire');
    const btnAds = document.getElementById('t-ads');
    const btnJump = document.getElementById('t-jump');
    const btnCrouch = document.getElementById('t-crouch');
    const btnReload = document.getElementById('t-reload');
    const btnWeapon = document.getElementById('t-weapon');
    const btnAbility = document.getElementById('t-ability');
    const btnBreach = document.getElementById('t-breach');

    btnFire?.addEventListener('touchstart', () => { this.firePressed = true; this.fireHeld = true; }, { passive: true });
    btnFire?.addEventListener('touchend', () => { this.fireHeld = false; }, { passive: true });
    btnAds?.addEventListener('touchstart', () => { this.adsHeld = !this.adsHeld; }, { passive: true });
    btnJump?.addEventListener('touchstart', () => { this.jumpPressed = true; }, { passive: true });
    btnCrouch?.addEventListener('touchstart', () => { this.crouchPressed = true; }, { passive: true });
    btnReload?.addEventListener('touchstart', () => { this.reloadPressed = true; }, { passive: true });
    btnWeapon?.addEventListener('touchstart', () => {
      this._touchWeaponIdx = (this._touchWeaponIdx + 1) % 3;
      this.weaponSwitch = this._touchWeaponIdx;
    }, { passive: true });
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

    let lean = 0;
    if (this.keys.has('KeyQ')) lean -= 1;
    if (this.keys.has('KeyE')) lean += 1;

    return {
      x,
      z,
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      lean
    };
  }

  consumeActions() {
    const out = {
      fire: this.firePressed,
      fireHeld: this.fireHeld,
      ads: this.adsHeld,
      jump: this.jumpPressed,
      crouch: this.crouchPressed,
      ability: this.abilityPressed,
      reload: this.reloadPressed,
      inspect: this.inspectPressed,
      breach: this.breachHeld,
      weaponSwitch: this.weaponSwitch,
      classSwitch: this.classSwitch,
      toggleMenu: this.toggleMenuPressed
    };
    this.firePressed = false;
    this.jumpPressed = false;
    this.crouchPressed = false;
    this.abilityPressed = false;
    this.reloadPressed = false;
    this.inspectPressed = false;
    this.weaponSwitch = null;
    this.classSwitch = null;
    this.toggleMenuPressed = false;
    return out;
  }
}
