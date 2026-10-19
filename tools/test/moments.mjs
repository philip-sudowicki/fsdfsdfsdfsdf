// Captures key gameplay moments (drift, ramp jump, perfect delivery, crash) for visual review.
import { startServer, launch, sleep, root, sceneIs } from './harness.mjs';
import path from 'node:path';
import fs from 'node:fs';

const out = process.argv[2] || path.join(root, 'tools', 'test', 'shots');
fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => localStorage.setItem('parcel-dash-save-v1', JSON.stringify({ tutorialSeen: true })));
await page.goto(srv.url);
await sceneIs(page, 'TitleScene', 1.2, 30000);
await page.keyboard.press('Enter');
await sceneIs(page, 'GameScene', 1.5, 10000);
const set = (fn, arg) => page.evaluate(fn, arg);

// Drift: full speed then hard steer.
await set(async () => {
  const { G } = await import('/js/state.js');
  const v = G.scene.shift.van;
  v.x = 10 * 128; v.y = 13.5 * 128 + 30; v.angle = 0; v.vx = 440; v.vy = 0;
});
await page.keyboard.down('ArrowRight');
await sleep(550);
await page.screenshot({ path: path.join(out, 'm-01-drift.png') });
await page.keyboard.up('ArrowRight');

// Ramp jump at speed.
await set(async () => {
  const { G } = await import('/js/state.js');
  const v = G.scene.shift.van;
  const r = G.world.ramps[0];
  v.x = r.x - r.dx * 180; v.y = r.y - r.dy * 180; v.angle = r.angle; v.vx = r.dx * 440; v.vy = r.dy * 440;
  G.scene.cam.x = v.x; G.scene.cam.y = v.y;
});
await sleep(560);
await page.screenshot({ path: path.join(out, 'm-02-jump.png') });
await sleep(900);

// Perfect delivery: park in range with the marker centred, then throw.
await set(async () => {
  const { G } = await import('/js/state.js');
  const s = G.scene.shift;
  const h = s.target.house;
  s.van.x = h.mat.x + h.front.x * 120; s.van.y = h.mat.y + h.front.y * 120;
  s.van.angle = Math.atan2(h.front.x, -h.front.y); s.van.vx = s.van.vy = 0;
  G.scene.cam.x = s.van.x; G.scene.cam.y = s.van.y;
});
await sleep(300);
await set(async () => {
  const { G } = await import('/js/state.js');
  G.scene.shift.meter.pos = 0.5;
});
await page.keyboard.press('Space');
await sleep(250);
await page.screenshot({ path: path.join(out, 'm-03-throw.png') });
await sleep(450);
await page.screenshot({ path: path.join(out, 'm-04-perfect.png') });
await sleep(700);
await page.screenshot({ path: path.join(out, 'm-05-after.png') });

// Crash into a house.
await set(async () => {
  const { G } = await import('/js/state.js');
  const v = G.scene.shift.van;
  const h = G.world.houses[40];
  v.x = h.cx - h.front.x * 0 + 150; v.y = h.cy; v.angle = Math.PI; v.vx = -440; v.vy = 0;
  G.scene.cam.x = v.x; G.scene.cam.y = v.y;
});
await sleep(330);
await page.screenshot({ path: path.join(out, 'm-06-crash.png') });
await browser.close();
srv.stop();
console.log(errors.join('\n') || 'NO ERRORS');
