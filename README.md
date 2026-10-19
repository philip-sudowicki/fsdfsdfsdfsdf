# Parcel Dash

A top-down arcade delivery game for the browser. You drive a courier van around a
toy town, racing the shift clock. Load parcels at the depot, follow the arrow, and
throw each parcel onto the doormat **without stopping**. The timing meter decides
whether it lands on the mat, on the path, or in the hedge.

Plain HTML5, ES modules and Canvas 2D. There is no engine and no build step. All art
is drawn in code and all sound is synthesised with the Web Audio API. The only bundled
asset is the Lilita One font (SIL Open Font License, see `assets/fonts/OFL.txt`). The
upload is about 90 KB.

## How to play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | Left/Right arrows or A/D | Drag anywhere on the left side (the van turns toward your finger) |
| Brake / reverse | Down arrow or S | Hold **BRAKE** |
| Throw parcel | Space | Tap **THROW** |
| Pause | P or Esc | Pause button (top right) |
| Menus | Arrows/Tab to move, Enter/Space to press, Esc to go back | Tap |

The van accelerates by itself.

- **Throw meter:** when you're close to the glowing doormat, a marker sweeps across a bar.
  - **Green:** a PERFECT throw onto the mat. Big tip, bonus time, combo +1, slow-mo and confetti.
  - **Amber:** the parcel lands on the path. Normal tip, and your combo resets.
  - **Red:** the parcel goes into a hedge or pond. No tip, but you can throw again while you're still in range.
  - The faster you drive, the faster the marker moves and the bigger the tip.
- **Time:** every delivery adds time based on how far you drove. The shift ends when the clock hits 0.
- **Specials:**
  - **EXPRESS** parcels have their own countdown and pay a big tip if you make it.
  - **FRAGILE** parcels lose 25% of their tip for every crash.
- **Bonus tips:** near misses with traffic, long drifts, ramp air time, and knocking over bins and cones.
- **Garage:** spend coins on 5 upgrades (top speed, handling, cargo space, a wider perfect zone,
  starting time), each with 5 levels. There are also 6 van paint jobs.

The first shift doubles as a short tutorial, which you can skip. You can turn it back on
in Settings.

## Run it locally

You need [Node.js](https://nodejs.org) 18 or newer. The game itself has no
dependencies; Node is only used for the tiny dev server and the tests.

```bash
npm start            # or: node tools/serve.mjs
```

Open the printed `http://localhost:8080/`. Any static web server works too (for example
`npx serve .` or `python3 -m http.server`). Open the game through a server rather than
`file://`, because ES modules don't load from `file://` URLs.

### On a phone over Wi-Fi

1. Connect the computer and the phone to the same Wi-Fi network.
2. Run `npm start` on the computer. It prints a second line like
   `On your phone (same Wi-Fi): http://192.168.1.23:8080/`.
3. Open that address in the phone's browser. Turn the phone sideways for the best
   view; portrait works too.
4. If the page doesn't load, allow Node through the computer's firewall for private
   networks. You can also pick another port with `node tools/serve.mjs 8000`.

Progress (coins, upgrades, vans, best score, settings, tutorial seen) is saved in
`localStorage`. To reset it, clear the site data for the address you used.

### The Poki SDK

`index.html` loads `https://game-cdn.poki.com/scripts/v2/poki-sdk.js`. If that request
fails (for example when you're offline or an ad blocker is on), `js/poki.js` falls
back to a local stub. The stub resolves commercial breaks immediately. It simulates a
short rewarded ad that pays out, so you can test the "+20 seconds" and "double coins"
flows locally.

## Automated tests

```bash
npm install          # installs Playwright (uses an existing Chromium if PLAYWRIGHT_BROWSERS_PATH is set)
npm test             # runs every suite below (takes a few minutes)
```

| Suite | What it checks |
| --- | --- |
| `fullshift.mjs` | Plays whole shifts with real keyboard input (see below). |
| `touch.mjs` | On a touch phone viewport: drag-to-steer, BRAKE, THROW with a second finger down, and the pause button. |
| `mechanics.mjs` | Throw zones, combos, the time bonus, depot reloading, EXPRESS and FRAGILE parcels, drift/air/bin/near-miss tips, and upgrade effects. |
| `garage.mjs` | Buying upgrades and vans, refused purchases, equipping, settings toggles, and persistence. |
| `audio.mjs` | Measures real output levels: music and effects play, there's silence during ads, and the toggles mute output. |
| `resize.mjs` | Rotating a phone and resizing a window in the middle of a shift. |
| `screens.mjs` | Screenshots every screen at 844x390, 390x844 and 1920x1080 into `tools/test/shots/`. |

`fullshift.mjs` uses a bot that path-finds over the road tiles and aims its throws.
It checks:

- the Poki call order (init, gameLoadingFinished, commercialBreak before
  gameplayStart, gameplayStop on pause, time up and menu, rewardedBreak);
- that audio is muted and input is blocked during ads;
- pause on a hidden tab;
- the time-up and double-coins rewards;
- that progress saves and reloads.

Every suite also fails on any console error.

Two dev helpers aren't part of `npm test`:

- `tools/test/moments.mjs` captures drift, jump, perfect-delivery and crash frames.
- `tools/test/perf.mjs` reports frame timing.

## Package for Poki

```bash
npm run zip          # or: node tools/zip.mjs
```

This writes `dist/parcel-dash.zip` with `index.html` at the root plus `js/` and `assets/`.
Upload that zip in the Poki for Developers dashboard. To zip by hand instead, zip the
*contents* of the project's `index.html`, `js/` and `assets/`, not the folder itself.
Leave out `tools/`, `node_modules/` and `dist/`.

### Poki integration checklist

- `PokiSDK.init()` runs at boot. Loading continues whether it resolves or rejects.
- `gameLoadingFinished()` is called after the loading bar completes.
- `gameplayStart()` is called when a shift starts, resumes from pause, or continues after
  a rewarded ad.
- `gameplayStop()` is called on pause, time up, the results screen and quitting to the menu.
- `commercialBreak()` runs before every new shift (Play, Play Again, Restart). During
  it the game is paused, audio is muted and input is ignored.
- `rewardedBreak()` is offered once per shift as "+20 seconds" when time runs out, and
  as "double coins" on the results screen. Both say an ad will play first. The reward
  is only granted when the promise resolves to `true`.
- Space, ArrowUp and ArrowDown key presses and wheel events call `preventDefault`.
- The game pauses when the tab is hidden.
- There are no external links, other ads or analytics.
- The top-centre of the screen stays clear for Poki's button.

## Project layout

```
index.html          entry point, loads the SDK and js/main.js
js/config.js        every tuning number (speeds, timings, tips, prices, difficulty)
js/main.js          boot, main loop, scene manager, input routing, resize, ads
js/world.js         town layout, house lots, colliders, surfaces
js/art.js           all sprites and ground tiles, drawn in code and cached
js/render.js        world renderer (tiles, shadows, objects, effects)
js/shift.js         gameplay rules: parcels, throw meter, tips, specials, tutorial
js/van.js           player physics (drift, ramps, collisions)
js/traffic.js       lane-following AI traffic
js/critters.js      pigeons and ducks
js/fx.js            particles, skid marks, floating text, screen shake
js/hud.js           in-game HUD and touch controls
js/ui.js            buttons, panels, icons, text
js/audio.js         synthesised music and sound effects
js/poki.js          Poki SDK wrapper with local stub
js/save.js          localStorage save (wrapped in try/catch)
js/scenes/          loading, title, garage, settings, game, pause, time-up, results
tools/              dev server, zip packager, Playwright tests
```
