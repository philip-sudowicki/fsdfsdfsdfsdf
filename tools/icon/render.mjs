// Renders an icon design with the game's own art code.
// Usage: node tools/icon/render.mjs <design module, relative to repo> <out.png> [size] [variant] [--sheet]
//   variant: "plain" (no text) or "title" (with the game name). --sheet writes a review sheet
//   showing the icon large plus 192/96/48 px previews on dark and light backgrounds.
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch } from '../test/harness.mjs';

const [design, out, sizeArg = '1024', variant = 'plain', sheetFlag] = process.argv.slice(2);
if (!design || !out) {
  console.error('Usage: node tools/icon/render.mjs <design.mjs> <out.png> [size] [plain|title] [--sheet]');
  process.exit(1);
}
const size = Number(sizeArg);
const sheet = sheetFlag === '--sheet';
const srv = await startServer();
const { browser, page, errors } = await launch({ viewport: { width: 400, height: 400 } });
await page.goto(srv.url + 'tools/icon/blank.html');
const dataUrl = await page.evaluate(async ({ design, size, variant, sheet }) => {
  const ff = new FontFace('Lilita', 'url(/assets/fonts/LilitaOne-Regular.woff2)');
  await ff.load();
  document.fonts.add(ff);
  const art = await import('/js/art.js');
  const ui = await import('/js/ui.js');
  const util = await import('/js/util.js');
  const mod = await import('/' + design);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  await mod.draw(ctx, size, { art, ui, util, variant });
  if (!sheet) return c.toDataURL('image/png');
  // Review sheet: the icon at 512 plus small previews on dark and light grounds.
  const s = document.createElement('canvas');
  s.width = 512 + 40 + 2 * (192 + 96 + 48 + 60);
  s.height = 552;
  const g = s.getContext('2d');
  g.fillStyle = '#20222e';
  g.fillRect(0, 0, s.width, s.height);
  g.fillStyle = '#f2f2f2';
  g.fillRect(552, 276, s.width - 552, 276);
  g.imageSmoothingQuality = 'high';
  g.drawImage(c, 20, 20, 512, 512);
  let x = 572;
  for (const px of [192, 96, 48]) {
    g.drawImage(c, x, 40, px, px);
    g.drawImage(c, x, 316, px, px);
    x += px + 30;
  }
  return s.toDataURL('image/png');
}, { design, size, variant, sheet });
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
await browser.close();
srv.stop();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Wrote ${out}`);
