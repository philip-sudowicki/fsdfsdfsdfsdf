// "Out of time" overlay offering +20 seconds for watching a rewarded ad.
import { CONFIG } from '../config.js';
import { G, placeModal, modalSpace } from '../state.js';
import { PAL } from '../art.js';
import { Sound } from '../audio.js';
import { Scene } from './base.js';
import { Button, text, panel, icon, wrap } from '../ui.js';
import { ease, clamp, rgba, shade } from '../util.js';

export class TimeUpOverlay extends Scene {
  constructor(game) {
    super();
    this.game = game;
    this.freezeBelow = true;
    this.busy = false;
  }

  enter() {
    Sound.whoosh();
    this.watch = this.ui.add(new Button({ label: `+${CONFIG.ads.rewardSeconds} SECONDS`, icon: 'ad', color: '#6cc08b', delay: 0.25, badge: 'AD', onClick: () => this.watchAd() }));
    this.skip = this.ui.add(new Button({ label: 'FINISH SHIFT', color: '#7c8aa8', delay: 0.35, sound: 'back', onClick: () => this.decline() }));
  }

  watchAd() {
    if (this.busy) return;
    this.busy = true;
    G.withRewardedBreak().then((ok) => {
      G.popOverlay(this);
      if (ok) this.game.continueWithBonus();
      else this.game.finish();
    });
  }

  decline() {
    if (this.busy) return;
    this.busy = true;
    G.popOverlay(this);
    this.game.finish();
  }

  layout() {
    const u = G.u;
    const w = Math.min(440 * u, G.w - 32 * u);
    const bh = Math.min(60 * u, G.h * 0.13);
    const h = Math.min(modalSpace(), 150 * u + bh * 2 + 30 * u);
    this.box = { x: G.w / 2 - w / 2, y: placeModal(h), w, h };
    Object.assign(this.watch, { x: G.w / 2, y: this.box.y + h - bh * 1.5 - 30 * u, w: w - 60 * u, h: bh });
    Object.assign(this.skip, { x: G.w / 2, y: this.box.y + h - bh * 0.5 - 16 * u, w: w * 0.6, h: bh * 0.78, size: 20 * u });
  }

  draw(ctx) {
    const u = G.u;
    const a = ease.outCubic(clamp(this.t / 0.25, 0, 1)) * this.fade;
    ctx.fillStyle = rgba(PAL.ink, 0.55 * a);
    ctx.fillRect(0, 0, G.w, G.h);
    const B = this.box;
    const s = ease.outBack(clamp(this.t / 0.4, 0, 1)) * (0.9 + 0.1 * this.fade);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(G.w / 2, B.y + B.h / 2);
    ctx.scale(s, s);
    ctx.translate(-G.w / 2, -(B.y + B.h / 2));
    panel(ctx, B.x, B.y, B.w, B.h, u, { header: PAL.coral, headerH: 58 * u });
    icon(ctx, 'clock', B.x + 40 * u, B.y + 29 * u, 34 * u, PAL.cream);
    text(ctx, 'OUT OF TIME!', G.w / 2 + 14 * u, B.y + 30 * u, 30 * u);
    const lines = wrap(ctx, `Watch a short ad to keep driving with ${CONFIG.ads.rewardSeconds} more seconds?`, 19 * u, B.w - 50 * u);
    lines.forEach((ln, i) => text(ctx, ln, G.w / 2, B.y + 84 * u + i * 24 * u, 19 * u, { color: PAL.ink, stroke: false }));
    text(ctx, 'An ad will play first.', G.w / 2, B.y + 84 * u + lines.length * 24 * u + 2 * u, 14 * u, { color: shade(PAL.ink, 0.35), stroke: false });
    this.ui.draw(ctx, this.t, u, G.lastDevice !== 'touch' && this.ui.focus >= 0);
    ctx.restore();
  }
}
