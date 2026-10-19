// Deterministic checks of the core mechanics: throw zones, combos, tips,
// EXPRESS and FRAGILE parcels, depot reloading and upgrade effects.
import { startServer, launch, sleep, sceneIs, waitFor } from './harness.mjs';

const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures.push(msg);
};

const srv = await startServer();
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('parcel-dash-save-v1', JSON.stringify({ tutorialSeen: true, upgrades: { speed: 2, green: 3, time: 1 } }));
  }
});
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.goto(srv.url);
await sceneIs(page, 'TitleScene', 1.0, 30000);
await page.keyboard.press('Enter');
await sceneIs(page, 'GameScene', 1.2, 10000);

// Upgrades feed the shift stats.
const stats = await ev(async () => {
  const { G } = await import('/js/state.js');
  const { CONFIG } = await import('/js/config.js');
  const s = G.scene.shift.stats;
  return { maxSpeed: s.maxSpeed, base: CONFIG.van.maxSpeed, green: s.greenHalf, baseGreen: CONFIG.throwMeter.green, start: s.startTime };
});
check(Math.abs(stats.maxSpeed - stats.base * 1.12) < 0.01, `top speed upgrade applied (${stats.maxSpeed.toFixed(0)})`);
check(Math.abs(stats.green - stats.baseGreen * 1.48) < 1e-6, `perfect zone upgrade widens the green zone (${stats.green.toFixed(3)})`);
check(stats.start === 64, `shift time upgrade adds starting time (${stats.start})`);

// Helper: park in range of the current target and throw at a given marker position.
async function throwAt(pos) {
  await ev(async () => {
    const { G } = await import('/js/state.js');
    const s = G.scene.shift;
    const h = s.target.house;
    s.van.x = h.mat.x + h.front.x * 120; s.van.y = h.mat.y + h.front.y * 120;
    s.van.angle = Math.atan2(h.front.x, -h.front.y); s.van.vx = s.van.vy = 0;
  });
  await waitFor(page, async () => (await import('/js/state.js')).G.scene.shift.meter.inRange, null, 3000);
  await ev(async (p) => {
    const { G } = await import('/js/state.js');
    const s = G.scene.shift;
    s.meter.pos = p;
    s.meter.dir = 0;
    s.meter.cooldown = 0;
  }, pos);
  const before = await ev(async () => {
    const s = (await import('/js/state.js')).G.scene.shift;
    return { coins: s.coins, time: s.time, deliveries: s.deliveries, misses: s.misses, parcels: s.parcels.length };
  });
  await page.keyboard.press('Space');
  await waitFor(page, async () => !(await import('/js/state.js')).G.scene.shift.pending, null, 3000);
  const after = await ev(async () => {
    const s = (await import('/js/state.js')).G.scene.shift;
    s.meter.dir = 1;
    return { coins: s.coins, time: s.time, deliveries: s.deliveries, misses: s.misses, perfects: s.perfects, combo: s.combo, parcels: s.parcels.length, texts: s.fx.texts.map((t) => t.str) };
  });
  return { before, after };
}

let r = await throwAt(0.5);
check(r.after.perfects === 1 && r.after.combo === 1 && r.after.coins > r.before.coins && r.after.time > r.before.time, `green throw = PERFECT with tip, time and combo (+${r.after.coins - r.before.coins} coins, +${(r.after.time - r.before.time).toFixed(1)}s)`);
const firstTip = r.after.coins - r.before.coins;
r = await throwAt(0.5);
const secondTip = r.after.coins - r.before.coins;
check(r.after.combo === 2 && secondTip > firstTip, `combo builds and boosts the next perfect tip (${firstTip} -> ${secondTip})`);
r = await throwAt(0.68);
check(r.after.deliveries === r.before.deliveries + 1 && r.after.combo === 0 && r.after.perfects === 2, `amber throw delivers with a normal tip and resets the combo (+${r.after.coins - r.before.coins})`);

// Van now empty: target is the depot; reloading refills the van.
const depot = await ev(async () => (await import('/js/state.js')).G.scene.shift.target.depot === true);
check(depot, 'empty van points to the depot');
async function reload() {
  await ev(async () => {
    const { G } = await import('/js/state.js');
    const { DEPOT } = await import('/js/world.js');
    const v = G.scene.shift.van;
    v.x = (DEPOT.zone.x0 + DEPOT.zone.x1) / 2; v.y = (DEPOT.zone.y0 + DEPOT.zone.y1) / 2; v.vx = v.vy = 0;
  });
  await waitFor(page, async () => (await import('/js/state.js')).G.scene.shift.parcels.length === 3, null, 4000);
}
await reload();
check(true, 'driving into the loading bay reloads the van to capacity');

// Red throw: miss, parcel kept, can throw again while in range.
r = await throwAt(0.98);
check(r.after.misses === r.before.misses + 1 && r.after.parcels === r.before.parcels && r.after.deliveries === r.before.deliveries, 'red throw misses, pays no delivery tip and keeps the parcel');
check(r.after.texts.some((t) => /HEDGE|SPLASH/.test(t)), `miss shows a comic hedge or splash (${r.after.texts.join('|')})`);
r = await throwAt(0.5);
check(r.after.deliveries === r.before.deliveries + 1, 'can throw again after a miss and deliver');

