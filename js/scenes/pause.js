// Pause menu overlay.
import { G, placeModal, modalSpace } from '../state.js';
import { PAL } from '../art.js';
import { Sound } from '../audio.js';
import { Scene } from './base.js';
import { Button, text, panel } from '../ui.js';
import { SettingsOverlay } from './settings.js';
import { ease, clamp, rgba } from '../util.js';

export class PauseOverlay extends Scene {
  constructor(game) {
    super();
    this.game = game;
    this.freezeBelow = true;
  }

  enter() {
    Sound.whoosh();
    const close = () => {
      G.popOverlay(this);
      this.game.resume();
    };
    this.resumeBtn = this.ui.add(new Button({ label: 'RESUME', icon: 'play', color: PAL.coral, delay: 0.08, onClick: close }));
    this.restartBtn = this.ui.add(new Button({ label: 'RESTART', icon: 'restart', color: PAL.teal, delay: 0.14, onClick: () => this.game.restart() }));
    this.settingsBtn = this.ui.add(new Button({ label: 'SETTINGS', icon: 'gear', color: PAL.plum, delay: 0.2, onClick: () => G.pushOverlay(new SettingsOverlay()) }));
    this.quitBtn = this.ui.add(new Button({ label: 'QUIT', icon: 'home', color: '#7c8aa8', delay: 0.26, sound: 'back', onClick: () => G.toTitle() }));
    this.close = close;
  }

  layout() {
    const u = G.u;
    const bh = Math.min(58 * u, (modalSpace() - 104 * u) / 4.96);
    const gap = bh * 0.32;
    const w = Math.min(320 * u, G.w - 40 * u);
    const h = 74 * u + 4 * bh + 3 * gap + 30 * u;
    this.box = { x: G.w / 2 - w / 2, y: placeModal(h), w, h };
    [this.resumeBtn, this.restartBtn, this.settingsBtn, this.quitBtn].forEach((b, i) => {
      Object.assign(b, { x: G.w / 2, y: this.box.y + 74 * u + i * (bh + gap) + bh / 2, w: w - 50 * u, h: bh });
    });
  }

  keyDown(code) {
    if (code === 'Escape' || code === 'KeyP') {
      Sound.click();
      this.close();
      return true;
    }
    return super.keyDown(code);
  }

  draw(ctx) {
    const u = G.u;
    const a = ease.outCubic(clamp(this.t / 0.25, 0, 1)) * this.fade;
    ctx.fillStyle = rgba(PAL.ink, 0.55 * a);
    ctx.fillRect(0, 0, G.w, G.h);
    const B = this.box;
    const s = ease.outBack(clamp(this.t / 0.35, 0, 1)) * (0.9 + 0.1 * this.fade);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(G.w / 2, B.y + B.h / 2);
    ctx.scale(s, s);
    ctx.translate(-G.w / 2, -(B.y + B.h / 2));
    panel(ctx, B.x, B.y, B.w, B.h, u, { header: PAL.ink, headerH: 58 * u });
    text(ctx, 'PAUSED', G.w / 2, B.y + 30 * u, 32 * u, { color: PAL.sun });
    this.ui.draw(ctx, this.t, u, G.lastDevice !== 'touch' && this.ui.focus >= 0);
    ctx.restore();
  }
}
