// Store icon concept "The Perfect Throw": a big parcel mid-air, about to land on the glowing
// doormat target in front of a house, with the courier van cropped at the corner.
// Everything is drawn in a 1024 x 1024 design space and scaled to the requested size.

const K = 1024;

const CARD = { body: '#d9a066', dark: '#a8763f', deep: '#8a5d2e', tape: '#f4dfb8', tapeDark: '#e0c493' };

const LAYOUTS = {
  plain: {
    scene: { x: 0, y: 0, s: 1 },
    burst: [520, 470],
    van: { x: 150, y: 860, scale: 6.2, angle: -0.62 },
    house: { x: 655, y: 300, w: 520, d: 330, roof: 3 },
    mat: { x: 655, y: 420 },
    ring: 150,
    parcel: { x: 500, y: 430, w: 330, h: 280, rot: -0.2 },
    shadow: { x: 590, y: 470 },
    trail: [[205, 790], [170, 330], [380, 340]],
  },
  title: {
    scene: { x: 60, y: -40, s: 0.86 },
    burst: [520, 380],
    van: { x: 150, y: 860, scale: 6.2, angle: -0.62 },
    house: { x: 655, y: 300, w: 520, d: 330, roof: 3 },
    mat: { x: 655, y: 420 },
    ring: 150,
    parcel: { x: 500, y: 430, w: 330, h: 280, rot: -0.2 },
    shadow: { x: 590, y: 470 },
    trail: [[205, 790], [170, 330], [380, 340]],
  },
};