// EXPRESS: force the next parcel to be express.
await ev(async () => {
  const { CONFIG } = await import('/js/config.js');
  CONFIG.specials.chance = 1;
});
r = await throwAt(0.5);
const kind = await ev(async () => (await import('/js/state.js')).G.scene.shift.target.kind);
check(kind === 'express' || kind === 'fragile', `special delivery assigned (${kind})`);
await ev(async () => {
  const { G } = await import('/js/state.js');
  const t = G.scene.shift.target;
  t.kind = 'express';
  t.expressT = t.expressMax = 12;
});
r = await throwAt(0.5);
check(r.after.texts.includes('EXPRESS BONUS!') && r.after.coins - r.before.coins > secondTip, `EXPRESS on time pays a big tip (+${r.after.coins - r.before.coins})`);

// EXPRESS expiry.
await reload();
await ev(async () => {
  const { G } = await import('/js/state.js');
  const t = G.scene.shift.target;
  t.kind = 'express';
  t.expressT = 0.2;
});
await sleep(500);
check((await ev(async () => (await import('/js/state.js')).G.scene.shift.target.kind)) === 'normal', 'EXPRESS timer running out turns it into a normal parcel');

// FRAGILE: crashes lower the tip.
await ev(async () => {
  const { G } = await import('/js/state.js');
  const s = G.scene.shift;
  s.target.kind = 'fragile';
  s.target.damage = 0;
  s.onVanEvent({ type: 'crash', impact: 300, x: s.van.x, y: s.van.y, nx: 1, ny: 0 });
});
const dmg = await ev(async () => (await import('/js/state.js')).G.scene.shift.target.damage);
check(dmg === 1, 'FRAGILE parcel takes damage on a crash');
await ev(async () => { (await import('/js/state.js')).G.scene.shift.combo = 0; });
r = await throwAt(0.5);
const fragileTip = r.after.coins - r.before.coins;
check(fragileTip > 0 && !r.after.texts.includes('NOT A SCRATCH!'), `damaged FRAGILE parcel pays a reduced tip (+${fragileTip})`);

// Extra tips: drift, ramp air time, knocking over a bin.
async function tipFrom(setup, wait, label) {
  await page.evaluate(async () => {
    const { G } = await import('/js/state.js');
    G.scene.shift.fx.texts.length = 0;
    G.scene.shift.hitstop = 0;
    G.scene.shift.slowmo = 0;
  });
  const c0 = await ev(async () => (await import('/js/state.js')).G.scene.shift.coins);
  await setup();
  await sleep(wait);
  const res = await ev(async () => {
    const s = (await import('/js/state.js')).G.scene.shift;
    return { coins: s.coins, texts: s.fx.texts.map((t) => t.str) };
  });
  const ok = res.coins > c0 && res.texts.some((t) => t.startsWith(label));
  check(ok, `${label} tip awarded (${res.texts.join('|')})`);
}
// Hard steering at speed makes the van slide; a long drift pays a tip.
await ev(async () => {
  const v = (await import('/js/state.js')).G.scene.shift.van;
  v.x = 9 * 128; v.y = 13.5 * 128 + 30; v.angle = 0; v.vx = 480; v.vy = 0; v.angVel = 0;
});
await page.keyboard.down('ArrowRight');
await waitFor(page, async () => (await import('/js/state.js')).G.scene.shift.van.drifting, null, 1500);
await page.keyboard.up('ArrowRight');
check(true, 'hard steering at speed starts a drift');
await tipFrom(async () => {
  await ev(async () => {
    const v = (await import('/js/state.js')).G.scene.shift.van;
    v.vx = 0; v.vy = 0;
    v.driftTime = 1.6;
  });
}, 300, 'DRIFT');
await tipFrom(async () => {
  await ev(async () => {
    const { G } = await import('/js/state.js');
    const v = G.scene.shift.van;
    const r0 = G.world.ramps[0];
    v.x = r0.x - r0.dx * 150; v.y = r0.y - r0.dy * 150; v.angle = r0.angle; v.vx = r0.dx * 480; v.vy = r0.dy * 480; v.angVel = 0;
  });
}, 1400, 'AIR TIME');
await tipFrom(async () => {
  await ev(async () => {
    const { G } = await import('/js/state.js');
    const v = G.scene.shift.van;
    const p = G.town.props.find((q) => q.kind === 'bin' && q.state === 'idle');
    v.x = p.x - 60; v.y = p.y; v.angle = 0; v.vx = 300; v.vy = 0;
  });
}, 500, 'BIN BASH');
await tipFrom(async () => {
  await ev(async () => {
    const { G } = await import('/js/state.js');
    const T = 128;
    // A car heading west on a straight stretch, the van heading east in the other lane.
    G.town.traffic.cars.length = 0;
    const car = G.town.traffic.spawnAt(12, 13, 2);
    car.s = 0;
    car.speed = car.cruise;
    const v = G.scene.shift.van;
    v.x = 8.5 * T; v.y = 13.5 * T + 30; v.angle = 0; v.vx = 430; v.vy = 0; v.angVel = 0;
  });
}, 1700, 'NEAR MISS');

await browser.close();
srv.stop();
check(errors.length === 0, `zero console errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
