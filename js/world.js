// Town layout: tile grid, house lots, colliders, surfaces and spawn points.
import { CONFIG } from './config.js';
import { mulberry32, clamp } from './util.js';

const T = CONFIG.tile;

export const TL = {
  WOODS: 0, ROAD: 1, LOT: 2, GARDEN: 3, PARK: 4, PATH: 5, ALLEY: 6, POND: 7, DEPOT: 8, YARD: 9, PARKING: 10,
};

// E, S, W, N
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const DIAGS = [[1, 1], [-1, 1], [-1, -1], [1, -1]]; // SE, SW, NW, NE

export const COLS = 33;
export const ROWS = 27;

const ROAD_ROWS = [1, 5, 9, 13, 17, 21, 25];
const ROAD_COLS = [1, 7, 13, 19, 25, 31];

const ALLEYS = [
  ['h', 3, 8, 12], ['h', 3, 20, 30], ['h', 15, 26, 30], ['h', 19, 2, 12], ['h', 19, 14, 18], ['h', 23, 8, 18],
  ['v', 4, 6, 8], ['v', 10, 6, 8], ['v', 28, 10, 12], ['v', 16, 2, 4], ['v', 22, 22, 24], ['v', 28, 18, 20],
];

const RAMPS = [
  [25, 3, 0], [7, 19, 2], [13, 23, 0], [28, 11, 3], [10, 7, 1],
  [17, 11, 0], [21, 15, 2], [15, 12, 3], [23, 14, 1],
];

const PARKING = [[2, 7], [18, 7], [12, 11], [30, 23], [20, 23]];

export const DEPOT = {
  building: { x0: 3 * T + 10, y0: 10 * T + 8, x1: 6 * T - 10, y1: 12 * T - 30 },
  zone: { x0: 3 * T + 20, y0: 12 * T - 26, x1: 6 * T - 20, y1: 13 * T - 6 },
  start: { x: 3 * T + 40, y: 12.5 * T, angle: 0 },
};

export const POND = { x: 19.5 * T, y: 13.5 * T, rx: 2.2 * T, ry: 1.2 * T };

// Rotate a local lot point (lot faces down / +y) into world orientation.
function lotAngle(facing) {
  const [dx, dy] = DIRS[facing];
  return Math.atan2(dy, dx) - Math.PI / 2;
}

export class World {
  constructor() {
    this.cols = COLS;
    this.rows = ROWS;
    this.width = COLS * T;
    this.height = ROWS * T;
    this.grid = new Uint8Array(COLS * ROWS);
    this.info = new Array(COLS * ROWS);
    this.houses = [];
    this.trees = [];
    this.lamps = [];
    this.sheds = [];
    this.parked = [];
    this.ramps = [];
    this.propSpots = [];
    this.flockSpots = [];
    this.colliders = new Array(COLS * ROWS);
    for (let i = 0; i < this.colliders.length; i++) this.colliders[i] = [];
    this.buckets = new Array(COLS * ROWS);
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = { houses: [], trees: [], lamps: [], sheds: [], parked: [] };
    this.stamp = 0;
    this.build();
  }

  idx(tx, ty) {
    return ty * COLS + tx;
  }

