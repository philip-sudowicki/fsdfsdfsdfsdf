// Boot, main loop, scene management, input routing, resize and Poki lifecycle.
import { CONFIG } from './config.js';
import { G } from './state.js';
import { Poki } from './poki.js';
import { Save } from './save.js';
import { Sound } from './audio.js';
import { Art, PAL } from './art.js';
import { World } from './world.js';
import { Town } from './town.js';
import { Renderer } from './render.js';
import { clamp, ease, TAU, rgba } from './util.js';
import { text } from './ui.js';
import { LoadingScene } from './scenes/loading.js';
import { TitleScene } from './scenes/title.js';
import { GameScene } from './scenes/game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
G.canvas = canvas;
G.ctx = ctx;

// ---- Layout ------------------------------------------------------------------

const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
  'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
document.body.appendChild(safeProbe);

export function baseZoom() {
  const C = CONFIG.camera;
  const area = G.w * G.h;
  const boost = clamp(Math.pow(area / 400000, 0.25), 1, C.bigScreenBoost);
  const zoom = Math.sqrt(area / (C.viewArea * boost));
  return Math.min(zoom, Math.min(G.w, G.h) / C.minVisibleShort);
}

function resize() {
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
  G.dpr = Math.min(CONFIG.maxDpr, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * G.dpr);
  canvas.height = Math.round(h * G.dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  G.w = w;
  G.h = h;
  G.u = clamp(Math.min(Math.max(w, h) / 860, Math.min(w, h) / 420), 0.7, 1.7);
  const cs = getComputedStyle(safeProbe);
  G.safe = {
    t: parseFloat(cs.paddingTop) || 0,
    r: parseFloat(cs.paddingRight) || 0,
    b: parseFloat(cs.paddingBottom) || 0,
    l: parseFloat(cs.paddingLeft) || 0,
  };
  G.zoom = baseZoom();
  if (G.loaded) Art.setScale(spriteScale());
  relayout();
}

export function spriteScale() {
  return clamp(Math.ceil(G.zoom * G.dpr * 2) / 2, 1, 2.5);
}
G.spriteScale = spriteScale;

function relayout() {
  if (G.scene && G.scene.layout) G.scene.layout();
  for (const o of G.overlays) if (o.layout) o.layout();
}

// ---- Scenes ------------------------------------------------------------------

const trans = { phase: null, t: 0, next: null, params: null };

G.setScene = (next, params) => {
  if (trans.phase) return;
  if (!G.scene) {
    G.scene = next;
    next.enter(params);
    if (next.layout) next.layout();
    return;
  }
  trans.phase = 'out';
  trans.t = 0;
  trans.next = next;
  trans.params = params;
  for (const o of G.overlays) o.leaving = true;
};

G.pushOverlay = (o, params) => {
  o.leaving = false;
  o.leaveT = 0;
  G.overlays.push(o);
  o.enter(params);
  if (o.layout) o.layout();
};

G.popOverlay = (o) => {
  const top = o || G.overlays[G.overlays.length - 1];
  if (top) top.leaving = true;
};

function topTarget() {
  for (let i = G.overlays.length - 1; i >= 0; i--) if (!G.overlays[i].leaving) return G.overlays[i];
  return G.scene;
}

// Show an ad break, then run `then`. Game is paused, muted and input is off meanwhile.
G.withCommercialBreak = (then) => {
  G.inputBlocked = true;
  Sound.engineStop();
  return Poki.commercialBreak(() => Sound.setAdMuted(true)).then(() => {
    Sound.setAdMuted(false);
    G.inputBlocked = false;
    then();
  });
};

G.withRewardedBreak = () => {
  G.inputBlocked = true;
  Sound.engineStop();
  return Poki.rewardedBreak(() => Sound.setAdMuted(true)).then((ok) => {
    Sound.setAdMuted(false);
    G.inputBlocked = false;
    return ok;
  });
};

G.startShift = () => {
  G.withCommercialBreak(() => {
    G.setScene(new GameScene(), { tutorial: !Save.data.tutorialSeen });
  });
};

G.toTitle = () => G.setScene(new TitleScene());

// ---- Input -------------------------------------------------------------------

const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space'];

function setTouchUI(on) {
  if (G.touchUI === on) return;
  G.touchUI = on;
  relayout();
}

function pointer(e) {
  return { id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType || 'mouse' };
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  Sound.unlock();
  G.lastDevice = e.pointerType;
  if (e.pointerType === 'touch') setTouchUI(true);
  if (G.inputBlocked || trans.phase) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
  const t = topTarget();
  if (t && t.pointerDown) t.pointerDown(pointer(e));
});
canvas.addEventListener('pointermove', (e) => {
  if (G.inputBlocked) return;
  const t = topTarget();
  if (t && t.pointerMove) t.pointerMove(pointer(e));
});
const up = (e) => {
  Sound.unlock();
  if (G.inputBlocked) return;
  const t = topTarget();
  if (t && t.pointerUp) t.pointerUp(pointer(e), e.type === 'pointercancel');
};
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  Sound.unlock();
  if (G.inputBlocked || trans.phase) return;
  if (GAME_KEYS.includes(e.code)) setTouchUI(false);
  G.keys.add(e.code);
  if (e.repeat) return;
  const t = topTarget();
  if (t && t.keyDown) t.keyDown(e.code);
});
window.addEventListener('keyup', (e) => {
  G.keys.delete(e.code);
});
window.addEventListener('blur', () => G.keys.clear());
window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
// Some mobile browsers only allow audio to start from a touchend.
document.addEventListener('touchend', () => Sound.unlock(), { passive: true });
document.addEventListener('gesturestart', (e) => e.preventDefault());

