// One delivery shift: timer, parcels, the throw meter, tips and specials.
import { CONFIG } from './config.js';
import { Van } from './van.js';
import { DEPOT } from './world.js';
import { Save } from './save.js';
import { Sound } from './audio.js';
import { PAL } from './art.js';
import { clamp, lerp, dist, rnd, pick, damp } from './util.js';

const TM = CONFIG.throwMeter;
const TIPS = CONFIG.tips;

function upgradeStats() {
  const up = Save.data.upgrades;
  const per = Object.fromEntries(CONFIG.upgrades.map((u) => [u.id, u.per]));
  return {
    maxSpeed: CONFIG.van.maxSpeed * (1 + up.speed * per.speed),
    turnRate: CONFIG.van.turnRate * (1 + up.handling * per.handling),
    grip: CONFIG.van.grip * (1 + up.handling * per.handling),
    capacity: CONFIG.baseCapacity + up.capacity * per.capacity,
    greenHalf: TM.green * (1 + up.green * per.green),
    startTime: CONFIG.shift.startTime + up.time * per.time,
  };
}

export class Shift {
  constructor(town, tutorial) {
    this.town = town;
    this.world = town.world;
    this.fx = town.fx;
    this.van = new Van();
    this.stats = upgradeStats();
    this.skin = Save.data.skin;
    this.time = this.stats.startTime;
    this.elapsed = 0;
    this.coins = 0;
    this.deliveries = 0;
    this.misses = 0;
    this.perfects = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.tipsEarned = 0;
    this.parcels = [];
    this.target = { depot: true };
    this.inbound = 0;
    this.loadT = 0;
    this.recent = [];
    this.meter = { show: 0, pos: 0, dir: 1, inRange: false, was: false, cooldown: 0, flash: 0, flashColor: PAL.cream };
    this.pending = null;
    this.state = 'play';
    this.slowmo = 0;
    this.hitstop = 0;
    this.rewardUsed = false;
    this.lastTick = Math.ceil(this.time);
    this.lastStop = { x: DEPOT.start.x, y: DEPOT.start.y };
    this.hud = { coinPop: 0, timePop: 0, timeGain: 0, comboPop: 0, parcelPop: 0, warn: 0 };
    this.fragileCooldown = 0;
    this.puffT = 0;
    this.dustT = 0;
    this.tut = tutorial ? { step: 0, t: 0, reloadShown: false } : null;
    town.reset();
    const s = DEPOT.start;
    this.van.reset(s.x, s.y, s.angle);
    town.traffic.maintain(s.x, s.y, CONFIG.traffic.countStart, 700);
  }

  get difficulty() {
    return clamp(Math.max(this.deliveries / CONFIG.difficulty.rampDeliveries, this.elapsed / 240), 0, 1);
  }

  get timeFrozen() {
    return !!this.tut && this.tut.step <= 1;
  }

  get timeScale() {
    if (this.hitstop > 0) return 0;
    if (this.slowmo > 0) {
      const k = clamp(this.slowmo / CONFIG.fx.slowmoTime, 0, 1);
      return lerp(1, CONFIG.fx.slowmoScale, Math.min(1, k * 1.6));
    }
    return 1;
  }

  // Kinds of parcels drawn in the van bed.
  get bed() {
    return this.parcels.map((p) => p.kind);
  }

  // ---- Targets -------------------------------------------------------------

  pickHouse() {
    const D = CONFIG.difficulty;
    const d = this.difficulty;
    let minD = lerp(D.minDistStart, D.minDistEnd, d);
    let band = lerp(D.bandStart, D.bandEnd, d);
    if (this.tut && this.deliveries === 0) { minD = 650; band = 450; }
    const v = this.van;
    const taken = new Set(this.parcels.filter((p) => p.house).map((p) => p.house.id));
    const ok = (h) => !taken.has(h.id) && !this.recent.includes(h.id) && dist(v.x, v.y, h.mat.x, h.mat.y) > TM.radius * 1.4;
    let cands = this.world.houses.filter((h) => {
      const dd = dist(v.x, v.y, h.mat.x, h.mat.y);
      return dd >= minD && dd <= minD + band && ok(h);
    });
    if (!cands.length) {
      const mid = minD + band / 2;
      cands = this.world.houses.filter(ok).sort((a, b) => Math.abs(dist(v.x, v.y, a.mat.x, a.mat.y) - mid) - Math.abs(dist(v.x, v.y, b.mat.x, b.mat.y) - mid)).slice(0, 8);
    }
    const h = pick(cands);
    this.recent.push(h.id);
    if (this.recent.length > 14) this.recent.shift();
    return h;
  }