  tile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return TL.WOODS;
    return this.grid[ty * COLS + tx];
  }

  set(tx, ty, v) {
    this.grid[ty * COLS + tx] = v;
  }

  isRoad(tx, ty) {
    return this.tile(tx, ty) === TL.ROAD;
  }

  tileAtWorld(x, y) {
    return this.tile(Math.floor(x / T), Math.floor(y / T));
  }

  build() {
    const rng = mulberry32(20240611);
    this.rng = rng;
    const g = this.grid;
    g.fill(TL.LOT);
    for (let x = 0; x < COLS; x++) {
      this.set(x, 0, TL.WOODS);
      this.set(x, ROWS - 1, TL.WOODS);
    }
    for (let y = 0; y < ROWS; y++) {
      this.set(0, y, TL.WOODS);
      this.set(COLS - 1, y, TL.WOODS);
    }
    for (const y of ROAD_ROWS) for (let x = 1; x < COLS - 1; x++) this.set(x, y, TL.ROAD);
    for (const x of ROAD_COLS) for (let y = 1; y < ROWS - 1; y++) this.set(x, y, TL.ROAD);
    // Merge a few blocks for variety.
    for (const y of [18, 19, 20]) this.set(7, y, TL.LOT);
    for (const y of [2, 3, 4]) this.set(25, y, TL.LOT);
    for (const y of [22, 23, 24]) this.set(13, y, TL.LOT);

    // Park with a pond and a looping path.
    for (let y = 10; y <= 16; y++) for (let x = 14; x <= 24; x++) this.set(x, y, TL.PARK);
    for (let x = 15; x <= 23; x++) {
      this.set(x, 11, TL.PATH);
      this.set(x, 15, TL.PATH);
    }
    for (let y = 11; y <= 15; y++) {
      this.set(15, y, TL.PATH);
      this.set(23, y, TL.PATH);
    }
    this.set(14, 13, TL.PATH);
    this.set(24, 13, TL.PATH);
    this.set(19, 10, TL.PATH);
    this.set(19, 16, TL.PATH);
    for (let y = 12; y <= 14; y++) for (let x = 17; x <= 21; x++) this.set(x, y, TL.POND);

    // Depot block.
    for (let y = 10; y <= 12; y++) for (let x = 2; x <= 6; x++) this.set(x, y, TL.YARD);
    for (let y = 10; y <= 11; y++) for (let x = 3; x <= 5; x++) this.set(x, y, TL.DEPOT);

    for (const [k, a, b, c] of ALLEYS) {
      for (let i = b; i <= c; i++) {
        if (k === 'h') this.set(i, a, TL.ALLEY);
        else this.set(a, i, TL.ALLEY);
      }
    }
    for (const [x, y] of PARKING) this.set(x, y, TL.PARKING);

    // Lots without road access become back gardens.
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (this.tile(tx, ty) !== TL.LOT) continue;
        if (this.lotFacing(tx, ty) < 0) this.set(tx, ty, TL.GARDEN);
      }
    }

    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) this.buildTile(tx, ty, rng);
    }

    // Depot colliders and parked courier vans.
    this.addRect(DEPOT.building.x0, DEPOT.building.y0, DEPOT.building.x1, DEPOT.building.y1);
    this.addParked(2.5 * T, 10.7 * T, Math.PI / 2, 'van');
    this.addParked(6.5 * T, 10.7 * T, -Math.PI / 2, 'van');
    this.flockSpots.push({ kind: 'pigeon', x: 2.5 * T, y: 12.4 * T, n: 4 });

    // Park extras.
    this.flockSpots.push({ kind: 'duck', x: POND.x, y: POND.y, n: 6 });
    this.flockSpots.push({ kind: 'pigeon', x: 19.5 * T, y: 10.5 * T, n: 5 });
    this.flockSpots.push({ kind: 'pigeon', x: 14.5 * T, y: 13.5 * T, n: 4 });
    this.flockSpots.push({ kind: 'pigeon', x: 23.5 * T, y: 15.5 * T, n: 4 });

    for (const [tx, ty, dir] of RAMPS) this.addRamp(tx, ty, dir);
  }

  lotFacing(tx, ty) {
    for (const d of [1, 3, 0, 2]) {
      const [dx, dy] = DIRS[d];
      if (this.isRoad(tx + dx, ty + dy)) return d;
    }
    return -1;
  }

  sideMasks(tx, ty) {
    let side = 0, diag = 0;
    for (let d = 0; d < 4; d++) if (this.isRoad(tx + DIRS[d][0], ty + DIRS[d][1])) side |= 1 << d;
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = DIAGS[d];
      if (!this.isRoad(tx + dx, ty + dy)) continue;
      const hx = dx > 0 ? 0 : 2;
      const vy = dy > 0 ? 1 : 3;
      if (side & (1 << hx) || side & (1 << vy)) continue;
      diag |= 1 << d;
    }
    return { side, diag };
  }

  connMask(tx, ty, types) {
    let m = 0;
    for (let d = 0; d < 4; d++) if (types.includes(this.tile(tx + DIRS[d][0], ty + DIRS[d][1]))) m |= 1 << d;
    return m;
  }

  buildTile(tx, ty, rng) {
    const type = this.tile(tx, ty);
    const { side, diag } = this.sideMasks(tx, ty);
    const variant = Math.floor(rng() * 3);
    const info = { type, tx, ty, side, diag, variant, key: '' };
    this.info[this.idx(tx, ty)] = info;
    const x0 = tx * T, y0 = ty * T;
    switch (type) {
      case TL.ROAD: {
        info.mask = this.connMask(tx, ty, [TL.ROAD]);
        let bits = 0;
        for (let d = 0; d < 4; d++) if (info.mask & (1 << d)) bits++;
        info.cross = bits >= 3;
        info.key = `R${info.mask}`;
        break;
      }
      case TL.WOODS: {
        info.key = `T${side}:${diag}:${variant}`;
        this.addRect(x0, y0, x0 + T, y0 + T);
        const n = 1 + Math.floor(rng() * 2);
        for (let i = 0; i < n; i++) {
          this.addTree(x0 + 24 + rng() * (T - 48), y0 + 24 + rng() * (T - 48), rng, rng() < 0.5 ? 'pine' : null, false);
        }
        break;
      }
      case TL.LOT:
        this.buildLot(info, rng);
        break;
      case TL.GARDEN: {
        const r = rng();
        info.feature = r < 0.3 ? 'tree' : r < 0.5 ? 'shed' : r < 0.68 ? 'pool' : r < 0.85 ? 'veg' : 'tramp';
        info.key = `G${side}:${diag}:${info.feature}:${variant}`;
        if (info.feature === 'tree') {
          this.addTree(x0 + 40 + rng() * 48, y0 + 40 + rng() * 48, rng, null, true);
        } else if (info.feature === 'shed') {
          const s = { x: x0 + 34 + rng() * 20, y: y0 + 30 + rng() * 20, w: 44, h: 32, color: Math.floor(rng() * 4) };
          this.sheds.push(s);
          this.bucket(tx, ty).sheds.push(s);
          this.addRect(s.x - 2, s.y - 2, s.x + s.w + 2, s.y + s.h + 2);
          this.addTree(x0 + 96, y0 + 96, rng, null, true, 0.75);
        } else if (info.feature === 'pool') {
          this.addRect(x0 + 24, y0 + 34, x0 + 104, y0 + 94);
        } else if (info.feature === 'veg') {
          this.addTree(x0 + 100, y0 + 28, rng, null, true, 0.7);
        }
        break;
      }
      case TL.PARK: {
        info.key = `P${side}:${diag}:${variant}`;
        if (rng() < 0.55 && side === 0) {
          this.addTree(x0 + 30 + rng() * 68, y0 + 30 + rng() * 68, rng, rng() < 0.2 ? 'blossom' : null, true);
        }
        break;
      }
      case TL.PATH:
        info.mask = this.connMask(tx, ty, [TL.PATH, TL.ROAD]);
        info.key = `B${info.mask}:${side}:${diag}`;
        if (side === 0 && rng() < 0.3) this.lamps.push(this.bucketPush(tx, ty, 'lamps', { x: x0 + 14, y: y0 + 14 }));
        break;
      case TL.ALLEY:
        info.mask = this.connMask(tx, ty, [TL.ALLEY, TL.ROAD]);
        info.key = `A${info.mask}:${side}:${diag}`;
        break;
      case TL.POND:
        info.key = `W${tx},${ty}`;
        break;
      case TL.DEPOT:
        info.key = `D${tx},${ty}`;
        break;
      case TL.YARD:
        info.key = `Y${tx},${ty}:${side}`;
        break;
      case TL.PARKING: {
        info.facing = this.lotFacing(tx, ty);
        info.key = `K${info.facing}:${side}:${diag}`;
        const ang = lotAngle(info.facing);
        const place = (lx, ly) => this.localToWorld(tx, ty, ang, lx, ly);
        const spots = [32, 64, 96];
        const used = spots.filter(() => rng() < 0.65);
        if (!used.length) used.push(64);
        for (const lx of used) {
          const p = place(lx, 54);
          this.addParked(p.x, p.y, ang + Math.PI / 2, null, rng);
        }
        const c = place(116, 24);
        this.propSpots.push({ kind: 'cone', x: c.x, y: c.y });
        break;
      }
    }
  }

  localToWorld(tx, ty, ang, lx, ly) {
    const cx = tx * T + T / 2, cy = ty * T + T / 2;
    const vx = lx - T / 2, vy = ly - T / 2;
    const c = Math.cos(ang), s = Math.sin(ang);
    return { x: cx + vx * c - vy * s, y: cy + vx * s + vy * c };
  }

  localRect(tx, ty, ang, x0, y0, x1, y1) {
    const a = this.localToWorld(tx, ty, ang, x0, y0);
    const b = this.localToWorld(tx, ty, ang, x1, y1);
    return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
  }

  buildLot(info, rng) {
    const { tx, ty } = info;
    const facing = this.lotFacing(tx, ty);
    info.facing = facing;
    const ang = lotAngle(facing);
    // Which local sides (left = local -x, right = local +x) also touch a road?
    const localSideRoad = (lx, ly) => {
      const c = Math.cos(ang), s = Math.sin(ang);
      const wx = Math.round(lx * c - ly * s), wy = Math.round(lx * s + ly * c);
      return this.isRoad(tx + wx, ty + wy);
    };
    const roadL = localSideRoad(-1, 0);
    const roadR = localSideRoad(1, 0);
    const style = Math.floor(rng() * 4);
    const sizes = [[92, 56], [88, 52], [96, 58], [84, 54]];
    const [hw, hd] = sizes[style];
    let color = Math.floor(rng() * 6);
    const prev = this.houses[this.houses.length - 1];
    if (prev && prev.color === color) color = (color + 1 + Math.floor(rng() * 5)) % 6;
    const r = rng();
    let yard = r < 0.45 ? 'hedge' : r < 0.65 ? 'fence' : r < 0.85 ? 'pond' : 'flowers';
    const hedgeL = !roadL && yard !== 'fence';
    const hedgeR = !roadR && (yard === 'hedge' || yard === 'flowers');
    const fenceL = !roadL && yard === 'fence';
    const fenceR = !roadR && yard === 'fence';
    const pondR = yard === 'pond' && !roadR;
    const bushR = (yard === 'fence' || (yard === 'pond' && roadR)) && !roadR;
    info.lotStyle = { yard, hedgeL, hedgeR, fenceL, fenceR, pondR, bushR, roadL, roadR };
    info.key = `L${facing}:${info.side}:${info.diag}:${+hedgeL}${+hedgeR}${+fenceL}${+fenceR}${+pondR}${+bushR}:${yard === 'flowers' ? 1 : 0}:${info.variant}`;

    const W = (lx, ly) => this.localToWorld(tx, ty, ang, lx, ly);
    const houseRect = this.localRect(tx, ty, ang, 64 - hw / 2, 66 - hd, 64 + hw / 2, 66);
    this.addRect(houseRect.x0, houseRect.y0, houseRect.x1, houseRect.y1);
    if (hedgeL) { const q = this.localRect(tx, ty, ang, 3, 72, 12, 110); this.addRect(q.x0, q.y0, q.x1, q.y1); }
    if (hedgeR) { const q = this.localRect(tx, ty, ang, 116, 72, 125, 110); this.addRect(q.x0, q.y0, q.x1, q.y1); }
    if (fenceL) { const q = this.localRect(tx, ty, ang, 4, 72, 8, 110); this.addRect(q.x0, q.y0, q.x1, q.y1); }
    if (fenceR) { const q = this.localRect(tx, ty, ang, 120, 72, 124, 110); this.addRect(q.x0, q.y0, q.x1, q.y1); }
    const misses = [];
    if (hedgeL) misses.push({ ...W(8, 92), kind: 'hedge' });
    if (hedgeR) misses.push({ ...W(120, 92), kind: 'hedge' });
    if (pondR) {
      const p = W(98, 92);
      this.addCircle(p.x, p.y, 13);
      misses.push({ ...p, kind: 'pond' });
    }
    if (bushR) {
      const p = W(102, 90);
      this.addCircle(p.x, p.y, 11);
      misses.push({ ...p, kind: 'hedge' });
    }
    if (!misses.length) misses.push({ ...W(30, 90), kind: 'hedge' });

    const [fx, fy] = DIRS[facing];
    const mat = W(64, 77);
    const house = {
      id: this.houses.length,
      tx, ty, facing, ang, style, color,
      w: hw, d: hd,
      cx: (houseRect.x0 + houseRect.x1) / 2,
      cy: (houseRect.y0 + houseRect.y1) / 2,
      rect: houseRect,
      mat,
      path: W(64, 100),
      misses,
      front: { x: fx, y: fy },
      chimney: rng() < 0.5 ? 0 : 1,
      seed: Math.floor(rng() * 1e6),
    };
    this.houses.push(house);
    this.bucket(tx, ty).houses.push(house);

    if (rng() < 0.3) {
      const b = W(rng() < 0.5 ? 94 : 34, 118);
      this.propSpots.push({ kind: 'bin', x: b.x, y: b.y });
    }
    if ((tx + ty) % 3 === 0) {
      const l = W(roadL ? 120 : 8, 120);
      this.lamps.push(this.bucketPush(tx, ty, 'lamps', l));
    }
    if (rng() < 0.05) {
      const p = W(64, 120);
      this.flockSpots.push({ kind: 'pigeon', x: p.x, y: p.y, n: 3 + Math.floor(rng() * 2) });
    }
    // Some back corners get a small tree for a leafier skyline.
    if (rng() < 0.25) {
      const p = W(rng() < 0.5 ? 12 : 116, 10);
      this.addTree(p.x, p.y, rng, null, true, 0.62);
    }
  }

  addRamp(tx, ty, dir) {
    const [dx, dy] = DIRS[dir];
    const cx = tx * T + T / 2, cy = ty * T + T / 2;
    const ramp = { x: cx, y: cy, dir, angle: Math.atan2(dy, dx), dx, dy, len: 44, wid: 62 };
    this.ramps.push(ramp);
    // Cones beside the ramp.
    const px = -dy, py = dx;
    this.propSpots.push({ kind: 'cone', x: cx + px * 46 - dx * 6, y: cy + py * 46 - dy * 6 });
    this.propSpots.push({ kind: 'cone', x: cx - px * 46 - dx * 6, y: cy - py * 46 - dy * 6 });
  }

  addParked(x, y, angle, kind, rng) {
    const car = { x, y, angle, kind: kind || 'car', color: rng ? Math.floor(rng() * 6) : 0, shape: rng ? Math.floor(rng() * 2) : 0 };
    this.parked.push(car);
    this.bucket(Math.floor(x / T), Math.floor(y / T)).parked.push(car);
    const len = kind === 'van' ? 54 : 46, wid = kind === 'van' ? 28 : 24;
    const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
    const hx = (len * c + wid * s) / 2, hy = (len * s + wid * c) / 2;
    this.addRect(x - hx, y - hy, x + hx, y + hy);
  }

  addTree(x, y, rng, kind, solid, scale = 1) {
    const size = (0.8 + rng() * 0.45) * scale;
    const t = {
      x, y,
      r: 30 * size,
      kind: kind || (rng() < 0.12 ? 'autumn' : 'round'),
      variant: Math.floor(rng() * 3),
      phase: rng() * Math.PI * 2,
    };
    this.trees.push(t);
    this.bucket(Math.floor(x / T), Math.floor(y / T)).trees.push(t);
    if (solid) this.addCircle(x, y, Math.max(9, 11 * size));
  }

  bucket(tx, ty) {
    return this.buckets[this.idx(clamp(tx, 0, COLS - 1), clamp(ty, 0, ROWS - 1))];
  }

  bucketPush(tx, ty, list, obj) {
    this.bucket(tx, ty)[list].push(obj);
    if (list === 'lamps') this.addCircle(obj.x, obj.y, 5);
    return obj;
  }

  // ---- Colliders ----

  addRect(x0, y0, x1, y1) {
    this.insert({ t: 0, x0, y0, x1, y1 }, x0, y0, x1, y1);
  }

  addCircle(x, y, r) {
    this.insert({ t: 1, x, y, r }, x - r, y - r, x + r, y + r);
  }

  insert(c, x0, y0, x1, y1) {
    c.s = 0;
    const tx0 = clamp(Math.floor(x0 / T), 0, COLS - 1), tx1 = clamp(Math.floor(x1 / T), 0, COLS - 1);
    const ty0 = clamp(Math.floor(y0 / T), 0, ROWS - 1), ty1 = clamp(Math.floor(y1 / T), 0, ROWS - 1);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) this.colliders[this.idx(tx, ty)].push(c);
  }

  // Push a circle out of all static geometry. Returns the deepest contact normal or null.
  resolveCircle(p, r, out) {
    this.stamp++;
    const tx0 = clamp(Math.floor((p.x - r) / T), 0, COLS - 1), tx1 = clamp(Math.floor((p.x + r) / T), 0, COLS - 1);
    const ty0 = clamp(Math.floor((p.y - r) / T), 0, ROWS - 1), ty1 = clamp(Math.floor((p.y + r) / T), 0, ROWS - 1);
    let hit = false;
    out.nx = 0; out.ny = 0; out.depth = 0; out.px = 0; out.py = 0;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const list = this.colliders[this.idx(tx, ty)];
        for (let i = 0; i < list.length; i++) {
          const c = list[i];
          if (c.s === this.stamp) continue;
          c.s = this.stamp;
          let nx, ny, depth;
          if (c.t === 0) {
            const qx = clamp(p.x, c.x0, c.x1), qy = clamp(p.y, c.y0, c.y1);
            let dx = p.x - qx, dy = p.y - qy;
            const d2 = dx * dx + dy * dy;
            if (d2 >= r * r) continue;
            if (d2 > 1e-6) {
              const d = Math.sqrt(d2);
              nx = dx / d; ny = dy / d; depth = r - d;
            } else {
              // Centre inside the rect: push out along the shallowest axis.
              const l = p.x - c.x0, rr = c.x1 - p.x, t = p.y - c.y0, b = c.y1 - p.y;
              const m = Math.min(l, rr, t, b);
              if (m === l) { nx = -1; ny = 0; depth = l + r; }
              else if (m === rr) { nx = 1; ny = 0; depth = rr + r; }
              else if (m === t) { nx = 0; ny = -1; depth = t + r; }
              else { nx = 0; ny = 1; depth = b + r; }
            }
          } else {
            const dx = p.x - c.x, dy = p.y - c.y;
            const d2 = dx * dx + dy * dy, rs = r + c.r;
            if (d2 >= rs * rs) continue;
            const d = Math.sqrt(d2) || 1e-3;
            nx = dx / d; ny = dy / d; depth = rs - d;
          }
          p.x += nx * depth;
          p.y += ny * depth;
          out.px += nx * depth;
          out.py += ny * depth;
          if (depth > out.depth) { out.depth = depth; out.nx = nx; out.ny = ny; }
          hit = true;
        }
      }
    }
    // Pond: treat as an ellipse.
    const ex = (p.x - POND.x) / (POND.rx + r), ey = (p.y - POND.y) / (POND.ry + r);
    const e2 = ex * ex + ey * ey;
    if (e2 < 1) {
      const e = Math.sqrt(e2) || 1e-3;
      const gx = ex / (POND.rx + r), gy = ey / (POND.ry + r);
      const gl = Math.hypot(gx, gy) || 1;
      const nx = gx / gl, ny = gy / gl;
      const tx = POND.x + (ex / e) * (POND.rx + r), ty = POND.y + (ey / e) * (POND.ry + r);
      const mx = tx - p.x, my = ty - p.y;
      const depth = Math.hypot(mx, my);
      p.x = tx; p.y = ty;
      out.px += mx; out.py += my;
      if (depth > out.depth) { out.depth = depth; out.nx = nx; out.ny = ny; }
      out.pond = true;
      hit = true;
    } else out.pond = false;
    return hit;
  }

  inPond(x, y, pad = 0) {
    const ex = (x - POND.x) / (POND.rx - pad), ey = (y - POND.y) / (POND.ry - pad);
    return ex * ex + ey * ey < 1;
  }

  surfaceAt(x, y) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    const type = this.tile(tx, ty);
    switch (type) {
      case TL.ROAD: case TL.YARD: case TL.PARKING: case TL.DEPOT:
        return 'road';
      case TL.ALLEY:
        return 'alley';
      case TL.PATH:
        return 'path';
      default: {
        const info = this.info[this.idx(clamp(tx, 0, COLS - 1), clamp(ty, 0, ROWS - 1))];
        if (info && info.side) {
          const lx = x - tx * T, ly = y - ty * T;
          if ((info.side & 1 && lx > T - 16) || (info.side & 2 && ly > T - 16) || (info.side & 4 && lx < 16) || (info.side & 8 && ly < 16)) return 'road';
        }
        return 'grass';
      }
    }
  }

  // Random road tile far enough from a point (used for traffic spawns).
  roadTiles() {
    if (!this._roads) {
      this._roads = [];
      for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) if (this.isRoad(tx, ty)) this._roads.push([tx, ty]);
    }
    return this._roads;
  }
}
