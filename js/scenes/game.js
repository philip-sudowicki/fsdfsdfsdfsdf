// Gameplay scene: drives a Shift, the camera, controls and the HUD.
import { CONFIG } from '../config.js';
import { G } from '../state.js';
import { PAL } from '../art.js';
import { Poki } from '../poki.js';
import { Sound } from '../audio.js';
import { Save } from '../save.js';
import { Shift } from '../shift.js';
import { HUD } from '../hud.js';
import { Scene } from './base.js';
import { Button, text } from '../ui.js';
import { PauseOverlay } from './pause.js';
import { TimeUpOverlay } from './timeup.js';
import { ResultsOverlay } from './results.js';
import { clamp, damp, ease, dist } from '../util.js';

export class GameScene extends Scene {
  enter(params = {}) {
    this.shift = new Shift(G.town, !!params.tutorial);
    const v = this.shift.van;
    this.cam = { x: v.x, y: v.y, zoom: G.zoom };
    this.hud = new HUD();
    this.joy = null;
    this.brakeId = null;
    this.throwId = null;
    this.throwQueued = false;
    this.handledTimeUp = false;
    this.resultsShown = false;
    this.overT = 0;
    this.banner = { str: 'SHIFT START!', t: 0, life: 1.6, color: PAL.sun };
    this.pauseBtn = this.ui.add(new Button({ icon: 'pause', iconOnly: true, color: PAL.ink, delay: 0.2, onClick: () => this.pause() }));
    this.skipBtn = this.ui.add(new Button({ label: 'SKIP', color: PAL.plum, delay: 0.6, visible: false, onClick: () => this.shift.finishTutorial() }));
    Sound.playSong('game');
    Sound.engineStart();
    Poki.gameplayStart();
  }

  exit() {
    Sound.engineStop();
    Sound.tension = false;
    Poki.gameplayStop();
  }

  layout() {
    const u = G.u;
    this.hud.layout();
    const P = this.hud.L.pause;
    Object.assign(this.pauseBtn, { x: P.x, y: P.y - 3 * u, w: P.r * 2, h: P.r * 2 - 6 * u });
    Object.assign(this.skipBtn, { w: 70 * u, h: 36 * u, size: 16 * u });
  }

  get playing() {
    return this.shift.state === 'play';
  }

  pause() {
    if (!this.playing || G.overlays.some((o) => !o.leaving)) return;
    Poki.gameplayStop();
    Sound.engineStop();
    this.releaseControls();
    G.pushOverlay(new PauseOverlay(this));
  }

  resume() {
    Poki.gameplayStart();
    Sound.engineStart();
  }

  onHidden() {
    this.pause();
  }

  releaseControls() {
    this.joy = null;
    this.brakeId = null;
    this.throwId = null;
    this.hud.brakeHeld = false;
    this.throwQueued = false;
  }

  restart() {
    G.withCommercialBreak(() => G.setScene(new GameScene(), { tutorial: !Save.data.tutorialSeen }));
  }

  // ---- Time up flow ----

  onTimeUp() {
    this.handledTimeUp = true;
    Poki.gameplayStop();
    Sound.engineStop();
    this.releaseControls();
    if (!this.shift.rewardUsed) G.pushOverlay(new TimeUpOverlay(this));
    else this.finish();
  }

  continueWithBonus() {
    const s = this.shift;
    s.rewardUsed = true;
    s.time = CONFIG.ads.rewardSeconds;
    s.lastTick = Math.ceil(s.time);
    s.state = 'play';
    s.hud.timeGain = CONFIG.ads.rewardSeconds;
    s.hud.timePop = 1;
    this.handledTimeUp = false;
    this.banner = { str: `+${CONFIG.ads.rewardSeconds} SECONDS!`, t: 0, life: 1.6, color: PAL.teal };
    Sound.engineStart();
    Sound.fanfare();
    Poki.gameplayStart();
  }

