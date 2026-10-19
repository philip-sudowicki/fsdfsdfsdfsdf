import { CONFIG } from './config.js';

// Shared runtime state for the whole app.
export const G = {
  canvas: null,
  ctx: null,
  w: 1,
  h: 1,
  dpr: 1,
  u: 1,
  safe: { t: 0, r: 0, b: 0, l: 0 },
  time: 0,
  world: null,
  town: null,
  renderer: null,
  scene: null,
  overlays: [],
  touchUI: false,
  lastDevice: 'mouse',
  inputBlocked: false,
  adCover: 0,
  keys: new Set(),
  // Assigned by main.js.
  setScene: null,
  pushOverlay: null,
  popOverlay: null,
  startShift: null,
};

export function portrait() {
  return G.h > G.w * 1.05;
}

// Vertical placement for modal panels that keeps the top centre clear.
export function placeModal(h) {
  const top = G.safe.t + CONFIG.ui.clearTop * G.u;
  const bottom = G.h - G.safe.b - 12 * G.u;
  return Math.max(top, Math.min((G.h - h) / 2, bottom - h));
}

export function modalSpace() {
  return G.h - G.safe.t - G.safe.b - (CONFIG.ui.clearTop + 12) * G.u;
}