  activateNext() {
    if (!this.parcels.length) {
      this.target = { depot: true };
      if (this.tut && (this.tut.step === 3 || this.tut.step === 5) && !this.tut.reloadShown) this.setTut(4);
      return;
    }
    const p = this.parcels[0];
    if (!p.house) {
      p.house = this.pickHouse();
      p.from = { x: this.lastStop.x, y: this.lastStop.y };
      p.dist = dist(p.from.x, p.from.y, p.house.mat.x, p.house.mat.y);
      const S = CONFIG.specials;
      if (!this.tut && this.deliveries >= S.startAfter && Math.random() < S.chance) {
        p.kind = Math.random() < 0.5 ? 'express' : 'fragile';
        if (p.kind === 'express') {
          const dv = dist(this.van.x, this.van.y, p.house.mat.x, p.house.mat.y);
          p.expressT = p.expressMax = S.expressBase + dv * S.expressPerUnit;
        }
        p.damage = 0;
        this.fx.text(this.van.x, this.van.y - 40, p.kind === 'express' ? 'EXPRESS!' : 'FRAGILE!', p.kind === 'express' ? PAL.coral : PAL.plum, 1.2, 1.4);
        Sound.expressWarn();
      }
    }
    this.target = p;
    this.meter.was = false;
  }

  // ---- Main update ---------------------------------------------------------

  update(realDt, ctrl, events) {
    if (this.hitstop > 0) this.hitstop -= realDt;
    if (this.slowmo > 0) this.slowmo -= realDt;
    const dt = realDt * this.timeScale;
    const hud = this.hud;
    hud.coinPop = Math.max(0, hud.coinPop - realDt * 3);
    hud.timePop = Math.max(0, hud.timePop - realDt * 1.2);
    hud.comboPop = Math.max(0, hud.comboPop - realDt * 3);
    hud.parcelPop = Math.max(0, hud.parcelPop - realDt * 3);
    this.meter.flash = Math.max(0, this.meter.flash - realDt * 3);
    if (this.tut) this.tut.t += realDt;
    if (dt <= 0) return;

    this.elapsed += dt;
    if (this.state === 'play' && !this.timeFrozen) {
      this.time -= dt;
      const sec = Math.ceil(this.time);
      if (sec !== this.lastTick) {
        this.lastTick = sec;
        if (sec <= CONFIG.shift.lowTime && sec > 0) {
          Sound.tick(sec <= 5);
          hud.warn = 1;
        }
      }
      if (this.time <= 0) {
        this.time = 0;
        this.state = 'timeup';
        Sound.timeUp();
      }
    }
    hud.warn = Math.max(0, hud.warn - realDt * 2.5);
    Sound.tension = this.time < CONFIG.shift.lowTime;

    const van = this.van;
    const vEvents = [];
    const control = this.state === 'play' ? ctrl : { steer: 0, brake: true, joy: false };
    van.update(dt, control, this.world, this.stats, vEvents);
    this.vanEffects(dt);
    this.trafficContact(dt);
    const tEvents = [];
    const viewR = 900;
    const count = Math.round(lerp(CONFIG.traffic.countStart, CONFIG.traffic.countEnd, this.difficulty));
    this.town.traffic.maintain(van.x, van.y, count, viewR);
    this.town.traffic.update(dt, van, 1 + this.difficulty * 0.15, tEvents);
    for (const e of tEvents) if (e.type === 'honk' && dist(e.car.x, e.car.y, van.x, van.y) < 500) Sound.honk(e.car.pitch);
    const townEvents = [];
    this.town.update(dt, realDt, van, events.inView, Sound, townEvents);
    for (const e of vEvents) this.onVanEvent(e);
    for (const e of townEvents) if (e.type === 'knock') this.onKnock(e.prop);

    if (this.state !== 'play') {
      this.meter.show = damp(this.meter.show, 0, 12, realDt);
      this.updateFlights(dt);
      return;
    }
    this.fragileCooldown -= dt;
    this.updateLoading(dt);
    this.updateFlights(dt);
    this.updateMeter(dt, realDt, ctrl.throwPressed);
    this.updateSpecial(dt);
    this.updateTutorial();
  }