document.addEventListener('visibilitychange', () => {
  const hidden = document.hidden;
  Sound.setHidden(hidden);
  if (hidden) {
    G.keys.clear();
    const t = topTarget();
    if (t && t.onHidden) t.onHidden();
    else if (G.scene && G.scene.onHidden) G.scene.onHidden();
  }
});

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

// ---- Loop --------------------------------------------------------------------

let last = performance.now();

function update(dt) {
  G.time += dt;
  if (trans.phase) {
    trans.t += dt;
    if (trans.phase === 'out' && trans.t >= 0.28) {
      if (G.scene.exit) G.scene.exit();
      G.overlays.length = 0;
      G.scene = trans.next;
      G.scene.enter(trans.params);
      if (G.scene.layout) G.scene.layout();
      trans.phase = 'in';
      trans.t = 0;
    } else if (trans.phase === 'in' && trans.t >= 0.32) {
      trans.phase = null;
    }
  }
  // Only dim the screen if an ad break actually takes a moment.
  G.blockedT = G.inputBlocked ? (G.blockedT || 0) + dt : 0;
  G.adCover = clamp(G.adCover + (G.blockedT > 0.3 ? dt * 5 : -dt * 5), 0, 1);
  if (G.inputBlocked) return;
  const top = topTarget();
  const covered = G.overlays.some((o) => !o.leaving && o.freezeBelow);
  // The outgoing scene stays frozen while the iris closes.
  if (trans.phase !== 'out') G.scene.update(dt, covered, top === G.scene);
  for (let i = G.overlays.length - 1; i >= 0; i--) {
    const o = G.overlays[i];
    if (o.leaving) {
      o.leaveT += dt;
      if (o.leaveT >= 0.22) {
        G.overlays.splice(i, 1);
        if (o.exit) o.exit();
        continue;
      }
    }
    o.update(dt);
  }
}

function drawTransition() {
  if (!trans.phase) return;
  const k = trans.phase === 'out' ? ease.inCubic(clamp(trans.t / 0.28, 0, 1)) : 1 - ease.outCubic(clamp(trans.t / 0.32, 0, 1));
  const r = Math.hypot(G.w, G.h) * 0.6 * (1 - k);
  ctx.fillStyle = PAL.ink;
  ctx.beginPath();
  ctx.rect(0, 0, G.w, G.h);
  ctx.arc(G.w / 2, G.h / 2, Math.max(0, r), 0, TAU, true);
  ctx.fill('evenodd');
}

function drawAdCover() {
  if (G.adCover <= 0) return;
  ctx.fillStyle = rgba(PAL.ink, 0.75 * G.adCover);
  ctx.fillRect(0, 0, G.w, G.h);
  const u = G.u;
  ctx.globalAlpha = G.adCover;
  ctx.strokeStyle = PAL.cream;
  ctx.lineWidth = 6 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(G.w / 2, G.h / 2 - 10 * u, 22 * u, G.time * 5, G.time * 5 + 4.2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  text(ctx, 'One moment...', G.w / 2, G.h / 2 + 40 * u, 20 * u, { alpha: G.adCover });
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  update(dt);
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  G.scene.draw(ctx);
  for (const o of G.overlays) {
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    o.fade = (1 - clamp(o.leaveT / 0.22, 0, 1));
    o.draw(ctx);
  }
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  drawAdCover();
  drawTransition();
  requestAnimationFrame(frame);
}

// ---- Boot --------------------------------------------------------------------

async function boot() {
  Save.load();
  G.touchUI = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  resize();
  G.world = new World();
  G.town = new Town(G.world);
  G.renderer = new Renderer(ctx);
  G.setScene(new LoadingScene());
  requestAnimationFrame(frame);
}

boot();
