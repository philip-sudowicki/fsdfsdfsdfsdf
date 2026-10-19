import { startServer, launch, sleep, root } from './harness.mjs';
import path from 'node:path';
import fs from 'node:fs';

const out = path.join(process.argv[2] || path.join(root, 'tools', 'test', 'shots'));
fs.mkdirSync(out, { recursive: true });
const srv = await startServer();
const { browser, page, errors } = await launch({ viewport: { width: 844, height: 390 } });
await page.goto(srv.url);
await sleep(600);
await page.screenshot({ path: path.join(out, 'smoke-loading.png') });
await sleep(4000);
await page.screenshot({ path: path.join(out, 'smoke-title.png') });
console.log('poki log', await page.evaluate(() => window.__pokiLog));
console.log(errors.join('\n') || 'NO ERRORS');
await browser.close();
srv.stop();