  vanEffects(dt) {
    const van = this.van;
    const fx = this.fx;
    const c = Math.cos(van.angle), s = Math.sin(van.angle);
    const sp = van.speed;
    this.puffT -= dt;
    if (this.puffT <= 0 && !van.air) {
      this.puffT = van.throttle > 0.3 ? 0.07 : 0.16;
      const ex = van.x - c * 29 + s * 7, ey = van.y - s * 29 - c * 7;
      fx.smoke(ex, ey, -c * 40, -s * 40, '#e8e2d6', 5, 0.35 + van.throttle * 0.25);
    }
    const w = van.wheels();
    const rough = van.surface === 'grass' || van.surface === 'path';
    this.dustT -= dt;
    if (!van.air && this.dustT <= 0 && sp > 90 && (rough || van.drifting)) {
      this.dustT = 0.035;
      const col = rough ? (van.surface === 'path' ? '#e2c995' : '#c9b48a') : '#d8d2c8';
      fx.dust(w[0], w[1], col, 1, 18);
      fx.dust(w[2], w[3], col, 1, 18);
    }
    const skid = !van.air && (van.drifting || (van.braking && sp > 180));
    if (skid && van.prevWheels && van.surface !== 'grass') {
      const p = van.prevWheels;
      fx.skidMark(p[0], p[1], w[0], w[1]);
      fx.skidMark(p[2], p[3], w[2], w[3]);
    }
    van.prevWheels = skid ? w : null;
    Sound.engineUpdate(clamp(sp / this.stats.maxSpeed, 0, 1.2), van.throttle, skid && van.surface !== 'grass' ? clamp(van.slip / 220, 0.3, 1) : 0);
  }

  trafficContact(dt) {
    const van = this.van;
    const V = CONFIG.van;
    const range = 26 + 28 + TIPS.nearMissDist;
    for (const car of this.town.traffic.cars) {
      const d = dist(car.x, car.y, van.x, van.y);
      if (d > 160) {
        car.nearArmed = false;
        continue;
      }
      const c = Math.cos(car.angle), s = Math.sin(car.angle);
      let best = { impact: 0 };
      for (const off of [11, -11]) {
        const r = van.bounceCircle(car.x + c * off, car.y + s * off, 12, car.vx, car.vy);
        if (r.impact > best.impact) best = r;
      }
      if (best.impact > 0) {
        car.stopT = CONFIG.traffic.stopTime;
        car.bump = 1;
        car.nearT = TIPS.nearMissCooldown;
        car.nearArmed = false;
        if (best.impact > V.crashMin * 0.7) {
          this.onVanEvent({ type: 'crash', impact: best.impact, x: (van.x + car.x) / 2, y: (van.y + car.y) / 2, nx: best.nx, ny: best.ny, car: true });
          Sound.honk(car.pitch);
        }
        continue;
      }
      // Near miss: a fast, close pass pays out once the van is clear without touching.
      if (car.nearT <= 0 && !van.air && van.speed > TIPS.nearMissSpeed && d < range) {
        if (Math.hypot(van.vx - car.vx, van.vy - car.vy) > 200) car.nearArmed = true;
      } else if (car.nearArmed && d >= range) {
        car.nearArmed = false;
        car.nearT = TIPS.nearMissCooldown;
        this.addTip(TIPS.nearMiss, 'NEAR MISS', PAL.teal);
        Sound.nearMiss();
      }
    }
  }

