// The player's delivery van: arcade handling, drifting, ramps and collisions.
import { CONFIG } from './config.js';
import { clamp, damp, lerp, wrapAngle } from './util.js';

const V = CONFIG.van;
const tmp = { x: 0, y: 0 };
const hit = { nx: 0, ny: 0, depth: 0, px: 0, py: 0, pond: false };

export class Van {
  constructor() {
    this.reset(0, 0, 0);
  }

  reset(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = 0;
    this.vy = 0;
    this.angVel = 0;
    this.steer = 0;
    this.driftAmt = 0;
    this.drifting = false;
    this.driftTime = 0;
    this.slip = 0;
    this.braking = false;
    this.throttle = 0;
    this.air = null;
    this.z = 0;
    this.squash = 0;
    this.squashV = 0;
    this.surface = 'road';
    this.lastVf = 0;
    this.accelF = 0;
    this.puffT = 0;
    this.dustT = 0;
    this.prevWheels = null;
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  get forwardSpeed() {
    return this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle);
  }

  wheels() {
    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    const rx = -fy, ry = fx;
    const bx = this.x - fx * 15, by = this.y - fy * 15;
    return [bx + rx * 11, by + ry * 11, bx - rx * 11, by - ry * 11];
  }

  kick(amount) {
    this.squashV += amount;
  }

  // ctrl: { steer, brake, joy, joyAngle, joyMag }  stats: { maxSpeed, turnRate, grip }
  update(dt, ctrl, world, stats, events) {
    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    const rx = -fy, ry = fx;
    let vf = this.vx * fx + this.vy * fy;
    let vl = this.vx * rx + this.vy * ry;
    const prevSurface = this.surface;
    this.surface = world.surfaceAt(this.x, this.y);
    if (prevSurface !== this.surface && !this.air && Math.abs(vf) > 120) {
      const roughNow = this.surface === 'grass' || this.surface === 'path';
      const roughBefore = prevSurface === 'grass' || prevSurface === 'path';
      if (roughNow !== roughBefore) this.kick(-0.25);
    }
    const maxF = stats.maxSpeed * V.surface[this.surface];

    let steer = ctrl.steer;
    if (ctrl.joy) {
      const facing = vf < -20 ? this.angle + Math.PI : this.angle;
      const diff = wrapAngle(ctrl.joyAngle - facing);
      steer = clamp(diff * V.joystickGain, -1, 1) * ctrl.joyMag * (vf < -20 ? -1 : 1);
    }
    this.steer = damp(this.steer, steer, V.steerResponse, dt);

    if (!this.air) {
      this.braking = false;
      this.throttle = 0;
      if (ctrl.brake) {
        if (vf > 30) {
          vf -= V.brake * dt;
          this.braking = true;
        } else {
          vf = Math.max(vf - V.reverseAccel * dt, -V.reverseSpeed);
        }
      } else if (vf < 0) {
        vf = Math.min(0, vf + V.brake * dt);
        this.throttle = 1;
      } else if (vf < maxF) {
        vf = Math.min(maxF, vf + V.accel * dt * (1 - 0.55 * (vf / maxF)));
        this.throttle = 1 - vf / maxF;
      } else {
        vf = damp(vf, maxF, 2.5, dt);
      }
      const wantDrift = Math.abs(this.steer) > V.driftSteer && vf > V.driftMinSpeed * stats.maxSpeed;
      this.driftAmt = damp(this.driftAmt, wantDrift ? 1 : 0, wantDrift ? 4 : 3, dt);
      const grip = lerp(stats.grip, V.driftGrip, this.driftAmt);
      vl *= Math.exp(-grip * dt);
      const turnK = clamp(Math.abs(vf) / V.turnFullSpeed, 0, 1) * Math.sign(vf);
      const yaw = this.steer * stats.turnRate * turnK * (1 + (V.driftYaw - 1) * this.driftAmt);
      this.angVel = damp(this.angVel, yaw, 14, dt);
    } else {
      this.angVel *= Math.exp(-1.5 * dt);
      this.braking = false;
    }

    this.accelF = (vf - this.lastVf) / Math.max(dt, 1e-4);
    this.lastVf = vf;
    this.angle = wrapAngle(this.angle + this.angVel * dt);
    this.vx = fx * vf + rx * vl;
    this.vy = fy * vf + ry * vl;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.slip = Math.abs(vl);
    const sp = this.speed;
    this.drifting = !this.air && sp > 200 && Math.abs(vl) > 70 && vf > 0;
    if (this.drifting) this.driftTime += dt;
    else if (this.driftTime > 0) {
      events.push({ type: 'driftEnd', time: this.driftTime });
      this.driftTime = 0;
    }

    // Ramps.
    if (!this.air) {
      for (const r of world.ramps) {
        const dx = this.x - r.x, dy = this.y - r.y;
        const lx = dx * r.dx + dy * r.dy, ly = -dx * r.dy + dy * r.dx;
        if (Math.abs(lx) < r.len / 2 && Math.abs(ly) < r.wid / 2) {
          const along = this.vx * r.dx + this.vy * r.dy;
          if (along > CONFIG.ramp.minSpeed) {
            const k = clamp(along / stats.maxSpeed, 0, 1.2);
            const R = CONFIG.ramp;
            this.air = { t: 0, dur: lerp(R.airMin, R.airMax, Math.min(1, k)), h: lerp(R.heightMin, R.heightMax, Math.min(1, k)) };
            this.kick(0.5);
            events.push({ type: 'jump' });
          }
          break;
        }
      }
    }
    if (this.air) {
      this.air.t += dt;
      const u = this.air.t / this.air.dur;
      this.z = 4 * this.air.h * u * (1 - u);
      if (u >= 1) {
        events.push({ type: 'land', air: this.air.dur });
        this.air = null;
        this.z = 0;
        this.kick(-0.7);
      }
    }

    this.collide(world, events);

    // Squash and stretch spring.
    const target = clamp(this.accelF / 4000, -0.06, 0.06);
    this.squashV += (-(this.squash - target) * 260 - this.squashV * 14) * dt;
    this.squash = clamp(this.squash + this.squashV * dt, -0.35, 0.35);
  }

