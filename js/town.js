// The living town shared by the title screen and gameplay: traffic, birds,
// knockable props, effects and parcels left on doormats.
import { CONFIG } from './config.js';
import { Traffic } from './traffic.js';
import { Flock } from './critters.js';
import { FX } from './fx.js';
import { rnd, dist } from './util.js';

export class Town {
  constructor(world) {
    this.world = world;
    this.traffic = new Traffic(world);
    this.fx = new FX();
    this.flocks = world.flockSpots.map((s) => new Flock(s));
    this.props = world.propSpots.map((s) => ({ kind: s.kind, hx: s.x, hy: s.y, x: s.x, y: s.y, z: 0, vx: 0, vy: 0, vz: 0, angle: 0, va: 0, state: 'idle', t: 0, alpha: 1 }));
    this.dropped = [];
    this.flying = [];
    this.time = 0;
  }

  reset() {
    this.traffic.clear();
    this.fx.clear();
    this.dropped.length = 0;
    this.flying.length = 0;
    for (const p of this.props) this.resetProp(p);
    this.flocks = this.world.flockSpots.map((s) => new Flock(s));
  }

  resetProp(p) {
    p.x = p.hx; p.y = p.hy; p.z = 0; p.vx = p.vy = p.vz = 0;
    p.angle = 0; p.va = 0; p.state = 'idle'; p.t = 0; p.alpha = 1;
  }

  // inView(x, y, pad) tells whether a point is on screen.
  update(dt, realDt, van, inView, sound, events) {
    this.time += dt;
    for (const f of this.flocks) {
      if (inView(f.x, f.y, 900)) f.update(dt, van, sound);
    }
    const P = CONFIG.props;
    for (const p of this.props) {
      if (p.state === 'idle') {
        if (van && !van.air && van.speed > 50 && dist(van.x, van.y, p.x, p.y) < 24) {
          p.state = 'flying';
          p.t = 0;
          p.vx = van.vx * 1.15 + rnd(-60, 60);
          p.vy = van.vy * 1.15 + rnd(-60, 60);
          p.vz = 140 + van.speed * 0.25;
          p.va = rnd(-14, 14);
          van.vx *= 1 - P.knockSlow;
          van.vy *= 1 - P.knockSlow;
          events.push({ type: 'knock', prop: p });
        }
      } else if (p.state === 'flying') {
        p.t += dt;
        p.vz -= 520 * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz = Math.abs(p.vz) > 60 ? -p.vz * 0.35 : 0;
          p.vx *= 0.6;
          p.vy *= 0.6;
          p.va *= 0.6;
        }
        const k = Math.exp(-1.2 * dt);
        p.vx *= k;
        p.vy *= k;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.va * dt;
        if (p.t > 2) p.alpha = Math.max(0, 1 - (p.t - 2) / 0.6);
        if (p.t > 2.6) {
          p.state = 'gone';
          p.t = 0;
        }
      } else {
        p.t += dt;
        if (p.t > P.respawn && !inView(p.hx, p.hy, 60) && (!van || dist(van.x, van.y, p.hx, p.hy) > 200)) this.resetProp(p);
      }
    }
    for (let i = this.dropped.length - 1; i >= 0; i--) {
      const d = this.dropped[i];
      d.t += dt;
      if (d.t > 30) this.dropped.splice(i, 1);
    }
    this.fx.update(dt, realDt);
  }

  dropParcel(x, y, kind, angle) {
    this.dropped.push({ x, y, kind, angle, t: 0 });
    if (this.dropped.length > 24) this.dropped.shift();
  }
}