  onVanEvent(e) {
    const fx = this.fx;
    const van = this.van;
    switch (e.type) {
      case 'crash': {
        const k = clamp(e.impact / 450, 0, 1);
        fx.shake(0.25 + k * 0.5);
        Sound.crash(k);
        if (e.pond) {
          fx.splash(e.x, e.y, 14);
          Sound.splash();
        } else {
          fx.sparks(e.x, e.y, e.nx, e.ny, 6 + Math.floor(k * 10));
          if (e.impact > 240) fx.stars(e.x, e.y, 5);
        }
        if (e.impact > CONFIG.van.hardCrash) this.hitstop = CONFIG.fx.hitstop;
        const p = this.target;
        if (p && p.kind === 'fragile' && p.house && e.impact > CONFIG.specials.fragileImpact && this.fragileCooldown <= 0) {
          this.fragileCooldown = 0.6;
          if (p.damage < CONFIG.specials.maxDamage) {
            p.damage++;
            fx.text(van.x, van.y - 36, p.damage >= CONFIG.specials.maxDamage ? 'SMASHED!' : 'CAREFUL!', PAL.plum, 1, 1);
            this.hud.parcelPop = 1;
          }
        }
        break;
      }
      case 'scrape':
        Sound.bump();
        break;
      case 'jump':
        Sound.jump();
        fx.dust(van.x, van.y, '#e2c995', 6, 60);
        break;
      case 'land': {
        Sound.land();
        fx.shake(0.18);
        fx.dust(van.x, van.y, '#d8cbb0', 10, 90);
        fx.ring(van.x, van.y, '#fff4e0', 10, 60, 0.4, 0.6);
        if (e.air >= TIPS.airMin) this.addTip(Math.round(e.air * TIPS.airPerSec), 'AIR TIME', PAL.sun);
        break;
      }
      case 'driftEnd':
        if (e.time >= TIPS.driftMin) this.addTip(Math.round(e.time * TIPS.driftPerSec), 'DRIFT', PAL.plum);
        break;
    }
  }

  onKnock(prop) {
    const amt = prop.kind === 'bin' ? TIPS.bin : TIPS.cone;
    this.addTip(amt, prop.kind === 'bin' ? 'BIN BASH' : 'CONE', PAL.coral);
    Sound.bump();
    Sound.pop();
    this.fx.debris(prop.x, prop.y, prop.vx, prop.vy, prop.kind === 'bin' ? '#3f8a6a' : PAL.coral, 5);
    this.fx.shake(0.08);
  }

  addTip(amount, label, color) {
    if (amount <= 0 || this.state !== 'play') return;
    this.coins += amount;
    this.tipsEarned += amount;
    this.hud.coinPop = 1;
    const v = this.van;
    this.fx.text(v.x + rnd(-10, 10), v.y - 30, `${label} +${amount}`, color, 0.75, 1.1);
    Sound.coin();
  }

  // ---- Depot loading ----

  updateLoading(dt) {
    const van = this.van;
    const z = DEPOT.zone;
    const inZone = van.x > z.x0 - 10 && van.x < z.x1 + 10 && van.y > z.y0 - 10 && van.y < z.y1 + 10;
    if (!inZone || this.parcels.length + this.inbound >= this.stats.capacity) {
      this.loadT = 0;
      return;
    }
    this.loadT -= dt;
    if (this.loadT > 0) return;
    this.loadT = CONFIG.depot.loadInterval;
    const b = DEPOT.building;
    const sx = (b.x0 + b.x1) / 2 + rnd(-80, 80), sy = b.y1 - 4;
    this.inbound++;
    this.town.flying.push({ load: true, x0: sx, y0: sy, x: sx, y: sy, z: 0, t: 0, dur: 0.28, h: 34, kind: 'normal', angle: 0, spin: rnd(-6, 6) });
    if (this.tut && this.tut.step === 4) this.finishTutorial();
  }

  // ---- Throw meter ----

  updateMeter(dt, realDt, throwPressed) {
    const m = this.meter;
    const van = this.van;
    const p = this.target;
    const canThrow = p && p.house && !this.pending && this.parcels[0] === p;
    const d = canThrow ? dist(van.x, van.y, p.house.mat.x, p.house.mat.y) : Infinity;
    m.inRange = canThrow && d < TM.radius;
    m.show = damp(m.show, m.inRange ? 1 : 0, m.inRange ? 14 : 10, realDt);
    m.cooldown -= dt;
    if (m.inRange) {
      if (!m.was) {
        m.was = true;
        m.dir = Math.random() < 0.5 ? 1 : -1;
        m.pos = m.dir > 0 ? 0 : 1;
        Sound.whoosh();
        if (this.tut && this.tut.step === 0) this.setTut(1);
      }
      const speedFrac = clamp(van.speed / this.stats.maxSpeed, 0, 1);
      let sweep = lerp(TM.sweepSlow, TM.sweepFast, speedFrac);
      if (this.tut && this.deliveries === 0) sweep *= TM.tutorialSlow;
      m.pos += m.dir * sweep * dt;
      if (m.pos > 1) { m.pos = 2 - m.pos; m.dir = -1; }
      if (m.pos < 0) { m.pos = -m.pos; m.dir = 1; }
      if (throwPressed && m.cooldown <= 0) this.doThrow(p);
    } else if (!canThrow || d > TM.radius * 1.3) {
      m.was = false;
    }
  }

