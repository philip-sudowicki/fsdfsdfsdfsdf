// The living town that pans behind the menus.
import { CONFIG } from './config.js';
import { G } from './state.js';
import { PAL } from './art.js';
import { rgba } from './util.js';

const cam = { x: 0, y: 0, zoom: 1 };
let t = 30;
let fresh = true;

function focus(time) {
  const W = G.world.width, H = G.world.height;
  const s = CONFIG.camera.attractSpeed / 60;
  return {
    x: W / 2 + W * 0.3 * Math.sin(time * 0.045 * s),
    y: H / 2 + H * 0.28 * Math.sin(time * 0.06 * s + 1),
  };
}

export const Attract = {
  reset() {
    fresh = true;
  },

  update(dt) {
    t += dt;
    const f = focus(t);
    cam.x = f.x;
    cam.y = f.y;
    cam.zoom = G.zoom * 0.92;
    const town = G.town;
    if (fresh) {
      town.reset();
      fresh = false;
    }
    town.traffic.maintain(cam.x, cam.y, CONFIG.traffic.titleCount, 500);
    town.traffic.update(dt, null, 1, []);
    const r = G.renderer;
    town.update(dt, dt, null, (x, y, pad) => r.visible(x, y, pad), null, []);
  },

  draw(ctx, dim = 0.25) {
    const r = G.renderer;
    r.begin(cam, G.w, G.h, G.dpr);
    r.drawTown(G.town, { time: t });
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, G.h);
    g.addColorStop(0, rgba(PAL.ink, dim + 0.2));
    g.addColorStop(0.5, rgba(PAL.ink, dim * 0.4));
    g.addColorStop(1, rgba(PAL.ink, dim + 0.3));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.w, G.h);
  },
};
