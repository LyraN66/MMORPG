// Touch joystick + tap-to-target/move + keyboard + zoom.
export class Input {
  constructor(canvas, joyEl, knobEl) {
    this.move = { x: 0, y: 0 };
    this.zoom = 1;
    this.onTap = null; this.onKey = null;
    this.keys = new Set();
    this.joy = null; // {id, ox, oy}
    this.pointers = new Map();
    this.pinch = null;
    this.joyEl = joyEl; this.knobEl = knobEl;
    this.enabled = true;

    canvas.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.moveEv(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('wheel', (e) => { this.zoom = Math.min(1.6, Math.max(0.6, this.zoom + Math.sign(e.deltaY) * 0.08)); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.onKey?.(k);
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(e) {
    if (!this.enabled) return;
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), type: e.pointerType };
    this.pointers.set(e.pointerId, p);
    const touch = e.pointerType !== 'mouse';
    if (touch && !this.joy && e.clientX < innerWidth * 0.5) {
      this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, active: false };
      p.joy = true;
    }
    const free = [...this.pointers.values()].filter((q) => !q.joy);
    if (free.length === 2) {
      const [a, b] = free; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.zoom };
    }
  }
  moveEv(e) {
    const p = this.pointers.get(e.pointerId); if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (p.joy && this.joy) {
      const dx = p.x - this.joy.ox, dy = p.y - this.joy.oy, d = Math.hypot(dx, dy);
      if (!this.joy.active && d > 10) { this.joy.active = true; this.showJoy(true); }
      if (this.joy.active) {
        const R = 55, k = Math.min(1, d / R);
        const nx = d > 0 ? dx / d : 0, ny = d > 0 ? dy / d : 0;
        this.joyVec = { x: nx * k, y: ny * k };
        this.knobEl.style.transform = `translate(${nx * Math.min(d, R)}px, ${ny * Math.min(d, R)}px)`;
      }
    }
    if (this.pinch) {
      const free = [...this.pointers.values()].filter((q) => !q.joy);
      if (free.length === 2) {
        const d = Math.hypot(free[0].x - free[1].x, free[0].y - free[1].y);
        this.zoom = Math.min(1.6, Math.max(0.6, this.pinch.z * this.pinch.d / d));
      }
    }
  }
  up(e) {
    const p = this.pointers.get(e.pointerId); if (!p) return;
    this.pointers.delete(e.pointerId);
    const moved = Math.hypot(p.x - p.sx, p.y - p.sy);
    const quick = performance.now() - p.t < 350;
    if (p.joy) {
      const wasActive = this.joy?.active;
      this.joy = null; this.joyVec = null; this.showJoy(false);
      if (!wasActive && quick && moved < 12) this.onTap?.(p.x, p.y);
      return;
    }
    if (this.pinch) { if ([...this.pointers.values()].filter((q) => !q.joy).length < 2) this.pinch = null; return; }
    if (moved < 14 && (quick || p.type === 'mouse')) this.onTap?.(p.x, p.y);
  }
  showJoy(on) {
    if (on) { this.joyEl.style.left = this.joy.ox + 'px'; this.joyEl.style.top = this.joy.oy + 'px'; this.joyEl.classList.add('on'); }
    else { this.joyEl.classList.remove('on'); this.knobEl.style.transform = ''; }
  }
  update() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y -= 1;
    if (k.has('s') || k.has('arrowdown')) y += 1;
    if (x || y) { const d = Math.hypot(x, y); this.move.x = x / d; this.move.y = y / d; }
    else if (this.joyVec) { this.move.x = this.joyVec.x; this.move.y = this.joyVec.y; }
    else { this.move.x = 0; this.move.y = 0; }
  }
}