  zoneAt(pos) {
    const off = Math.abs(pos - 0.5);
    if (off <= this.stats.greenHalf) return 'perfect';
    if (off <= TM.amber) return 'good';
    return 'miss';
  }

  doThrow(p) {
    const van = this.van;
    const h = p.house;
    const result = this.zoneAt(this.meter.pos);
    let to, missKind = null;
    if (result === 'perfect') to = { x: h.mat.x, y: h.mat.y };
    else if (result === 'good') to = { x: h.path.x + rnd(-6, 6), y: h.path.y + rnd(-6, 6) };
    else {
      const mm = pick(h.misses);
      to = { x: mm.x + rnd(-4, 4), y: mm.y + rnd(-4, 4) };
      missKind = mm.kind;
    }
    const d = dist(van.x, van.y, to.x, to.y);
    const fp = {
      x0: van.x, y0: van.y, x1: to.x, y1: to.y, x: van.x, y: van.y, z: 8, t: 0,
      dur: clamp(d / 560, TM.flightMin, TM.flightMax), h: 34 + d * 0.1,
      kind: p.kind, result, missKind, parcel: p, house: h,
      angle: van.angle, spin: rnd(-9, 9),
      speedMult: 1 + clamp(van.speed / CONFIG.van.maxSpeed, 0, 1.2) * TIPS.speedBonus,
    };
    this.town.flying.push(fp);
    this.pending = fp;
    this.meter.cooldown = TM.cooldown;
    this.meter.flash = 1;
    this.meter.flashColor = result === 'perfect' ? '#7cc95f' : result === 'good' ? PAL.sun : PAL.coral;
    this.meter.lastResult = result;
    if (result !== 'miss') {
      this.parcels.shift();
      this.hud.parcelPop = 1;
    }
    van.kick(0.22);
    Sound.throwSfx();
  }

  updateFlights(dt) {
    const fl = this.town.flying;
    for (let i = fl.length - 1; i >= 0; i--) {
      const f = fl[i];
      f.t += dt;
      const u = clamp(f.t / f.dur, 0, 1);
      if (f.load) {
        f.x1 = this.van.x;
        f.y1 = this.van.y;
      }
      f.x = lerp(f.x0, f.x1, u);
      f.y = lerp(f.y0, f.y1, u);
      f.z = 4 * f.h * u * (1 - u) + (f.load ? 0 : 8 * (1 - u));
      f.angle += f.spin * dt * (1 - u * 0.5);
      if (u >= 1) {
        fl.splice(i, 1);
        if (f.load) this.onLoaded();
        else this.land(f);
      }
    }
  }

  onLoaded() {
    this.inbound = Math.max(0, this.inbound - 1);
    if (this.parcels.length >= this.stats.capacity) return;
    this.parcels.push({ kind: 'normal', house: null, damage: 0 });
    Sound.load(this.parcels.length);
    this.van.kick(0.15);
    this.hud.parcelPop = 1;
    if (this.parcels.length === 1 || this.target.depot) {
      this.lastStop = { x: DEPOT.start.x, y: DEPOT.start.y };
      this.activateNext();
    }
    if (this.parcels.length === this.stats.capacity) {
      this.fx.text(this.van.x, this.van.y - 40, 'LOADED UP!', PAL.sun, 0.9, 1.1);
    }
  }

