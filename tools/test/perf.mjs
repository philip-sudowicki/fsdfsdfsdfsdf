// Rough performance check: frames per second and per-frame script time during gameplay.
import { startServer, launch, sleep, sceneIs } from './harness.mjs';
import { readWorld, drive } from './bot.mjs';

const srv = await startServer();
const { browser, page, errors } = await launch({ viewport: { width: 844, height: 390 }, dpr: 2 });
await page.addInitScript(() => localStorage.setItem('parcel-dash-save-v1', JSON.stringify({ tutorialSeen: true })));
await page.goto(srv.url);
await sceneIs(page, 'TitleScene', 1.2, 30000);
await page.keyboard.press('Enter');
await sceneIs(page, 'GameScene', 1.0, 10000);
await page.evaluate(() => {
  window.__frames = [];
  const tick = (t) => { window.__frames.push(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
const world = await readWorld(page);
await drive(page, world, { timeout: 8000, until: () => false });
const stats = await page.evaluate(() => {
  const f = window.__frames;
  const d = [];
  for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
  d.sort((a, b) => a - b);
  return { frames: f.length, seconds: (f[f.length - 1] - f[0]) / 1000, median: d[Math.floor(d.length / 2)], p95: d[Math.floor(d.length * 0.95)] };
});
console.log(`fps=${(stats.frames / stats.seconds).toFixed(1)} median=${stats.median.toFixed(1)}ms p95=${stats.p95.toFixed(1)}ms`);
const prof = await page.evaluate(async () => {
  const { G } = await import('/js/state.js');
  const sc = G.scene;
  const N = 120;
  let up = 0, dr = 0;
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    sc.update(1 / 60, false);
    const t1 = performance.now();
    G.ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    sc.draw(G.ctx);
    const t2 = performance.now();
    up += t1 - t0; dr += t2 - t1;
  }
  return { update: up / N, draw: dr / N };
});
console.log(`update=${prof.update.toFixed(2)}ms draw=${prof.draw.toFixed(2)}ms per frame`);
await browser.close();
srv.stop();
console.log(errors.join('\n') || 'NO ERRORS');
