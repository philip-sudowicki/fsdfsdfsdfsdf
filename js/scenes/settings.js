// Settings overlay: music, sound and tutorial toggles.
import { G, placeModal, modalSpace } from '../state.js';
import { PAL } from '../art.js';
import { Save } from '../save.js';
import { Sound } from '../audio.js';
import { Scene } from './base.js';
import { Button, text, panel } from '../ui.js';
import { ease, clamp, rgba } from '../util.js';

export class SettingsOverlay extends Scene {
  constructor() {
    super();
    this.freezeBelow = true;
  }

  enter() {
    Sound.whoosh();
    const toggle = (key, on) => {
      Save.data[key] = on;
      Save.write();
      Sound.applyVolumes(false);
      this.refresh();
    };
    this.done = this.ui.add(new Button({ label: 'DONE', icon: 'check', color: PAL.coral, delay: 0.3, sound: 'back', onClick: () => G.popOverlay(this) }));
    this.music = this.ui.add(new Button({ delay: 0.12, onClick: () => toggle('music', !Save.data.music) }));
    this.sound = this.ui.add(new Button({ delay: 0.18, onClick: () => toggle('sound', !Save.data.sound) }));
    this.tut = this.ui.add(new Button({ delay: 0.24, onClick: () => { Save.data.tutorialSeen = !Save.data.tutorialSeen; Save.write(); this.refresh(); } }));
    this.refresh();
  }

  refresh() {
    const set = (b, on, iconName) => {
      b.label = on ? 'ON' : 'OFF';
      b.color = on ? '#6cc08b' : '#a7a3b5';
      b.icon = iconName;
      b.iconOpts = { off: !on };
    };
    set(this.music, Save.data.music, 'music');
    set(this.sound, Save.data.sound, 'sound');
    set(this.tut, !Save.data.tutorialSeen, 'play');
  }

  layout() {
    const u = G.u;
    const w = Math.min(420 * u, G.w - 32 * u);
    const rowH = Math.min(54 * u, (modalSpace() - 132 * u) / 4);
    const h = rowH * 4 + 132 * u;
    this.box = { x: G.w / 2 - w / 2, y: placeModal(h), w, h, rowH };
    const bx = this.box.x + w - 82 * u;
    const y0 = this.box.y + 78 * u;
    [this.music, this.sound, this.tut].forEach((b, i) => {
      Object.assign(b, { x: bx, y: y0 + i * (rowH + 10 * u) + rowH / 2, w: 124 * u, h: rowH * 0.86 });
    });
    Object.assign(this.done, { x: G.w / 2, y: this.box.y + h - rowH * 0.5 - 14 * u, w: 190 * u, h: rowH });
  }

  keyDown(code) {
    if (code === 'Escape' || code === 'KeyP') {
      Sound.back();
      G.popOverlay(this);
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
    panel(ctx, B.x, B.y, B.w, B.h, u, { header: PAL.plum, headerH: 58 * u });
    text(ctx, 'SETTINGS', G.w / 2, B.y + 30 * u, 30 * u);
    const labels = ['Music', 'Sound', 'Tutorial'];
    [this.music, this.sound, this.tut].forEach((b, i) => {
      text(ctx, labels[i], B.x + 26 * u, b.y + 2 * u, 24 * u, { align: 'left', color: PAL.ink, stroke: false });
    });
    this.ui.draw(ctx, this.t, u, G.lastDevice !== 'touch' && this.ui.focus >= 0);
    ctx.restore();
  }
}
