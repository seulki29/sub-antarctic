import { VIEW_W, VIEW_H } from './constants.js';

export function stickVector(ox, oy, x, y, r = 26) {
  const dx = x - ox, dy = y - oy;
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return { x: 0, y: 0, len: 0 };
  return { x: dx / d, y: dy / d, len: Math.min(d / r, 1) };
}

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'boost', ShiftRight: 'boost',
};

export class Input {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.aim = { x: 1, y: 0 };
    this.firing = false;
    this.boost = false;
    this.touchMode = false;
    this.pointer = { x: 0, y: 0, clicked: false };
    this.sticks = { left: null, right: null };
    this._keys = new Set();
    this._mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false };
    this._playerScreen = { x: VIEW_W / 2, y: VIEW_H / 2 };
    this._touches = new Map(); // id -> {side, ox, oy, x, y}
    this._clickQueue = false;
  }

  attach(canvas) {
    this._canvas = canvas;
    const toView = (cx, cy) => {
      const r = canvas.getBoundingClientRect();
      return { x: (cx - r.left) / r.width * VIEW_W, y: (cy - r.top) / r.height * VIEW_H };
    };
    window.addEventListener('keydown', e => { if (KEYMAP[e.code]) { this._keys.add(KEYMAP[e.code]); e.preventDefault(); } });
    window.addEventListener('keyup', e => { if (KEYMAP[e.code]) this._keys.delete(KEYMAP[e.code]); });
    canvas.addEventListener('mousemove', e => Object.assign(this._mouse, toView(e.clientX, e.clientY)));
    canvas.addEventListener('mousedown', e => { this._mouse.down = true; this._clickQueue = true; Object.assign(this._mouse, toView(e.clientX, e.clientY)); });
    window.addEventListener('mouseup', () => { this._mouse.down = false; });
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      this.touchMode = true;
      for (const t of e.changedTouches) {
        const p = toView(t.clientX, t.clientY);
        const side = p.x < VIEW_W / 2 ? 'left' : 'right';
        if ([...this._touches.values()].some(v => v.side === side)) continue;
        this._touches.set(t.identifier, { side, ox: p.x, oy: p.y, x: p.x, y: p.y });
        this._clickQueue = true;
        Object.assign(this.pointer, p);
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const v = this._touches.get(t.identifier);
        if (v) Object.assign(v, toView(t.clientX, t.clientY));
      }
    }, { passive: false });
    const endTouch = e => {
      e.preventDefault(); // block synthesized mouse events double-firing clicks
      for (const t of e.changedTouches) this._touches.delete(t.identifier);
    };
    canvas.addEventListener('touchend', endTouch, { passive: false });
    canvas.addEventListener('touchcancel', endTouch, { passive: false });
  }

  setPlayerScreen(x, y) { this._playerScreen = { x, y }; }

  update() {
    this.pointer.clicked = this._clickQueue;
    this._clickQueue = false;
    if (!this.touchMode) {
      const k = this._keys;
      this.move = {
        x: (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0),
        y: (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0),
      };
      const len = Math.hypot(this.move.x, this.move.y);
      if (len > 1) { this.move.x /= len; this.move.y /= len; }
      const a = stickVector(this._playerScreen.x, this._playerScreen.y, this._mouse.x, this._mouse.y, 1);
      if (a.len > 0) this.aim = { x: a.x, y: a.y };
      this.firing = this._mouse.down;
      this.boost = k.has('boost');
      Object.assign(this.pointer, { x: this._mouse.x, y: this._mouse.y });
    } else {
      this.sticks.left = this.sticks.right = null;
      this.move = { x: 0, y: 0 };
      this.firing = false;
      let leftV = null;
      for (const v of this._touches.values()) {
        const s = stickVector(v.ox, v.oy, v.x, v.y);
        if (v.side === 'left') { this.move = { x: s.x * s.len, y: s.y * s.len }; this.sticks.left = v; leftV = s; }
        else {
          if (s.len > 0.15) this.aim = { x: s.x, y: s.y };
          this.firing = s.len > 0.35;
          this.sticks.right = v;
        }
      }
      // boost: left stick fully deflected
      this.boost = !!leftV && leftV.len >= 0.98;
    }
  }

  consumeClick() {
    const c = this.pointer.clicked;
    this.pointer.clicked = false;
    return c;
  }
}
