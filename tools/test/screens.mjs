// Screenshot every screen at phone landscape, phone portrait and desktop sizes.
// Usage: node tools/test/screens.mjs [outDir]
import { startServer, launch, sleep, root, sceneIs, overlayIs } from './harness.mjs';
import path from 'node:path';
import fs from 'node:fs';

const out = process.argv[2] || path.join(root, 'tools', 'test', 'shots');
fs.mkdirSync(out, { recursive: true });

const SIZES = [
  { name: 'phone-landscape', viewport: { width: 844, height: 390 }, dpr: 2, touch: true },
  { name: 'phone-portrait', viewport: { width: 390, height: 844 }, dpr: 2, touch: true },
  { name: 'desktop', viewport: { width: 1920, height: 1080 }, dpr: 1, touch: false },
];

const SAVE = {
  coins: 1840, best: 412, upgrades: { speed: 2, handling: 1, capacity: 5, green: 0, time: 3 },
  skins: ['classic', 'mint', 'grape'], skin: 'mint', tutorialSeen: false, music: true, sound: false, shifts: 7,
};

const srv = await startServer();
let allErrors = [];

async function click(page, x, y, touch) {
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function btn(page, expr) {
  return page.evaluate(async (e) => {
    const { G } = await import('/js/state.js');
    // eslint-disable-next-line no-new-func
    const b = new Function('G', `return ${e}`)(G);
    return { x: b.x, y: b.y };
  }, expr);
}

for (const size of SIZES) {
  const { browser, page, errors } = await launch({ viewport: size.viewport, dpr: size.dpr, touch: size.touch, mobile: size.touch });
  await page.addInitScript((s) => localStorage.setItem('parcel-dash-save-v1', JSON.stringify(s)), SAVE);
  const shot = (n) => page.screenshot({ path: path.join(out, `${size.name}-${n}.png`) });
  await page.goto(srv.url);
  await sleep(350);
  await shot('01-loading');
  await sceneIs(page, 'TitleScene', 1.6, 30000);
  await shot('02-title');
  let b = await btn(page, 'G.scene.settings');
  await click(page, b.x, b.y, size.touch);
  await overlayIs(page, 'SettingsOverlay', 0.6);
  await shot('03-settings');
  b = await btn(page, 'G.overlays[0].done');
  await click(page, b.x, b.y, size.touch);
  await sleep(400);
  b = await btn(page, 'G.scene.garage');
  await click(page, b.x, b.y, size.touch);
  await sceneIs(page, 'GarageScene', 1.2);
  await shot('04-garage');
  b = await btn(page, 'G.scene.back');
  await click(page, b.x, b.y, size.touch);
  await sceneIs(page, 'TitleScene', 1.2);
  b = await btn(page, 'G.scene.play');
  await click(page, b.x, b.y, size.touch);
  await sceneIs(page, 'GameScene', 0.3);
  await shot('05-shift-start');
  await sceneIs(page, 'GameScene', 2.4);
  await shot('06-tutorial');
  // Put the van on the road in front of its target to show the throw meter.
  await page.evaluate(async () => {
    const { G } = await import('/js/state.js');
    const s = G.scene.shift;
    const h = s.target.house;
    s.van.x = h.mat.x + h.front.x * 150 - h.front.y * 120;
    s.van.y = h.mat.y + h.front.y * 150 + h.front.x * 120;
    s.van.angle = Math.atan2(h.front.x, -h.front.y);
    s.van.vx = Math.cos(s.van.angle) * 120;
    s.van.vy = Math.sin(s.van.angle) * 120;
    G.scene.cam.x = s.van.x;
    G.scene.cam.y = s.van.y;
  });
  await sleep(380);
  await shot('07-meter');
  // A special delivery mid-shift with combo and tips.
  await page.evaluate(async () => {
    const { G } = await import('/js/state.js');
    const s = G.scene.shift;
    s.finishTutorial();
    s.combo = 3;
    s.coins = 186;
    s.target.kind = 'express';
    s.target.expressT = 7.4;
    s.fx.text(s.van.x, s.van.y - 40, 'DRIFT +8', '#8e7dbe', 0.75, 3);
  });
  await sleep(500);
  await shot('08-express');
  await page.evaluate(async () => {
    const { G } = await import('/js/state.js');
    const s = G.scene.shift;
    s.target.kind = 'fragile';
    s.target.damage = 1;
    s.van.x -= 600;
    G.scene.cam.x -= 600;
  });
  await sleep(500);
  await shot('09-fragile-arrow');
  if (size.touch) {
    b = await btn(page, 'G.scene.pauseBtn');
    await click(page, b.x, b.y, true);
  } else {
    await page.keyboard.press('Escape');
  }
  await overlayIs(page, 'PauseOverlay', 0.6);
  await shot('10-pause');
  await page.keyboard.press('Escape');
  await sleep(400);
  await page.evaluate(async () => {
    const { G } = await import('/js/state.js');
    G.scene.shift.time = 0.05;
  });
  await overlayIs(page, 'TimeUpOverlay', 0.7);
  await shot('11-timeup');
  b = await btn(page, 'G.overlays[0].skip');
  await click(page, b.x, b.y, size.touch);
  await overlayIs(page, 'ResultsOverlay', 0.3);
  await shot('12-results-early');
  await overlayIs(page, 'ResultsOverlay', 4.2);
  await shot('13-results');
  b = await btn(page, 'G.overlays[0].double');
  await click(page, b.x, b.y, size.touch);
  await sleep(1800);
  await shot('14-results-doubled');
  allErrors = allErrors.concat(errors.map((e) => `${size.name}: ${e}`));
  await browser.close();
}
srv.stop();
console.log(allErrors.join('\n') || 'NO ERRORS');
process.exit(allErrors.length ? 1 : 0);