  finish() {
    const s = this.shift;
    s.state = 'over';
    s.finishTutorial();
    this.banner = { str: "TIME'S UP!", t: 0, life: 1.5, color: PAL.coral };
    this.overT = 0;
    Sound.tension = false;
    Poki.gameplayStop();
  }

  // ---- Input ----

  readControls() {
    const k = G.keys;
    const steer = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    const brake = k.has('ArrowDown') || k.has('KeyS') || this.brakeId !== null;
    let joy = false, joyAngle = 0, joyMag = 0;
    if (this.joy) {
      const R = CONFIG.van.joystickRadius * G.u;
      const dx = this.joy.kx - this.joy.ax, dy = this.joy.ky - this.joy.ay;
      const mag = Math.hypot(dx, dy) / R;
      const dz = CONFIG.van.joystickDeadzone;
      if (mag > dz) {
        joy = true;
        joyAngle = Math.atan2(dy, dx);
        joyMag = clamp(((mag - dz) / (1 - dz)) * 1.6, 0, 1);
      }
    }
    const throwPressed = this.throwQueued;
    this.throwQueued = false;
    return { steer, brake, joy, joyAngle, joyMag, throwPressed };
  }

  pointerDown(p) {
    if (this.ui.pointerDown(p)) return true;
    if (!this.playing) return false;
    const L = this.hud.L;
    if (G.touchUI) {
      if (dist(p.x, p.y, L.throwBtn.x, L.throwBtn.y) < L.throwBtn.r * 1.2) {
        this.throwQueued = true;
        this.throwId = p.id;
        this.hud.throwFlash = 1;
        return true;
      }
      if (dist(p.x, p.y, L.brakeBtn.x, L.brakeBtn.y) < L.brakeBtn.r * 1.25) {
        this.brakeId = p.id;
        this.hud.brakeHeld = true;
        return true;
      }
    }
    if (!this.joy && p.x < G.w * 0.6) {
      this.joy = { id: p.id, ax: p.x, ay: p.y, kx: p.x, ky: p.y };
      return true;
    }
    return false;
  }

  pointerMove(p) {
    this.ui.pointerMove(p);
    const j = this.joy;
    if (j && p.id === j.id) {
      const R = CONFIG.van.joystickRadius * G.u;
      let dx = p.x - j.ax, dy = p.y - j.ay;
      const d = Math.hypot(dx, dy);
      if (d > R * 1.35) {
        // Let the stick base follow the thumb so steering never runs out.
        j.ax += (dx / d) * (d - R * 1.35);
        j.ay += (dy / d) * (d - R * 1.35);
        dx = p.x - j.ax;
        dy = p.y - j.ay;
      }
      const dd = Math.hypot(dx, dy);
      const s = dd > R ? R / dd : 1;
      j.kx = j.ax + dx * s;
      j.ky = j.ay + dy * s;
    }
  }

  pointerUp(p, cancelled) {
    if (cancelled) this.ui.cancel();
    else this.ui.pointerUp(p);
    if (this.joy && this.joy.id === p.id) this.joy = null;
    if (this.brakeId === p.id) {
      this.brakeId = null;
      this.hud.brakeHeld = false;
    }
    if (this.throwId === p.id) {
      this.throwId = null;
      this.hud.throwFlash = 0;
    }
  }

  keyDown(code) {
    if (code === 'Escape' || code === 'KeyP') {
      this.pause();
      return true;
    }
    if (code === 'Space') {
      if (this.playing) this.throwQueued = true;
      return true;
    }
    return false;
  }

  // ---- Update ----

