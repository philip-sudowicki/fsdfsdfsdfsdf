// A keyboard-driving bot: reads game state through the game's own ES modules,
// path-finds over drivable tiles and steers with real key presses.
import { sleep } from './harness.mjs';

const DRIVABLE = new Set([1, 5, 6, 9, 10]); // road, path, alley, yard, parking

export async function readWorld(page) {
  return page.evaluate(async () => {
    const { G } = await import('/js/state.js');
    const w = G.world;
    return { cols: w.cols, rows: w.rows, grid: Array.from(w.grid), tile: 128 };
  });
}

export async function readState(page) {
  return page.evaluate(async () => {
    const { G } = await import('/js/state.js');
    const sc = G.scene;
    const s = sc && sc.shift;
    if (!s) return { scene: sc && sc.constructor.name, overlays: G.overlays.map((o) => o.constructor.name) };
    const t = s.target;
    let target = null;
    if (t && t.depot) target = { x: 4.5 * 128, y: 12.5 * 128, depot: true };
    else if (t && t.house) target = { x: t.house.mat.x, y: t.house.mat.y, kind: t.kind, front: t.house.front };
    return {
      scene: sc.constructor.name,
      overlays: G.overlays.map((o) => o.constructor.name),
      state: s.state,
      time: s.time,
      van: { x: s.van.x, y: s.van.y, a: s.van.angle, speed: s.van.speed, vx: s.van.vx, vy: s.van.vy },
      target,
      parcels: s.parcels.length,
      meter: { inRange: s.meter.inRange, pos: s.meter.pos, dir: s.meter.dir, green: s.stats.greenHalf },
      pending: !!s.pending,
      coins: s.coins,
      deliveries: s.deliveries,
      misses: s.misses,
      perfects: s.perfects,
      combo: s.combo,
      tut: s.tut ? s.tut.step : null,
    };
  });
}

function bfs(world, sx, sy, tx, ty) {
  const { cols, rows, grid } = world;
  const ok = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && DRIVABLE.has(grid[y * cols + x]);
  const prev = new Int32Array(cols * rows).fill(-1);
  const q = [[sx, sy]];
  prev[sy * cols + sx] = sy * cols + sx;
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!ok(nx, ny) || prev[ny * cols + nx] !== -1) continue;
      prev[ny * cols + nx] = y * cols + x;
      q.push([nx, ny]);
    }
  }
  if (prev[ty * cols + tx] === -1) return null;
  const path = [];
  let c = ty * cols + tx;
  while (c !== sy * cols + sx) {
    path.push([c % cols, Math.floor(c / cols)]);
    c = prev[c];
  }
  path.reverse();
  return path;
}

// The road tile in front of a target doormat.
function goalTile(world, st) {
  const T = world.tile;
  if (st.target.depot) return [4, 12];
  const f = st.target.front;
  return [Math.floor((st.target.x + f.x * 100) / T), Math.floor((st.target.y + f.y * 100) / T)];
}

function nearestDrivable(world, x, y) {
  const T = world.tile;
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  let best = null, bd = Infinity;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= world.cols || ny >= world.rows) continue;
      if (!DRIVABLE.has(world.grid[ny * world.cols + nx])) continue;
      const d = Math.hypot((nx + 0.5) * T - x, (ny + 0.5) * T - y);
      if (d < bd) { bd = d; best = [nx, ny]; }
    }
  }
  return best;
}

const held = new Set();
async function setKey(page, key, on) {
  if (on && !held.has(key)) { held.add(key); await page.keyboard.down(key); }
  if (!on && held.has(key)) { held.delete(key); await page.keyboard.up(key); }
}

export async function releaseAll(page) {
  for (const k of [...held]) await setKey(page, k, false);
}

// Drive until `until(state)` is true or timeout. aim: 'perfect' | 'any'.
export async function drive(page, world, { until, timeout = 60000, aim = 'perfect', log = () => {} }) {
  const T = world.tile;
  const start = Date.now();
  let st = await readState(page);
  let stuckT = 0, lastPos = null, reverseUntil = 0;
  while (Date.now() - start < timeout) {
    st = await readState(page);
    if (!st.van || until(st)) break;
    if (st.state !== 'play' || st.overlays.length) {
      await releaseAll(page);
      await sleep(100);
      continue;
    }
    const v = st.van;
    // Throw logic.
    if (st.meter.inRange && !st.pending) {
      const off = Math.abs(st.meter.pos - 0.5);
      const g = st.meter.green;
      const outward = Math.sign(st.meter.pos - 0.5) === st.meter.dir;
      const ok = aim === 'perfect' ? off < g * 0.55 : aim === 'good' ? outward && off > g + 0.02 && off < 0.16 : aim === 'miss' ? off > 0.32 : true;
      if (ok) {
        await page.keyboard.press('Space');
        log(`throw at ${st.meter.pos.toFixed(3)}`);
      }
    }
    // Stuck detection: reverse briefly.
    const now = Date.now();
    if (lastPos && Math.hypot(v.x - lastPos.x, v.y - lastPos.y) < 3) stuckT += 1; else stuckT = 0;
    lastPos = { x: v.x, y: v.y };
    if (stuckT > 12 && now > reverseUntil) {
      reverseUntil = now + 900;
      stuckT = 0;
      log('stuck: reversing');
    }
    if (now < reverseUntil) {
      await setKey(page, 'ArrowDown', true);
      await setKey(page, 'ArrowLeft', true);
      await setKey(page, 'ArrowRight', false);
      await sleep(40);
      continue;
    }
    if (!st.target) {
      await sleep(40);
      continue;
    }
    const s0 = nearestDrivable(world, v.x, v.y) || [Math.floor(v.x / T), Math.floor(v.y / T)];
    const goal = goalTile(world, st);
    const path = bfs(world, s0[0], s0[1], goal[0], goal[1]) || [];
    let wx, wy;
    const near = Math.hypot(st.target.x - v.x, st.target.y - v.y);
    if (path.length >= 2) {
      const p = path[Math.min(1, path.length - 1)];
      wx = (p[0] + 0.5) * T; wy = (p[1] + 0.5) * T;
    } else if (path.length === 1) {
      wx = (path[0][0] + 0.5) * T; wy = (path[0][1] + 0.5) * T;
    } else {
      wx = st.target.x; wy = st.target.y;
    }
    if (st.target.depot && near < 200) { wx = st.target.x; wy = st.target.y; }
    const want = Math.atan2(wy - v.y, wx - v.x);
    let diff = want - v.a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    await setKey(page, 'ArrowRight', diff > 0.12);
    await setKey(page, 'ArrowLeft', diff < -0.12);
    const slowForTurn = Math.abs(diff) > 0.9 && v.speed > 170;
    const slowForThrow = st.meter.inRange && v.speed > 260;
    const slowForDepot = st.target.depot && near < 260 && v.speed > 150;
    await setKey(page, 'ArrowDown', slowForTurn || slowForThrow || slowForDepot);
    await sleep(30);
  }
  await releaseAll(page);
  return st;
}
