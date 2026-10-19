// Pigeons and ducks that scatter when the van gets close.
import { CONFIG } from './config.js';
import { POND } from './world.js';
import { rnd, dist, TAU, wrapAngle, damp } from './util.js';

export class Flock {
  constructor(spot) {
    this.kind = spot.kind;
    this.x = spot.x;
    this.y = spot.y;
    this.state = 'calm';
    this.t = 0;
    this.birds = [];
    for (let i = 0; i < spot.n; i++) {
      const b = { x: 0, y: 0, z: 0, vx: 0, vy: 0, a: rnd(0, TAU), t: rnd(0, 2), flap: rnd(0, 1), hop: 0, hx: 0, hy: 0 };
      this.home(b);
      b.x = b.hx;
      b.y = b.hy;
      this.birds.push(b);
    }
  }

  home(b) {
    if (this.kind === 'duck') {
      const a = rnd(0, TAU), d = rnd(0.1, 0.7);
      b.hx = POND.x + Math.cos(a) * (POND.rx - 30) * d;
      b.hy = POND.y + Math.sin(a) * (POND.ry - 24) * d;
    } else {
      b.hx = this.x + rnd(-26, 26);
      b.hy = this.y + rnd(-16, 16);
    }
  }

  update(dt, van, sound) {
    this.t += dt;
    const B = CONFIG.birds;
    let near = Infinity, vanSpeed = 0;
    if (van) {
      vanSpeed = van.speed;
      for (const b of this.birds) near = Math.min(near, dist(b.x, b.y, van.x, van.y));
    }
    if (this.state === 'calm' && van && near < B.scareDist && vanSpeed > B.scareSpeed) {
      this.state = 'scatter';
      this.t = 0;
      for (const b of this.birds) {
        let ax = b.x - van.x, ay = b.y - van.y;
        const l = Math.hypot(ax, ay) || 1;
        const a = Math.atan2(ay / l, ax / l) + rnd(-0.7, 0.7);
        const s = rnd(150, 230);
        b.vx = Math.cos(a) * s;
        b.vy = Math.sin(a) * s;
        b.vz = rnd(70, 110);
        b.a = a;
      }
      if (sound) {
        if (this.kind === 'duck') sound.quack();
        sound.flutter();
      }
    }
    if (this.state === 'scatter') {
      for (const b of this.birds) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z = Math.min(60, b.z + b.vz * dt);
        b.vx *= Math.exp(-0.5 * dt);
        b.vy *= Math.exp(-0.5 * dt);
        b.flap += dt * 14;
      }
      if (this.t > B.returnDelay && (!van || near > 320 || dist(van.x, van.y, this.x, this.y) > 360)) {
        this.state = 'return';
        this.t = 0;
        for (const b of this.birds) this.home(b);
      }
    } else if (this.state === 'return') {
      let landed = 0;
      for (const b of this.birds) {
        const dx = b.hx - b.x, dy = b.hy - b.y;
        const d = Math.hypot(dx, dy);
        if (d > 4) {
          const s = Math.min(170, d * 2.4 + 30);
          b.vx = (dx / d) * s;
          b.vy = (dy / d) * s;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.a = Math.atan2(dy, dx);
          b.z = Math.min(b.z, d * 0.5);
          b.flap += dt * 12;
        } else {
          b.x = b.hx;
          b.y = b.hy;
          b.z = Math.max(0, b.z - dt * 80);
          if (b.z <= 0) landed++;
        }
      }
      if (landed === this.birds.length) {
        this.state = 'calm';
        this.t = 0;
      }
      if (van && near < B.scareDist * 0.8 && vanSpeed > B.scareSpeed && this.t > 0.6) {
        this.state = 'calm';
      }
    } else {
      for (const b of this.birds) {
        b.t -= dt;
        if (this.kind === 'duck') {
          const dx = b.hx - b.x, dy = b.hy - b.y;
          const d = Math.hypot(dx, dy);
          if (d > 2) {
            b.x += (dx / d) * Math.min(d, 14 * dt);
            b.y += (dy / d) * Math.min(d, 14 * dt);
            b.a = wrapAngle(b.a + wrapAngle(Math.atan2(dy, dx) - b.a) * Math.min(1, dt * 3));
          }
          if (b.t <= 0) {
            this.home(b);
            b.t = rnd(2, 5);
          }
        } else {
          b.hop = damp(b.hop, 0, 10, dt);
          if (b.t <= 0) {
            b.t = rnd(0.5, 2);
            if (Math.random() < 0.5) {
              b.x += rnd(-8, 8);
              b.y += rnd(-6, 6);
              b.x = Math.max(this.x - 30, Math.min(this.x + 30, b.x));
              b.y = Math.max(this.y - 20, Math.min(this.y + 20, b.y));
              b.hop = 1;
            }
            b.a += rnd(-1.2, 1.2);
          }
        }
      }
    }
  }
}
