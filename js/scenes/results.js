// End-of-shift results with animated count-up, new best and double coins offer.
import { G, portrait, placeModal, modalSpace } from '../state.js';
import { PAL } from '../art.js';
import { Save } from '../save.js';
import { Sound } from '../audio.js';
import { Scene } from './base.js';
import { Button, text, panel, icon, measure, pill } from '../ui.js';
import { GarageScene } from './garage.js';
import { ease, clamp, rgba, shade, rnd, TAU, roundRect } from '../util.js';

const ROW_START = 0.45, ROW_GAP = 0.4, ROW_DUR = 0.45;

export class ResultsOverlay extends Scene {
  constructor(game) {
    super();
    this.game = game;
    this.freezeBelow = false;
    this.confetti = [];
  }

  enter(res) {
    this.res = res;
    const d = Save.data;
    this.prevBest = d.best;
    this.newBest = res.coins > d.best && res.coins > 0;
    d.coins += res.coins;
    d.best = Math.max(d.best, res.coins);
    d.shifts += 1;
    Save.write();
    Sound.playSong('menu');
    Sound.whoosh();
    this.rows = [
      { label: 'Deliveries', value: res.deliveries, icon: 'house' },
      { label: 'Perfect throws', value: res.perfects, icon: 'star' },
      { label: 'Best combo', value: res.bestCombo, prefix: 'x', icon: 'target' },
    ];
    this.coinStart = ROW_START + ROW_GAP * this.rows.length;
    this.coinDur = 1.0;
    this.bestAt = this.coinStart + this.coinDur + 0.25;
    this.doubled = false;
    this.doubleT = 0;
    this.busy = false;
    this.done = new Set();
    this.again = this.ui.add(new Button({ label: 'PLAY AGAIN', icon: 'play', color: PAL.coral, delay: this.coinStart + 0.2, onClick: () => G.startShift() }));
    this.double = this.ui.add(new Button({ label: 'DOUBLE COINS', icon: 'ad', color: '#6cc08b', badge: 'AD', delay: this.coinStart + 0.3, visible: res.coins > 0, onClick: () => this.watchAd() }));
    this.garage = this.ui.add(new Button({ label: 'GARAGE', icon: 'wrench', color: PAL.teal, delay: this.coinStart + 0.4, onClick: () => G.setScene(new GarageScene()) }));
    this.menu = this.ui.add(new Button({ label: 'MENU', icon: 'home', color: '#7c8aa8', delay: this.coinStart + 0.45, sound: 'back', onClick: () => G.toTitle() }));
  }

  watchAd() {
    if (this.busy || this.doubled) return;
    this.busy = true;
    G.withRewardedBreak().then((ok) => {
      this.busy = false;
      if (!ok) {
        this.double.wobble = 1;
        this.notice = { str: 'No ad available right now. Try again later!', t: 0 };
        return;
      }
      Save.data.coins += this.res.coins;
      Save.write();
      this.doubled = true;
      this.doubleT = 0;
      this.double.visible = false;
      Sound.buy();
      this.burst(G.w / 2, this.coinY, 60);
      this.layout();
    });
  }

