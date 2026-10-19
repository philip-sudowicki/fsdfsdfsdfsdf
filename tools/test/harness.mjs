// Shared Playwright helpers for the automated tests.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function startServer() {
  const proc = spawn(process.execPath, [path.join(root, 'tools', 'serve.mjs'), '0'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const first = await new Promise((resolve) => proc.stdout.once('data', (d) => resolve(String(d))));
  const port = first.match(/localhost:(\d+)/)[1];
  process.on('exit', () => proc.kill());
  return { url: `http://localhost:${port}/`, stop: () => proc.kill() };
}

// A recording stand-in for the Poki SDK. `adDelay` simulates ad length.
export const MOCK_SDK = `
  window.__pokiLog = [];
  window.__adMuteSamples = [];
  const log = (n) => window.__pokiLog.push(n);
  window.PokiSDK = {
    init() { log('init'); return Promise.resolve(); },
    gameLoadingFinished() { log('gameLoadingFinished'); },
    gameplayStart() { log('gameplayStart'); },
    gameplayStop() { log('gameplayStop'); },
    commercialBreak(cb) {
      log('commercialBreak');
      if (cb) cb();
      return new Promise((r) => setTimeout(r, 400));
    },
    rewardedBreak(cb) {
      log('rewardedBreak');
      if (cb) cb();
      return new Promise((r) => setTimeout(() => r(window.__rewardResult !== false), 400));
    },
  };
`;

export async function launch(opts = {}) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 1280, height: 720 },
    deviceScaleFactor: opts.dpr || 1,
    hasTouch: !!opts.touch,
    isMobile: !!opts.mobile,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[console.${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
  page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()} ${r.failure() && r.failure().errorText}`));
  if (!opts.realSdk) {
    await page.addInitScript(MOCK_SDK);
    await page.route('**/poki-sdk.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  }
  return { browser, context, page, errors };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Read internal state through the same ES module instances the game uses.
export async function state(page, fn) {
  return page.evaluate(fn);
}

// Poll an async in-page predicate (page.waitForFunction does not await promises).
export async function waitFor(page, fn, arg, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(fn, arg)) return true;
    await sleep(50);
  }
  throw new Error('waitFor timed out: ' + fn.toString().slice(0, 120));
}

export async function sceneIs(page, name, minT = 0, timeout = 15000) {
  return waitFor(page, async ([n, t]) => {
    const { G } = await import('/js/state.js');
    return !!G.scene && G.scene.constructor.name === n && G.scene.t > t;
  }, [name, minT], timeout);
}

export async function overlayIs(page, name, minT = 0, timeout = 15000) {
  return waitFor(page, async ([n, t]) => {
    const { G } = await import('/js/state.js');
    const o = G.overlays[G.overlays.length - 1];
    return !!o && !o.leaving && o.constructor.name === n && o.t > t;
  }, [name, minT], timeout);
}
