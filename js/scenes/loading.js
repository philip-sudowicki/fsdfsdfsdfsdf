// Loading screen: font, SDK init and sprite pre-rendering with a progress bar.
import { CONFIG } from '../config.js';
import { G } from '../state.js';
import { Poki } from '../poki.js';
import { Art, PAL } from '../art.js';
import { Scene } from './base.js';
import { TitleScene } from './title.js';
import { text } from '../ui.js';
import { damp, roundRect, rgba, ease, clamp } from '../util.js';
import { paintVan } from '../art.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const PUFF_COLORS = ['#d9c39a', '#eee6d8', '#e8e2d6', '#e2c995', '#c9b48a', '#d8d2c8', '#d8cbb0', '#e8dcc4', '#ff4f5e'];
const DOT_COLORS = [PAL.coral, PAL.sun, PAL.teal, PAL.plum, PAL.cream, '#7cc95f', '#8ddcea', '#fff4e0', '#4f9e5c', '#3f8a6a'];

function buildTasks() {
  const w = G.world;
  const tasks = [];
  const seen = new Set();
  for (const info of w.info) {
    if (seen.has(info.key)) continue;
    seen.add(info.key);
    tasks.push(() => Art.ground(info));
  }
  const hs = new Set();
  for (const h of w.houses) {
    const k = `${h.style}:${h.color}:${h.chimney}`;
    if (hs.has(k)) continue;
    hs.add(k);
    tasks.push(() => {
      Art.house(h);
      Art.shadow(h.w, h.d, 4, 8);
    });
  }
  const ts = new Set();
  for (const t of w.trees) {
    const k = t.kind + t.variant;
    if (ts.has(k)) continue;
    ts.add(k);
    tasks.push(() => Art.tree(t.kind, t.variant));
  }
  for (let s = 0; s < 2; s++) for (let c = 0; c < 6; c++) tasks.push(() => Art.car(s, c));
  for (const sk of CONFIG.skins) tasks.push(() => Art.van(sk.id));
  tasks.push(() => {
    Art.fleetVan(); Art.ramp(); Art.lamp(); Art.bin(); Art.cone();
    for (const k of ['normal', 'express', 'fragile']) { Art.parcel(k); Art.bedBox(k); }
    for (const b of ['pigeon', 'duck']) { Art.bird(b, 0); Art.bird(b, 1); }
    for (let i = 0; i < 4; i++) Art.shed(i);
  });
  tasks.push(() => Art.depot());
  tasks.push(() => {
    Art.shadow(40, 40, 20, 8); Art.shadow(46, 24, 8, 5); Art.shadow(54, 28, 8, 5); Art.shadow(14, 14, 7, 3); Art.shadow(44, 32, 3, 6);
    for (const c of PUFF_COLORS) Art.puff(c);
    for (const c of DOT_COLORS) Art.dot(c);
  });
  return tasks;
}

export class LoadingScene extends Scene {
  enter() {
    this.progress = 0;
    this.shown = 0;
    this.tasks = null;
    this.i = 0;
    this.done = false;
    this.fontReady = false;
    this.begin();
  }

  async begin() {
    try {
      // Use the face if the host page already registered it, otherwise load the bundled file.
      let face = null;
      document.fonts.forEach((f) => { if (f.family.replace(/["']/g, '') === 'Lilita') face = f; });
      if (face) await face.load();
      else {
        const ff = new FontFace('Lilita', 'url(assets/fonts/LilitaOne-Regular.woff2)');
        await ff.load();
        document.fonts.add(ff);
      }
    } catch (e) {
      // Fall back to system fonts if the font cannot load.
    }
    this.fontReady = true;
    await Promise.race([Poki.init(), wait(6000)]);
    Art.setScale(G.spriteScale());
    G.loaded = true;
    this.tasks = buildTasks();
  }

  update(dt) {
    super.update(dt);
    if (this.tasks && this.i < this.tasks.length) {
      const start = performance.now();
      while (this.i < this.tasks.length && performance.now() - start < 12) this.tasks[this.i++]();
      this.progress = this.i / this.tasks.length;
    }
    this.shown = damp(this.shown, this.progress, 8, dt);
    if (this.progress >= 1 && this.shown > 0.99) this.shown = 1;
    if (!this.done && this.tasks && this.i >= this.tasks.length && this.shown >= 1) {
      this.done = true;
      Poki.loadingFinished();
      G.setScene(new TitleScene());
    }
  }

  draw(ctx) {
    const u = G.u;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(0, 0, G.w, G.h);
    // Soft diagonal stripes.
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = PAL.cream;
    const step = 46 * u;
    const off = (this.t * 20 * u) % (step * 2);
    for (let x = -G.h - step * 2; x < G.w + step * 2; x += step * 2) {
      ctx.beginPath();
      ctx.moveTo(x + off, 0);
      ctx.lineTo(x + off + step, 0);
      ctx.lineTo(x + off + step + G.h, G.h);
      ctx.lineTo(x + off + G.h, G.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const cx = G.w / 2, cy = G.h / 2;
    if (this.fontReady) {
      const a = ease.outBack(clamp(this.t / 0.5, 0, 1));
      const size = Math.min(64 * u, G.w * 0.12);
      ctx.save();
      ctx.translate(cx, cy - 46 * u);
      ctx.scale(a, a);
      text(ctx, 'PARCEL DASH', 0, 0, size, { color: PAL.sun, sw: size * 0.2 });
      ctx.restore();
    }
    const bw = Math.min(360 * u, G.w - 60 * u), bh = 26 * u;
    const bx = cx - bw / 2, by = cy + 24 * u;
    ctx.fillStyle = rgba('#000000', 0.25);
    roundRect(ctx, bx - 5 * u, by - 5 * u, bw + 10 * u, bh + 10 * u, bh / 2 + 5 * u);
    ctx.fill();
    ctx.fillStyle = rgba(PAL.cream, 0.15);
    roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill();
    const fw = Math.max(bh, bw * this.shown);
    ctx.fillStyle = PAL.coral;
    roundRect(ctx, bx, by, fw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.25);
    roundRect(ctx, bx + 4 * u, by + 3 * u, Math.max(0, fw - 8 * u), bh * 0.35, bh * 0.2);
    ctx.fill();
    paintVan(ctx, 'classic', bx + fw, by - 12 * u + Math.sin(this.t * 18) * 1.5 * u, 1.1 * u, 0);
    if (this.fontReady) text(ctx, `${Math.round(this.shown * 100)}%`, cx, by + bh + 26 * u, 18 * u, { sw: 4 * u });
  }
}
