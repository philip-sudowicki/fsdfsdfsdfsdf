// Store icon "hero-van": the coral courier van tearing diagonally toward the
// top-right over a teal sunburst, leaving skid marks and a puff of tyre smoke,
// while a parcel flies off its side onto a doormat target. Built from the game's
// own van / parcel painters and palette. The title variant drops the target and
// pairs the van with the in-game logo (and its parcel tumbling off the D).

const BG = 'teal';

export function draw(ctx, size, { art, ui, util, variant }) {
  const { PAL, paintVan, paintParcel } = art;
  const { shade, rgba, roundRect, TAU, mulberry32 } = util;
  const titled = variant === 'title';
  const U = size / 1024; // work in a 1024 design space

  // Layout (1024 space).
  const L = titled
    ? {
      vx: 548, vy: 305, vs: 9.4, ang: -0.42, sun: [540, 330],
      // Motion trails go on the van's upper-left side, clear of the logo.
      side: -1,
      lines: [[19.5, -2, -30, 1.6], [24, -12, -32, 1.2]],
      skid: { end: -54, bend: 12 }, // shorter, so it stays off the logo
      target: null, parcel: null,
      logo: [512, 712, 170],
    }
    : {
      vx: 560, vy: 520, vs: 11.8, ang: -0.56, sun: [560, 520],
      // Which flank the motion trails sit on (+1 = right, -1 = left).
      side: 1,
      // [y offset, x start, x end, width] in van units (y mirrored by side).
      lines: [[19.5, -2, -26, 1.6], [23.5, -10, -26, 1.2]],
      skid: { end: -68, bend: 24 },
      target: { x: 188, y: 182, ring: 80, pulse: 104 },
      parcel: [306, 256, 156, 0.32],
      sparkle: [314, 112, 24],
      logo: null,
    };

  ctx.save();
  ctx.scale(U, U);

  const c = Math.cos(L.ang), s = Math.sin(L.ang);
  const toScreen = (lx, ly) => [L.vx + (lx * c - ly * s) * L.vs, L.vy + (lx * s + ly * c) * L.vs];

  background();
  if (L.target) target(L.target);
  skids();
  vanShadow();
  speedLines();
  smoke();
  if (L.parcel) flyingParcel();
  van();
  if (L.sparkle) sparkle(...L.sparkle);
  if (L.logo) logo(...L.logo);

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
    // Soft glow in the middle, a light ink falloff toward the corners.
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 560);
    g.addColorStop(0, rgba('#ffffff', 0.28));
    g.addColorStop(1, rgba('#ffffff', 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
    g = ctx.createRadialGradient(512, 512, 380, 512, 512, 760);
    g.addColorStop(0, rgba(PAL.ink, 0));
    g.addColorStop(1, rgba(PAL.ink, 0.2));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
  }

  function disc(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function ringStroke(x, y, r, w, col) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
  }

  // The delivery target: the game's coral doormat inside its cream ring, plus one
  // sun-yellow "perfect" pulse. Small and opaque, so it reads without competing.
  function target(m) {
    ctx.save();
    // Sun pulse, outermost.
    // (Near-opaque: at 0.6 the yellow mixes with the teal into khaki.)
    ringStroke(m.x, m.y, m.pulse, 8, rgba(PAL.sun, 0.92));
    // Lit pad inside the ring.
    ctx.fillStyle = shade(PAL.teal, 0.3);
    disc(m.x, m.y, m.ring);
    // Cream ring with a chunky ink outline.
    ringStroke(m.x, m.y, m.ring, 13 + 18, PAL.ink);
    ringStroke(m.x, m.y, m.ring, 13, PAL.cream);
    // Doormat, as drawn on the game's lots (darker coral border, cream stripes).
    const w = 90, h = 56;
    ctx.translate(m.x, m.y);
    ctx.fillStyle = PAL.ink;
    roundRect(ctx, -w / 2 - 7, -h / 2 - 7, w + 14, h + 14, 14); ctx.fill();
    ctx.fillStyle = shade(PAL.coral, -0.25);
    roundRect(ctx, -w / 2, -h / 2, w, h, 9); ctx.fill();
    ctx.fillStyle = PAL.coral;
    roundRect(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 6); ctx.fill();
    ctx.fillStyle = rgba(PAL.cream, 0.9);
    roundRect(ctx, -w / 2 + 14, -11, w - 28, 7, 3); ctx.fill();
    roundRect(ctx, -w / 2 + 14, 4, w - 28, 7, 3); ctx.fill();
    ctx.restore();
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

  function vanShadow() {
    // Airborne shadow, well offset below-right so the van pops off the ground.
    ctx.save();
    vanFrame(46, 66);
    ctx.translate(-27, -14);
    ctx.filter = `blur(${14 * U}px)`;
    ctx.fillStyle = rgba(PAL.ink, 0.5);
    vanSilhouette(1.5);
    ctx.filter = 'none';
    ctx.restore();
  }

  function van() {
    ctx.save();
    vanFrame();
    ctx.save();
    ctx.translate(-27, -14);
    ctx.fillStyle = PAL.ink;
    vanSilhouette(2.4);
    ctx.restore();
    paintVan(ctx, 'classic', 0, 0, 1, 0);
    // Parcels riding in the cargo bed (one slot empty: it just flew out).
    const slots = [[0, -5, 'normal'], [0, 5, 'normal'], [-7, -5, 'fragile'], [-7, 5, 'normal'],
      [-14, -5, 'normal'], [-14, 5, 'fragile'], [-21, 5, 'normal']];
    for (const [x, y, k] of slots) paintParcel(ctx, x, y, 6, 10, k);
    // Glossy highlight along the roof.
    ctx.fillStyle = rgba('#ffffff', 0.22);
    roundRect(ctx, 7, -11.5, 15, 3, 1.5); ctx.fill();
    ctx.restore();
  }

  // Two dark rubber arcs swinging in behind the rear wheels (drawn on the ground).
  function skids() {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.3 * L.vs;
    for (const wy of [-12.5, 12.5]) {
      const [wx0, wy0] = toScreen(-16, wy);
      const { end, bend } = L.skid;
      const [cx, cy] = toScreen((end - 16) * 0.6, wy + bend * 0.08 * L.side);
      const [ex, ey] = toScreen(end, wy + bend * L.side);
      const g = ctx.createLinearGradient(ex, ey, wx0, wy0);
      g.addColorStop(0, rgba(PAL.ink, 0));
      g.addColorStop(0.4, rgba(PAL.ink, 0.3));
      g.addColorStop(1, rgba(PAL.ink, 0.35));
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.quadraticCurveTo(cx, cy, wx0, wy0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function speedLines() {
    ctx.save();
    ctx.lineCap = 'round';
    for (const pass of [0, 1]) {
      for (const [ly, x0, x1, w] of L.lines) {
        const [ax, ay] = toScreen(x0, ly * L.side);
        const [bx, by] = toScreen(x1, ly * L.side);
        ctx.strokeStyle = pass ? PAL.cream : PAL.ink;
        ctx.lineWidth = (w + (pass ? 0 : 1.4)) * L.vs;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // A few small grey tyre-smoke puffs at the rear wheels.
  function smoke() {
    const rng = mulberry32(7);
    const puffs = [[-28, 10, 3.1], [-30.5, 13.6, 2.5], [-32.2, 7.6, 2.0], [-35, 11.6, 1.5]];
    for (const p of puffs) p[1] += (rng() - 0.5) * 0.6;
    const pts = puffs.map(([x, y, r]) => [...toScreen(x, y * L.side), r * L.vs]);
    const rim = 0.8 * L.vs;
    for (const [x, y, r] of pts) { ctx.fillStyle = PAL.ink; disc(x, y, r + rim); }
    for (const [x, y, r] of pts) { ctx.fillStyle = shade(PAL.cream, -0.2); disc(x, y, r); }
    for (const [x, y, r] of pts) { ctx.fillStyle = shade(PAL.cream, -0.06); disc(x - r * 0.18, y - r * 0.2, r * 0.68); }
  }

  function flyingParcel() {
    // Thrown out of the van's left side toward the doorstep; the game draws
    // airborne parcels raised and enlarged.
    const [px, py, w, rot] = L.parcel;
    const h = w * 0.84;
    // Speed streaks trailing back toward the van's left flank (perpendicular to
    // its heading): the parcel is moving along -n, away from the van.
    const dx = Math.cos(L.ang), dy = Math.sin(L.ang), nx = -dy, ny = dx;
    ctx.save();
    ctx.lineCap = 'round';
    const streaks = [[-0.3, 0.8, 1.12], [0.04, 0.84, 1.3], [0.36, 0.78, 1.0]];
    for (const pass of [0, 1]) {
      for (const [off, a, b] of streaks) {
        const x0 = px + nx * w * a + dx * w * off, y0 = py + ny * w * a + dy * w * off;
        const x1 = px + nx * w * b + dx * w * off, y1 = py + ny * w * b + dy * w * off;
        ctx.strokeStyle = pass ? PAL.cream : PAL.ink;
        ctx.lineWidth = w * (pass ? 0.085 : 0.085 + 0.1);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }
    ctx.restore();
    // Airborne drop shadow.
    ctx.save();
    ctx.filter = `blur(${w * 0.06 * U}px)`;
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
    ctx.save();
    ctx.scale(w / 14, h / 12);
    paintParcel(ctx, 0, 0, 14, 12, 'normal');
    ctx.restore();
    // Shipping label with a barcode, so it reads as a parcel, not a crate.
    const lx = w * 0.1, ly = h * 0.13, lw = w * 0.31, lh = h * 0.27;
    ctx.fillStyle = PAL.cream;
    roundRect(ctx, lx, ly, lw, lh, w * 0.03); ctx.fill();
    ctx.fillStyle = PAL.ink;
    const bars = 8, bx0 = lx + lw * 0.13, bw = lw * 0.74;
    for (let i = 0; i < bars; i++) {
      ctx.fillRect(bx0 + (i / bars) * bw, ly + lh * 0.18, i % 3 ? lw * 0.035 : lw * 0.07, lh * 0.42);
    }
    ctx.fillRect(bx0, ly + lh * 0.7, bw * 0.62, lh * 0.1);
    ctx.restore();
  }

  // A single cream sparkle for the "perfect throw".
  function sparkle(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU - Math.PI / 2;
      const d = i % 2 ? r * 0.34 : r;
      ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = PAL.ink;
    ctx.stroke();
    ctx.fillStyle = PAL.cream;
    ctx.fill();
    ctx.restore();
  }

  // The game's title logo (scenes/title.js drawLogo), settled and static,
  // including the parcel tumbling off the D.
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
    ctx.save();
    ctx.translate(sz * 2.05, -sz * 0.55);
    ctx.rotate(0.3);
    // Scale as if the logo were drawn at in-game size, so the tape keeps its weight.
    const k = sz / 70;
    ctx.scale(k, k);
    const ps = sz / k;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(-ps * 0.36, -ps * 0.31, ps * 0.72, ps * 0.62);
    paintParcel(ctx, 0, 0, ps * 0.6, ps * 0.5, 'normal');
    ctx.restore();
    ctx.restore();
  }
}
