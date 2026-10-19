// Garage: buy upgrades and van skins with coins.
import { CONFIG } from '../config.js';
import { G, portrait } from '../state.js';
import { PAL, SKIN_ART, paintVan } from '../art.js';
import { Save } from '../save.js';
import { Sound } from '../audio.js';
import { Attract } from '../attract.js';
import { Scene } from './base.js';
import { Button, text, icon, panel, pill, measure, fit } from '../ui.js';
import { ease, clamp, roundRect, rgba, shade, rnd, TAU } from '../util.js';

const UP_ICONS = { speed: 'speed', handling: 'wheel', capacity: 'cargo', green: 'target', time: 'stopwatch' };
const UP_DESC = {
  speed: 'Higher top speed',
  handling: 'Sharper turns, more grip',
  capacity: 'Carry more parcels',
  green: 'Wider green zone',
  time: 'More time to start',
};

export class GarageScene extends Scene {
  enter() {
    Sound.playSong('menu');
    this.sparks = [];
    this.coinPop = 0;
    this.back = this.ui.add(new Button({ label: 'BACK', icon: 'back', color: PAL.plum, sound: 'back', delay: 0.1, onClick: () => G.toTitle() }));
    this.upButtons = CONFIG.upgrades.map((up, i) =>
      this.ui.add(new Button({ color: PAL.coral, delay: 0.2 + i * 0.05, upgrade: up, onClick: (b) => this.buyUpgrade(b) })));
    this.cards = CONFIG.skins.map((sk, i) => {
      const b = this.ui.add(new Button({ color: PAL.cream, delay: 0.3 + i * 0.05, skin: sk, onClick: (bb) => this.pickSkin(bb) }));
      b.draw = (ctx, t, u, focused) => this.drawCard(ctx, b, t, u, focused);
      return b;
    });
    this.refresh();
  }

  refresh() {
    const d = Save.data;
    for (const b of this.upButtons) {
      const up = b.upgrade;
      const lvl = d.upgrades[up.id];
      if (lvl >= up.prices.length) {
        b.label = 'MAX';
        b.icon = 'star';
        b.enabled = false;
        b.color = PAL.sun;
        b.keepColor = true;
        b.maxed = true;
      } else {
        const price = up.prices[lvl];
        b.label = String(price);
        b.icon = 'coin';
        b.enabled = d.coins >= price;
        b.color = '#6cc08b';
        b.keepColor = false;
        b.maxed = false;
      }
    }
  }

  buyUpgrade(b) {
    const up = b.upgrade;
    const d = Save.data;
    const lvl = d.upgrades[up.id];
    if (lvl >= up.prices.length || d.coins < up.prices[lvl]) return;
    d.coins -= up.prices[lvl];
    d.upgrades[up.id] = lvl + 1;
    this.pipPop = { id: up.id, k: lvl, t: 0 };
    Save.write();
    Sound.buy();
    this.coinPop = 1;
    this.burst(b.x, b.y);
    this.refresh();
  }

  pickSkin(b) {
    const d = Save.data;
    const sk = b.skin;
    if (d.skins.includes(sk.id)) {
      if (d.skin !== sk.id) {
        d.skin = sk.id;
        Save.write();
        Sound.pop();
        this.burst(b.x, b.y, 10);
      }
      return;
    }
    if (d.coins < sk.price) {
      b.wobble = 1;
      Sound.denied();
      return;
    }
    d.coins -= sk.price;
    d.skins.push(sk.id);
    d.skin = sk.id;
    Save.write();
    Sound.buy();
    this.coinPop = 1;
    this.burst(b.x, b.y, 26);
    this.refresh();
  }

