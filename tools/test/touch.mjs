// Touch controls test on a phone-sized touch device: drag-to-steer, BRAKE,
// THROW (also while steering with a second finger) and the pause button.
import { startServer, launch, sleep, root, sceneIs, overlayIs, waitFor } from './harness.mjs';
import { readState } from './bot.mjs';
import path from 'node:path';
import fs from 'node:fs';

const out = process.argv[2] || path.join(root, 'tools', 'test', 'shots');
fs.mkdirSync(out, { recursive: true });
const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures.push(msg);
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const srv = await startServer();
const { browser, page, errors } = await launch({ viewport: { width: 844, height: 390 }, dpr: 2, touch: true, mobile: true });
await page.addInitScript(() => localStorage.setItem('parcel-dash-save-v1', JSON.stringify({ tutorialSeen: true })));
const cdp = await page.context().newCDPSession(page);
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
const pos = (expr) => page.evaluate(async (e) => {
  const { G } = await import('/js/state.js');
  // eslint-disable-next-line no-new-func
  return new Function('G', `return ${e}`)(G);
}, expr);

await page.goto(srv.url);
await sceneIs(page, 'TitleScene', 1.2, 30000);
const play = await pos('({ x: G.scene.play.x, y: G.scene.play.y })');
await page.touchscreen.tap(play.x, play.y);
await sceneIs(page, 'GameScene', 1.0, 10000);
check(await pos('G.touchUI'), 'touch controls enabled on a touch device');

// Steer with a drag on the left: point the stick straight up (north).
let st = await readState(page);
const startAngle = st.van.a;
await touch('touchStart', [{ x: 160, y: 270, id: 1 }]);
for (let i = 1; i <= 8; i++) {
  await touch('touchMove', [{ x: 160, y: 270 - i * 10, id: 1 }]);
  await sleep(16);
}
check(await pos('!!G.scene.joy'), 'drag on the left creates the steering stick');
await sleep(1300);
st = await readState(page);
await page.screenshot({ path: path.join(out, 'touch-01-steer.png') });
check(Math.abs(wrap(st.van.a + Math.PI / 2)) < 0.6, `van turns toward the stick direction (from ${startAngle.toFixed(2)} to ${st.van.a.toFixed(2)})`);
await touch('touchEnd', []);
await sleep(100);
check(!(await pos('!!G.scene.joy')), 'releasing the finger removes the stick');

// Brake button.
await sleep(800);
const brake = await pos('({ x: G.scene.hud.L.brakeBtn.x, y: G.scene.hud.L.brakeBtn.y })');
const v0 = (await readState(page)).van.speed;
await touch('touchStart', [{ x: brake.x, y: brake.y, id: 2 }]);
await sleep(700);
const v1 = await page.evaluate(async () => (await import('/js/state.js')).G.scene.shift.van.forwardSpeed);
await touch('touchEnd', []);
check(v1 < v0 * 0.5, `holding BRAKE slows the van (${v0.toFixed(0)} -> ${v1.toFixed(0)})`);

// Throw while steering with another finger.
await page.evaluate(async () => {
  const { G } = await import('/js/state.js');
  const s = G.scene.shift;
  const h = s.target.house;
  s.van.x = h.mat.x + h.front.x * 110;
  s.van.y = h.mat.y + h.front.y * 110;
  s.van.angle = Math.atan2(h.front.x, -h.front.y);
  s.van.vx = Math.cos(s.van.angle) * 60;
  s.van.vy = Math.sin(s.van.angle) * 60;
});
await waitFor(page, async () => (await import('/js/state.js')).G.scene.shift.meter.inRange, null, 3000);
const thr = await pos('({ x: G.scene.hud.L.throwBtn.x, y: G.scene.hud.L.throwBtn.y })');
await page.screenshot({ path: path.join(out, 'touch-02-meter.png') });
await touch('touchStart', [{ x: 150, y: 250, id: 3 }]);
await touch('touchMove', [{ x: 190, y: 250, id: 3 }]);
await touch('touchStart', [{ x: 150, y: 250, id: 3 }, { x: thr.x, y: thr.y, id: 4 }]);
await sleep(60);
const flying = await page.evaluate(async () => (await import('/js/state.js')).G.town.flying.filter((f) => !f.load).length);
check(flying === 1, 'tapping THROW in range throws a parcel (while a second finger steers)');
await touch('touchEnd', []);
let outcome = null;
for (let i = 0; i < 40 && !outcome; i++) {
  outcome = await page.evaluate(async () => {
    const s = (await import('/js/state.js')).G.scene.shift;
    if (s.deliveries > 0) return 'delivered';
    const miss = s.fx.texts.find((t) => /HEDGE|SPLASH/.test(t.str));
    return miss ? miss.str : null;
  });
  if (!outcome) await sleep(50);
}
await page.screenshot({ path: path.join(out, 'touch-03-after-throw.png') });
check(!!outcome, `throw resolved (${outcome})`);

// Pause button.
const pb = await pos('({ x: G.scene.pauseBtn.x, y: G.scene.pauseBtn.y })');
await page.touchscreen.tap(pb.x, pb.y);
await overlayIs(page, 'PauseOverlay', 0.5, 5000);
check(true, 'pause button opens the pause menu');
const rb = await pos('({ x: G.overlays[0].resumeBtn.x, y: G.overlays[0].resumeBtn.y })');
await page.touchscreen.tap(rb.x, rb.y);
await sleep(500);
check((await pos('G.overlays.length')) === 0, 'resume button closes the pause menu');

await browser.close();
srv.stop();
check(errors.length === 0, `zero console errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
