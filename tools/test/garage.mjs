// Garage and settings: purchases, equipping, denied buys, persistence and
// that upgrades change the next shift.
import { startServer, launch, sleep, sceneIs, overlayIs } from './harness.mjs';

const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures.push(msg);
};

const srv = await startServer();
const { browser, page, errors } = await launch({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('parcel-dash-save-v1', JSON.stringify({ coins: 700, tutorialSeen: true }));
  }
});
const get = (expr) => page.evaluate(async (e) => {
  const { G } = await import('/js/state.js');
  const { Save } = await import('/js/save.js');
  // eslint-disable-next-line no-new-func
  return new Function('G', 'Save', `return ${e}`)(G, Save);
}, expr);
const clickAt = async (expr) => {
  const p = await get(`({ x: ${expr}.x, y: ${expr}.y })`);
  await page.mouse.click(p.x, p.y);
  await sleep(150);
};

await page.goto(srv.url);
await sceneIs(page, 'TitleScene', 1.2, 30000);
await clickAt('G.scene.garage');
await sceneIs(page, 'GarageScene', 1.2);

// Buy cargo space (capacity) level 1 for 150.
await clickAt('G.scene.upButtons[2]');
check((await get('Save.data.upgrades.capacity')) === 1 && (await get('Save.data.coins')) === 550, 'buying an upgrade spends coins and raises its level');
// Next price is shown.
check((await get('G.scene.upButtons[2].label')) === '300', 'next level price shown');
// Unaffordable skin is refused.
await clickAt('G.scene.cards[5]');
check((await get('Save.data.skins.includes("gold")')) === false && (await get('Save.data.coins')) === 550, 'unaffordable van is not bought');
// Affordable skin is bought and equipped.
await clickAt('G.scene.cards[1]');
check((await get('Save.data.skin')) === 'mint' && (await get('Save.data.coins')) === 250, 'buying a van spends coins and equips it');
// Switch back to an owned skin for free.
await clickAt('G.scene.cards[0]');
check((await get('Save.data.skin')) === 'classic' && (await get('Save.data.coins')) === 250, 'equipping an owned van is free');
// Keyboard navigation in menus.
await page.keyboard.press('ArrowDown');
check((await get('G.scene.ui.focus')) >= 0, 'arrow keys move menu focus');
await page.keyboard.press('Escape');
await sceneIs(page, 'TitleScene', 0.5);

// Settings toggles persist.
await clickAt('G.scene.settings');
await overlayIs(page, 'SettingsOverlay', 0.5);
await clickAt('G.overlays[0].music');
await clickAt('G.overlays[0].sound');
check((await get('Save.data.music')) === false && (await get('Save.data.sound')) === false, 'music and sound toggles switch off');
await page.keyboard.press('Escape');
await sleep(300);

await page.reload();
await sceneIs(page, 'TitleScene', 0.5, 30000);
const d = await get('Save.data');
check(d.coins === 250 && d.upgrades.capacity === 1 && d.skins.includes('mint') && d.skin === 'classic' && d.music === false && d.sound === false, 'garage and settings persist after reload');

// The capacity upgrade loads 4 parcels next shift.
await page.keyboard.press('Enter');
await sceneIs(page, 'GameScene', 1.5, 10000);
check((await get('G.scene.shift.parcels.length')) === 4, `upgraded van loads 4 parcels (${await get('G.scene.shift.parcels.length')})`);

await browser.close();
srv.stop();
check(errors.length === 0, `zero console errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
