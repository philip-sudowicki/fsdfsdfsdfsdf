// AI traffic that drives on the right-hand lane and turns at junctions.
import { CONFIG } from './config.js';
import { DIRS } from './world.js';
import { rnd, rndInt, dist } from './util.js';

const T = CONFIG.tile;
const LANE = 30;
const PATHS = {};

function right(d) {
  return DIRS[(d + 1) % 4];
}

function buildPaths() {
  for (let din = 0; din < 4; din++) {
    for (let dout = 0; dout < 4; dout++) {
      if (dout === (din + 2) % 4) continue;
      const [ix, iy] = DIRS[din], [ox, oy] = DIRS[dout];
      const [rix, riy] = right(din), [rox, roy] = right(dout);
      const ex = -ix * T / 2 + rix * LANE, ey = -iy * T / 2 + riy * LANE;
      const xx = ox * T / 2 + rox * LANE, xy = oy * T / 2 + roy * LANE;
      const pts = [];
      if (din === dout) {
        pts.push([ex, ey], [xx, xy]);
      } else {
        const cx = iy === 0 ? xx : ex;
        const cy = iy === 0 ? ey : xy;
        const N = 10;
        for (let i = 0; i <= N; i++) {
          const t = i / N, u = 1 - t;
          pts.push([u * u * ex + 2 * u * t * cx + t * t * xx, u * u * ey + 2 * u * t * cy + t * t * xy]);
        }
      }
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      PATHS[din * 4 + dout] = { pts, cum, len: cum[cum.length - 1] };
    }
  }
}
buildPaths();

function samplePath(path, s, out) {
  const { pts, cum } = path;
  let i = 1;
  while (i < pts.length - 1 && cum[i] < s) i++;
  const s0 = cum[i - 1], s1 = cum[i];
  const t = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
  const a = pts[i - 1], b = pts[i];
  out.x = a[0] + (b[0] - a[0]) * t;
  out.y = a[1] + (b[1] - a[1]) * t;
  out.angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
}

const sample = { x: 0, y: 0, angle: 0 };

export class Traffic {
  constructor(world) {
    this.world = world;
    this.cars = [];
  }

  clear() {
    this.cars.length = 0;
  }

  pickOut(tx, ty, din) {
    const opts = [];
    for (let d = 0; d < 4; d++) {
      if (d === (din + 2) % 4) continue;
      if (!this.world.isRoad(tx + DIRS[d][0], ty + DIRS[d][1])) continue;
      opts.push(d);
      if (d === din) opts.push(d, d);
    }
    if (!opts.length) return -1;
    return opts[Math.floor(Math.random() * opts.length)];
  }

  spawnAt(tx, ty, din) {
    const dout = this.pickOut(tx, ty, din);
    if (dout < 0) return null;
    const car = {
      tx, ty, din, dout,
      path: PATHS[din * 4 + dout],
      s: rnd(0, 20),
      speed: 0,
      cruise: rnd(CONFIG.traffic.speedMin, CONFIG.traffic.speedMax),
      shape: rndInt(0, 1),
      color: rndInt(0, 5),
      x: 0, y: 0, angle: 0, vx: 0, vy: 0,
      stopT: 0, waitT: 0, ghostT: 0, nearT: 0, honkT: 0, bump: 0,
      pitch: rnd(0.85, 1.2),
    };
    this.place(car);
    car.speed = car.cruise * 0.8;
    this.cars.push(car);
    return car;
  }

  place(car) {
    samplePath(car.path, car.s, sample);
    car.x = car.tx * T + T / 2 + sample.x;
    car.y = car.ty * T + T / 2 + sample.y;
    car.angle = sample.angle;
  }

  // Keep roughly `count` cars around (fx, fy), spawning outside the view.
  maintain(fx, fy, count, viewR) {
    const C = CONFIG.traffic;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      if (dist(this.cars[i].x, this.cars[i].y, fx, fy) > C.despawn) this.cars.splice(i, 1);
    }
    const roads = this.world.roadTiles();
    let tries = 0;
    while (this.cars.length < count && tries < 24) {
      tries++;
      const [tx, ty] = roads[Math.floor(Math.random() * roads.length)];
      const cx = tx * T + T / 2, cy = ty * T + T / 2;
      const d = dist(cx, cy, fx, fy);
      if (d < Math.max(C.spawnMin, viewR) || d > Math.max(C.spawnMax, viewR + 600)) continue;
      if (this.cars.some((c) => dist(c.x, c.y, cx, cy) < 110)) continue;
      const dirs = [0, 1, 2, 3].filter((k) => this.world.isRoad(tx - DIRS[k][0], ty - DIRS[k][1]));
      if (!dirs.length) continue;
      this.spawnAt(tx, ty, dirs[Math.floor(Math.random() * dirs.length)]);
    }
  }

  update(dt, van, speedMul, events) {
    const C = CONFIG.traffic;
    const cars = this.cars;
    for (const car of cars) {
      const dir = car.angle;
      const fx = Math.cos(dir), fy = Math.sin(dir);
      let target = car.cruise * speedMul;
      let blockedByCar = false;
      const check = (ox, oy, isCar) => {
        const dx = ox - car.x, dy = oy - car.y;
        const f = dx * fx + dy * fy;
        if (f <= 0 || f > C.lookAhead) return;
        const lat = Math.abs(-dx * fy + dy * fx);
        if (lat > 24) return;
        const allowed = Math.max(0, (f - 40) * 3.2);
        if (allowed < target) {
          target = allowed;
          if (isCar) blockedByCar = true;
        }
      };
      if (car.ghostT <= 0) {
        for (const o of cars) if (o !== car) check(o.x, o.y, true);
      }
      if (van) check(van.x, van.y, false);
      if (car.stopT > 0) {
        car.stopT -= dt;
        target = 0;
      }
      car.ghostT -= dt;
      car.nearT -= dt;
      car.honkT -= dt;
      const rate = target < car.speed ? 700 : 240;
      car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), rate * dt);
      if (car.speed < 8 && target < 8) {
        car.waitT += dt;
        if (blockedByCar && car.waitT > 2) {
          car.ghostT = 1.4;
          car.waitT = 0;
        } else if (!blockedByCar && car.stopT <= 0 && car.waitT > 2.6 && car.honkT <= 0) {
          events.push({ type: 'honk', car });
          car.honkT = 3;
        }
      } else car.waitT = 0;
      car.s += car.speed * dt;
      let guard = 0;
      while (car.s >= car.path.len && guard++ < 3) {
        car.s -= car.path.len;
        car.tx += DIRS[car.dout][0];
        car.ty += DIRS[car.dout][1];
        car.din = car.dout;
        const next = this.pickOut(car.tx, car.ty, car.din);
        if (next < 0) {
          car.dead = true;
          break;
        }
        car.dout = next;
        car.path = PATHS[car.din * 4 + car.dout];
      }
      const px = car.x, py = car.y;
      this.place(car);
      car.vx = (car.x - px) / Math.max(dt, 1e-4);
      car.vy = (car.y - py) / Math.max(dt, 1e-4);
      car.bump = Math.max(0, car.bump - dt * 3);
    }
    for (let i = cars.length - 1; i >= 0; i--) if (cars[i].dead) cars.splice(i, 1);
  }
}
