// Plays a complete shift with real keyboard input and checks the Poki SDK
// lifecycle, ad muting, input blocking, pause, rewards and save/reload.
import { startServer, launch, sleep, root, sceneIs, overlayIs, waitFor } from './harness.mjs';
import { readWorld, readState, drive, releaseAll } from './bot.mjs';
import path from 'node:path';
import fs from 'node:fs';

const out = process.argv[2] || path.join(root, 'tools', 'test', 'shots');
fs.mkdirSync(out, { recursive: true });
const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures.push(msg);
};

const srv = await startServer();
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
// Sample the master volume while ads run.
await page.addInitScript(() => {
  const sample = () => import('/js/audio.js').then((m) => window.__adMuteSamples.push(m.Sound.masterLevel));
  window.__sampleDuringAd = () => setTimeout(sample, 250);
});
await page.addInitScript(() => {
  const wrap = (name) => {
    const orig = window.PokiSDK[name];
    window.PokiSDK[name] = (cb) => {
      window.__sampleDuringAd();
      return orig(cb);
    };
  };
  wrap('commercialBreak');
  wrap('rewardedBreak');
});
await page.goto(srv.url);
await sceneIs(page, 'TitleScene', 1.2, 30000);
let log = await page.evaluate(() => window.__pokiLog.slice());
check(log[0] === 'init' && log[1] === 'gameLoadingFinished', `SDK init then gameLoadingFinished (${log.join(',')})`);

// First input unlocks audio.
await page.keyboard.press('ShiftLeft');
await sleep(300);
const audioState = await page.evaluate(async () => (await import('/js/audio.js')).Sound.ctx?.state);
check(audioState === 'running', `audio context running after first input (${audioState})`);

// Start: commercial break first, input blocked during it.
await page.keyboard.press('Enter');
await sleep(120);
const blocked = await page.evaluate(async () => (await import('/js/state.js')).G.inputBlocked);
check(blocked === true, 'input blocked while commercial break plays');
await page.keyboard.press('Escape');
await sceneIs(page, 'GameScene', 0.2, 10000);
const mute1 = await page.evaluate(() => window.__adMuteSamples.slice());
check(mute1.length === 1 && mute1[0] === 0, `audio muted during commercial break (${mute1})`);
log = await page.evaluate(() => window.__pokiLog.slice());
check(log.slice(2).join(',') === 'commercialBreak,gameplayStart', `commercialBreak before gameplayStart (${log.join(',')})`);
const tut = await readState(page);
check(tut.tut === 0, 'first shift runs the tutorial');
await page.screenshot({ path: path.join(out, 'full-01-start.png') });

const world = await readWorld(page);

// Pause and resume with the keyboard.
await sleep(1500);
await page.keyboard.press('KeyP');
await overlayIs(page, 'PauseOverlay', 0.3);
log = await page.evaluate(() => window.__pokiLog.slice());
check(log[log.length - 1] === 'gameplayStop', 'pause calls gameplayStop');
const t0 = (await readState(page)).van;
await sleep(500);
const t1 = (await readState(page)).van;
check(t0.x === t1.x && t0.y === t1.y, 'game is frozen while paused');
await page.keyboard.press('KeyP');
await sleep(400);
log = await page.evaluate(() => window.__pokiLog.slice());
check(log[log.length - 1] === 'gameplayStart', 'resume calls gameplayStart');