  collide(world, events) {
    let impact = 0, inx = 0, iny = 0, cx = 0, cy = 0, pond = false;
    const r = V.width / 2;
    for (let iter = 0; iter < 2; iter++) {
      const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
      for (const off of [11, -11]) {
        tmp.x = this.x + fx * off;
        tmp.y = this.y + fy * off;
        if (!world.resolveCircle(tmp, r, hit)) continue;
        this.x += hit.px;
        this.y += hit.py;
        const len = Math.hypot(hit.px, hit.py) || 1;
        const nx = hit.px / len, ny = hit.py / len;
        const vn = this.vx * nx + this.vy * ny;
        if (vn < 0) {
          this.vx -= (1 + V.restitution) * vn * nx;
          this.vy -= (1 + V.restitution) * vn * ny;
          const cross = fx * ny - fy * nx;
          this.angVel += cross * Math.sign(off) * Math.min(-vn, 400) * 0.006;
          if (-vn > impact) {
            impact = -vn;
            inx = nx; iny = ny;
            cx = tmp.x - nx * r; cy = tmp.y - ny * r;
            pond = hit.pond;
          }
        }
      }
    }
    if (impact > V.crashMin) {
      const loss = 1 - V.crashSpeedLoss * clamp(impact / 400, 0.2, 1);
      this.vx *= loss;
      this.vy *= loss;
      this.kick(-Math.min(0.9, impact / 450));
      events.push({ type: 'crash', impact, x: cx, y: cy, nx: inx, ny: iny, pond });
    } else if (impact > 40) {
      events.push({ type: 'scrape', impact, x: cx, y: cy, nx: inx, ny: iny });
    }
  }

  // Bounce off a moving circle (traffic). Returns impact speed.
  bounceCircle(px, py, pr, ovx, ovy) {
    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    const r = V.width / 2;
    let best = 0, bnx = 0, bny = 0;
    for (const off of [11, -11]) {
      const cx = this.x + fx * off, cy = this.y + fy * off;
      const dx = cx - px, dy = cy - py;
      const d = Math.hypot(dx, dy), rs = r + pr;
      if (d >= rs) continue;
      const nx = d > 1e-3 ? dx / d : 1, ny = d > 1e-3 ? dy / d : 0;
      const depth = rs - d;
      this.x += nx * depth;
      this.y += ny * depth;
      const rvx = this.vx - ovx, rvy = this.vy - ovy;
      const vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        this.vx -= (1 + V.restitution) * vn * nx;
        this.vy -= (1 + V.restitution) * vn * ny;
        this.angVel += (fx * ny - fy * nx) * Math.sign(off) * Math.min(-vn, 400) * 0.006;
        if (-vn > best) { best = -vn; bnx = nx; bny = ny; }
      }
    }
    return { impact: best, nx: bnx, ny: bny };
  }
}