  land(f) {
    const fx = this.fx;
    if (this.pending === f) this.pending = null;
    if (f.result === 'miss') {
      this.combo = 0;
      this.misses++;
      if (f.missKind === 'pond') {
        fx.splash(f.x1, f.y1, 18);
        Sound.splash();
        fx.text(f.x1, f.y1 - 20, 'SPLASH!', PAL.teal, 1, 1.1);
      } else {
        fx.leaves(f.x1, f.y1, 16);
        Sound.leaves();
        fx.text(f.x1, f.y1 - 20, 'IN THE HEDGE!', '#7cc95f', 0.9, 1.1);
      }
      Sound.miss();
      this.meter.was = false;
      return;
    }
    const p = f.parcel;
    const perfect = f.result === 'perfect';
    this.town.dropParcel(f.x1, f.y1, p.kind, f.angle);
    Sound.thud();
    fx.dust(f.x1, f.y1, '#e8dcc4', 6, 50);
    let tip = (perfect ? TIPS.perfect : TIPS.good) * f.speedMult;
    if (perfect) tip *= 1 + TIPS.comboStep * this.combo;
    if (p.kind === 'express' && p.expressT > 0) {
      tip += TIPS.express * f.speedMult;
      fx.text(f.x1, f.y1 + 34, 'EXPRESS BONUS!', PAL.coral, 0.8, 1.4, 0.4);
    }
    if (p.kind === 'fragile') {
      tip *= Math.max(0, 1 - TIPS.fragilePenalty * p.damage);
      if (p.damage === 0) {
        tip += TIPS.fragileIntact;
        fx.text(f.x1, f.y1 + 34, 'NOT A SCRATCH!', PAL.plum, 0.8, 1.4, 0.4);
      }
    }
    tip = Math.round(tip);
    this.coins += tip;
    this.hud.coinPop = 1;
    const SH = CONFIG.shift;
    const gain = lerp(SH.timeBase, SH.timeBaseEnd, this.difficulty) + (p.dist || 0) * SH.timePerUnit + (perfect ? SH.perfectTime : 0);
    const before = this.time;
    this.time = Math.min(CONFIG.shift.maxTime, this.time + gain);
    this.hud.timeGain = Math.round(this.time - before);
    this.hud.timePop = 1;
    this.lastTick = Math.ceil(this.time);
    this.deliveries++;
    if (perfect) {
      this.perfects++;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.hud.comboPop = 1;
      this.slowmo = CONFIG.fx.slowmoTime;
      fx.confetti(f.x1, f.y1, 70, 1.15);
      fx.ring(f.x1, f.y1, PAL.sun, 10, 90, 0.5, 0.9);
      fx.shake(0.15);
      Sound.perfect(this.combo);
      Sound.pop();
      fx.text(f.x1, f.y1 - 44, 'PERFECT!', PAL.sun, 1.5, 1.3);
    } else {
      this.combo = 0;
      Sound.good();
      fx.text(f.x1, f.y1 - 44, 'GOOD!', PAL.cream, 1.2, 1.1);
    }
    fx.text(f.x1, f.y1 + 4, `+${tip}`, PAL.sun, 1.05, 1.3, 0.2);
    Sound.coin();
    this.lastStop = { x: f.house.mat.x, y: f.house.mat.y };
    if (this.tut && this.tut.step <= 1) this.setTut(2);
    this.activateNext();
  }

  updateSpecial(dt) {
    const p = this.target;
    if (!p || !p.house || p.kind !== 'express') return;
    if (this.pending && this.pending.parcel === p) return;
    p.expressT -= dt;
    if (p.expressT <= 0) {
      p.kind = 'normal';
      this.fx.text(this.van.x, this.van.y - 40, 'EXPRESS EXPIRED', PAL.coral, 0.8, 1.2);
      Sound.miss();
    } else if (p.expressT < 5 && Math.ceil(p.expressT) !== Math.ceil(p.expressT + dt)) {
      Sound.expressWarn();
    }
  }

  // ---- Tutorial ----

  setTut(step) {
    if (!this.tut) return;
    this.tut.step = step;
    this.tut.t = 0;
    if (step === 4) this.tut.reloadShown = true;
  }

  updateTutorial() {
    const t = this.tut;
    if (!t) return;
    // Steps: 0 follow arrow, 1 throw, 2 time bonus, 3 tips, 5 quiet until empty, 4 reload.
    if (t.step === 2 && t.t > 4) this.setTut(3);
    else if (t.step === 3 && t.t > 4) this.setTut(this.parcels.length || this.target.house ? 5 : 4);
  }

  finishTutorial() {
    if (!this.tut) return;
    this.tut = null;
    Save.data.tutorialSeen = true;
    Save.write();
  }

  results() {
    return {
      deliveries: this.deliveries,
      perfects: this.perfects,
      bestCombo: this.bestCombo,
      coins: this.coins,
    };
  }
}