  burst(x, y, n = 18) {
    const cols = [PAL.sun, PAL.coral, PAL.teal, PAL.cream, PAL.plum];
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), s = rnd(120, 360) * G.u;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120 * G.u, t: 0, life: rnd(0.6, 1), c: cols[i % cols.length], r: rnd(0, TAU), s: rnd(5, 9) * G.u });
    }
  }

  layout() {
    const u = G.u;
    const port = portrait();
    const m = 14 * u;
    const top = m + G.safe.t;
    this.header = { y: top + 28 * u };
    const compact = G.w < 600 * u;
    this.back.iconOnly = compact;
    Object.assign(this.back, compact
      ? { x: m + G.safe.l + 28 * u, y: this.header.y, w: 54 * u, h: 46 * u }
      : { x: m + G.safe.l + 74 * u, y: this.header.y, w: 140 * u, h: 48 * u });
    const contentTop = top + 70 * u;
    const maxW = Math.min(G.w - 2 * m - G.safe.l - G.safe.r, 1060 * u);
    const x0 = G.w / 2 - maxW / 2;
    let upBox, vanBox;
    if (port) {
      const rowH = 58 * u;
      upBox = { x: x0, y: contentTop, w: maxW, h: 52 * u + rowH * 5 };
      const cardW = (maxW - 40 * u) / 3;
      const cardH = Math.min(cardW * 1.08, 140 * u);
      vanBox = { x: x0, y: upBox.y + upBox.h + 18 * u, w: maxW, h: 56 * u + cardH * 2 + 12 * u, cardW, cardH, cols: 3 };
      upBox.rowH = rowH;
    } else {
      const availH = G.h - contentTop - m - G.safe.b;
      const gap = 18 * u;
      const lw = maxW * 0.54;
      const rowH = Math.min(58 * u, (availH - 52 * u) / 5);
      upBox = { x: x0, y: contentTop, w: lw, h: 52 * u + rowH * 5, rowH };
      const rw = maxW - lw - gap;
      const cardW = (rw - 40 * u) / 3;
      const cardH = Math.min(cardW * 1.08, (availH - 70 * u) / 2);
      vanBox = { x: x0 + lw + gap, y: contentTop, w: rw, h: 56 * u + cardH * 2 + 12 * u, cardW, cardH, cols: 3 };
    }
    this.upBox = upBox;
    this.vanBox = vanBox;
    this.upButtons.forEach((b, i) => {
      const ry = upBox.y + 50 * u + i * upBox.rowH + upBox.rowH / 2;
      const bw = Math.min(124 * u, upBox.w * 0.3);
      Object.assign(b, { x: upBox.x + upBox.w - bw / 2 - 14 * u, y: ry - 2 * u, w: bw, h: upBox.rowH * 0.66, size: Math.min(22 * u, upBox.rowH * 0.34) });
    });
    this.cards.forEach((b, i) => {
      const col = i % vanBox.cols, row = Math.floor(i / vanBox.cols);
      const cx = vanBox.x + 14 * u + col * (vanBox.cardW + 6 * u) + vanBox.cardW / 2;
      const cy = vanBox.y + 52 * u + row * (vanBox.cardH + 10 * u) + vanBox.cardH / 2;
      Object.assign(b, { x: cx, y: cy, w: vanBox.cardW - 6 * u, h: vanBox.cardH - 10 * u });
    });
  }

  keyDown(code) {
    if (code === 'Escape') {
      Sound.back();
      G.toTitle();
      return true;
    }
    return super.keyDown(code);
  }

  update(dt) {
    super.update(dt);
    Attract.update(dt);
    this.coinPop = Math.max(0, this.coinPop - dt * 3);
    if (this.pipPop) this.pipPop.t += dt;
    for (const s of this.sparks) {
      s.t += dt;
      s.vy += 700 * G.u * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.r += dt * 8;
    }
    this.sparks = this.sparks.filter((s) => s.t < s.life);
  }

  drawCard(ctx, b, t, u, focused) {
    const appear = ease.outBack(clamp((t - b.delay) / 0.4, 0, 1));
    if (appear <= 0) return;
    const d = Save.data;
    const sk = b.skin;
    const owned = d.skins.includes(sk.id);
    const equipped = d.skin === sk.id;
    const afford = d.coins >= sk.price;
    const { w, h } = b;
    const shake = b.wobble > 0 ? Math.sin(b.wobble * 40) * b.wobble * 8 * u : 0;
    ctx.save();
    ctx.translate(b.x + shake, b.y);
    const sc = appear * (1 + b.hover * 0.04 - b.press * 0.05);
    ctx.scale(sc, sc);
    const r = 16 * u;
    if (focused) {
      ctx.strokeStyle = rgba(PAL.ink, 0.5 + 0.4 * Math.sin(t * 6));
      ctx.lineWidth = 4 * u;
      roundRect(ctx, -w / 2 - 7 * u, -h / 2 - 7 * u, w + 14 * u, h + 14 * u, r + 7 * u);
      ctx.stroke();
    }
    const base = equipped ? PAL.sun : owned ? '#f6ecd9' : '#ded6e6';
    ctx.fillStyle = PAL.ink;
    roundRect(ctx, -w / 2 - 3 * u, -h / 2 - 3 * u, w + 6 * u, h + 9 * u, r + 3 * u);
    ctx.fill();
    ctx.fillStyle = shade(base, -0.25);
    roundRect(ctx, -w / 2, -h / 2 + 3 * u, w, h, r);
    ctx.fill();
    ctx.fillStyle = base;
    roundRect(ctx, -w / 2, -h / 2, w, h, r);
    ctx.fill();
    const art = SKIN_ART[sk.id];
    ctx.fillStyle = rgba(art.body, 0.18);
    roundRect(ctx, -w / 2 + 6 * u, -h / 2 + 6 * u, w - 12 * u, h * 0.5, r * 0.7);
    ctx.fill();
    const vs = Math.min(w / 72, h / 80);
    const bob = Math.sin(t * 3 + b.delay * 10) * 2 * u;
    paintVan(ctx, sk.id, 0, -h * 0.2 + bob, vs, -0.3 + (equipped ? Math.sin(t * 2) * 0.08 : 0));
    if (!owned) {
      ctx.fillStyle = rgba(PAL.ink, 0.35);
      roundRect(ctx, -w / 2 + 6 * u, -h / 2 + 6 * u, w - 12 * u, h * 0.5, r * 0.7);
      ctx.fill();
      icon(ctx, 'lock', w / 2 - 20 * u, -h / 2 + 22 * u, 20 * u, PAL.cream);
    }
    const nameSize = fit(ctx, sk.name, Math.min(17 * u, h * 0.15), w - 16 * u);
    text(ctx, sk.name, 0, h * 0.2, nameSize, { color: PAL.ink, stroke: false });
    const ly = h * 0.37;
    if (equipped) {
      text(ctx, 'EQUIPPED', 0, ly, Math.min(14 * u, w * 0.13), { color: PAL.ink, stroke: false });
    } else if (owned) {
      text(ctx, 'EQUIP', 0, ly, 15 * u, { color: shade(PAL.teal, -0.3), stroke: false });
    } else {
      const label = String(sk.price);
      const lw = measure(ctx, label, 16 * u);
      icon(ctx, 'coin', -lw / 2 - 6 * u, ly, 16 * u);
      text(ctx, label, 6 * u, ly + 1 * u, 16 * u, { color: afford ? shade(PAL.teal, -0.35) : PAL.coral, stroke: false });
    }
    ctx.restore();
  }

  draw(ctx) {
    Attract.draw(ctx, 0.45);
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    const u = G.u;
    const t = this.t;
    const d = Save.data;
    // Header.
    const ha = ease.outBack(clamp(t / 0.4, 0, 1));
    const tx = this.back.x + this.back.w / 2 + 16 * u;
    ctx.save();
    ctx.translate(tx, this.header.y);
    ctx.scale(ha, ha);
    text(ctx, 'GARAGE', 0, 0, (this.back.iconOnly ? 28 : 36) * u, { color: PAL.sun, align: 'left' });
    ctx.restore();
    const coins = String(d.coins);
    const cw = measure(ctx, coins, 24 * u) + 58 * u;
    const ch = 42 * u;
    const cx = G.w - 14 * u - G.safe.r - cw;
    ctx.save();
    ctx.translate(cx + cw / 2, this.header.y);
    ctx.scale(1 + this.coinPop * 0.15, 1 + this.coinPop * 0.15);
    pill(ctx, -cw / 2, -ch / 2, cw, ch, PAL.ink, u);
    icon(ctx, 'coin', -cw / 2 + ch / 2 + 2 * u, 0, ch * 0.7);
    text(ctx, coins, cw / 2 - 12 * u, 2 * u, 24 * u, { align: 'right', color: PAL.sun });
    ctx.restore();

    // Upgrades panel.
    const U = this.upBox;
    const pa = ease.outCubic(clamp((t - 0.1) / 0.35, 0, 1));
    ctx.save();
    ctx.globalAlpha = pa;
    ctx.translate(0, (1 - pa) * 30 * u);
    panel(ctx, U.x, U.y, U.w, U.h, u, { header: PAL.coral, headerH: 42 * u });
    text(ctx, 'UPGRADES', U.x + U.w / 2, U.y + 22 * u, 22 * u);
    this.upButtons.forEach((b, i) => {
      const up = b.upgrade;
      const ry = U.y + 50 * u + i * U.rowH + U.rowH / 2;
      if (i > 0) {
        ctx.fillStyle = rgba(PAL.ink, 0.08);
        ctx.fillRect(U.x + 14 * u, ry - U.rowH / 2, U.w - 28 * u, 2 * u);
      }
      const is = Math.min(36 * u, U.rowH * 0.62);
      ctx.fillStyle = PAL.ink;
      roundRect(ctx, U.x + 14 * u, ry - is / 2 - 2 * u, is + 4 * u, is + 4 * u, 10 * u);
      ctx.fill();
      ctx.fillStyle = PAL.teal;
      roundRect(ctx, U.x + 16 * u, ry - is / 2, is, is, 8 * u);
      ctx.fill();
      icon(ctx, UP_ICONS[up.id], U.x + 16 * u + is / 2, ry, is * 0.72, PAL.cream, { bg: PAL.teal });
      const tx = U.x + 28 * u + is;
      const avail = b.x - b.w / 2 - tx - 10 * u;
      const ns = fit(ctx, up.name, Math.min(20 * u, U.rowH * 0.34), avail);
      text(ctx, up.name, tx, ry - U.rowH * 0.15, ns, { align: 'left', color: PAL.ink, stroke: false });
      const lvl = d.upgrades[up.id];
      const pip = Math.min(13 * u, U.rowH * 0.22);
      const showDesc = avail > 5 * (pip + 5 * u) + measure(ctx, UP_DESC[up.id], 12 * u) + 16 * u;
      for (let k = 0; k < up.prices.length; k++) {
        const px = tx + k * (pip + 5 * u);
        const py = ry + U.rowH * 0.08;
        const pp = this.pipPop;
        const popped = pp && pp.id === up.id && pp.k === k ? 1 + 0.6 * Math.max(0, 1 - pp.t * 3) * Math.sin(Math.min(pp.t * 3, 1) * Math.PI) : 1;
        ctx.save();
        ctx.translate(px + pip / 2, py + pip / 2);
        ctx.scale(popped, popped);
        ctx.fillStyle = PAL.ink;
        roundRect(ctx, -pip / 2, -pip / 2, pip, pip, 3 * u);
        ctx.fill();
        ctx.fillStyle = k < lvl ? PAL.sun : '#d9cfbe';
        roundRect(ctx, -pip / 2 + 2 * u, -pip / 2 + 2 * u, pip - 4 * u, pip - 4 * u, 2 * u);
        ctx.fill();
        ctx.restore();
      }
      if (showDesc) {
        text(ctx, UP_DESC[up.id], tx + 5 * (pip + 5 * u) + 8 * u, ry + U.rowH * 0.08 + pip / 2, 12 * u, { align: 'left', color: shade(PAL.ink, 0.35), stroke: false });
      }
    });
    ctx.restore();

    // Vans panel.
    const Vb = this.vanBox;
    const pb = ease.outCubic(clamp((t - 0.18) / 0.35, 0, 1));
    ctx.save();
    ctx.globalAlpha = pb;
    ctx.translate(0, (1 - pb) * 30 * u);
    panel(ctx, Vb.x, Vb.y, Vb.w, Vb.h, u, { header: PAL.teal, headerH: 42 * u });
    text(ctx, 'VANS', Vb.x + Vb.w / 2, Vb.y + 22 * u, 22 * u);
    ctx.restore();

    this.ui.draw(ctx, t, u, G.lastDevice !== 'touch' && this.ui.focus >= 0);
    for (const s of this.sparks) {
      ctx.globalAlpha = 1 - s.t / s.life;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.r);
      ctx.fillStyle = s.c;
      ctx.fillRect(-s.s / 2, -s.s / 4, s.s, s.s / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
