// Store icon "hero-van": the coral courier van tearing diagonally toward the
// top-right over a teal sunburst, a parcel flying off the back, speed lines and
// a dust puff. Built from the game's own van / parcel painters and palette.

const BG = 'teal';

export function draw(ctx, size, { art, ui, util, variant }) {
  const { PAL, paintVan, paintParcel } = art;
  const { shade, rgba, roundRect, TAU, mulberry32 } = util;
  const titled = variant === 'title';
  const U = size / 1024; // work in a 1024 design space

  // Layout (1024 space).
  const L = titled
    ? { vx: 548, vy: 300, vs: 8.6, ang: -0.42, sun: [540, 330], parcel: [210, 170, 136, -0.45] }
    : { vx: 532, vy: 502, vs: 11.4, ang: -Math.PI / 6, sun: [532, 502], parcel: [222, 236, 176, -0.45] };

  ctx.save();
  ctx.scale(U, U);

  background();

  const c = Math.cos(L.ang), s = Math.sin(L.ang);
  const toScreen = (lx, ly) => [L.vx + (lx * c - ly * s) * L.vs, L.vy + (lx * s + ly * c) * L.vs];

  speedLines();
  dust();
  flyingParcel();
  van();

  if (titled) logo(512, 738, 182);

  ctx.restore();

  // ---------------------------------------------------------------------------

  function background() {
    const base = BG === 'teal' ? PAL.teal : PAL.sun;
    const ray = BG === 'teal' ? shade(PAL.teal, 0.16) : shade(PAL.sun, 0.45);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 1024, 1024);
    const [cx, cy] = L.sun;
    const n = 18;
    ctx.fillStyle = ray;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU + 0.1, a1 = a0 + (TAU / n) * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * 1600, cy + Math.sin(a0) * 1600);
      ctx.lineTo(cx + Math.cos(a1) * 1600, cy + Math.sin(a1) * 1600);
      ctx.closePath();
      ctx.fill();
    }
    // Soft glow in the middle, darker toward the corners.
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 560);
    g.addColorStop(0, rgba('#ffffff', 0.28));
    g.addColorStop(1, rgba('#ffffff', 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
    g = ctx.createRadialGradient(512, 512, 380, 512, 512, 760);
    g.addColorStop(0, rgba(PAL.ink, 0));
    g.addColorStop(1, rgba(PAL.ink, 0.32));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
  }

  // Van silhouette path pieces in van-local units (0..54 x 0..28), grown by o.
  function vanSilhouette(o) {
    const len = 54, wid = 28;
    roundRect(ctx, -o, -o, len + 2 * o, wid + 2 * o, 7 + o); ctx.fill();
    for (const wx of [len * 0.2, len * 0.74]) {
      roundRect(ctx, wx - 6 - o, -2 - o, 12 + 2 * o, 6 + 2 * o, 2 + o); ctx.fill();
      roundRect(ctx, wx - 6 - o, wid - 4 - o, 12 + 2 * o, 6 + 2 * o, 2 + o); ctx.fill();
    }
    roundRect(ctx, len - 14 - o, -2.5 - o, 4 + 2 * o, 3.5 + 2 * o, 1 + o); ctx.fill();
    roundRect(ctx, len - 14 - o, wid - 1 - o, 4 + 2 * o, 3.5 + 2 * o, 1 + o); ctx.fill();
  }

  function vanFrame(dx = 0, dy = 0) {
    ctx.translate(L.vx + dx, L.vy + dy);
    ctx.rotate(L.ang);
    ctx.scale(L.vs * 1.04, L.vs * 0.97); // a touch of speed stretch
  }

  function van() {
    // Airborne shadow, well offset so the van feels like it is flying along.
    ctx.save();
    vanFrame(26, 38);
    ctx.translate(-27, -14);
    ctx.filter = `blur(${10}px)`;
    ctx.fillStyle = rgba(PAL.ink, 0.38);
    vanSilhouette(1.5);
    ctx.filter = 'none';
    ctx.restore();

    ctx.save();
    vanFrame();
    ctx.save();
    ctx.translate(-27, -14);
    ctx.fillStyle = PAL.ink;
    vanSilhouette(2.4);
    ctx.restore();
    paintVan(ctx, 'classic', 0, 0, 1, 0);
    // Parcels riding in the cargo bed (one slot empty: it just flew out).
    const slots = [[0, -5, 'normal'], [0, 5, 'express'], [-7, -5, 'fragile'], [-7, 5, 'normal'],
      [-14, -5, 'normal'], [-14, 5, 'fragile'], [-21, 5, 'normal']];
    for (const [x, y, k] of slots) paintParcel(ctx, x, y, 6, 10, k);
    // Glossy highlight along the roof.
    ctx.fillStyle = rgba('#ffffff', 0.22);
    roundRect(ctx, 7, -11.5, 15, 3, 1.5); ctx.fill();
    ctx.restore();
  }

  function speedLines() {
    ctx.save();
    ctx.lineCap = 'round';
    const lines = [
      // [y offset (units), x start, x end, width]
      [21, 12, -24, 2.4],
      [28.5, -2, -32, 1.8],
      [12, -32, -44, 1.8],
    ];
    for (const pass of [0, 1]) {
      for (const [ly, x0, x1, w] of lines) {
        const [ax, ay] = toScreen(x0, ly);
        const [bx, by] = toScreen(x1, ly);
        ctx.strokeStyle = pass ? PAL.cream : PAL.ink;
        ctx.lineWidth = (w + (pass ? 0 : 2.0)) * L.vs;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function dust() {
    const rng = mulberry32(7);
    // One chunky cloud kicked up behind the rear wheels.
    const puffs = [
      [-29, 9, 5.8], [-30, -3, 5.0], [-35, 4, 5.4], [-37, -7, 3.4],
      [-40, 11, 3.6], [-42, 0, 3.8], [-46.5, 7, 2.6], [-46, -6, 1.9],
    ];
    for (const p of puffs) p[1] += (rng() - 0.5) * 1.2;
    const pts = puffs.map(([x, y, r]) => [...toScreen(x, y), r * L.vs]);
    for (const [x, y, r] of pts) {
      ctx.fillStyle = PAL.ink;
      ctx.beginPath(); ctx.arc(x, y, r + 1.1 * L.vs, 0, TAU); ctx.fill();
    }
    for (const [x, y, r] of pts) {
      ctx.fillStyle = shade(PAL.cream, -0.08);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    for (const [x, y, r] of pts) {
      ctx.fillStyle = PAL.cream;
      ctx.beginPath(); ctx.arc(x - r * 0.18, y - r * 0.2, r * 0.72, 0, TAU); ctx.fill();
    }
  }

  function flyingParcel() {
    // Bounced out of the bed and flying up and back; the game draws airborne
    // parcels raised and enlarged, so it sits up-left of the van.
    const [px, py, w, rot] = L.parcel;
    const h = w * 0.84;
    const [sx, sy] = toScreen(-21, -5);
    // Tapered swoosh trail from the cargo bed to where the parcel is now.
    const ex = px + w * 0.2, ey = py + h * 0.25;
    const qx = (sx + ex) / 2 + w * 0.05, qy = (sy + ey) / 2 + w * 0.32;
    const pt = (t) => [
      (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * qx + t * t * ex,
      (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * qy + t * t * ey,
    ];
    const N = 40, left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const [ax, ay] = pt(Math.max(0, t - 0.01));
      const [bx, by] = pt(Math.min(1, t + 0.01));
      const d = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / d, ny = (bx - ax) / d;
      const hw = 2 + w * 0.3 * Math.pow(t, 1.3);
      const [cx, cy] = pt(t);
      left.push([cx + nx * hw, cy + ny * hw]);
      right.push([cx - nx * hw, cy - ny * hw]);
    }
    ctx.save();
    ctx.fillStyle = rgba(PAL.cream, 0.55);
    ctx.beginPath();
    left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Airborne drop shadow.
    ctx.save();
    ctx.filter = `blur(${w * 0.06}px)`;
    ctx.fillStyle = rgba(PAL.ink, 0.35);
    ctx.translate(px + w * 0.16, py + w * 0.24);
    ctx.rotate(rot);
    roundRect(ctx, -w / 2 - 6, -h / 2 - 6, w + 12, h + 12, w * 0.12);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
    // The parcel.
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    const o = w * 0.075;
    ctx.fillStyle = PAL.ink;
    roundRect(ctx, -w / 2 - o, -h / 2 - o, w + 2 * o, h + 2 * o, w * 0.12);
    ctx.fill();
    ctx.scale(w / 14, h / 12);
    paintParcel(ctx, 0, 0, 14, 12, 'normal');
    ctx.restore();
  }

  function logo(cx, cy, sz) {
    const words = [['PARCEL', PAL.cream, -0.05], ['DASH', PAL.sun, 0.04]];
    ctx.save();
    ctx.translate(cx, cy);
    const gap = sz * 0.98;
    words.forEach(([word, color, tilt], wi) => {
      const fs = wi === 1 ? sz * 1.22 : sz;
      const total = ui.measure(ctx, word, fs) + (word.length - 1) * fs * 0.02;
      let x = -total / 2;
      const y = (wi === 0 ? -gap / 2 : gap / 2) + (wi === 1 ? fs * 0.06 : 0);
      for (const ch of word) {
        const cw = ui.measure(ctx, ch, fs);
        ctx.save();
        ctx.translate(x + cw / 2, y);
        ctx.rotate(tilt);
        ui.text(ctx, ch, 0, 0, fs, { color, sw: fs * 0.22 });
        ctx.restore();
        x += cw + fs * 0.02;
      }
    });
    ctx.restore();
  }
}
