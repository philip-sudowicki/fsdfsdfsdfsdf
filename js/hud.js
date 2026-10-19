// In-game HUD: timer, coins, combo, parcels, throw meter, target arrow,
// floating text, touch controls and the tutorial prompt card.
import { CONFIG } from './config.js';
import { PAL } from './art.js';
import { DEPOT } from './world.js';
import { G, portrait } from './state.js';
import { text, icon, pill, wrap, measure } from './ui.js';
import { textScale } from './fx.js';
import { clamp, ease, roundRect, rgba, shade, mix, TAU, damp } from './util.js';

export function hudLayout() {
  const u = G.u;
  const m = 12 * u;
  const L = {};
  L.top = m + G.safe.t;
  L.left = m + G.safe.l;
  L.right = G.w - m - G.safe.r;
  L.bottom = G.h - m - G.safe.b;
  L.pause = { x: L.right - 26 * u, y: L.top + 26 * u, r: 26 * u };
  L.timer = { x: L.left, y: L.top, w: 122 * u, h: 52 * u };
  L.parcels = { x: L.left + 4 * u, y: L.top + 70 * u, s: 22 * u };
  L.coinsRight = L.pause.x - 40 * u;
  L.throwBtn = { x: L.right - 64 * u, y: L.bottom - 64 * u, r: 60 * u };
  L.brakeBtn = { x: L.throwBtn.x - 118 * u, y: L.bottom - 42 * u, r: 42 * u };
  L.joyHint = { x: L.left + 86 * u, y: L.bottom - 86 * u };
  const port = portrait();
  if (port) {
    L.meter = { cx: G.w / 2, cy: G.h * 0.64, w: Math.min(380 * u, G.w - 48 * u) };
    const w = Math.min(G.w - 28 * u, 460 * u);
    L.prompt = { cx: G.w / 2, y: L.top + 136 * u, w };
  } else {
    const side = G.touchUI ? 200 * u : 60 * u;
    L.meter = { cx: G.w / 2, cy: L.bottom - 40 * u, w: Math.min(400 * u, G.w - side * 2) };
    // Fit between the timer/parcels on the left and the coins/combo on the right.
    const x0 = L.left + 132 * u, x1 = L.right - 250 * u;
    const w = Math.min(x1 - x0, 560 * u);
    L.prompt = { cx: (x0 + x1) / 2, y: L.top + 62 * u, w };
  }
  return L;
}

export class HUD {
  constructor() {
    this.coinsShown = 0;
    this.layout();
    this.introT = 0;
    this.comboK = 0;
    this.lastCombo = 1;
    this.specialK = 0;
    this.special = null;
  }

  layout() {
    this.L = hudLayout();
  }

  update(dt, shift) {
    this.coinsShown = damp(this.coinsShown, shift.coins, 8, dt);
    if (Math.abs(this.coinsShown - shift.coins) < 0.5) this.coinsShown = shift.coins;
    this.introT += dt;
    const comboOn = shift.combo >= 1;
    if (comboOn) this.lastCombo = shift.combo;
    this.comboK = clamp(this.comboK + (comboOn ? dt : -dt) / 0.25, 0, 1);
    this.comboOn = comboOn;
    const p = shift.target;
    const sp = p && p.house && (p.kind === 'express' || p.kind === 'fragile') ? p : null;
    // Keep a snapshot so the chip can animate out after the special ends.
    if (sp) this.special = { kind: sp.kind, expressT: sp.expressT, damage: sp.damage };
    this.specialOn = !!sp;
    this.specialK = clamp(this.specialK + (sp ? dt : -dt) / 0.25, 0, 1);
    this.readyK = damp(this.readyK || 0, shift.meter.inRange ? 1 : 0, 12, dt);
    this.updatePrompt(dt, shift);
  }

  // Grow with a bounce, shrink smoothly.
  popScale(k, on) {
    return on ? ease.outBack(k) : ease.outCubic(k);
  }

