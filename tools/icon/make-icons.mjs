// Exports every icon size from the icon design.
// Usage: node tools/icon/make-icons.mjs [design module]
//   promo/             store images for Poki (not part of the game upload)
//   assets/icon/       small favicons the game page links to
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch, root } from '../test/harness.mjs';

const design = process.argv[2] || 'tools/icon/designs/icon.mjs';
const OUTPUTS = [
  { file: 'promo/icon-1024.png', size: 1024, variant: 'plain' },
  { file: 'promo/icon-512.png', size: 512, variant: 'plain' },
  { file: 'promo/icon-title-1024.png', size: 1024, variant: 'title' },
  { file: 'promo/icon-title-512.png', size: 512, variant: 'title' },
  { file: 'assets/icon/icon-192.png', size: 192, variant: 'plain' },
  { file: 'assets/icon/apple-touch-icon.png', size: 180, variant: 'plain' },
  { file: 'assets/icon/favicon-32.png', size: 32, variant: 'plain' },
];

const srv = await startServer();
const { browser, page, errors } = await launch({ viewport: { width: 400, height: 400 } });
await page.goto(srv.url + 'tools/icon/blank.html');
const images = await page.evaluate(async ({ design, outputs }) => {
  const ff = new FontFace('Lilita', 'url(/assets/fonts/LilitaOne-Regular.woff2)');
  await ff.load();
  document.fonts.add(ff);
  const art = await import('/js/art.js');
  const ui = await import('/js/ui.js');
  const util = await import('/js/util.js');
  const mod = await import('/' + design);
  const masters = {};
  for (const variant of ['plain', 'title']) {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    await mod.draw(c.getContext('2d'), 1024, { art, ui, util, variant });
    masters[variant] = c;
  }
  // Halve repeatedly for clean downscaling, then one final resize.
  const scaled = (src, size) => {
    let cur = src;
    while (cur.width / 2 >= size) {
      const n = document.createElement('canvas');
      n.width = n.height = cur.width / 2;
      const g = n.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(cur, 0, 0, n.width, n.height);
      cur = n;
    }
    if (cur.width === size) return cur;
    const n = document.createElement('canvas');
    n.width = n.height = size;
    const g = n.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, size, size);
    return n;
  };
  return outputs.map((o) => scaled(masters[o.variant], o.size).toDataURL('image/png'));
}, { design, outputs: OUTPUTS });
OUTPUTS.forEach((o, i) => {
  const file = path.join(root, o.file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(images[i].split(',')[1], 'base64'));
  console.log(`Wrote ${o.file} (${(fs.statSync(file).size / 1024).toFixed(1)} KB)`);
});
await browser.close();
srv.stop();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
