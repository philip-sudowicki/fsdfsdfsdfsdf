// Measures real audio output levels: music on menus, SFX in play, silence during ads.
import { startServer, launch, sleep, sceneIs } from './harness.mjs';

const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures.push(msg);
};
const srv = await startServer();
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => localStorage.setItem('parcel-dash-save-v1', JSON.stringify({ tutorialSeen: true })));
await page.goto(srv.url);
await sceneIs(page, 'TitleScene', 1.0, 30000);
await page.keyboard.press('ShiftLeft');
await sleep(300);
await page.evaluate(async () => {
  const { Sound } = await import('/js/audio.js');
  const an = Sound.ctx.createAnalyser();
  an.fftSize = 2048;
  Sound.master.connect(an);
  window.__level = () => {
    const d = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(d);
    let peak = 0, sum = 0;
    for (const v of d) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
    return { peak, rms: Math.sqrt(sum / d.length) };
  };
});
const sample = async (ms) => {
  let peak = 0, rms = 0, n = 0;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const l = await page.evaluate(() => window.__level());
    peak = Math.max(peak, l.peak); rms += l.rms; n++;
    await sleep(40);
  }
  return { peak, rms: rms / n };
};
const menu = await sample(2500);
check(menu.rms > 0.005 && menu.peak < 1, `title music plays (rms ${menu.rms.toFixed(3)}, peak ${menu.peak.toFixed(2)})`);
await page.keyboard.press('Enter');
await sceneIs(page, 'GameScene', 0.5, 10000);
const play = await sample(2500);
check(play.rms > 0.005 && play.peak < 1, `gameplay music, engine and effects play (rms ${play.rms.toFixed(3)}, peak ${play.peak.toFixed(2)})`);
await page.evaluate(async () => {
  const { Sound } = await import('/js/audio.js');
  Sound.setAdMuted(true);
});
await sleep(200);
const ad = await sample(800);
check(ad.peak < 0.001, `silent while an ad plays (peak ${ad.peak.toFixed(4)})`);
await page.evaluate(async () => {
  const { Sound } = await import('/js/audio.js');
  const { Save } = await import('/js/save.js');
  Sound.setAdMuted(false);
  Save.data.music = false;
  Save.data.sound = false;
  Sound.applyVolumes(true);
});
await sleep(300);
const off = await sample(800);
check(off.peak < 0.001, `music and sound toggles silence output (peak ${off.peak.toFixed(4)})`);
await browser.close();
srv.stop();
check(errors.length === 0, `zero console errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
