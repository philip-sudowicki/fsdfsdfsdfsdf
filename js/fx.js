// Particles, tyre marks, floating score text and screen shake.
import { CONFIG } from './config.js';
import { Art, PAL } from './art.js';
import { rnd, pick, clamp, TAU, ease } from './util.js';

const CONFETTI = [PAL.coral, PAL.sun, PAL.teal, PAL.plum, PAL.cream, '#7cc95f'];

export class FX {
  constructor() {
    this.parts = [];
    this.texts = [];
    const n = CONFIG.fx.maxSkids;
    this.skid = new Float32Array(n * 5);
    this.skidHead = 0;
    this.skidCount = 0;
    this.trauma = 0;
    this.time = 0;
  }

  clear() {
    this.parts.length = 0;
    this.texts.length = 0;
    this.skidCount = 0;
    this.trauma = 0;
  }

  add(p) {
    if (this.parts.length >= CONFIG.fx.maxParticles) this.parts.shift();
    p.t = 0;
    p.z = p.z || 0;
    p.vz = p.vz || 0;
    p.rot = p.rot || 0;
    p.vr = p.vr || 0;
    p.drag = p.drag ?? 2;
    p.grav = p.grav || 0;
    p.a = p.a ?? 1;
    this.parts.push(p);
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  shakeOffset() {
    const s = this.trauma * this.trauma * CONFIG.fx.shakeMax;
    const t = this.time * 40;
    return [Math.sin(t * 1.3) * s * Math.cos(t * 0.7), Math.cos(t * 1.1) * s * Math.sin(t * 0.9 + 1)];
  }

  // ---- Bursts ----

  dust(x, y, color = '#d9c39a', n = 1, spread = 20) {
    for (let i = 0; i < n; i++) {
      this.add({ kind: 'puff', x: x + rnd(-4, 4), y: y + rnd(-4, 4), vx: rnd(-spread, spread), vy: rnd(-spread, spread), life: rnd(0.45, 0.8), size: rnd(8, 12), grow: 18, color, a: 0.55 });
    }
  }

  smoke(x, y, vx = 0, vy = 0, color = '#eee6d8', size = 8, a = 0.5) {
    this.add({ kind: 'puff', x, y, vx: vx + rnd(-10, 10), vy: vy + rnd(-10, 10), life: rnd(0.5, 0.9), size, grow: 20, color, a });
  }

  confetti(x, y, n = 40, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), s = rnd(60, 220) * power;
      this.add({ kind: 'confetti', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, z: rnd(4, 14), vz: rnd(120, 260) * power, grav: 380, drag: 1.4, life: rnd(1.3, 2.1), color: pick(CONFETTI), rot: rnd(0, TAU), vr: rnd(-12, 12), size: rnd(6, 10) });
    }
  }

  splash(x, y, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), s = rnd(30, 110);
      this.add({ kind: 'drop', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(120, 240), grav: 600, drag: 0.8, life: 1.2, color: i % 3 ? '#8ddcea' : '#fff4e0', size: rnd(2.5, 4.5) });
    }
    this.add({ kind: 'ring', x, y, life: 0.7, size: 6, grow: 60, color: '#ffffff', a: 0.8, drag: 0 });
    this.add({ kind: 'ring', x, y, life: 0.9, size: 4, grow: 40, color: '#ffffff', a: 0.6, drag: 0 });
  }

  leaves(x, y, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), s = rnd(30, 120);
      this.add({ kind: 'leaf', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(80, 180), grav: 260, drag: 1.6, life: rnd(0.9, 1.5), color: i % 2 ? '#4f9e5c' : '#7cc95f', rot: rnd(0, TAU), vr: rnd(-8, 8), size: rnd(4, 6) });
    }
  }

  sparks(x, y, nx, ny, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(ny, nx) + rnd(-1.2, 1.2), s = rnd(120, 320);
      this.add({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.18, 0.35), color: i % 2 ? PAL.sun : PAL.cream, drag: 4, size: 2 });
    }
  }

  stars(x, y, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd(-0.3, 0.3), s = rnd(60, 120);
      this.add({ kind: 'star', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, z: 10, vz: rnd(60, 120), grav: 200, drag: 2.5, life: 0.7, color: i % 2 ? PAL.sun : PAL.cream, rot: rnd(0, TAU), vr: rnd(-8, 8), size: rnd(5, 7) });
    }
  }

  ring(x, y, color = '#ffffff', size = 10, grow = 120, life = 0.5, a = 0.8) {
    this.add({ kind: 'ring', x, y, life, size, grow, color, a, drag: 0 });
  }

  debris(x, y, vx, vy, color, n = 6) {
    for (let i = 0; i < n; i++) {
      this.add({ kind: 'confetti', x, y, vx: vx * 0.5 + rnd(-80, 80), vy: vy * 0.5 + rnd(-80, 80), z: 6, vz: rnd(80, 180), grav: 420, drag: 2, life: rnd(0.6, 1), color, rot: rnd(0, TAU), vr: rnd(-12, 12), size: rnd(3, 5) });
    }
  }

  // ---- Floating text (drawn in screen space) ----

  text(x, y, str, color = PAL.cream, size = 1, life = 1.1, delay = 0) {
    this.texts.push({ x, y, str, color, size, life, t: -delay });
  }

  // ---- Skid marks ----

  skidMark(x1, y1, x2, y2) {
    const i = this.skidHead * 5;
    const s = this.skid;
    s[i] = x1; s[i + 1] = y1; s[i + 2] = x2; s[i + 3] = y2; s[i + 4] = this.time;
    this.skidHead = (this.skidHead + 1) % CONFIG.fx.maxSkids;
    this.skidCount = Math.min(this.skidCount + 1, CONFIG.fx.maxSkids);
  }

  update(dt, realDt) {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - realDt * 1.8);
    const ps = this.parts;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.t += dt;
      if (p.t >= p.life) continue;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.grav) {
        p.vz -= p.grav * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          if (p.kind === 'drop') continue;
          p.z = 0;
          p.vz *= -0.3;
          p.vx *= 0.6;
          p.vy *= 0.6;
          p.vr *= 0.5;
        }
      }
      if (p.kind === 'confetti' && p.z > 0 && p.vz < 0) {
        p.vz = Math.max(p.vz, -60);
        p.vx += Math.sin(p.t * 9 + p.rot) * 30 * dt;
      }
      p.rot += p.vr * dt;
      ps[w++] = p;
    }
    ps.length = w;
    const ts = this.texts;
    w = 0;
    for (let i = 0; i < ts.length; i++) {
      ts[i].t += realDt;
      if (ts[i].t < ts[i].life) ts[w++] = ts[i];
    }
    ts.length = w;
  }

  drawSkids(ctx) {
    const life = CONFIG.fx.skidLife;
    const s = this.skid;
    const n = this.skidCount, max = CONFIG.fx.maxSkids;
    if (!n) return;
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgb(40,42,58)';
    const buckets = 6;
    for (let b = 0; b < buckets; b++) {
      const a0 = (b / buckets) * life, a1 = ((b + 1) / buckets) * life;
      ctx.beginPath();
      let any = false;
      for (let j = 0; j < n; j++) {
        const i = ((this.skidHead - 1 - j + max) % max) * 5;
        const age = this.time - s[i + 4];
        if (age < a0 || age >= a1) continue;
        ctx.moveTo(s[i], s[i + 1]);
        ctx.lineTo(s[i + 2], s[i + 3]);
        any = true;
      }
      if (any) {
        ctx.globalAlpha = 0.32 * (1 - (b + 0.5) / buckets);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // r: renderer exposing spr(sprite, x, y, angle, sx, sy) and world transform.
  drawParticles(ctx, r) {
    for (const p of this.parts) {
      const k = p.t / p.life;
      const y = p.y - p.z;
      switch (p.kind) {
        case 'puff': {
          const s = (p.size + p.grow * k) / 16;
          ctx.globalAlpha = p.a * Math.pow(1 - k, 1.4);
          r.spr(Art.puff(p.color), p.x, y, 0, s, s);
          break;
        }
        case 'drop':
        case 'leaf':
        case 'confetti': {
          ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
          const flip = p.kind === 'confetti' ? Math.abs(Math.cos(p.t * 8 + p.rot)) : 1;
          r.spr(Art.dot(p.color), p.x, y, p.rot, p.size / 16, (p.size / 16) * (p.kind === 'drop' ? 1 : 0.55) * (0.3 + 0.7 * flip));
          break;
        }
        case 'star': {
          ctx.globalAlpha = 1 - k;
          r.spr(Art.dot(p.color), p.x, y, p.rot, p.size / 16, p.size / 32);
          r.spr(Art.dot(p.color), p.x, y, p.rot + Math.PI / 2, p.size / 16, p.size / 32);
          break;
        }
        default:
          break;
      }
    }
    ctx.globalAlpha = 1;
    r.resetWorld();
    for (const p of this.parts) {
      const k = p.t / p.life;
      if (p.kind === 'spark') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
      } else if (p.kind === 'ring') {
        ctx.globalAlpha = p.a * (1 - ease.outQuad(k));
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size + p.grow * ease.outCubic(k), (p.size + p.grow * ease.outCubic(k)) * 0.8, 0, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}

export function textScale(t) {
  const life = t.life;
  const k = clamp(t.t / life, 0, 1);
  const pop = t.t < 0.25 ? ease.outBack(clamp(t.t / 0.25, 0, 1)) : 1;
  const alpha = t.t < 0 ? 0 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
  const rise = ease.outCubic(k) * 46;
  return { pop, alpha, rise };
}
