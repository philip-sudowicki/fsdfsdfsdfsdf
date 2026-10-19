// Title screen: logo, animated town, Play / Garage / Settings.
import { G, portrait } from '../state.js';
import { PAL, paintVan, paintParcel } from '../art.js';
import { Save } from '../save.js';
import { Sound } from '../audio.js';
import { Poki } from '../poki.js';
import { Attract } from '../attract.js';
import { Scene } from './base.js';
import { Button, text, icon, pill, measure } from '../ui.js';
import { GarageScene } from './garage.js';
import { SettingsOverlay } from './settings.js';
import { ease, clamp } from '../util.js';

export function drawLogo(ctx, cx, cy, size, t) {
  const words = [['PARCEL', PAL.cream, -0.05], ['DASH', PAL.sun, 0.04]];
  ctx.save();
  ctx.translate(cx, cy);
  const lineGap = size * 0.98;
  words.forEach(([word, color, tilt], wi) => {
    const s = wi === 1 ? size * 1.22 : size;
    ctx.font = `${Math.round(s)}px Lilita, sans-serif`;
    const total = measure(ctx, word, s) + (word.length - 1) * s * 0.02;
    let x = -total / 2;
    const y = (wi === 0 ? -lineGap / 2 : lineGap / 2) + (wi === 1 ? s * 0.06 : 0);
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      const cw = measure(ctx, ch, s);
      const delay = 0.08 + (wi * 6 + i) * 0.05;
      const k = ease.outElastic(clamp((t - delay) / 0.9, 0, 1));
      const bob = Math.sin(t * 2.4 + i * 0.6 + wi) * s * 0.025;
      ctx.save();
      ctx.translate(x + cw / 2, y + bob);
      ctx.rotate(tilt + Math.sin(t * 1.7 + i) * 0.015);
      ctx.scale(k, k);
      text(ctx, ch, 0, 0, s, { color, sw: s * 0.22 });
      ctx.restore();
      x += cw + s * 0.02;
    }
  });
  // A parcel tumbling off the D.
  const pk = ease.outBack(clamp((t - 0.9) / 0.5, 0, 1));
  ctx.save();
  ctx.translate(size * 2.05, -size * 0.55 + Math.sin(t * 3) * size * 0.06);
  ctx.rotate(0.3 + Math.sin(t * 2) * 0.1);
  ctx.scale(pk, pk);
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(-size * 0.36, -size * 0.31, size * 0.72, size * 0.62);
  paintParcel(ctx, 0, 0, size * 0.6, size * 0.5, 'normal');
  ctx.restore();
  ctx.restore();
}

export class TitleScene extends Scene {
  enter() {
    Attract.reset();
    Sound.playSong('menu');
    Sound.engineStop();
    Poki.gameplayStop();
    this.play = this.ui.add(new Button({ label: 'PLAY', icon: 'play', color: PAL.coral, delay: 0.55, onClick: () => G.startShift() }));
    this.garage = this.ui.add(new Button({ label: 'GARAGE', icon: 'wrench', color: PAL.teal, delay: 0.65, onClick: () => G.setScene(new GarageScene()) }));
    this.settings = this.ui.add(new Button({ label: 'SETTINGS', icon: 'gear', color: PAL.plum, delay: 0.72, onClick: () => G.pushOverlay(new SettingsOverlay()) }));
  }

  layout() {
    const u = G.u;
    const port = portrait();
    const cx = G.w / 2;
    if (port) {
      this.logo = { x: cx, y: G.h * 0.27, size: Math.min(G.w * 0.17, 84 * u) };
      Object.assign(this.play, { x: cx, y: G.h * 0.6, w: 250 * u, h: 76 * u });
      const bw = Math.min(170 * u, (G.w - 52 * u) / 2);
      Object.assign(this.garage, { x: cx - bw / 2 - 8 * u, y: this.play.y + 96 * u, w: bw, h: 58 * u });
      Object.assign(this.settings, { x: cx + bw / 2 + 8 * u, y: this.play.y + 96 * u, w: bw, h: 58 * u });
    } else {
      const size = Math.min(G.h * 0.13, 74 * u, G.w * 0.075);
      this.logo = { x: cx, y: G.h * 0.28, size };
      const ph = Math.min(70 * u, G.h * 0.16);
      Object.assign(this.play, { x: cx, y: G.h * 0.6, w: 240 * u, h: ph });
      const bh = Math.min(56 * u, G.h * 0.13);
      Object.assign(this.garage, { x: cx - 92 * u, y: this.play.y + ph / 2 + bh / 2 + 26 * u, w: 168 * u, h: bh });
      Object.assign(this.settings, { x: cx + 92 * u, y: this.garage.y, w: 168 * u, h: bh });
    }
  }

  update(dt) {
    super.update(dt);
    Attract.update(dt);
  }

  draw(ctx) {
    Attract.draw(ctx, 0.2);
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    const u = G.u;
    const t = this.t;
    const L = this.logo;
    // Van zooming across under the logo.
    const vx = ((t * 260 * u) % (G.w + 400 * u)) - 200 * u;
    const vy = L.y + L.size * 1.55;
    ctx.globalAlpha = 0.9;
    for (let i = 1; i < 4; i++) {
      ctx.fillStyle = 'rgba(255,244,224,0.35)';
      ctx.fillRect(vx - (40 + i * 26) * u, vy - 10 * u + i * 6 * u, 22 * u, 3 * u);
    }
    ctx.globalAlpha = 1;
    paintVan(ctx, Save.data.skin, vx, vy, 1.5 * u, 0);
    drawLogo(ctx, L.x, L.y, L.size, t);
    this.ui.draw(ctx, t, u, G.lastDevice !== 'touch' && this.ui.focus >= 0);
    // Wallet and best score chips, kept clear of the top-centre.
    const a = ease.outCubic(clamp((t - 0.4) / 0.5, 0, 1));
    ctx.globalAlpha = a;
    const m = 14 * u;
    const h = 38 * u;
    const coins = String(Save.data.coins);
    const cw = measure(ctx, coins, 22 * u) + 56 * u;
    pill(ctx, m + G.safe.l, m + G.safe.t, cw, h, PAL.ink, u);
    icon(ctx, 'coin', m + G.safe.l + h / 2 + 2 * u, m + G.safe.t + h / 2, h * 0.7);
    text(ctx, coins, m + G.safe.l + cw - 12 * u, m + G.safe.t + h / 2 + 2 * u, 22 * u, { align: 'right', color: PAL.sun });
    const best = `BEST ${Save.data.best}`;
    const bw = measure(ctx, best, 20 * u) + 52 * u;
    const bx = G.w - m - G.safe.r - bw;
    pill(ctx, bx, m + G.safe.t, bw, h, PAL.ink, u);
    icon(ctx, 'star', bx + h / 2 + 2 * u, m + G.safe.t + h / 2, h * 0.62, PAL.sun);
    text(ctx, best, bx + bw - 12 * u, m + G.safe.t + h / 2 + 2 * u, 20 * u, { align: 'right' });
    ctx.globalAlpha = 1;
  }
}
