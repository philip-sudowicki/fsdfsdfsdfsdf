// Exploratory run: start a shift and let the bot deliver a few parcels, with screenshots.
import { startServer, launch, sleep, root, sceneIs } from './harness.mjs';
import { readWorld, readState, drive } from './bot.mjs';
import path from 'node:path';
import fs from 'node:fs';

const out = process.argv[2] || path.join(root, 'tools', 'test', 'shots');
fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { browser, page, errors } = await launch({ viewport: { width: 844, height: 390 } });
await page.goto(srv.url);
await sceneIs(page, 'TitleScene', 1.2, 30000);
await page.keyboard.press('Enter');
await sceneIs(page, 'GameScene', 0, 10000);
await sleep(1200);
await page.screenshot({ path: path.join(out, 'ex-start.png') });
const world = await readWorld(page);
let shot = 0;
const st = await drive(page, world, {
  timeout: 45000,
  until: (s) => s.deliveries >= 4,
  log: async (m) => {
    console.log(m);
    if (m.startsWith('throw') && shot < 4) {
      shot++;
      await page.screenshot({ path: path.join(out, `ex-throw${shot}.png`) });
    }
  },
});
console.log(JSON.stringify(st));
await page.screenshot({ path: path.join(out, 'ex-end.png') });
console.log('poki log', await page.evaluate(() => window.__pokiLog));
console.log(errors.join('\n') || 'NO ERRORS');
await browser.close();
srv.stop();