// Tab hidden pauses the game.
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { value: true, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await overlayIs(page, 'PauseOverlay', 0.1);
check(true, 'hidden tab opens the pause menu');
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.keyboard.press('Escape');
await sleep(400);

// Drive and deliver. Mix aimed and rushed throws to exercise every zone.
let st = await readState(page);
const startDeliveries = st.deliveries;
for (let round = 0; round < 7; round++) {
  const before = await readState(page);
  if (before.state !== 'play') break;
  const aim = round === 3 ? 'miss' : round === 4 ? 'good' : 'perfect';
  st = await drive(page, world, {
    timeout: 40000,
    aim,
    until: (s) => s.deliveries > before.deliveries || s.misses > before.misses || s.state !== 'play',
    log: () => {},
  });
  if (aim === 'miss') check(st.misses > before.misses && st.deliveries === before.deliveries, 'red-zone throw misses and the parcel stays in the van');
  if (aim === 'good') check(st.deliveries > before.deliveries && st.perfects === before.perfects && st.combo === 0, 'amber throw delivers without a perfect and resets combo');
  console.log(`  round ${round}: deliveries=${st.deliveries} perfects=${st.perfects} coins=${st.coins} time=${st.time?.toFixed(1)} tut=${st.tut}`);
  if (round === 1) await page.screenshot({ path: path.join(out, 'full-02-midshift.png') });
}
check(st.deliveries - startDeliveries >= 5, `bot delivered parcels (${st.deliveries})`);
check(st.perfects >= 1, `perfect throws happened (${st.perfects})`);
check(st.tut === null, 'tutorial completed during the first shift');
const saved = await page.evaluate(async () => (await import('/js/save.js')).Save.data.tutorialSeen);
check(saved === true, 'tutorial marked as seen');

// Let the clock run out naturally: keep driving but stop delivering.
st = await drive(page, world, { timeout: 150000, aim: 'none', until: (s) => s.state !== 'play' });
check(st.state === 'timeup', `shift clock runs out on its own (${st.state})`);
await releaseAll(page);
await overlayIs(page, 'TimeUpOverlay', 0.5, 20000);
log = await page.evaluate(() => window.__pokiLog.slice());
check(log[log.length - 1] === 'gameplayStop', 'time up calls gameplayStop');
await page.screenshot({ path: path.join(out, 'full-03-timeup.png') });
await page.keyboard.press('Space');
await page.keyboard.press('Enter');
await sleep(300);
check((await page.evaluate(() => window.__pokiLog.slice(-1)[0])) === 'gameplayStop', 'Space/Enter alone do not start the rewarded ad');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await waitFor(page, async () => {
  const { G } = await import('/js/state.js');
  return G.scene.shift.state === 'play' && !G.inputBlocked;
}, null, 10000);
st = await readState(page);
check(st.time > 15, `rewarded ad granted +20 seconds (${st.time.toFixed(1)})`);
log = await page.evaluate(() => window.__pokiLog.slice());
check(log.slice(-2).join(',') === 'rewardedBreak,gameplayStart', `rewardedBreak then gameplayStart (${log.slice(-3).join(',')})`);
const mute2 = await page.evaluate(() => window.__adMuteSamples.slice());
check(mute2[1] === 0, `audio muted during rewarded ad (${mute2})`);
const vol = await page.evaluate(async () => (await import('/js/audio.js')).Sound.masterLevel);
check(vol > 0.5, `audio restored after ad (${vol})`);

// Second time-up: no second offer, straight to results.
await drive(page, world, { timeout: 30000, aim: 'perfect', until: (s) => s.state !== 'play' });
await overlayIs(page, 'ResultsOverlay', 0.2, 30000);
check(true, 'second time-up skips the offer and shows results');
const res = await page.evaluate(async () => {
  const { G } = await import('/js/state.js');
  const { Save } = await import('/js/save.js');
  return { res: G.overlays[0].res, coins: Save.data.coins, best: Save.data.best };
});
check(res.coins === res.res.coins && res.best === res.res.coins, `coins and best saved (${JSON.stringify(res)})`);
await overlayIs(page, 'ResultsOverlay', 4.5, 10000);
await page.screenshot({ path: path.join(out, 'full-04-results.png') });

// Double coins via rewarded ad.
const dbl = await page.evaluate(async () => {
  const { G } = await import('/js/state.js');
  const b = G.overlays[0].double;
  return { x: b.x, y: b.y };
});
await page.mouse.click(dbl.x, dbl.y);
await waitFor(page, async () => (await import('/js/state.js')).G.overlays[0].doubled, null, 5000);
const coins2 = await page.evaluate(async () => (await import('/js/save.js')).Save.data.coins);
check(coins2 === res.res.coins * 2, `double coins granted (${coins2})`);

// Reload: progress persists.
await page.reload();
await sceneIs(page, 'TitleScene', 1.2, 30000);
const persisted = await page.evaluate(async () => (await import('/js/save.js')).Save.data);
check(persisted.coins === coins2 && persisted.tutorialSeen === true && persisted.best === res.res.coins, `progress persisted after reload (${persisted.coins}, best ${persisted.best})`);

// Second shift: no tutorial; a declined reward finishes the shift.
await page.keyboard.press('Enter');
await sceneIs(page, 'GameScene', 0.3, 10000);
st = await readState(page);
check(st.tut === null, 'tutorial not shown again');
await page.evaluate(async () => {
  const { G } = await import('/js/state.js');
  G.scene.shift.time = 0.5;
});
await overlayIs(page, 'TimeUpOverlay', 0.5, 10000);
// An ad that does not complete must not grant the reward.
await page.evaluate(() => { window.__rewardResult = false; });
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await overlayIs(page, 'ResultsOverlay', 0.2, 10000);
const after = await readState(page);
check(after.state === 'over' && after.time === 0, 'unfinished rewarded ad grants no time and ends the shift');

await browser.close();
srv.stop();
const errs = errors.filter((e) => !e.includes('[requestfailed]') || !e.includes('poki'));
check(errs.length === 0, `zero console errors${errs.length ? ':\n' + errs.join('\n') : ''}`);
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