  draw(ctx, shift, r, t, joy) {
    this.drawTarget(ctx, shift, r, t);
    this.drawTexts(ctx, shift, r);
    if (shift.state === 'over') {
      if (this.hideStart === undefined) this.hideStart = G.time;
      this.hide = clamp((G.time - this.hideStart) / 0.3, 0, 1);
      if (this.hide >= 1) return;
    }
    ctx.globalAlpha = 1 - (this.hide || 0);
    // Slide the HUD in from the edges when the shift begins.
    const intro = 1 - ease.outBack(clamp(this.introT / 0.55, 0, 1));
    const slide = intro * 280 * G.u;
    ctx.save();
    ctx.translate(-slide, 0);
    this.drawTimer(ctx, shift, t);
    this.drawParcels(ctx, shift, t);
    ctx.restore();
    ctx.save();
    ctx.translate(slide, 0);
    this.drawCoins(ctx, shift, t);
    ctx.restore();
    this.drawMeter(ctx, shift, t);
    ctx.save();
    ctx.translate(0, slide);
    if (G.touchUI && shift.state === 'play') this.drawTouch(ctx, shift, t, joy);
    else if (G.touchUI) this.drawTouch(ctx, shift, t, null, 0.4 * (1 - (this.hide || 0)));
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawTimer(ctx, shift, t) {
    const { x, y, w, h } = this.L.timer;
    const u = G.u;
    const low = shift.time <= CONFIG.shift.lowTime && shift.state === 'play';
    const sc = 1 + shift.hud.warn * 0.12 + shift.hud.timePop * 0.06;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(sc, sc);
    const col = low ? (Math.sin(t * 12) > 0 ? PAL.coral : shade(PAL.coral, -0.2)) : PAL.ink;
    pill(ctx, -w / 2, -h / 2, w, h, col, u);
    if (!low) {
      ctx.fillStyle = shade(PAL.ink, 0.12);
      roundRect(ctx, -w / 2 + 3 * u, -h / 2 + 3 * u, w - 6 * u, h - 6 * u, h / 2 - 3 * u);
      ctx.fill();
    }
    icon(ctx, 'clock', -w / 2 + h / 2 + 2 * u, 2 * u, h * 0.6, low ? PAL.cream : PAL.sun);
    const secs = Math.max(0, Math.ceil(shift.time));
    text(ctx, String(secs), w * 0.14, 3 * u, h * 0.66, { color: low ? PAL.cream : PAL.cream });
    ctx.restore();
    if (shift.hud.timePop > 0 && shift.hud.timeGain > 0) {
      const k = 1 - shift.hud.timePop;
      text(ctx, `+${shift.hud.timeGain}s`, x + w + 32 * u, y + h / 2 - k * 18 * u, 26 * u * (0.8 + 0.4 * ease.outBack(Math.min(1, k * 3))), { color: '#7ee0ef', alpha: Math.min(1, shift.hud.timePop * 2.5) });
    }
    if (shift.timeFrozen) {
      // Small "paused" badge while the tutorial holds the clock.
      const bx = x + w - 4 * u, by = y + 6 * u, br = 11 * u;
      ctx.fillStyle = PAL.ink;
      ctx.beginPath(); ctx.arc(bx, by, br + 3 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = PAL.teal;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
      icon(ctx, 'pause', bx, by, br * 1.2, PAL.cream);
    }
  }

  drawParcels(ctx, shift, t) {
    const L = this.L.parcels;
    const u = G.u;
    const cap = shift.stats.capacity;
    const perRow = cap > 4 ? Math.ceil(cap / 2) : cap;
    const rows = Math.ceil(cap / perRow);
    const s = L.s;
    const gap = 4 * u;
    const w = perRow * (s + gap) - gap + 12 * u;
    const ph = rows * (s + gap) - gap + 10 * u;
    pill(ctx, L.x - 6 * u, L.y - s / 2 - 5 * u, w, ph, rgba(PAL.ink, 0.75), u, false);
    for (let i = 0; i < cap; i++) {
      const cx = L.x + (i % perRow) * (s + gap) + s / 2;
      const cy = L.y + Math.floor(i / perRow) * (s + gap);
      const p = shift.parcels[i];
      const pop = i === shift.parcels.length - 1 ? 1 + shift.hud.parcelPop * 0.35 : 1;
      if (p) icon(ctx, 'box', cx, cy, s * pop, PAL.cream, { kind: p.kind });
      else icon(ctx, 'boxEmpty', cx, cy, s * 0.92);
    }
    const chipY = L.y - s / 2 - 5 * u + ph + 10 * u;
    // Special delivery chip.
    const p = this.special;
    if (p && this.specialK > 0) {
      const y = chipY;
      const h = 28 * u;
      const k = this.popScale(this.specialK, this.specialOn);
      ctx.save();
      ctx.translate(L.x, y + h / 2);
      ctx.scale(k, k);
      ctx.translate(-L.x, -(y + h / 2));
      if (p.kind === 'express') {
        const urgent = p.expressT < 5;
        const label = `EXPRESS ${Math.ceil(Math.max(0, p.expressT))}s`;
        const wch = measure(ctx, label, 17 * u) + 26 * u;
        const sc = urgent ? 1 + 0.08 * Math.abs(Math.sin(t * 8)) : 1;
        ctx.save();
        ctx.translate(L.x - 6 * u + wch / 2, y + h / 2);
        ctx.scale(sc, sc);
        pill(ctx, -wch / 2, -h / 2, wch, h, PAL.coral, u);
        text(ctx, label, 0, 1 * u, 17 * u, { sw: 4 * u });
        ctx.restore();
      } else {
        const label = 'FRAGILE';
        const wch = measure(ctx, label, 17 * u) + 98 * u;
        pill(ctx, L.x - 6 * u, y, wch, h, PAL.plum, u);
        text(ctx, label, L.x + 8 * u, y + h / 2 + 1 * u, 17 * u, { align: 'left', sw: 4 * u });
        const max = CONFIG.specials.maxDamage;
        for (let i = 0; i < max; i++) {
          const cx = L.x - 6 * u + wch - 16 * u - (max - 1 - i) * 14 * u;
          const ok = i >= p.damage;
          ctx.fillStyle = PAL.ink;
          ctx.beginPath(); ctx.arc(cx, y + h / 2, 5.5 * u, 0, TAU); ctx.fill();
          ctx.fillStyle = ok ? PAL.cream : shade(PAL.plum, -0.3);
          ctx.beginPath(); ctx.arc(cx, y + h / 2, 4 * u, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  drawCoins(ctx, shift, t) {
    const u = G.u;
    const P = this.L.pause;
    const right = this.L.coinsRight;
    const h = 42 * u;
    const label = String(Math.round(this.coinsShown));
    const tw = measure(ctx, label, 28 * u);
    const w = Math.max(96 * u, tw + 62 * u);
    const x = right - w, y = P.y - h / 2;
    const sc = 1 + shift.hud.coinPop * 0.14;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(sc, sc);
    pill(ctx, -w / 2, -h / 2, w, h, PAL.ink, u);
    icon(ctx, 'coin', -w / 2 + h / 2 + 1 * u, 0, h * 0.72);
    text(ctx, label, w / 2 - 14 * u, 2 * u, 28 * u, { align: 'right', color: PAL.sun });
    ctx.restore();
    if (this.comboK > 0) {
      const cl = `COMBO x${this.lastCombo}`;
      const cw = measure(ctx, cl, 18 * u) + 28 * u;
      const ch = 30 * u;
      const cs = (1 + shift.hud.comboPop * 0.3) * this.popScale(this.comboK, this.comboOn);
      ctx.save();
      ctx.translate(right - cw / 2, y + h + 22 * u);
      ctx.scale(cs, cs);
      ctx.rotate(-0.04 + Math.sin(t * 3) * 0.02);
      pill(ctx, -cw / 2, -ch / 2, cw, ch, PAL.sun, u);
      text(ctx, cl, 0, 1 * u, 18 * u, { color: PAL.ink, stroke: false });
      ctx.restore();
    }
  }

  drawMeter(ctx, shift, t) {
    const m = shift.meter;
    if (m.show < 0.02) return;
    const u = G.u;
    const L = this.L.meter;
    const k = ease.outBack(clamp(m.show, 0, 1));
    const w = L.w, h = 30 * u;
    ctx.save();
    ctx.translate(L.cx, L.cy + (1 - k) * 40 * u);
    ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
    ctx.globalAlpha = clamp(m.show * 1.4, 0, 1);
    const x0 = -w / 2, y0 = -h / 2;
    ctx.fillStyle = rgba(PAL.ink, 0.3);
    roundRect(ctx, x0 + 3 * u, y0 + 7 * u, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = PAL.ink;
    roundRect(ctx, x0 - 5 * u, y0 - 5 * u, w + 10 * u, h + 10 * u, h / 2 + 5 * u);
    ctx.fill();
    ctx.save();
    roundRect(ctx, x0, y0, w, h, h / 2);
    ctx.clip();
    ctx.fillStyle = PAL.coral;
    ctx.fillRect(x0, y0, w, h);
    const amber = CONFIG.throwMeter.amber, green = shift.stats.greenHalf;
    ctx.fillStyle = PAL.sun;
    ctx.fillRect(x0 + (0.5 - amber) * w, y0, amber * 2 * w, h);
    const gp = 0.5 + 0.5 * Math.sin(t * 10);
    ctx.fillStyle = '#7cc95f';
    ctx.fillRect(x0 + (0.5 - green) * w, y0, green * 2 * w, h);
    ctx.fillStyle = rgba('#ffffff', 0.18 + gp * 0.15);
    ctx.fillRect(x0 + (0.5 - green) * w, y0, green * 2 * w, h);
    ctx.fillStyle = rgba('#ffffff', 0.22);
    ctx.fillRect(x0, y0, w, h * 0.35);
    ctx.fillStyle = rgba(PAL.ink, 0.18);
    ctx.fillRect(x0 + (0.5 - amber) * w - 1.5 * u, y0, 3 * u, h);
    ctx.fillRect(x0 + (0.5 + amber) * w - 1.5 * u, y0, 3 * u, h);
    if (m.flash > 0) {
      ctx.fillStyle = rgba(m.flashColor, m.flash * 0.7);
      ctx.fillRect(x0, y0, w, h);
    }
    ctx.restore();
    // Marker.
    const mx = x0 + m.pos * w;
    ctx.fillStyle = PAL.ink;
    ctx.beginPath();
    ctx.moveTo(mx - 10 * u, y0 - 14 * u);
    ctx.lineTo(mx + 10 * u, y0 - 14 * u);
    ctx.lineTo(mx, y0 + 2 * u);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(mx - 10 * u, y0 + h + 14 * u);
    ctx.lineTo(mx + 10 * u, y0 + h + 14 * u);
    ctx.lineTo(mx, y0 + h - 2 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.ink;
    roundRect(ctx, mx - 4 * u, y0 - 4 * u, 8 * u, h + 8 * u, 3 * u);
    ctx.fill();
    ctx.fillStyle = PAL.cream;
    roundRect(ctx, mx - 2 * u, y0 - 2 * u, 4 * u, h + 4 * u, 2 * u);
    ctx.fill();
    // Label.
    const pulse = 1 + 0.06 * Math.sin(t * 9);
    const keyb = !G.touchUI;
    const label = keyb ? 'THROW!' : 'TAP THROW!';
    ctx.save();
    ctx.translate(0, y0 - 32 * u);
    ctx.scale(pulse, pulse);
    if (keyb) {
      const lw = measure(ctx, label, 24 * u);
      const kw = measure(ctx, 'SPACE', 14 * u) + 16 * u;
      const total = lw + kw + 10 * u;
      text(ctx, label, -total / 2 + lw / 2, 0, 24 * u);
      const kx = -total / 2 + lw + 10 * u;
      ctx.fillStyle = PAL.ink;
      roundRect(ctx, kx - 2 * u, -13 * u, kw + 4 * u, 28 * u, 7 * u);
      ctx.fill();
      ctx.fillStyle = PAL.cream;
      roundRect(ctx, kx, -11 * u, kw, 22 * u, 5 * u);
      ctx.fill();
      text(ctx, 'SPACE', kx + kw / 2, 1 * u, 14 * u, { color: PAL.ink, stroke: false });
    } else {
      text(ctx, label, 0, 0, 24 * u);
    }
    ctx.restore();
    ctx.restore();
  }

  targetInfo(shift) {
    const tg = shift.target;
    if (!tg) return null;
    if (tg.depot) {
      return { x: (DEPOT.zone.x0 + DEPOT.zone.x1) / 2, y: (DEPOT.zone.y0 + DEPOT.zone.y1) / 2, color: PAL.teal, icon: 'depot' };
    }
    if (!tg.house) return null;
    const color = tg.kind === 'express' ? PAL.coral : tg.kind === 'fragile' ? PAL.plum : PAL.sun;
    return { x: tg.house.mat.x, y: tg.house.mat.y, color, icon: 'house' };
  }

  drawTarget(ctx, shift, r, t) {
    if (shift.state !== 'play') return;
    const info = this.targetInfo(shift);
    if (!info) return;
    const u = G.u;
    const L = this.L;
    const sp = r.toScreen(info.x, info.y);
    const vs = r.toScreen(shift.van.x, shift.van.y);
    const x0 = L.left + 34 * u, x1 = L.right - 34 * u;
    let y0 = L.top + 70 * u;
    let y1 = L.bottom - 50 * u;
    // On-screen targets get a bobbing marker above them, if it fits on screen.
    const inside = sp.x > x0 && sp.x < x1 && sp.y - 70 * u > L.top && sp.y < L.bottom - 20 * u;
    const bob = Math.sin(t * 6) * 6 * u;
    if (inside) {
      const y = sp.y - 52 * u + bob;
      ctx.save();
      ctx.translate(sp.x, y);
      ctx.fillStyle = PAL.ink;
      ctx.beginPath();
      ctx.moveTo(-17 * u, -14 * u); ctx.lineTo(17 * u, -14 * u); ctx.lineTo(0, 18 * u); ctx.closePath();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 8 * u;
      ctx.strokeStyle = PAL.ink;
      ctx.stroke();
      ctx.fill();
      ctx.fillStyle = info.color;
      ctx.beginPath();
      ctx.moveTo(-13 * u, -11 * u); ctx.lineTo(13 * u, -11 * u); ctx.lineTo(0, 13 * u); ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    // In range the meter is the cue, so the edge arrow steps aside.
    if (shift.meter.show > 0.3 && !shift.target.depot) return;
    // Off-screen: clamp to the edge along the ray from the van.
    let dx = sp.x - vs.x, dy = sp.y - vs.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const edge = (top, bottom) => {
      const cx = clamp(vs.x, x0, x1), cy = clamp(vs.y, top, bottom);
      let tMax = Infinity;
      if (dx > 0) tMax = Math.min(tMax, (x1 - cx) / dx);
      if (dx < 0) tMax = Math.min(tMax, (x0 - cx) / dx);
      if (dy > 0) tMax = Math.min(tMax, (bottom - cy) / dy);
      if (dy < 0) tMax = Math.min(tMax, (top - cy) / dy);
      return [cx + dx * tMax, cy + dy * tMax];
    };
    let [ax, ay] = edge(y0, y1);
    // On touch screens, stay above the steering stick and the buttons in the bottom corners.
    if (G.touchUI && ay > L.bottom - 160 * u && (ax < L.left + 200 * u || ax > L.brakeBtn.x - L.brakeBtn.r - 30 * u)) {
      y1 = L.bottom - 160 * u;
      [ax, ay] = edge(y0, y1);
    }
    // Keep clear of the timer (left) and coins/combo (right) clusters.
    if (ay < L.top + 130 * u && (ax < L.left + 200 * u || ax > L.right - 240 * u)) {
      y0 = L.top + 140 * u;
      [ax, ay] = edge(y0, y1);
    }
    const ang = Math.atan2(dy, dx);
    const R = 25 * u;
    const pulse = 1 + 0.07 * Math.sin(t * 7);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.scale(pulse, pulse);
    ctx.save();
    ctx.rotate(ang);
    ctx.fillStyle = PAL.ink;
    ctx.beginPath();
    ctx.moveTo(R + 20 * u, 0); ctx.lineTo(R - 4 * u, -17 * u); ctx.lineTo(R - 4 * u, 17 * u); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.moveTo(R + 13 * u, 0); ctx.lineTo(R - 2 * u, -11 * u); ctx.lineTo(R - 2 * u, 11 * u); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = rgba(PAL.ink, 0.3);
    ctx.beginPath(); ctx.arc(2 * u, 5 * u, R + 4 * u, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.ink;
    ctx.beginPath(); ctx.arc(0, 0, R + 4 * u, 0, TAU); ctx.fill();
    ctx.fillStyle = info.color;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    icon(ctx, info.icon, 0, 1 * u, R * 1.15, info.icon === 'house' ? shade(info.color, -0.2) : PAL.cream);
    ctx.restore();
    const dm = Math.round(Math.hypot(info.x - shift.van.x, info.y - shift.van.y) / 12.8);
    const ty = ay + R + 26 * u > L.bottom ? ay - R - 18 * u : ay + R + 18 * u;
    text(ctx, `${dm}m`, ax, ty, 16 * u, { sw: 4 * u });
  }

  drawTexts(ctx, shift, r) {
    const u = G.u;
    for (const ft of shift.fx.texts) {
      if (ft.t < 0) continue;
      const { pop, alpha, rise } = textScale(ft);
      const sp = r.toScreen(ft.x, ft.y);
      const size = 24 * u * ft.size * pop;
      const half = measure(ctx, ft.str, size) / 2 + 8 * u;
      const x = half * 2 < G.w ? clamp(sp.x, half, G.w - half) : G.w / 2;
      const y = clamp(sp.y - rise * u, size, G.h - size);
      text(ctx, ft.str, x, y, size, { color: ft.color, alpha, sw: Math.max(3, size * 0.2) });
    }
  }

  drawTouch(ctx, shift, t, joy, fade = 1) {
    const u = G.u;
    const L = this.L;
    ctx.save();
    ctx.globalAlpha = fade;
    // Steering stick.
    if (joy) {
      const R = CONFIG.van.joystickRadius * u;
      ctx.fillStyle = rgba(PAL.ink, 0.3);
      ctx.beginPath(); ctx.arc(joy.ax, joy.ay, R + 10 * u, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(PAL.cream, 0.6);
      ctx.lineWidth = 4 * u;
      ctx.beginPath(); ctx.arc(joy.ax, joy.ay, R, 0, TAU); ctx.stroke();
      ctx.fillStyle = PAL.ink;
      ctx.beginPath(); ctx.arc(joy.kx, joy.ky, 28 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = PAL.cream;
      ctx.beginPath(); ctx.arc(joy.kx, joy.ky, 24 * u, 0, TAU); ctx.fill();
    } else {
      const h = L.joyHint;
      ctx.globalAlpha = 0.35 * fade;
      ctx.strokeStyle = PAL.cream;
      ctx.lineWidth = 4 * u;
      ctx.beginPath(); ctx.arc(h.x, h.y, 50 * u, 0, TAU); ctx.stroke();
      ctx.fillStyle = PAL.cream;
      ctx.beginPath(); ctx.arc(h.x, h.y, 18 * u, 0, TAU); ctx.fill();
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(i * Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(32 * u, -7 * u); ctx.lineTo(41 * u, 0); ctx.lineTo(32 * u, 7 * u); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 0.75 * fade;
      text(ctx, 'DRAG TO STEER', h.x, h.y + 68 * u, 13 * u, { sw: 3 * u, drop: false });
      ctx.globalAlpha = fade;
    }
    // Brake.
    const B = L.brakeBtn;
    const bp = this.brakeHeld ? 1 : 0;
    this.roundButton(ctx, B.x, B.y, B.r, '#7c8aa8', bp, fade);
    text(ctx, 'BRAKE', B.x, B.y + 2 * u + bp * 3 * u, 16 * u, { sw: 4 * u });
    // Throw.
    const T = L.throwBtn;
    const k = this.readyK || 0;
    const tp = this.throwFlash || 0;
    const pr = 1 + 0.05 * k * Math.sin(t * 10);
    this.roundButton(ctx, T.x, T.y, T.r * pr, mix('#a7a3b5', PAL.coral, k), tp, fade);
    icon(ctx, 'box', T.x, T.y - 12 * u + tp * 4 * u, 30 * u, PAL.cream);
    text(ctx, 'THROW', T.x, T.y + 22 * u + tp * 4 * u, 19 * u, { sw: 4 * u });
    ctx.restore();
  }

  roundButton(ctx, x, y, r, color, press, fade) {
    const u = G.u;
    const depth = 6 * u;
    ctx.globalAlpha = 0.9 * fade;
    ctx.fillStyle = rgba(PAL.ink, 0.3);
    ctx.beginPath(); ctx.arc(x + 2 * u, y + depth + 4 * u, r, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.ink;
    ctx.beginPath(); ctx.arc(x, y + depth / 2 + press * depth / 2, r + 4 * u, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(color, -0.3);
    ctx.beginPath(); ctx.arc(x, y + depth, r, 0, TAU); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y + press * depth, r, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.2);
    ctx.beginPath(); ctx.ellipse(x, y - r * 0.42 + press * depth, r * 0.7, r * 0.32, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = fade;
  }

  // Tutorial prompt card. Returns the card rect (for the skip button) or null.
  // Swap prompts by shrinking the old card out before popping the new one in.
  updatePrompt(dt, shift) {
    const tut = shift.tut;
    let want = null;
    if (tut && shift.state === 'play' && tut.t >= (tut.step === 0 ? 1.5 : 0)) want = promptText(tut.step);
    const key = want ? want[0] : null;
    this.promptGrowing = this.promptKey === key;
    if (!this.promptGrowing) {
      this.promptK = (this.promptK || 0) - dt / 0.18;
      if (this.promptK <= 0) {
        this.promptK = 0;
        this.promptKey = key;
        this.prompt = want;
      }
    } else if (this.prompt) {
      this.promptK = Math.min(1, (this.promptK || 0) + dt / 0.4);
    }
  }

  drawPrompt(ctx) {
    const msg = this.prompt;
    if (!msg || !(this.promptK > 0)) return null;
    const u = G.u;
    const L = this.L.prompt;
    const a = this.popScale(this.promptK, this.promptGrowing);
    const pad = 16 * u;
    const w = L.w;
    const titleSize = 21 * u, subSize = 14 * u;
    // The right edge holds the SKIP button.
    const lines = wrap(ctx, msg[0], titleSize, w - pad * 2 - 84 * u);
    const sub = msg[1] ? wrap(ctx, msg[1], subSize, w - pad * 2 - 84 * u) : [];
    const h = pad * 2 + lines.length * titleSize * 1.15 + (sub.length ? 6 * u + sub.length * subSize * 1.3 : 0);
    const x = L.cx - w / 2, y = L.y;
    ctx.save();
    ctx.translate(L.cx, y + h / 2);
    ctx.scale(a, a);
    ctx.translate(-L.cx, -(y + h / 2));
    ctx.fillStyle = rgba(PAL.ink, 0.3);
    roundRect(ctx, x + 3 * u, y + 6 * u, w, h, 18 * u); ctx.fill();
    ctx.fillStyle = PAL.ink;
    roundRect(ctx, x - 3 * u, y - 3 * u, w + 6 * u, h + 6 * u, 21 * u); ctx.fill();
    ctx.fillStyle = PAL.cream;
    roundRect(ctx, x, y, w, h, 18 * u); ctx.fill();
    let ty = y + pad + titleSize * 0.55;
    for (const ln of lines) {
      text(ctx, ln, x + pad, ty, titleSize, { align: 'left', color: PAL.ink, stroke: false });
      ty += titleSize * 1.15;
    }
    ty += 6 * u - titleSize * 0.15;
    for (const ln of sub) {
      text(ctx, ln, x + pad, ty + subSize * 0.4, subSize, { align: 'left', color: shade(PAL.ink, 0.3), stroke: false });
      ty += subSize * 1.3;
    }
    ctx.restore();
    return { x, y, w, h, k: this.promptK };
  }
}

function promptText(step) {
  const touch = G.touchUI;
  switch (step) {
    case 0: return ['Follow the arrow to the glowing doormat!', (touch ? 'Drag on the left side to steer. Hold BRAKE to slow down or reverse.' : 'Steer with the arrow keys or A/D. Brake and reverse with Down or S.') + ' The clock starts after your first delivery.'];
    case 1: return [touch ? 'Tap THROW when the marker is in the GREEN!' : 'Press SPACE when the marker is in the GREEN!', 'No need to stop. Driving faster earns bigger tips!'];
    case 2: return ['Deliveries add time to the clock!', 'Perfect throws add extra time and build your combo.'];
    case 3: return ['Drift, jump ramps and near-miss traffic for tips!', 'Knocking over bins and cones pays a little too.'];
    case 4: return ['Out of parcels! Head back to the depot.', 'Drive into the yellow loading bay to reload.'];
    default: return null;
  }
}