  update(dt, covered) {
    this.t += dt;
    this.ui.update(dt);
    if (covered) return;
    const s = this.shift;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.life) this.banner = null;
    }
    const ctrl = this.readControls();
    const r = G.renderer;
    s.update(dt, ctrl, { inView: (x, y, pad) => r.visible(x, y, pad) });
    if (s.state === 'timeup' && !this.handledTimeUp) this.onTimeUp();
    if (s.state === 'over') {
      this.overT += dt;
      if (this.overT > 1.3 && !this.resultsShown) {
        this.resultsShown = true;
        G.pushOverlay(new ResultsOverlay(this), s.results());
      }
    }
    // Camera.
    const v = s.van;
    const C = CONFIG.camera;
    const tx = v.x + v.vx * C.lead, ty = v.y + v.vy * C.lead;
    this.cam.x = damp(this.cam.x, tx, C.follow, dt);
    this.cam.y = damp(this.cam.y, ty, C.follow, dt);
    const sf = clamp(v.speed / s.stats.maxSpeed, 0, 1);
    this.cam.zoom = damp(this.cam.zoom, G.zoom * (1 - C.speedZoomOut * sf), 2, dt);
    const hw = G.w / 2 / this.cam.zoom, hh = G.h / 2 / this.cam.zoom;
    const W = G.world.width, H = G.world.height;
    this.cam.x = W > hw * 2 ? clamp(this.cam.x, hw, W - hw) : W / 2;
    this.cam.y = H > hh * 2 ? clamp(this.cam.y, hh, H - hh) : H / 2;
    this.hud.update(dt, s);
    if (this.hud.throwFlash && this.throwId === null) this.hud.throwFlash = Math.max(0, this.hud.throwFlash - dt * 6);
  }

  // ---- Draw ----

  draw(ctx) {
    const s = this.shift;
    const r = G.renderer;
    const [sx, sy] = s.fx.shakeOffset();
    r.begin(this.cam, G.w, G.h, G.dpr, sx / this.cam.zoom, sy / this.cam.zoom);
    const tg = s.target;
    let target = null, houseGlow = null, color = PAL.coral;
    if (s.state === 'play' && tg) {
      if (tg.depot) target = { depot: true };
      else if (tg.house) {
        target = { mat: tg.house.mat };
        houseGlow = tg.house;
        color = tg.kind === 'express' ? PAL.coral : tg.kind === 'fragile' ? PAL.plum : PAL.sun;
      }
    }
    const nearTarget = target && target.mat && dist(s.van.x, s.van.y, target.mat.x, target.mat.y) < CONFIG.throwMeter.radius * 1.8;
    r.drawTown(G.town, {
      van: s.van, skin: s.skin, bed: s.bed, time: this.t, target, houseGlow, color,
      showRadius: nearTarget, radius: CONFIG.throwMeter.radius, inRange: s.meter.inRange,
    });
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    this.hud.draw(ctx, s, r, this.t, this.joy);
    const card = this.hud.drawPrompt(ctx);
    const showSkip = !!card && card.k > 0.6 && !!s.tut;
    if (showSkip && !this.skipBtn.visible) this.skipBtn.delay = this.t;
    this.skipBtn.visible = showSkip;
    if (card) {
      this.skipBtn.x = card.x + card.w - this.skipBtn.w / 2 - 12 * G.u;
      this.skipBtn.y = card.y + card.h / 2 - 3 * G.u;
    }
    this.drawBanner(ctx);
    this.pauseBtn.visible = this.playing;
    this.ui.draw(ctx, this.t, G.u, false);
  }

  drawBanner(ctx) {
    const b = this.banner;
    if (!b) return;
    const u = G.u;
    const k = b.t / b.life;
    const pop = ease.outBack(clamp(b.t / 0.35, 0, 1));
    const out = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    const size = Math.min(64 * u, G.w * 0.1);
    ctx.save();
    ctx.translate(G.w / 2, G.h * 0.36);
    ctx.scale(pop * (0.9 + 0.1 * out), pop * (0.9 + 0.1 * out));
    ctx.rotate(-0.04);
    text(ctx, b.str, 0, 0, size, { color: b.color, alpha: out, sw: size * 0.22 });
    ctx.restore();
  }
}