export function draw(ctx, size, { art, ui, util, variant }) {
  const { PAL } = art;
  const { shade, rgba, roundRect, TAU, mulberry32 } = util;
  const u = size / K;
  const L = LAYOUTS[variant] || LAYOUTS.plain;
  const INK = PAL.ink;

  const shadowOn = (ox, oy, blur, a = 0.32) => {
    ctx.shadowColor = rgba('#1e2033', a);
    ctx.shadowBlur = blur * u * L.scene.s;
    ctx.shadowOffsetX = ox * u * L.scene.s;
    ctx.shadowOffsetY = oy * u * L.scene.s;
  };
  const shadowOff = () => {
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  };
  const disc = (x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  };

  ctx.save();
  ctx.scale(u, u);

  // ---- Background: teal sunburst, brightest behind the action. ----
  const [bx, by] = L.burst;
  const bg = ctx.createRadialGradient(bx, by, 40, bx, by, 900);
  bg.addColorStop(0, shade(PAL.teal, 0.35));
  bg.addColorStop(0.45, PAL.teal);
  bg.addColorStop(1, shade(PAL.teal, -0.28));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, K, K);
  ctx.save();
  ctx.translate(bx, by);
  const rays = 18;
  ctx.fillStyle = rgba('#ffffff', 0.09);
  for (let i = 0; i < rays; i++) {
    const a0 = (i / rays) * TAU + 0.1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 1500, a0, a0 + TAU / rays / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(L.scene.x, L.scene.y);
  ctx.scale(L.scene.s, L.scene.s);
  scene();
  ctx.restore();

  if (variant === 'title') logo(512, 800, 150);
  ctx.restore();

  // -------------------------------------------------------------------------

  function scene() {
    house(L.house);
    target(L.mat, L.ring);
    van(L.van);
    confetti();
    trail(L.trail);
    parcel(L.parcel, L.shadow);
  }

  function house(h) {
    const roof = art.ROOFS[h.roof];
    const lit = shade(roof, 0.18), dark = shade(roof, -0.22), edge = shade(roof, -0.42);
    const x0 = h.x - h.w / 2, y1 = h.y, y0 = y1 - h.d;
    // Path from the porch to the mat.
    ctx.fillStyle = '#ece3d1';
    roundRect(ctx, h.x - 50, y1, 100, L.mat.y - y1, 8);
    ctx.fill();
    // Silhouette with outline and drop shadow.
    shadowOn(14, 20, 24);
    ctx.fillStyle = INK;
    roundRect(ctx, x0 - 12, y0 - 12, h.w + 24, h.d + 24, 30);
    ctx.fill();
    shadowOff();
    ctx.fillStyle = edge;
    roundRect(ctx, x0, y0, h.w, h.d, 18);
    ctx.fill();
    const m = 12;
    ctx.fillStyle = lit;
    ctx.fillRect(x0 + m, y0 + m, h.w - 2 * m, h.d / 2 - m);
    ctx.fillStyle = dark;
    ctx.fillRect(x0 + m, y0 + h.d / 2, h.w - 2 * m, h.d / 2 - m);
    ctx.fillStyle = rgba(INK, 0.12);
    for (let y = y0 + 44; y < y1 - 20; y += 34) if (Math.abs(y - (y0 + h.d / 2)) > 14) ctx.fillRect(x0 + m, y, h.w - 2 * m, 6);
    ctx.fillStyle = shade(roof, 0.45);
    ctx.fillRect(x0 + m, y0 + h.d / 2 - 9, h.w - 2 * m, 18);
    // Chimney.
    const cx = x0 + h.w * 0.72, cy = y0 + 40;
    ctx.fillStyle = INK;
    roundRect(ctx, cx - 8, cy - 8, 86, 80, 16);
    ctx.fill();
    ctx.fillStyle = '#b8574f';
    roundRect(ctx, cx, cy, 70, 64, 10);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillRect(cx + 14, cy + 14, 42, 36);
    // Porch canopy over the front door.
    const pw = 150, ph = 54;
    ctx.fillStyle = INK;
    roundRect(ctx, h.x - pw / 2 - 9, y1 - 26 - 9, pw + 18, ph + 18, 18);
    ctx.fill();
    ctx.fillStyle = PAL.cream;
    roundRect(ctx, h.x - pw / 2, y1 - 26, pw, ph, 10);
    ctx.fill();
    ctx.fillStyle = shade(roof, -0.1);
    for (let i = 0; i < 4; i++) ctx.fillRect(h.x - pw / 2 + i * (pw / 4) + 8, y1 - 26, pw / 8, ph);
  }

  function target(m, r) {
    // Soft coral glow.
    const g = ctx.createRadialGradient(m.x, m.y, r * 0.2, m.x, m.y, r * 1.7);
    g.addColorStop(0, rgba(PAL.coral, 0.75));
    g.addColorStop(0.55, rgba(PAL.coral, 0.35));
    g.addColorStop(1, rgba(PAL.coral, 0));
    ctx.fillStyle = g;
    disc(m.x, m.y, r * 1.7);
    // Perfect pulse rings.
    ctx.lineWidth = 12;
    ctx.strokeStyle = rgba(PAL.sun, 0.95);
    ctx.beginPath();
    ctx.arc(m.x, m.y, r * 1.32, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.strokeStyle = rgba('#ffffff', 0.55);
    ctx.beginPath();
    ctx.arc(m.x, m.y, r * 1.58, 0, TAU);
    ctx.stroke();
    // Target disc.
    ctx.fillStyle = rgba(PAL.coral, 0.55);
    disc(m.x, m.y, r);
    ctx.lineWidth = 30;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 16;
    ctx.strokeStyle = PAL.cream;
    ctx.stroke();
    // Doormat.
    const w = 190, h = 78;
    ctx.fillStyle = INK;
    roundRect(ctx, m.x - w / 2 - 9, m.y - h / 2 - 9, w + 18, h + 18, 20);
    ctx.fill();
    ctx.fillStyle = shade(PAL.coral, -0.25);
    roundRect(ctx, m.x - w / 2, m.y - h / 2, w, h, 14);
    ctx.fill();
    ctx.fillStyle = PAL.coral;
    roundRect(ctx, m.x - w / 2 + 8, m.y - h / 2 + 8, w - 16, h - 16, 10);
    ctx.fill();
    ctx.fillStyle = rgba(PAL.cream, 0.9);
    roundRect(ctx, m.x - w / 2 + 22, m.y - 15, w - 44, 9, 4);
    ctx.fill();
    roundRect(ctx, m.x - w / 2 + 22, m.y + 6, w - 44, 9, 4);
    ctx.fill();
  }

  function van(v) {
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    ctx.scale(v.scale, v.scale);
    const o = 2.2;
    shadowOn(14, 20, 24);
    ctx.fillStyle = INK;
    roundRect(ctx, -27 - o, -14 - o, 54 + 2 * o, 28 + 2 * o, 7 + o);
    ctx.fill();
    shadowOff();
    for (const wx of [54 * 0.2, 54 * 0.74]) {
      roundRect(ctx, -27 + wx - 6 - o, -14 - 2 - o, 12 + 2 * o, 6 + o, 3);
      ctx.fill();
      roundRect(ctx, -27 + wx - 6 - o, 14 - 4, 12 + 2 * o, 6 + o, 3);
      ctx.fill();
    }
    ctx.restore();
    art.paintVan(ctx, 'classic', v.x, v.y, v.scale, v.angle);
    // Parcels still riding in the cargo bed.
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    ctx.scale(v.scale, v.scale);
    const slots = [[-7, -5], [-7, 5], [-14, -5], [-21, 5], [-21, -5]];
    const kinds = ['express', 'normal', 'normal', 'fragile', 'normal'];
    slots.forEach(([sx, sy], i) => art.paintParcel(ctx, sx, sy, 6, 10, kinds[i]));
    ctx.restore();
  }

  function trail(pts) {
    const [[x0, y0], [cx, cy], [x1, y1]] = pts;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.setLineDash([2, 44]);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
    };
    path();
    ctx.lineWidth = 34;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.lineWidth = 18;
    ctx.strokeStyle = PAL.cream;
    ctx.stroke();
    ctx.restore();
  }

  function parcel(p, sh) {
    // Ground shadow on the doormat: it is about to land right there.
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = rgba('#1e2033', 0.28);
    shadowOn(0, 0, 30, 0.4);
    roundRect(ctx, -p.w * 0.4, -p.h * 0.4, p.w * 0.8, p.h * 0.8, 30);
    ctx.fill();
    shadowOff();
    ctx.restore();

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    const w = p.w, h = p.h, depth = 34, o = 14, r = 22;
    shadowOn(16, 24, 30, 0.35);
    ctx.fillStyle = INK;
    roundRect(ctx, -w / 2 - o, -h / 2 - o, w + 2 * o, h + depth + 2 * o, r + o);
    ctx.fill();
    shadowOff();
    // Side face.
    ctx.fillStyle = CARD.deep;
    roundRect(ctx, -w / 2, -h / 2 + depth, w, h, r);
    ctx.fill();
    ctx.fillStyle = CARD.dark;
    roundRect(ctx, -w / 2, -h / 2 + depth * 0.6, w, h, r);
    ctx.fill();
    // Top face.
    ctx.fillStyle = shade(CARD.body, -0.1);
    roundRect(ctx, -w / 2, -h / 2, w, h, r);
    ctx.fill();
    ctx.fillStyle = CARD.body;
    roundRect(ctx, -w / 2 + 10, -h / 2 + 10, w - 20, h - 20, r - 6);
    ctx.fill();
    // Highlight along the top-left.
    ctx.fillStyle = rgba('#ffffff', 0.22);
    roundRect(ctx, -w / 2 + 18, -h / 2 + 14, w - 50, 10, 5);
    ctx.fill();
    // Tape cross.
    const t = w * 0.15;
    ctx.fillStyle = CARD.tapeDark;
    ctx.fillRect(-t / 2 - 3, -h / 2 + 6, t + 6, h - 12);
    ctx.fillRect(-w / 2 + 6, -t / 2 - 3, w - 12, t + 6);
    ctx.fillStyle = CARD.tape;
    ctx.fillRect(-t / 2, -h / 2 + 6, t, h - 12);
    ctx.fillRect(-w / 2 + 6, -t / 2, w - 12, t);
    ctx.fillStyle = rgba('#ffffff', 0.35);
    ctx.fillRect(-t / 2 + 6, -h / 2 + 6, 6, h - 12);
    // Shipping label.
    const lx = w * 0.12, ly = h * 0.14, lw = w * 0.28, lh = h * 0.24;
    ctx.fillStyle = PAL.cream;
    roundRect(ctx, lx, ly, lw, lh, 6);
    ctx.fill();
    ctx.fillStyle = INK;
    for (let i = 0; i < 9; i++) ctx.fillRect(lx + 10 + i * (lw - 20) / 9, ly + 10, i % 3 ? 4 : 7, lh * 0.45);
    ctx.fillRect(lx + 10, ly + lh * 0.68, lw * 0.6, 5);
    ctx.restore();
  }

  function confetti() {
    const rng = mulberry32(4242);
    const cols = [PAL.coral, PAL.sun, PAL.plum, PAL.cream, PAL.green, PAL.sun];
    const m = L.mat, r = L.ring;
    for (let i = 0; i < 46; i++) {
      const a = rng() * TAU;
      const d = r * (1.05 + rng() * 1.5);
      const x = m.x + Math.cos(a) * d, y = m.y + Math.sin(a) * d * 0.9;
      if (Math.hypot(x - L.parcel.x, y - L.parcel.y) < 210) continue;
      const len = 22 + rng() * 14, wid = 12 + rng() * 5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng() * TAU);
      ctx.fillStyle = INK;
      roundRect(ctx, -len / 2 - 4, -wid / 2 - 4, len + 8, wid + 8, 6);
      ctx.fill();
      ctx.fillStyle = cols[i % cols.length];
      roundRect(ctx, -len / 2, -wid / 2, len, wid, 3);
      ctx.fill();
      ctx.restore();
    }
    // Sparkles.
    for (const [sx, sy, ss] of [[860, 640, 34], [420, 160, 28], [880, 200, 24]]) star(sx, sy, ss);
  }

  function star(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    const pts = (k) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - Math.PI / 2;
        const d = i % 2 ? s * 0.32 * k : s * k;
        ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
      }
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    pts(1);
    ctx.lineWidth = 10;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = PAL.cream;
    ctx.fill();
    ctx.restore();
  }

  function logo(cx, cy, size) {
    const words = [['PARCEL', PAL.cream, -0.05], ['DASH', PAL.sun, 0.04]];
    const lineGap = size * 0.98;
    words.forEach(([word, color, tilt], wi) => {
      const s = wi === 1 ? size * 1.22 : size;
      const total = ui.measure(ctx, word, s) + (word.length - 1) * s * 0.02;
      let x = cx - total / 2;
      const y = cy + (wi === 0 ? -lineGap / 2 : lineGap / 2) + (wi === 1 ? s * 0.06 : 0);
      for (const ch of word) {
        const cw = ui.measure(ctx, ch, s);
        ctx.save();
        ctx.translate(x + cw / 2, y);
        ctx.rotate(tilt);
        ui.text(ctx, ch, 0, 0, s, { color, sw: s * 0.22 });
        ctx.restore();
        x += cw + s * 0.02;
      }
    });
  }
}
