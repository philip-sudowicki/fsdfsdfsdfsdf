// Draws the town: ground tiles, shadows, objects, effects.
import { CONFIG } from './config.js';
import { Art, PAL } from './art.js';
import { DEPOT, POND, COLS, ROWS } from './world.js';
import { TAU, clamp, rgba } from './util.js';

const T = CONFIG.tile;
const SHADOW_ALPHA = 0.26;

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.K = 1;
    this.OX = 0;
    this.OY = 0;
    this.cam = { x: 0, y: 0, zoom: 1 };
  }

  begin(cam, W, H, dpr, shakeX = 0, shakeY = 0) {
    this.cam = cam;
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.K = dpr * cam.zoom;
    this.cx = cam.x + shakeX;
    this.cy = cam.y + shakeY;
    this.OX = dpr * W / 2 - this.cx * this.K;
    this.OY = dpr * H / 2 - this.cy * this.K;
    const hw = W / 2 / cam.zoom, hh = H / 2 / cam.zoom;
    this.vx0 = this.cx - hw;
    this.vy0 = this.cy - hh;
    this.vx1 = this.cx + hw;
    this.vy1 = this.cy + hh;
  }

  resetWorld() {
    this.ctx.setTransform(this.K, 0, 0, this.K, this.OX, this.OY);
  }

  spr(s, x, y, a = 0, sx = 1, sy = 1) {
    const K = this.K;
    if (a) {
      const c = Math.cos(a), n = Math.sin(a);
      this.ctx.setTransform(K * c * sx, K * n * sx, -K * n * sy, K * c * sy, this.OX + K * x, this.OY + K * y);
    } else {
      this.ctx.setTransform(K * sx, 0, 0, K * sy, this.OX + K * x, this.OY + K * y);
    }
    this.ctx.drawImage(s.c, -s.ax, -s.ay, s.w, s.h);
  }

  visible(x, y, pad) {
    return x > this.vx0 - pad && x < this.vx1 + pad && y > this.vy0 - pad && y < this.vy1 + pad;
  }

  toScreen(x, y) {
    return { x: (x - this.cx) * this.cam.zoom + this.W / 2, y: (y - this.cy) * this.cam.zoom + this.H / 2 };
  }

  drawGround(world) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#6bb55a';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const tx0 = clamp(Math.floor(this.vx0 / T), 0, COLS - 1), tx1 = clamp(Math.floor(this.vx1 / T), 0, COLS - 1);
    const ty0 = clamp(Math.floor(this.vy0 / T), 0, ROWS - 1), ty1 = clamp(Math.floor(this.vy1 / T), 0, ROWS - 1);
    const K = this.K;
    for (let ty = ty0; ty <= ty1; ty++) {
      const y0 = Math.round(this.OY + ty * T * K), y1 = Math.round(this.OY + (ty + 1) * T * K);
      for (let tx = tx0; tx <= tx1; tx++) {
        const x0 = Math.round(this.OX + tx * T * K), x1 = Math.round(this.OX + (tx + 1) * T * K);
        ctx.drawImage(Art.ground(world.info[ty * COLS + tx]), x0, y0, x1 - x0, y1 - y0);
      }
    }
    this.tiles = [tx0, ty0, tx1, ty1];
  }

  // Iterate the world buckets over visible tiles (+1 margin).
  eachBucket(world, fn) {
    const [tx0, ty0, tx1, ty1] = this.tiles;
    for (let ty = Math.max(0, ty0 - 1); ty <= Math.min(ROWS - 1, ty1 + 1); ty++) {
      for (let tx = Math.max(0, tx0 - 1); tx <= Math.min(COLS - 1, tx1 + 1); tx++) fn(world.buckets[ty * COLS + tx]);
    }
  }

  drawPondLife(time) {
    if (!this.visible(POND.x, POND.y, POND.rx + 40)) return;
    const ctx = this.ctx;
    this.resetWorld();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const k = ((time * 0.35 + i / 6) % 1);
      const a = i * 2.1;
      const px = POND.x + Math.cos(a) * POND.rx * 0.5, py = POND.y + Math.sin(a * 1.3) * POND.ry * 0.45;
      ctx.globalAlpha = 0.35 * (1 - k);
      ctx.beginPath();
      ctx.ellipse(px, py, 6 + k * 30, (6 + k * 30) * 0.55, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // opts: { van, skin, bed: [kinds], target: {house|depot}, pulse, radius, time, inRange }
  drawTown(town, opts) {
    const ctx = this.ctx;
    const world = town.world;
    const time = opts.time;
    this.drawGround(world);
    this.drawPondLife(time);
    this.resetWorld();
    town.fx.drawSkids(ctx);
    this.drawTarget(opts);

    // Ground-level objects.
    for (const r of world.ramps) if (this.visible(r.x, r.y, 60)) this.spr(Art.ramp(), r.x, r.y, r.angle);
    for (const d of town.dropped) {
      if (!this.visible(d.x, d.y, 20)) continue;
      ctx.globalAlpha = d.t > 28 ? (30 - d.t) / 2 : 1;
      this.spr(Art.parcel(d.kind), d.x, d.y, d.angle);
    }
    ctx.globalAlpha = 1;
    for (const f of town.flocks) {
      if (!this.visible(f.x, f.y, 300)) continue;
      for (const b of f.birds) {
        if (b.z > 2) continue;
        this.spr(Art.bird(f.kind, 0), b.x, b.y - b.hop * 3, b.a, 1, 1);
      }
    }

    // Shadow pass.
    ctx.globalAlpha = SHADOW_ALPHA;
    const treeSh = Art.shadow(40, 40, 20, 8);
    const carSh = Art.shadow(46, 24, 8, 5);
    const vanSh = Art.shadow(54, 28, 8, 5);
    const smallSh = Art.shadow(14, 14, 7, 3);
    this.eachBucket(world, (b) => {
      for (const h of b.houses) if (this.visible(h.cx, h.cy, 80)) this.spr(Art.shadow(h.w, h.d, 4, 8), h.cx + 7, h.cy + 9, h.ang);
      for (const s of b.sheds) if (this.visible(s.x, s.y, 60)) this.spr(Art.shadow(s.w, s.h, 3, 6), s.x + s.w / 2 + 5, s.y + s.h / 2 + 6);
      for (const p of b.parked) if (this.visible(p.x, p.y, 50)) this.spr(p.kind === 'van' ? vanSh : carSh, p.x + 3, p.y + 4, p.angle);
      for (const t of b.trees) if (this.visible(t.x, t.y, t.r + 20)) this.spr(treeSh, t.x + 9, t.y + 11, 0, t.r / 20 * 0.95, t.r / 20 * 0.95);
    });
    if (this.visible((DEPOT.building.x0 + DEPOT.building.x1) / 2, (DEPOT.building.y0 + DEPOT.building.y1) / 2, 300)) {
      const b = DEPOT.building;
      this.spr(Art.shadow(b.x1 - b.x0, b.y1 - b.y0, 5, 10), (b.x0 + b.x1) / 2 + 9, (b.y0 + b.y1) / 2 + 11);
    }
    for (const c of town.traffic.cars) if (this.visible(c.x, c.y, 60)) this.spr(carSh, c.x + 3, c.y + 4, c.angle);
    for (const p of town.props) {
      if (p.state === 'gone' || !this.visible(p.x, p.y, 30)) continue;
      ctx.globalAlpha = SHADOW_ALPHA * p.alpha;
      this.spr(smallSh, p.x + 2, p.y + 3, 0, 0.9, 0.9);
    }
    ctx.globalAlpha = SHADOW_ALPHA;
    const van = opts.van;
    if (van) {
      const z = van.z;
      this.spr(vanSh, van.x + 3 + z * 0.7, van.y + 4 + z * 0.9, van.angle, 1 - z / 140, 1 - z / 140);
    }
    for (const fp of town.flying) this.spr(smallSh, fp.x + 2, fp.y + 3, 0, 0.8, 0.8);
    for (const f of town.flocks) {
      if (!this.visible(f.x, f.y, 400)) continue;
      for (const b of f.birds) if (b.z > 2) this.spr(smallSh, b.x + b.z * 0.4, b.y + b.z * 0.5, 0, 0.5, 0.35);
    }
    ctx.globalAlpha = 1;
    // Lamp pole shadows.
    this.resetWorld();
    ctx.strokeStyle = rgba(PAL.ink, 0.22);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    this.eachBucket(world, (b) => {
      for (const l of b.lamps) {
        if (!this.visible(l.x, l.y, 40)) continue;
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x + 22, l.y + 28);
      }
    });
    ctx.stroke();

    // Props.
    for (const p of town.props) {
      if (p.state === 'gone' || !this.visible(p.x, p.y, 30)) continue;
      ctx.globalAlpha = p.alpha;
      this.spr(p.kind === 'bin' ? Art.bin() : Art.cone(), p.x, p.y - p.z, p.angle);
    }
    ctx.globalAlpha = 1;

    // Vehicles.
    this.eachBucket(world, (b) => {
      for (const p of b.parked) if (this.visible(p.x, p.y, 40)) this.spr(p.kind === 'van' ? Art.fleetVan() : Art.car(p.shape, p.color), p.x, p.y, p.angle);
    });
    for (const c of town.traffic.cars) {
      if (!this.visible(c.x, c.y, 60)) continue;
      const bump = 1 + c.bump * 0.12;
      this.spr(Art.car(c.shape, c.color), c.x, c.y, c.angle, bump, 2 - bump);
    }
    if (van && !van.air) this.drawVan(van, opts);

    // Buildings.
    this.eachBucket(world, (b) => {
      for (const s of b.sheds) if (this.visible(s.x, s.y, 60)) this.spr(Art.shed(s.color), s.x + s.w / 2, s.y + s.h / 2);
      for (const h of b.houses) if (this.visible(h.cx, h.cy, 70)) this.spr(Art.house(h), h.cx, h.cy, h.ang);
    });
    if (this.visible((DEPOT.building.x0 + DEPOT.building.x1) / 2, (DEPOT.building.y0 + DEPOT.building.y1) / 2, 300)) {
      const b = DEPOT.building;
      this.spr(Art.depot(), (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    }
    if (opts.houseGlow) this.drawHouseGlow(opts.houseGlow, time);
    if (van && van.air) this.drawVan(van, opts);

    // Tall things.
    const lamp = Art.lamp();
    this.eachBucket(world, (b) => {
      for (const l of b.lamps) if (this.visible(l.x, l.y, 20)) this.spr(lamp, l.x, l.y);
    });
    this.eachBucket(world, (b) => {
      for (const t of b.trees) {
        if (!this.visible(t.x, t.y, t.r + 4)) continue;
        const sw = Math.sin(time * 1.3 + t.phase);
        const s = (t.r / 30) * (1 + 0.018 * Math.sin(time * 1.7 + t.phase));
        this.spr(Art.tree(t.kind, t.variant), t.x + sw * 1.6, t.y + Math.cos(time * 1.1 + t.phase) * 0.8, sw * 0.035, s, s);
      }
    });

    // Airborne birds and parcels.
    for (const f of town.flocks) {
      if (!this.visible(f.x, f.y, 400)) continue;
      for (const b of f.birds) {
        if (b.z <= 2) continue;
        const s = 1 + b.z / 70;
        this.spr(Art.bird(f.kind, Math.floor(b.flap) % 2), b.x, b.y - b.z, b.a, s, s);
      }
    }
    for (const fp of town.flying) {
      const s = 1 + fp.z / 60;
      this.spr(Art.parcel(fp.kind), fp.x, fp.y - fp.z, fp.angle, s, s);
    }
    town.fx.drawParticles(ctx, this);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  drawVan(van, opts) {
    const ctx = this.ctx;
    const zs = 1 + van.z / 70;
    const sx = (1 + van.squash) * zs, sy = (1 - van.squash * 0.7) * zs;
    const y = van.y - van.z;
    this.spr(Art.van(opts.skin), van.x, y, van.angle, sx, sy);
    const c = Math.cos(van.angle), s = Math.sin(van.angle);
    const bed = opts.bed || [];
    const slots = [[0, -5], [0, 5], [-7, -5], [-7, 5], [-14, -5], [-14, 5], [-21, -5], [-21, 5]];
    for (let i = 0; i < bed.length && i < slots.length; i++) {
      const lx = slots[i][0] * sx, ly = slots[i][1] * sy;
      this.spr(Art.bedBox(bed[i]), van.x + lx * c - ly * s, y + lx * s + ly * c, van.angle, sx * 1.02, sy);
    }
    if (van.braking) {
      ctx.globalAlpha = 0.85;
      const red = Art.puff('#ff4f5e');
      for (const side of [-9, 9]) {
        const lx = -27 * sx, ly = side * sy;
        this.spr(red, van.x + lx * c - ly * s, y + lx * s + ly * c, 0, 0.9, 0.9);
      }
      ctx.globalAlpha = 1;
    }
  }

  drawTarget(opts) {
    const t = opts.target;
    if (!t) return;
    const ctx = this.ctx;
    const time = opts.time;
    this.resetWorld();
    if (t.depot) {
      const z = DEPOT.zone;
      const p = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.strokeStyle = rgba(PAL.sun, 0.5 + 0.5 * p);
      ctx.lineWidth = 6 + p * 3;
      ctx.strokeRect(z.x0 - 6, z.y0 - 6, z.x1 - z.x0 + 12, z.y1 - z.y0 + 12);
      return;
    }
    const m = t.mat;
    if (opts.showRadius) {
      ctx.setLineDash([14, 12]);
      ctx.lineDashOffset = -time * 30;
      ctx.strokeStyle = rgba(PAL.cream, opts.inRange ? 0.55 : 0.3);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(m.x, m.y, opts.radius, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const pulse = 0.5 + 0.5 * Math.sin(time * 6);
    ctx.fillStyle = rgba(opts.color || PAL.coral, 0.25 + pulse * 0.2);
    ctx.beginPath();
    ctx.arc(m.x, m.y, 20 + pulse * 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = PAL.cream;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 20 + pulse * 6, 0, TAU);
    ctx.stroke();
  }

  drawHouseGlow(h, time) {
    const ctx = this.ctx;
    this.resetWorld();
    const p = 0.5 + 0.5 * Math.sin(time * 5);
    ctx.strokeStyle = rgba(PAL.sun, 0.45 + 0.45 * p);
    ctx.lineWidth = 4 + p * 2;
    const r = h.rect;
    ctx.beginPath();
    const pad = 5 + p * 2;
    ctx.roundRect ? ctx.roundRect(r.x0 - pad, r.y0 - pad, r.x1 - r.x0 + pad * 2, r.y1 - r.y0 + pad * 2, 8) : ctx.rect(r.x0 - pad, r.y0 - pad, r.x1 - r.x0 + pad * 2, r.y1 - r.y0 + pad * 2);
    ctx.stroke();
  }
}
