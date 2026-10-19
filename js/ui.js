// Canvas UI kit: text, panels, icons and chunky animated buttons.
import { PAL, paintParcel } from './art.js';
import { FONT, roundRect, shade, rgba, ease, clamp, TAU, damp } from './util.js';
import { Sound } from './audio.js';

export function font(size) {
  return `${Math.round(size)}px ${FONT}`;
}

export function text(ctx, str, x, y, size, o = {}) {
  ctx.font = font(size);
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.baseline || 'middle';
  const sw = o.sw ?? Math.max(2, size * 0.16);
  const base = ctx.globalAlpha;
  ctx.globalAlpha = base * (o.alpha ?? 1);
  ctx.lineJoin = 'round';
  if (o.stroke !== false) {
    if (o.drop !== false) {
      ctx.strokeStyle = o.stroke || PAL.ink;
      ctx.lineWidth = sw;
      ctx.fillStyle = o.stroke || PAL.ink;
      ctx.strokeText(str, x, y + size * 0.09);
      ctx.fillText(str, x, y + size * 0.09);
    }
    ctx.strokeStyle = o.stroke || PAL.ink;
    ctx.lineWidth = sw;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = o.color || PAL.cream;
  ctx.fillText(str, x, y);
  ctx.globalAlpha = base;
}

export function measure(ctx, str, size) {
  ctx.font = font(size);
  return ctx.measureText(str).width;
}

// Shrink a font size until the string fits in maxW.
export function fit(ctx, str, size, maxW) {
  const w = measure(ctx, str, size);
  return w > maxW ? size * (maxW / w) : size;
}

export function panel(ctx, x, y, w, h, u, o = {}) {
  const r = o.r ?? 22 * u;
  ctx.fillStyle = rgba(PAL.ink, 0.3);
  roundRect(ctx, x + 3 * u, y + 7 * u, w, h, r);
  ctx.fill();
  ctx.fillStyle = PAL.ink;
  roundRect(ctx, x - 3 * u, y - 3 * u, w + 6 * u, h + 6 * u, r + 3 * u);
  ctx.fill();
  ctx.fillStyle = o.color || PAL.cream;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  if (o.header) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = o.header;
    ctx.fillRect(x, y, w, o.headerH);
    ctx.fillStyle = rgba('#ffffff', 0.18);
    ctx.fillRect(x, y, w, o.headerH * 0.45);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Icons (centred at x, y; s = size)
// ---------------------------------------------------------------------------

function circ(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

export function icon(ctx, name, x, y, s, color = PAL.cream, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const ink = o.ink || PAL.ink;
  const lw = Math.max(2, s * 0.13);
  switch (name) {
    case 'coin': {
      circ(ctx, 0, s * 0.04, s * 0.48); ctx.fillStyle = shade(PAL.sun, -0.35); ctx.fill();
      circ(ctx, 0, 0, s * 0.48); ctx.fillStyle = ink; ctx.fill();
      circ(ctx, 0, 0, s * 0.4); ctx.fillStyle = PAL.sun; ctx.fill();
      circ(ctx, 0, 0, s * 0.27); ctx.fillStyle = shade(PAL.sun, -0.15); ctx.fill();
      ctx.fillStyle = shade(PAL.sun, 0.45);
      ctx.fillRect(-s * 0.06, -s * 0.18, s * 0.12, s * 0.36);
      circ(ctx, -s * 0.2, -s * 0.2, s * 0.07); ctx.fillStyle = '#fff'; ctx.fill();
      break;
    }
    case 'clock': {
      circ(ctx, 0, 0, s * 0.48); ctx.fillStyle = ink; ctx.fill();
      circ(ctx, 0, 0, s * 0.38); ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.24); ctx.moveTo(0, 0); ctx.lineTo(s * 0.17, s * 0.08); ctx.stroke();
      ctx.fillStyle = ink; ctx.fillRect(-s * 0.1, -s * 0.62, s * 0.2, s * 0.12);
      break;
    }
    case 'box':
    case 'boxEmpty': {
      if (name === 'box') paintParcel(ctx, 0, 0, s * 0.92, s * 0.8, o.kind || 'normal');
      else {
        ctx.strokeStyle = rgba(PAL.cream, 0.55); ctx.lineWidth = Math.max(1.5, s * 0.08);
        ctx.setLineDash([s * 0.12, s * 0.08]);
        roundRect(ctx, -s * 0.42, -s * 0.36, s * 0.84, s * 0.72, s * 0.08); ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }
    case 'pause': {
      ctx.fillStyle = color;
      roundRect(ctx, -s * 0.3, -s * 0.34, s * 0.2, s * 0.68, s * 0.06); ctx.fill();
      roundRect(ctx, s * 0.1, -s * 0.34, s * 0.2, s * 0.68, s * 0.06); ctx.fill();
      break;
    }
    case 'play': {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(-s * 0.26, -s * 0.36); ctx.lineTo(s * 0.38, 0); ctx.lineTo(-s * 0.26, s * 0.36); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = lw * 0.8; ctx.stroke();
      break;
    }
    case 'gear': {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU, r = i % 2 ? s * 0.34 : s * 0.46;
        const a2 = a + TAU / 32;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
      }
      ctx.closePath(); ctx.fill();
      circ(ctx, 0, 0, s * 0.15); ctx.fillStyle = o.bg || ink; ctx.fill();
      break;
    }
    case 'wrench': {
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = color;
      roundRect(ctx, -s * 0.09, -s * 0.15, s * 0.18, s * 0.62, s * 0.08); ctx.fill();
      circ(ctx, 0, -s * 0.28, s * 0.22); ctx.fill();
      ctx.fillStyle = o.bg || ink;
      roundRect(ctx, -s * 0.07, -s * 0.56, s * 0.14, s * 0.26, s * 0.03); ctx.fill();
      break;
    }
    case 'music': {
      ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(-s * 0.12, s * 0.22); ctx.lineTo(-s * 0.12, -s * 0.34); ctx.lineTo(s * 0.3, -s * 0.42); ctx.lineTo(s * 0.3, s * 0.14); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-s * 0.22, s * 0.24, s * 0.14, s * 0.11, -0.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.2, s * 0.16, s * 0.14, s * 0.11, -0.4, 0, TAU); ctx.fill();
      if (o.off) { ctx.strokeStyle = PAL.coral; ctx.lineWidth = lw * 1.2; ctx.beginPath(); ctx.moveTo(-s * 0.42, -s * 0.42); ctx.lineTo(s * 0.42, s * 0.42); ctx.stroke(); }
      break;
    }
    case 'sound': {
      ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.12); ctx.lineTo(-s * 0.2, -s * 0.12); ctx.lineTo(s * 0.04, -s * 0.34); ctx.lineTo(s * 0.04, s * 0.34); ctx.lineTo(-s * 0.2, s * 0.12); ctx.lineTo(-s * 0.4, s * 0.12); ctx.closePath(); ctx.fill();
      if (o.off) {
        ctx.strokeStyle = PAL.coral; ctx.lineWidth = lw * 1.2;
        ctx.beginPath(); ctx.moveTo(s * 0.16, -s * 0.16); ctx.lineTo(s * 0.44, s * 0.16); ctx.moveTo(s * 0.44, -s * 0.16); ctx.lineTo(s * 0.16, s * 0.16); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(s * 0.08, 0, s * 0.2, -0.9, 0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(s * 0.08, 0, s * 0.36, -0.9, 0.9); ctx.stroke();
      }
      break;
    }
    case 'back': {
      ctx.strokeStyle = color; ctx.lineWidth = lw * 1.3;
      ctx.beginPath(); ctx.moveTo(s * 0.3, 0); ctx.lineTo(-s * 0.28, 0); ctx.moveTo(-s * 0.05, -s * 0.26); ctx.lineTo(-s * 0.3, 0); ctx.lineTo(-s * 0.05, s * 0.26); ctx.stroke();
      break;
    }
    case 'restart': {
      ctx.strokeStyle = color; ctx.lineWidth = lw * 1.2;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.3, -0.4, Math.PI * 1.45); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(s * 0.18, -s * 0.38); ctx.lineTo(s * 0.42, -s * 0.16); ctx.lineTo(s * 0.12, -s * 0.06); ctx.closePath(); ctx.fill();
      break;
    }
    case 'home': {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.02); ctx.lineTo(0, -s * 0.4); ctx.lineTo(s * 0.4, -s * 0.02); ctx.closePath(); ctx.fill();
      roundRect(ctx, -s * 0.28, -s * 0.06, s * 0.56, s * 0.42, s * 0.05); ctx.fill();
      ctx.fillStyle = o.bg || ink; roundRect(ctx, -s * 0.08, s * 0.1, s * 0.16, s * 0.26, s * 0.03); ctx.fill();
      break;
    }
    case 'house': {
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.moveTo(-s * 0.48, 0); ctx.lineTo(0, -s * 0.46); ctx.lineTo(s * 0.48, 0); ctx.closePath(); ctx.fill();
      roundRect(ctx, -s * 0.36, -s * 0.06, s * 0.72, s * 0.5, s * 0.06); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(-s * 0.36, -s * 0.04); ctx.lineTo(0, -s * 0.36); ctx.lineTo(s * 0.36, -s * 0.04); ctx.closePath(); ctx.fill();
      ctx.fillStyle = PAL.cream;
      roundRect(ctx, -s * 0.27, -s * 0.02, s * 0.54, s * 0.38, s * 0.04); ctx.fill();
      ctx.fillStyle = color; roundRect(ctx, -s * 0.08, s * 0.1, s * 0.16, s * 0.26, s * 0.03); ctx.fill();
      break;
    }
    case 'depot': {
      ctx.fillStyle = ink;
      roundRect(ctx, -s * 0.46, -s * 0.36, s * 0.92, s * 0.76, s * 0.08); ctx.fill();
      ctx.fillStyle = PAL.sun;
      roundRect(ctx, -s * 0.36, -s * 0.06, s * 0.72, s * 0.38, s * 0.04); ctx.fill();
      ctx.fillStyle = ink;
      for (let i = 0; i < 3; i++) ctx.fillRect(-s * 0.36, s * 0.02 + i * s * 0.11, s * 0.72, s * 0.04);
      ctx.fillStyle = PAL.cream;
      ctx.fillRect(-s * 0.36, -s * 0.28, s * 0.72, s * 0.12);
      break;
    }
    case 'check': {
      ctx.strokeStyle = color; ctx.lineWidth = lw * 1.4;
      ctx.beginPath(); ctx.moveTo(-s * 0.3, 0); ctx.lineTo(-s * 0.08, s * 0.22); ctx.lineTo(s * 0.32, -s * 0.24); ctx.stroke();
      break;
    }
    case 'lock': {
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(0, -s * 0.1, s * 0.2, Math.PI, 0); ctx.lineTo(s * 0.2, 0); ctx.moveTo(-s * 0.2, 0); ctx.lineTo(-s * 0.2, -s * 0.1); ctx.stroke();
      ctx.fillStyle = color; roundRect(ctx, -s * 0.3, -s * 0.04, s * 0.6, s * 0.44, s * 0.08); ctx.fill();
      ctx.fillStyle = o.bg || ink; circ(ctx, 0, s * 0.16, s * 0.06); ctx.fill();
      break;
    }
    case 'star': {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * TAU, r = i % 2 ? s * 0.22 : s * 0.5;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'speed': {
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(0, s * 0.1, s * 0.4, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.lineWidth = lw * 1.2;
      ctx.beginPath(); ctx.moveTo(0, s * 0.1); ctx.lineTo(s * 0.26, -s * 0.16); ctx.stroke();
      ctx.fillStyle = color; circ(ctx, 0, s * 0.1, s * 0.09); ctx.fill();
      break;
    }
    case 'wheel': {
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      circ(ctx, 0, 0, s * 0.38); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.38, 0); ctx.lineTo(s * 0.38, 0); ctx.moveTo(0, 0); ctx.lineTo(0, s * 0.38); ctx.stroke();
      ctx.fillStyle = color; circ(ctx, 0, 0, s * 0.1); ctx.fill();
      break;
    }
    case 'cargo': {
      paintParcel(ctx, -s * 0.2, s * 0.16, s * 0.4, s * 0.34, 'normal');
      paintParcel(ctx, s * 0.22, s * 0.16, s * 0.4, s * 0.34, 'normal');
      paintParcel(ctx, 0, -s * 0.2, s * 0.4, s * 0.34, 'normal');
      break;
    }
    case 'target': {
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      circ(ctx, 0, 0, s * 0.4); ctx.stroke();
      circ(ctx, 0, 0, s * 0.22); ctx.stroke();
      ctx.fillStyle = color; circ(ctx, 0, 0, s * 0.08); ctx.fill();
      break;
    }
    case 'stopwatch': {
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      circ(ctx, 0, s * 0.06, s * 0.36); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, s * 0.06); ctx.lineTo(0, -s * 0.14); ctx.stroke();
      ctx.fillStyle = color; ctx.fillRect(-s * 0.1, -s * 0.46, s * 0.2, s * 0.12);
      break;
    }
    case 'ad': {
      ctx.fillStyle = color;
      roundRect(ctx, -s * 0.46, -s * 0.32, s * 0.92, s * 0.64, s * 0.12); ctx.fill();
      ctx.fillStyle = o.bg || ink;
      ctx.beginPath(); ctx.moveTo(-s * 0.12, -s * 0.18); ctx.lineTo(s * 0.2, 0); ctx.lineTo(-s * 0.12, s * 0.18); ctx.closePath(); ctx.fill();
      break;
    }
    case 'arrow': {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(s * 0.5, 0); ctx.lineTo(-s * 0.2, -s * 0.38); ctx.lineTo(-s * 0.06, 0); ctx.lineTo(-s * 0.2, s * 0.38); ctx.closePath(); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export class Button {
  constructor(o) {
    Object.assign(this, {
      x: 0, y: 0, w: 100, h: 50,
      label: '', icon: null, iconOpts: null, color: PAL.coral, textColor: PAL.cream,
      enabled: true, visible: true, delay: 0, sub: null, badge: null, size: null,
      onClick: null, sound: 'click', iconOnly: false,
    }, o);
    this.press = 0;
    this.hover = 0;
    this.pressed = false;
    this.hovered = false;
    this.wobble = 0;
  }

  hit(px, py) {
    return this.visible && px >= this.x - this.w / 2 && px <= this.x + this.w / 2 && py >= this.y - this.h / 2 && py <= this.y + this.h / 2;
  }

  update(dt) {
    this.press = damp(this.press, this.pressed ? 1 : 0, 30, dt);
    this.hover = damp(this.hover, this.hovered && !this.pressed ? 1 : 0, 14, dt);
    this.wobble = Math.max(0, this.wobble - dt * 2.5);
  }

  draw(ctx, t, u, focused) {
    if (!this.visible) return;
    const appear = ease.outBack(clamp((t - this.delay) / 0.4, 0, 1));
    if (appear <= 0) return;
    const { w, h } = this;
    const depth = Math.max(4, h * 0.12);
    const shake = this.wobble > 0 ? Math.sin(this.wobble * 40) * this.wobble * 8 * u : 0;
    ctx.save();
    ctx.translate(this.x + shake, this.y);
    const sc = appear * (1 + this.hover * 0.04 - this.press * 0.04);
    ctx.scale(sc, sc);
    const r = Math.min(h * 0.34, 22 * u);
    const col = this.enabled || this.keepColor ? this.color : '#a7a3b5';
    const pressY = this.press * depth * 0.75;
    if (focused) {
      ctx.strokeStyle = rgba(PAL.cream, 0.6 + 0.4 * Math.sin(t * 6));
      ctx.lineWidth = 4 * u;
      roundRect(ctx, -w / 2 - 7 * u, -h / 2 - 7 * u, w + 14 * u, h + depth + 14 * u, r + 7 * u);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(PAL.ink, 0.28);
    roundRect(ctx, -w / 2 + 2 * u, -h / 2 + depth + 5 * u, w, h, r);
    ctx.fill();
    ctx.fillStyle = PAL.ink;
    roundRect(ctx, -w / 2 - 3 * u, -h / 2 - 3 * u + pressY, w + 6 * u, h + depth + 6 * u - pressY, r + 3 * u);
    ctx.fill();
    ctx.fillStyle = shade(col, -0.32);
    roundRect(ctx, -w / 2, -h / 2 + pressY, w, h + depth - pressY, r);
    ctx.fill();
    ctx.fillStyle = col;
    roundRect(ctx, -w / 2, -h / 2 + pressY, w, h, r);
    ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.22);
    roundRect(ctx, -w / 2 + 5 * u, -h / 2 + pressY + 4 * u, w - 10 * u, h * 0.36, r * 0.7);
    ctx.fill();
    const cy = pressY;
    const fs = this.size || Math.min(h * 0.44, 34 * u);
    if (this.iconOnly && this.icon) {
      icon(ctx, this.icon, 0, cy, h * 0.52, this.textColor, { ...(this.iconOpts || {}), bg: col });
    } else {
      let lw = this.label ? measure(ctx, this.label, fs) : 0;
      const isz = this.icon ? fs * 1.05 : 0;
      const gap = this.icon && this.label ? fs * 0.35 : 0;
      const maxW = w - 24 * u;
      let size = fs;
      if (lw + isz + gap > maxW) {
        size = fs * (maxW - isz - gap) / lw;
        lw = measure(ctx, this.label, size);
      }
      const total = lw + isz + gap;
      let x = -total / 2;
      const ty = this.sub ? cy - h * 0.1 : cy;
      if (this.icon) {
        icon(ctx, this.icon, x + isz / 2, ty, isz, this.textColor, { ...(this.iconOpts || {}), bg: col });
        x += isz + gap;
      }
      if (this.label) text(ctx, this.label, x + lw / 2, ty + size * 0.04, size, { color: this.textColor, sw: Math.max(3, size * 0.2) });
      if (this.sub) text(ctx, this.sub, 0, cy + h * 0.28, fs * 0.52, { color: this.textColor, sw: Math.max(2, fs * 0.12), drop: false });
    }
    if (this.badge) {
      const bw = measure(ctx, this.badge, 15 * u) + 14 * u;
      ctx.fillStyle = PAL.ink;
      roundRect(ctx, w / 2 - bw * 0.8, -h / 2 - 12 * u + pressY, bw, 22 * u, 11 * u);
      ctx.fill();
      ctx.fillStyle = PAL.sun;
      roundRect(ctx, w / 2 - bw * 0.8 + 2 * u, -h / 2 - 10 * u + pressY, bw - 4 * u, 18 * u, 9 * u);
      ctx.fill();
      text(ctx, this.badge, w / 2 - bw * 0.3, -h / 2 - 1 * u + pressY, 14 * u, { color: PAL.ink, stroke: false });
    }
    ctx.restore();
  }
}

export class ButtonGroup {
  constructor() {
    this.buttons = [];
    this.focus = -1;
    this.active = new Map();
  }

  add(b) {
    this.buttons.push(b);
    return b;
  }

  clear() {
    this.buttons.length = 0;
    this.focus = -1;
    this.active.clear();
  }

  update(dt) {
    for (const b of this.buttons) b.update(dt);
  }

  draw(ctx, t, u, showFocus) {
    this.t = t;
    this.buttons.forEach((b, i) => b.draw(ctx, t, u, showFocus && i === this.focus));
  }

  // Buttons only accept input once they have animated in.
  ready(b) {
    return b.visible && (this.t === undefined || this.t >= b.delay + 0.1);
  }

  pointerDown(p) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (b.hit(p.x, p.y) && this.ready(b)) {
        b.pressed = true;
        this.active.set(p.id, b);
        return true;
      }
    }
    return false;
  }

  pointerMove(p) {
    if (p.type === 'mouse') {
      for (const b of this.buttons) b.hovered = b.hit(p.x, p.y);
    }
    const b = this.active.get(p.id);
    if (b) b.pressed = b.hit(p.x, p.y);
  }

  pointerUp(p) {
    const b = this.active.get(p.id);
    this.active.delete(p.id);
    if (!b) return false;
    const inside = b.hit(p.x, p.y);
    b.pressed = false;
    if (inside) this.fire(b);
    return inside;
  }

  cancel() {
    for (const b of this.buttons) b.pressed = false;
    this.active.clear();
  }

  fire(b) {
    if (!this.ready(b)) return;
    if (!b.enabled) {
      b.wobble = 1;
      Sound.denied();
      if (b.onDenied) b.onDenied();
      return;
    }
    if (b.sound === 'click') Sound.click();
    else if (b.sound === 'back') Sound.back();
    if (b.onClick) b.onClick(b);
  }

  // Arrow/Tab navigation and Enter/Space to activate.
  key(code) {
    const vis = this.buttons.map((b, i) => (b.visible ? i : -1)).filter((i) => i >= 0);
    if (!vis.length) return false;
    if (['ArrowDown', 'ArrowRight', 'Tab', 'KeyS', 'KeyD'].includes(code)) {
      const k = vis.indexOf(this.focus);
      this.focus = vis[(k + 1) % vis.length];
      Sound.click();
      return true;
    }
    if (['ArrowUp', 'ArrowLeft', 'KeyW', 'KeyA'].includes(code)) {
      const k = vis.indexOf(this.focus);
      this.focus = vis[(k - 1 + vis.length) % vis.length];
      Sound.click();
      return true;
    }
    if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') {
      // With nothing focused yet, Enter/Space triggers the primary (first visible) button.
      const b = this.buttons[this.focus >= 0 ? this.focus : vis[0]];
      if (b && b.visible) {
        b.press = 1;
        this.fire(b);
        return true;
      }
    }
    return false;
  }
}

// Greedy word wrap.
export function wrap(ctx, str, size, maxW) {
  ctx.font = font(size);
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// A small rounded pill (used for chips and counters).
export function pill(ctx, x, y, w, h, color, u, outline = true) {
  const r = h / 2;
  if (outline) {
    ctx.fillStyle = rgba(PAL.ink, 0.25);
    roundRect(ctx, x + 2 * u, y + 4 * u, w, h, r);
    ctx.fill();
    ctx.fillStyle = PAL.ink;
    roundRect(ctx, x - 3 * u, y - 3 * u, w + 6 * u, h + 6 * u, r + 3 * u);
    ctx.fill();
  }
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.16);
  roundRect(ctx, x + 4 * u, y + 3 * u, w - 8 * u, h * 0.38, r * 0.6);
  ctx.fill();
}