  burst(x, y, n) {
    const cols = [PAL.sun, PAL.coral, PAL.teal, PAL.cream, PAL.plum, '#7cc95f'];
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), s = rnd(160, 520) * G.u;
      this.confetti.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 260 * G.u, t: 0, life: rnd(1.2, 2), c: cols[i % cols.length], r: rnd(0, TAU), vr: rnd(-10, 10), s: rnd(6, 11) * G.u });
    }
  }

  layout() {
    const u = G.u;
    const port = portrait();
    if (port) {
      const w = Math.min(440 * u, G.w - 28 * u);
      const rowH = 40 * u;
      const bh = 56 * u;
      const showDouble = this.double.visible;
      const h = 70 * u + rowH * 3 + 96 * u + (showDouble ? bh + 14 * u : 0) + bh * 2 + 14 * u + 34 * u;
      const y = placeModal(h);
      this.box = { x: G.w / 2 - w / 2, y, w, h };
      this.statX0 = this.box.x + 22 * u;
      this.statX1 = this.box.x + w - 22 * u;
      this.rowY0 = y + 76 * u;
      this.rowH = rowH;
      this.coinY = this.rowY0 + rowH * 3 + 42 * u;
      this.coinX = G.w / 2;
      let by = this.coinY + 64 * u + bh / 2;
      if (showDouble) {
        Object.assign(this.double, { x: G.w / 2, y: by, w: w - 44 * u, h: bh });
        by += bh + 14 * u;
      }
      Object.assign(this.again, { x: G.w / 2, y: by, w: w - 44 * u, h: bh });
      by += bh + 14 * u;
      const hw = (w - 58 * u) / 2;
      Object.assign(this.garage, { x: G.w / 2 - hw / 2 - 7 * u, y: by, w: hw, h: bh * 0.9 });
      Object.assign(this.menu, { x: G.w / 2 + hw / 2 + 7 * u, y: by, w: hw, h: bh * 0.9 });
    } else {
      const w = Math.min(760 * u, G.w - 28 * u - G.safe.l - G.safe.r);
      const h = Math.min(modalSpace(), 350 * u);
      this.box = { x: G.w / 2 - w / 2, y: placeModal(h), w, h };
      const split = w * 0.56;
      this.statX0 = this.box.x + 26 * u;
      this.statX1 = this.box.x + split - 20 * u;
      const inner = h - 66 * u;
      this.rowH = Math.min(40 * u, inner * 0.14);
      this.rowY0 = this.box.y + 70 * u + this.rowH / 2;
      this.coinY = this.rowY0 + this.rowH * 3 + Math.min(54 * u, inner * 0.2);
      this.coinX = this.box.x + split / 2;
      const bx = this.box.x + split + (w - split) / 2;
      const bw = w - split - 36 * u;
      const vis = [this.double, this.again, this.garage, this.menu].filter((b) => b.visible);
      const gap = 12 * u;
      const bh = Math.min(56 * u, (inner - 20 * u - gap * (vis.length - 1)) / vis.length);
      const top = this.box.y + 66 * u + (inner - vis.length * bh - (vis.length - 1) * gap) / 2;
      vis.forEach((b, i) => Object.assign(b, { x: bx, y: top + i * (bh + gap) + bh / 2, w: bw, h: bh }));
    }
  }

  update(dt) {
    super.update(dt);
    const t = this.t;
    this.rows.forEach((r, i) => {
      const s = ROW_START + i * ROW_GAP;
      if (t > s && t < s + ROW_DUR && r.value > 0) Sound.count();
      if (t >= s + ROW_DUR && !this.done.has(i)) {
        this.done.add(i);
        Sound.pop();
      }
    });
    if (t > this.coinStart && t < this.coinStart + this.coinDur && this.res.coins > 0) Sound.count();
    if (t >= this.coinStart + this.coinDur && !this.done.has('coins')) {
      this.done.add('coins');
      Sound.coin();
    }
    if (this.newBest && t >= this.bestAt && !this.done.has('best')) {
      this.done.add('best');
      Sound.fanfare();
      this.burst(this.coinX, this.coinY, 70);
    }
    if (this.doubled) this.doubleT += dt;
    if (this.notice) {
      this.notice.t += dt;
      if (this.notice.t > 3) this.notice = null;
    }
    for (const c of this.confetti) {
      c.t += dt;
      c.vy += 900 * G.u * dt;
      c.vx *= Math.exp(-1.2 * dt);
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.r += c.vr * dt;
    }
    this.confetti = this.confetti.filter((c) => c.t < c.life);
  }

  keyDown(code) {
    if (code === 'Escape') {
      Sound.back();
      G.toTitle();
      return true;
    }
    return super.keyDown(code);
  }

  draw(ctx) {
    const u = G.u;
    const t = this.t;
    const a = ease.outCubic(clamp(t / 0.3, 0, 1)) * this.fade;
    ctx.fillStyle = rgba(PAL.ink, 0.5 * a);
    ctx.fillRect(0, 0, G.w, G.h);
    const B = this.box;
    const s = ease.outBack(clamp(t / 0.4, 0, 1));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(G.w / 2, B.y + B.h / 2);
    ctx.scale(s, s);
    ctx.translate(-G.w / 2, -(B.y + B.h / 2));
    panel(ctx, B.x, B.y, B.w, B.h, u, { header: PAL.coral, headerH: 58 * u });
    text(ctx, 'SHIFT COMPLETE!', G.w / 2, B.y + 30 * u, Math.min(30 * u, B.w * 0.08));
    // Stat rows.
    this.rows.forEach((r, i) => {
      const st = ROW_START + i * ROW_GAP;
      const k = clamp((t - st + 0.25) / 0.3, 0, 1);
      if (k <= 0) return;
      const y = this.rowY0 + i * this.rowH;
      ctx.globalAlpha = a * k;
      const slide = (1 - ease.outCubic(k)) * 30 * u;
      const fs = Math.min(21 * u, this.rowH * 0.55);
      ctx.fillStyle = rgba(PAL.ink, 0.06);
      roundRect(ctx, this.statX0 - 8 * u + slide, y - this.rowH / 2 + 3 * u, this.statX1 - this.statX0 + 16 * u, this.rowH - 6 * u, 10 * u);
      ctx.fill();
      icon(ctx, r.icon, this.statX0 + 12 * u + slide, y, fs * 1.1, r.icon === 'star' ? PAL.sun : r.icon === 'house' ? PAL.coral : PAL.teal, r.icon === 'target' ? {} : {});
      text(ctx, r.label, this.statX0 + 32 * u + slide, y + 1 * u, fs, { align: 'left', color: PAL.ink, stroke: false });
      const cv = Math.round(r.value * ease.outCubic(clamp((t - st) / ROW_DUR, 0, 1)));
      const pop = 1 + 0.25 * Math.max(0, 1 - Math.abs(t - st - ROW_DUR) * 6);
      ctx.save();
      ctx.translate(this.statX1 + slide, y + 1 * u);
      ctx.scale(pop, pop);
      text(ctx, `${r.prefix || ''}${cv}`, 0, 0, fs * 1.2, { align: 'right', color: PAL.sun });
      ctx.restore();
    });
    ctx.globalAlpha = a;
    // Coins.
    const ck = clamp((t - this.coinStart + 0.2) / 0.3, 0, 1);
    if (ck > 0) {
      const cx = this.coinX, cy = this.coinY;
      ctx.globalAlpha = a * ck;
      text(ctx, 'COINS EARNED', cx, cy - 32 * u, 16 * u, { color: shade(PAL.ink, 0.3), stroke: false });
      let v = Math.round(this.res.coins * ease.outCubic(clamp((t - this.coinStart) / this.coinDur, 0, 1)));
      if (this.doubled) v = Math.round(this.res.coins * (1 + ease.outCubic(clamp(this.doubleT / 0.8, 0, 1))));
      const label = String(v);
      const fs = 46 * u;
      const lw = measure(ctx, label, fs);
      const pop = 1 + 0.2 * Math.max(0, 1 - Math.abs(t - this.coinStart - this.coinDur) * 5) + (this.doubled ? 0.25 * Math.max(0, 1 - this.doubleT * 2) : 0);
      ctx.save();
      ctx.translate(cx, cy + 8 * u);
      ctx.scale(pop, pop);
      icon(ctx, 'coin', -lw / 2 - 8 * u, 0, 40 * u);
      text(ctx, label, 14 * u, 2 * u, fs, { color: PAL.sun, sw: 9 * u });
      ctx.restore();
      if (this.doubled) {
        const dk = ease.outBack(clamp(this.doubleT / 0.4, 0, 1));
        ctx.save();
        ctx.translate(cx + lw / 2 + 44 * u, cy - 14 * u);
        ctx.scale(dk, dk);
        ctx.rotate(0.15);
        pill(ctx, -24 * u, -15 * u, 48 * u, 30 * u, '#6cc08b', u);
        text(ctx, 'x2', 0, 1 * u, 20 * u);
        ctx.restore();
      }
    }
    // New best stamp.
    if (this.newBest && t >= this.bestAt) {
      const bk = ease.outBack(clamp((t - this.bestAt) / 0.4, 0, 1));
      ctx.save();
      ctx.translate(this.coinX, this.coinY + 52 * u);
      ctx.rotate(-0.06 + Math.sin(t * 3) * 0.03);
      ctx.scale(bk * 1.0, bk * 1.0);
      const bw = measure(ctx, 'NEW BEST!', 20 * u) + 36 * u;
      pill(ctx, -bw / 2, -16 * u, bw, 32 * u, PAL.coral, u);
      icon(ctx, 'star', -bw / 2 + 16 * u, 0, 18 * u, PAL.sun);
      text(ctx, 'NEW BEST!', 10 * u, 1 * u, 20 * u);
      ctx.restore();
    } else if (!this.newBest && t >= this.bestAt && this.prevBest > 0) {
      const k = clamp((t - this.bestAt) / 0.3, 0, 1);
      text(ctx, `Best: ${Save.data.best}`, this.coinX, this.coinY + 50 * u, 15 * u, { color: shade(PAL.ink, 0.3), stroke: false, alpha: a * k });
    }
    ctx.globalAlpha = a;
    this.ui.draw(ctx, t, u, G.lastDevice !== 'touch' && this.ui.focus >= 0);
    if (this.notice) {
      const n = this.notice;
      const na = Math.min(1, n.t * 5, (3 - n.t) * 3);
      const nw = Math.min(B.w - 30 * u, measure(ctx, n.str, 15 * u) + 30 * u);
      ctx.globalAlpha = a * na;
      pill(ctx, G.w / 2 - nw / 2, B.y + B.h - 12 * u, nw, 30 * u, PAL.ink, u);
      text(ctx, n.str, G.w / 2, B.y + B.h + 3 * u, Math.min(15 * u, (nw - 20 * u) / n.str.length * 1.9), { drop: false, sw: 3 * u });
      ctx.globalAlpha = a;
    }
    ctx.restore();
    for (const c of this.confetti) {
      ctx.globalAlpha = Math.min(1, (1 - c.t / c.life) * 2);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.r);
      ctx.fillStyle = c.c;
      ctx.fillRect(-c.s / 2, -c.s / 4, c.s, (c.s / 2) * Math.abs(Math.cos(c.t * 7 + c.r)));
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
