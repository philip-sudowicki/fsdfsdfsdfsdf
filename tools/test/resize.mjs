// Rotating a phone and resizing a desktop window mid-shift must keep working.
import { startServer, launch, sleep, root, sceneIs } from './harness.mjs';
import path from 'node:path';

const out = process.argv[2] || path.join(root, 'tools', 'test', 'shots');
const srv = await startServer();
const { browser, page, errors } = await launch({ viewport: { width: 844, height: 390 }, dpr: 2, touch: true, mobile: true });
await page.addInitScript(() => localStorage.setItem('parcel-dash-save-v1', JSON.stringify({ tutorialSeen: true })));
await page.goto(srv.url);
await sceneIs(page, 'TitleScene', 1.2, 30000);
const p = await page.evaluate(async () => { const { G } = await import('/js/state.js'); return { x: G.scene.play.x, y: G.scene.play.y }; });
await page.touchscreen.tap(p.x, p.y);
await sceneIs(page, 'GameScene', 1.0, 10000);
await page.setViewportSize({ width: 390, height: 844 });
await sleep(700);
await page.screenshot({ path: path.join(out, 'resize-01-rotated.png') });
await page.setViewportSize({ width: 1920, height: 1080 });
await sleep(700);
await page.screenshot({ path: path.join(out, 'resize-02-desktop.png') });
const st = await page.evaluate(async () => {
  const { G } = await import('/js/state.js');
  const { Art } = await import('/js/art.js');
  return { w: G.w, h: G.h, S: Art.S, zoom: G.zoom, scene: G.scene.constructor.name };
});
console.log(JSON.stringify(st));
await browser.close();
srv.stop();
console.log(errors.join('\n') || 'NO ERRORS');
process.exit(errors.length ? 1 : 0);
