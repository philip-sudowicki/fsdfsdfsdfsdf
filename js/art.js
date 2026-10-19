// Every sprite and ground tile is drawn in code and cached on offscreen canvases.
import { CONFIG } from './config.js';
import { TL, DIRS, POND, DEPOT } from './world.js';
import { mulberry32, shade, mix, rgba, roundRect, makeCanvas, TAU, FONT, hashStr } from './util.js';

const T = CONFIG.tile;

// Core palette: ink, cream, coral, sun, green, teal, plum, slate.
export const PAL = {
  ink: '#2d3047',
  cream: '#fff4e0',
  coral: '#f2665e',
  sun: '#ffc845',
  green: '#7cc95f',
  teal: '#43c0d8',
  plum: '#8e7dbe',
  slate: '#5d6274',
};

const C = {
  lawnA: '#94d46f', lawnB: '#89cb66', grassDot: '#7fbf5c', grassHi: '#a6de82',
  garden: '#86c864', gardenB: '#7ec05e',
  park: '#97d873', woods: '#6bb55a', woodsDark: '#5aa24d',
  asphalt: '#5d6274', asphaltLight: '#686d80', asphaltDark: '#52576a',
  walk: '#ece3d1', walkJoint: '#dacfb9', kerb: '#d3c7af', kerbDark: '#ad9f86',
  gravel: '#ecd5a6', gravelDark: '#d6b985', gravelLight: '#f6e5c2',
  cobble: '#c6b49d', cobbleLight: '#d9cab4', cobbleJoint: '#a3917b',
  hedge: '#4f9e5c', hedgeLight: '#66b46f', hedgeDark: '#3d8450',
  water: '#43c0d8', waterDeep: '#2a9cba', waterLight: '#8ddcea',
  card: '#d9a066', cardDark: '#a8763f', cardTape: '#f4dfb8',
  shadowSolid: 'rgb(30,32,51)',
  bakedShadow: 'rgba(30,32,51,0.3)',
};

export const ROOFS = ['#f2665e', '#ffc845', '#43c0d8', '#8e7dbe', '#9aa0b4', '#6cc08b'];
export const CAR_COLORS = ['#43c0d8', '#8e7dbe', '#ffc845', '#fff4e0', '#6cc08b', '#7c8aa8'];

export const SKIN_ART = {
  classic: { body: '#f2665e', accent: '#ffc845', trim: '#fff4e0' },
  mint: { body: '#5cc8a8', accent: '#fff4e0', trim: '#2d3047' },
  sunny: { body: '#ffc845', accent: '#2d3047', trim: '#fff4e0' },
  grape: { body: '#8e7dbe', accent: '#fff4e0', trim: '#ffc845' },
  night: { body: '#33395a', accent: '#43c0d8', trim: '#ffc845', stars: true },
  gold: { body: '#f2bf3a', accent: '#fff4e0', trim: '#c98f1c', shine: true },
};

export const PARCEL_COLORS = {
  normal: { body: C.card, dark: C.cardDark, tape: C.cardTape },
  express: { body: '#f2665e', dark: '#b8424b', tape: '#ffc845' },
  fragile: { body: '#8e7dbe', dark: '#62559a', tape: '#fff4e0' },
};

function lotAngle(facing) {
  const [dx, dy] = DIRS[facing];
  return Math.atan2(dy, dx) - Math.PI / 2;
}

function speckle(ctx, rng, n, colors, x0 = 0, y0 = 0, w = T, h = T, s0 = 1.2, s1 = 2.6) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[i % colors.length];
    const s = s0 + rng() * (s1 - s0);
    ctx.fillRect(x0 + rng() * w, y0 + rng() * h, s, s);
  }
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function setShadow(ctx, S, ox = 3, oy = 4, blur = 4, color = C.bakedShadow) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * S;
  ctx.shadowOffsetX = ox * S;
  ctx.shadowOffsetY = oy * S;
}

function clearShadow(ctx) {
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

// ---------------------------------------------------------------------------
// Ground tiles
// ---------------------------------------------------------------------------

function sidewalks(ctx, side, diag, skip = -1) {
  const B = 16;
  const bands = [[T - B, 0, B, T], [0, T - B, T, B], [0, 0, B, T], [0, 0, T, B]];
  for (let d = 0; d < 4; d++) {
    if (!(side & (1 << d)) || d === skip) continue;
    const [x, y, w, h] = bands[d];
    ctx.fillStyle = C.walk;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.walkJoint;
    if (d === 0 || d === 2) for (let j = 0; j <= T; j += 16) ctx.fillRect(x, j - 0.5, w, 1);
    else for (let j = 0; j <= T; j += 16) ctx.fillRect(j - 0.5, y, 1, h);
  }
  const sq = [[T - B, T - B], [0, T - B], [0, 0], [T - B, 0]];
  for (let d = 0; d < 4; d++) {
    if (!(diag & (1 << d))) continue;
    ctx.fillStyle = C.walk;
    ctx.fillRect(sq[d][0], sq[d][1], B, B);
  }
  for (let d = 0; d < 4; d++) {
    if (!(side & (1 << d)) || d === skip) continue;
    ctx.fillStyle = C.kerb;
    if (d === 0) ctx.fillRect(T - 4, 0, 4, T);
    if (d === 1) ctx.fillRect(0, T - 4, T, 4);
    if (d === 2) ctx.fillRect(0, 0, 4, T);
    if (d === 3) ctx.fillRect(0, 0, T, 4);
    ctx.fillStyle = C.kerbDark;
    if (d === 0) ctx.fillRect(T - 4.5, 0, 1, T);
    if (d === 1) ctx.fillRect(0, T - 4.5, T, 1);
    if (d === 2) ctx.fillRect(3.5, 0, 1, T);
    if (d === 3) ctx.fillRect(0, 3.5, T, 1);
  }
}

function drawRoad(ctx, info, rng) {
  ctx.fillStyle = C.asphalt;
  ctx.fillRect(0, 0, T, T);
  speckle(ctx, rng, 150, [C.asphaltLight, C.asphaltDark], 0, 0, T, T, 1, 2.4);
  const m = info.mask;
  ctx.fillStyle = C.asphaltDark;
  if (!(m & 1)) ctx.fillRect(T - 5, 0, 5, T);
  if (!(m & 2)) ctx.fillRect(0, T - 5, T, 5);
  if (!(m & 4)) ctx.fillRect(0, 0, 5, T);
  if (!(m & 8)) ctx.fillRect(0, 0, T, 5);
  ctx.fillStyle = rgba(PAL.cream, 0.92);
  ctx.strokeStyle = rgba(PAL.cream, 0.92);
  const H = (m & 5) === 5, V = (m & 10) === 10;
  if (info.cross) {
    for (let d = 0; d < 4; d++) {
      if (!(m & (1 << d))) continue;
      for (let s = 12; s < T - 16; s += 13) {
        if (d === 0) roundRect(ctx, T - 26, s, 20, 7, 1.5);
        if (d === 2) roundRect(ctx, 6, s, 20, 7, 1.5);
        if (d === 1) roundRect(ctx, s, T - 26, 7, 20, 1.5);
        if (d === 3) roundRect(ctx, s, 6, 7, 20, 1.5);
        ctx.fill();
      }
    }
  } else if (H && !V) {
    for (let x = 6; x < T; x += 32) { roundRect(ctx, x, 62, 20, 4, 2); ctx.fill(); }
  } else if (V && !H) {
    for (let y = 6; y < T; y += 32) { roundRect(ctx, 62, y, 4, 20, 2); ctx.fill(); }
  } else {
    const corners = { 3: [T, T, Math.PI, 1.5 * Math.PI], 6: [0, T, 1.5 * Math.PI, TAU], 12: [0, 0, 0, 0.5 * Math.PI], 9: [T, 0, 0.5 * Math.PI, Math.PI] };
    const c = corners[m];
    if (c) {
      ctx.lineWidth = 4;
      ctx.setLineDash([18, 14]);
      ctx.beginPath();
      ctx.arc(c[0], c[1], 64, c[2], c[3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function lawn(ctx, rng, a = C.lawnA, b = C.lawnB) {
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    ctx.fillRect(i * 16, 0, 16, T);
  }
  speckle(ctx, rng, 40, [C.grassDot, C.grassHi], 0, 0, T, T, 1, 2.2);
}

function flowers(ctx, rng, x, y, w, h, n) {
  const cols = [PAL.coral, PAL.sun, PAL.cream, PAL.plum];
  for (let i = 0; i < n; i++) {
    const fx = x + rng() * w, fy = y + rng() * h;
    ctx.fillStyle = C.hedgeDark;
    circle(ctx, fx + 0.6, fy + 0.8, 2.2);
    ctx.fillStyle = cols[Math.floor(rng() * cols.length)];
    circle(ctx, fx, fy, 1.9);
  }
}

function hedgeShape(ctx, S, x, y, w, h, rng) {
  setShadow(ctx, S, 3, 4, 4);
  ctx.fillStyle = C.hedge;
  roundRect(ctx, x, y, w, h, Math.min(w, h) / 2);
  ctx.fill();
  clearShadow(ctx);
  const along = h > w;
  const len = along ? h : w;
  for (let i = 4; i < len - 2; i += 6) {
    const bx = along ? x + w / 2 : x + i, by = along ? y + i : y + h / 2;
    ctx.fillStyle = C.hedgeLight;
    circle(ctx, bx - 1.2, by - 1.2, Math.min(w, h) * 0.32);
    ctx.fillStyle = C.hedgeDark;
    circle(ctx, bx + 1.5 + rng(), by + 1.5, 1);
  }
}

function bushShape(ctx, S, x, y, r, rng) {
  setShadow(ctx, S, 3, 4, 4);
  ctx.fillStyle = C.hedge;
  circle(ctx, x, y, r);
  clearShadow(ctx);
  ctx.fillStyle = C.hedgeLight;
  circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.55);
  ctx.fillStyle = C.hedgeDark;
  for (let i = 0; i < 4; i++) circle(ctx, x + (rng() - 0.3) * r, y + (rng() - 0.3) * r, 1.2);
}

function fenceShape(ctx, S, x, y0, y1) {
  setShadow(ctx, S, 2, 3, 3);
  ctx.fillStyle = PAL.cream;
  ctx.fillRect(x + 1, y0, 2, y1 - y0);
  for (let y = y0; y < y1; y += 6) {
    roundRect(ctx, x - 0.5, y, 5, 3.5, 1);
    ctx.fill();
  }
  clearShadow(ctx);
}

function gardenPond(ctx, S, x, y, rx, ry, rng) {
  ctx.fillStyle = '#cbbfa8';
  ctx.beginPath();
  ctx.ellipse(x, y, rx + 3, ry + 3, 0, 0, TAU);
  ctx.fill();
  for (let a = 0; a < TAU; a += 0.6) {
    ctx.fillStyle = a % 1.2 < 0.6 ? '#ddd2bc' : '#b9ac94';
    circle(ctx, x + Math.cos(a) * (rx + 2.5), y + Math.sin(a) * (ry + 2.5), 2.2);
  }
  ctx.fillStyle = C.waterDeep;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.water;
  ctx.beginPath();
  ctx.ellipse(x - 1.5, y - 1, rx - 2.5, ry - 2.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.waterLight;
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.35, y - ry * 0.35, rx * 0.3, ry * 0.18, -0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PAL.green;
  circle(ctx, x + rx * 0.35, y + ry * 0.2, 3);
}

function drawLot(ctx, info, rng, S) {
  const s = info.lotStyle;
  const ang = lotAngle(info.facing);
  ctx.save();
  ctx.translate(T / 2, T / 2);
  ctx.rotate(ang);
  ctx.translate(-T / 2, -T / 2);
  lawn(ctx, rng);
  // Flower beds hugging the front wall.
  ctx.fillStyle = '#b98a5e';
  roundRect(ctx, 22, 66, 30, 7, 3); ctx.fill();
  roundRect(ctx, 76, 66, 30, 7, 3); ctx.fill();
  flowers(ctx, rng, 24, 67, 26, 5, 7);
  flowers(ctx, rng, 78, 67, 26, 5, 7);
  // Paved path to the pavement.
  ctx.fillStyle = C.walk;
  ctx.fillRect(56, 66, 16, 48);
  ctx.fillStyle = C.walkJoint;
  for (let y = 70; y < 114; y += 8) ctx.fillRect(56, y, 16, 1);
  ctx.fillRect(63.5, 66, 1, 48);
  // Doormat.
  ctx.fillStyle = shade(PAL.coral, -0.25);
  roundRect(ctx, 49.5, 70.5, 29, 13, 2.5); ctx.fill();
  ctx.fillStyle = PAL.coral;
  roundRect(ctx, 51, 72, 26, 10, 2); ctx.fill();
  ctx.fillStyle = rgba(PAL.cream, 0.85);
  ctx.fillRect(54, 75, 20, 1.4);
  ctx.fillRect(54, 78.5, 20, 1.4);
  if (s.yard === 'flowers') {
    flowers(ctx, rng, 20, 86, 26, 18, 12);
    flowers(ctx, rng, 84, 86, 26, 18, 12);
  }
  if (s.hedgeL) hedgeShape(ctx, S, 3, 72, 9, 38, rng);
  if (s.hedgeR) hedgeShape(ctx, S, 116, 72, 9, 38, rng);
  if (s.fenceL) fenceShape(ctx, S, 4, 72, 110);
  if (s.fenceR) fenceShape(ctx, S, 120, 72, 110);
  if (s.pondR) gardenPond(ctx, S, 98, 92, 15, 10, rng);
  if (s.bushR) bushShape(ctx, S, 102, 90, 11, rng);
  ctx.restore();
  sidewalks(ctx, info.side, info.diag);
}

function drawGarden(ctx, info, rng, S) {
  lawn(ctx, rng, C.garden, C.gardenB);
  const f = info.feature;
  if (f === 'pool') {
    setShadow(ctx, S, 2, 3, 3);
    ctx.fillStyle = PAL.cream;
    roundRect(ctx, 24, 34, 80, 60, 10); ctx.fill();
    clearShadow(ctx);
    const g = ctx.createLinearGradient(0, 40, 0, 88);
    g.addColorStop(0, '#7fdcee');
    g.addColorStop(1, '#36b1d0');
    ctx.fillStyle = g;
    roundRect(ctx, 30, 40, 68, 48, 7); ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', 0.5);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(38 + i * 18, 52 + i * 9);
      ctx.quadraticCurveTo(44 + i * 18, 48 + i * 9, 50 + i * 18, 52 + i * 9);
      ctx.stroke();
    }
    ctx.fillStyle = PAL.coral;
    circle(ctx, 80, 72, 5);
    ctx.fillStyle = PAL.cream;
    circle(ctx, 80, 72, 2.4);
  } else if (f === 'veg') {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#a77a52';
      roundRect(ctx, 18, 46 + i * 22, 74, 13, 4); ctx.fill();
      for (let x = 24; x < 90; x += 9) {
        ctx.fillStyle = i === 1 ? PAL.coral : PAL.green;
        circle(ctx, x, 52.5 + i * 22, 3);
      }
    }
  } else if (f === 'tramp') {
    setShadow(ctx, S, 3, 4, 5);
    ctx.fillStyle = PAL.plum;
    circle(ctx, 64, 64, 30);
    clearShadow(ctx);
    ctx.fillStyle = '#3f4f86';
    circle(ctx, 64, 64, 24);
    ctx.fillStyle = '#5266a6';
    circle(ctx, 60, 60, 16);
    ctx.strokeStyle = rgba(PAL.cream, 0.35);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(52, 64); ctx.lineTo(76, 64);
    ctx.moveTo(64, 52); ctx.lineTo(64, 76);
    ctx.stroke();
    ctx.strokeStyle = shade(PAL.plum, 0.3);
    ctx.lineWidth = 1;
    for (let a = 0; a < TAU; a += TAU / 16) {
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(a) * 24, 64 + Math.sin(a) * 24);
      ctx.lineTo(64 + Math.cos(a) * 29, 64 + Math.sin(a) * 29);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = C.walk;
    for (let i = 0; i < 4; i++) circle(ctx, 30 + i * 16, 100 - i * 6, 5);
  }
  sidewalks(ctx, info.side, info.diag);
}

function drawPark(ctx, info, rng) {
  ctx.fillStyle = C.park;
  ctx.fillRect(0, 0, T, T);
  speckle(ctx, rng, 50, [C.grassDot, C.grassHi], 0, 0, T, T, 1, 2.4);
  if (info.variant === 0) flowers(ctx, rng, 20 + rng() * 50, 20 + rng() * 50, 30, 30, 14);
  if (info.variant === 1) {
    ctx.fillStyle = '#c9bea9';
    for (let i = 0; i < 3; i++) circle(ctx, 30 + rng() * 70, 30 + rng() * 70, 2 + rng() * 2);
  }
  sidewalks(ctx, info.side, info.diag);
}

function armShape(ctx, mask, width, c = T / 2) {
  const h = width / 2;
  ctx.beginPath();
  ctx.arc(c, c, h, 0, TAU);
  ctx.rect(c - h, c - h, width, width);
  if (mask & 1) ctx.rect(c, c - h, T - c, width);
  if (mask & 2) ctx.rect(c - h, c, width, T - c);
  if (mask & 4) ctx.rect(0, c - h, c, width);
  if (mask & 8) ctx.rect(c - h, 0, width, c);
}

function drawPath(ctx, info, rng) {
  ctx.fillStyle = C.park;
  ctx.fillRect(0, 0, T, T);
  speckle(ctx, rng, 40, [C.grassDot, C.grassHi]);
  sidewalks(ctx, info.side, info.diag);
  ctx.fillStyle = C.gravelDark;
  armShape(ctx, info.mask, 76);
  ctx.fill('nonzero');
  ctx.fillStyle = C.gravel;
  armShape(ctx, info.mask, 70);
  ctx.fill('nonzero');
  ctx.save();
  armShape(ctx, info.mask, 70);
  ctx.clip('nonzero');
  speckle(ctx, rng, 120, [C.gravelDark, C.gravelLight], 0, 0, T, T, 1, 2.4);
  ctx.restore();
}

function drawAlley(ctx, info, rng) {
  ctx.fillStyle = C.garden;
  ctx.fillRect(0, 0, T, T);
  speckle(ctx, rng, 40, [C.grassDot, C.grassHi]);
  sidewalks(ctx, info.side, info.diag);
  ctx.fillStyle = C.cobbleJoint;
  armShape(ctx, info.mask, 90);
  ctx.fill('nonzero');
  ctx.save();
  armShape(ctx, info.mask, 84);
  ctx.clip('nonzero');
  ctx.fillStyle = C.cobble;
  ctx.fillRect(0, 0, T, T);
  for (let y = 0, row = 0; y < T; y += 9, row++) {
    for (let x = row % 2 ? -6 : 0; x < T; x += 12) {
      ctx.fillStyle = rng() < 0.5 ? C.cobbleLight : shade(C.cobble, 0.08);
      roundRect(ctx, x + 1, y + 1, 10, 7, 2.5);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawPond(ctx, info, rng) {
  ctx.fillStyle = C.park;
  ctx.fillRect(0, 0, T, T);
  speckle(ctx, rng, 40, [C.grassDot, C.grassHi]);
  sidewalks(ctx, info.side, info.diag);
  ctx.save();
  ctx.translate(-info.tx * T, -info.ty * T);
  const { x, y, rx, ry } = POND;
  ctx.fillStyle = C.gravel;
  ctx.beginPath();
  ctx.ellipse(x, y, rx + 12, ry + 12, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.gravelDark;
  ctx.beginPath();
  ctx.ellipse(x, y, rx + 4, ry + 4, 0, 0, TAU);
  ctx.fill();
  const g = ctx.createRadialGradient(x - rx * 0.2, y - ry * 0.3, 10, x, y, rx);
  g.addColorStop(0, '#6fd3e6');
  g.addColorStop(0.7, C.water);
  g.addColorStop(1, C.waterDeep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.35);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, rx - 10, ry - 10, 0, Math.PI * 1.05, Math.PI * 1.45);
  ctx.stroke();
  // Lily pads and reeds at fixed spots so tiles line up.
  const r2 = mulberry32(77);
  for (let i = 0; i < 14; i++) {
    const a = r2() * TAU, d = 0.45 + r2() * 0.45;
    const px = x + Math.cos(a) * rx * d, py = y + Math.sin(a) * ry * d;
    ctx.fillStyle = '#5bb764';
    ctx.beginPath();
    ctx.arc(px, py, 6 + r2() * 4, a, a + TAU - 0.7);
    ctx.lineTo(px, py);
    ctx.fill();
    if (r2() < 0.35) {
      ctx.fillStyle = PAL.cream;
      circle(ctx, px + 2, py - 2, 2.2);
    }
  }
  for (let i = 0; i < 40; i++) {
    const a = r2() * TAU;
    const px = x + Math.cos(a) * (rx + 2), py = y + Math.sin(a) * (ry + 2);
    ctx.strokeStyle = r2() < 0.5 ? '#3f8a4f' : '#5aa45c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + (r2() - 0.5) * 8, py - 6 - r2() * 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWoods(ctx, info, rng, S) {
  ctx.fillStyle = C.woods;
  ctx.fillRect(0, 0, T, T);
  speckle(ctx, rng, 60, [C.woodsDark, C.grassDot]);
  for (let i = 0; i < 4; i++) bushShape(ctx, S, 16 + rng() * 96, 16 + rng() * 96, 8 + rng() * 6, rng);
  sidewalks(ctx, info.side, info.diag);
}

function drawYard(ctx, info, rng) {
  ctx.fillStyle = '#62677a';
  ctx.fillRect(0, 0, T, T);
  speckle(ctx, rng, 140, [C.asphaltLight, C.asphaltDark], 0, 0, T, T, 1, 2.4);
  ctx.save();
  ctx.translate(-info.tx * T, -info.ty * T);
  const z = DEPOT.zone;
  ctx.fillStyle = rgba(PAL.sun, 0.18);
  ctx.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
  ctx.strokeStyle = PAL.sun;
  ctx.lineWidth = 5;
  ctx.setLineDash([16, 10]);
  ctx.strokeRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
  ctx.setLineDash([]);
  ctx.fillStyle = rgba(PAL.sun, 0.9);
  ctx.font = `44px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LOADING', (z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2 + 22);
  for (let i = 0; i < 3; i++) {
    const cx = z.x0 + 50 + i * ((z.x1 - z.x0 - 100) / 2), cy = z.y0 + 22;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy + 8);
    ctx.lineTo(cx, cy - 6);
    ctx.lineTo(cx + 14, cy + 8);
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  ctx.strokeStyle = PAL.cream;
  ctx.lineWidth = 3;
  for (const bx of [2 * T + 34, 6 * T + 34]) {
    ctx.strokeRect(bx, 10 * T + 22, 60, 120);
  }
  ctx.restore();
}

function drawDepotTile(ctx, info, rng) {
  ctx.fillStyle = '#62677a';
  ctx.fillRect(0, 0, T, T);
  speckle(ctx, rng, 100, [C.asphaltLight, C.asphaltDark]);
  sidewalks(ctx, info.side, info.diag);
}

function drawParking(ctx, info, rng) {
  ctx.fillStyle = C.asphalt;
  ctx.fillRect(0, 0, T, T);
  speckle(ctx, rng, 140, [C.asphaltLight, C.asphaltDark], 0, 0, T, T, 1, 2.4);
  ctx.save();
  ctx.translate(T / 2, T / 2);
  ctx.rotate(lotAngle(info.facing));
  ctx.translate(-T / 2, -T / 2);
  ctx.fillStyle = rgba(PAL.cream, 0.9);
  for (const x of [16, 48, 80, 112]) ctx.fillRect(x - 1.5, 22, 3, 62);
  for (const x of [32, 64, 96]) { roundRect(ctx, x - 8, 24, 16, 4, 2); ctx.fill(); }
  ctx.restore();
  sidewalks(ctx, info.side, info.diag, info.facing);
}

function renderGround(ctx, info, S) {
  const rng = mulberry32(hashStr(info.key));
  switch (info.type) {
    case TL.ROAD: drawRoad(ctx, info, rng); break;
    case TL.LOT: drawLot(ctx, info, rng, S); break;
    case TL.GARDEN: drawGarden(ctx, info, rng, S); break;
    case TL.PARK: drawPark(ctx, info, rng); break;
    case TL.PATH: drawPath(ctx, info, rng); break;
    case TL.ALLEY: drawAlley(ctx, info, rng); break;
    case TL.POND: drawPond(ctx, info, rng); break;
    case TL.WOODS: drawWoods(ctx, info, rng, S); break;
    case TL.YARD: drawYard(ctx, info, rng); break;
    case TL.DEPOT: drawDepotTile(ctx, info, rng); break;
    case TL.PARKING: drawParking(ctx, info, rng); break;
  }
}

// ---------------------------------------------------------------------------
// Object sprites
// ---------------------------------------------------------------------------

function sprite(w, h, draw, pad = 6) {
  const S = Art.S;
  const c = makeCanvas((w + pad * 2) * S, (h + pad * 2) * S);
  const ctx = c.getContext('2d');
  ctx.scale(S, S);
  ctx.translate(pad, pad);
  draw(ctx, S);
  return { c, w: w + pad * 2, h: h + pad * 2, ax: pad + w / 2, ay: pad + h / 2 };
}

function drawHouse(ctx, S, style, color, w, d, chimney, seed) {
  const rng = mulberry32(seed);
  const roof = ROOFS[color];
  const lit = shade(roof, 0.18), dark = shade(roof, -0.22), edge = shade(roof, -0.42);
  // Porch canopy at the front door.
  ctx.fillStyle = PAL.cream;
  roundRect(ctx, w / 2 - 12, d - 4, 24, 9, 2);
  ctx.fill();
  ctx.fillStyle = shade(roof, -0.1);
  for (let i = 0; i < 4; i++) ctx.fillRect(w / 2 - 12 + i * 6 + 1, d - 4, 3, 9);
  if (style === 0) {
    ctx.fillStyle = edge;
    roundRect(ctx, 0, 0, w, d, 3); ctx.fill();
    ctx.fillStyle = lit;
    ctx.fillRect(2, 2, w - 4, d / 2 - 2);
    ctx.fillStyle = dark;
    ctx.fillRect(2, d / 2, w - 4, d / 2 - 2);
    ctx.fillStyle = rgba(PAL.ink, 0.12);
    for (let y = 8; y < d - 3; y += 6) if (Math.abs(y - d / 2) > 2) ctx.fillRect(2, y, w - 4, 1.2);
    ctx.fillStyle = shade(roof, 0.45);
    ctx.fillRect(2, d / 2 - 1.5, w - 4, 3);
    const cx = chimney ? w * 0.74 : w * 0.2;
    ctx.fillStyle = '#b8574f';
    roundRect(ctx, cx, 6, 12, 11, 2); ctx.fill();
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(cx + 2.5, 8.5, 7, 6);
  } else if (style === 1) {
    ctx.fillStyle = edge;
    roundRect(ctx, 0, 0, w, d, 3); ctx.fill();
    ctx.fillStyle = roof;
    ctx.fillRect(2, 2, w - 4, d - 4);
    ctx.fillStyle = '#e6dfd1';
    ctx.fillRect(6, 6, w - 12, d - 12);
    ctx.fillStyle = rgba(PAL.ink, 0.08);
    ctx.fillRect(6, 6, w - 12, 2);
    const cols = 3, rows = 2, pw = 17, ph = 13;
    const ox = 11, oy = 10;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = ox + c * (pw + 3), py = oy + r * (ph + 3);
        ctx.fillStyle = '#2f3d6b';
        ctx.fillRect(px, py, pw, ph);
        ctx.fillStyle = '#4d63a3';
        ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
        ctx.fillStyle = rgba('#ffffff', 0.25);
        ctx.fillRect(px + 1, py + 1, pw - 2, 2);
        ctx.fillStyle = rgba(PAL.ink, 0.35);
        ctx.fillRect(px + pw / 2 - 0.5, py, 1, ph);
        ctx.fillRect(px, py + ph / 2 - 0.5, pw, 1);
      }
    }
    ctx.fillStyle = '#b9b3a6';
    roundRect(ctx, w - 26, d - 26, 16, 14, 2); ctx.fill();
    ctx.fillStyle = '#8f897d';
    circle(ctx, w - 18, d - 19, 4.5);
  } else if (style === 2) {
    ctx.fillStyle = edge;
    roundRect(ctx, 0, 0, w, d, 3); ctx.fill();
    ctx.fillStyle = roof;
    ctx.fillRect(2, 2, w - 4, d - 4);
    ctx.fillStyle = '#86c864';
    ctx.fillRect(6, 6, w - 12, d - 12);
    speckle(ctx, rng, 30, ['#79bb59', '#9bd67a'], 6, 6, w - 12, d - 12, 1, 2);
    ctx.fillStyle = '#d9a066';
    ctx.fillRect(w * 0.52, 8, w * 0.4, d * 0.45);
    ctx.fillStyle = '#c38a52';
    for (let x = w * 0.52 + 4; x < w * 0.92; x += 5) ctx.fillRect(x, 8, 1, d * 0.45);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = C.hedge;
      circle(ctx, 14 + i * 9, d - 14 - (i % 2) * 6, 5);
      ctx.fillStyle = C.hedgeLight;
      circle(ctx, 13 + i * 9, d - 15 - (i % 2) * 6, 2.5);
    }
    const ux = w * 0.72, uy = d * 0.3;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? PAL.cream : PAL.coral;
      ctx.beginPath();
      ctx.moveTo(ux, uy);
      ctx.arc(ux, uy, 10, (i * TAU) / 8, ((i + 1) * TAU) / 8);
      ctx.fill();
    }
    ctx.fillStyle = PAL.ink;
    circle(ctx, ux, uy, 1.5);
  } else {
    const inset = d * 0.42;
    ctx.fillStyle = edge;
    roundRect(ctx, 0, 0, w, d, 3); ctx.fill();
    const face = (pts, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
      ctx.fill();
    };
    const x0 = 2, y0 = 2, x1 = w - 2, y1 = d - 2;
    const rx0 = inset, rx1 = w - inset, ry = d / 2;
    face([x0, y0, x1, y0, rx1, ry, rx0, ry], lit);
    face([x0, y1, x1, y1, rx1, ry, rx0, ry], dark);
    face([x0, y0, rx0, ry, x0, y1], shade(roof, 0.05));
    face([x1, y0, rx1, ry, x1, y1], shade(roof, -0.12));
    ctx.strokeStyle = shade(roof, 0.4);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx0, ry); ctx.lineTo(rx1, ry);
    ctx.moveTo(x0, y0); ctx.lineTo(rx0, ry); ctx.lineTo(x0, y1);
    ctx.moveTo(x1, y0); ctx.lineTo(rx1, ry); ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.fillStyle = PAL.cream;
    roundRect(ctx, w * 0.3, 7, 14, 10, 2); ctx.fill();
    ctx.fillStyle = '#9fdcea';
    ctx.fillRect(w * 0.3 + 2, 9, 10, 6);
    const cx = chimney ? w * 0.68 : w * 0.56;
    ctx.fillStyle = '#b8574f';
    roundRect(ctx, cx, 8, 10, 10, 2); ctx.fill();
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(cx + 2, 10, 6, 6);
  }
  // Soft highlight along the top-left edges.
  ctx.fillStyle = rgba('#ffffff', 0.18);
  ctx.fillRect(2, 2, w - 4, 1.5);
  ctx.fillRect(2, 2, 1.5, d - 4);
}

function treeCanopy(ctx, r, kind, variant, rng) {
  if (kind === 'pine') {
    const cols = ['#3f8a55', '#4d9b5f', '#5aad68'];
    for (let layer = 0; layer < 3; layer++) {
      const rr = r * (1 - layer * 0.28);
      ctx.fillStyle = cols[layer];
      ctx.beginPath();
      const n = 9;
      for (let i = 0; i <= n * 2; i++) {
        const a = (i / (n * 2)) * TAU + layer * 0.2;
        const d = i % 2 ? rr * 0.72 : rr;
        const px = Math.cos(a) * d - layer * 1.5, py = Math.sin(a) * d - layer * 1.5;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.fill();
    }
    ctx.fillStyle = '#6dbd76';
    circle(ctx, -3, -3, r * 0.14);
    return;
  }
  let base, mid, hi;
  if (kind === 'autumn') {
    base = variant === 0 ? '#d9822f' : '#d96a4f';
    mid = variant === 0 ? '#f0a43c' : '#f2865e';
    hi = '#ffc845';
  } else if (kind === 'blossom') {
    base = '#d97a9a'; mid = '#f0a3b8'; hi = '#ffd7e0';
  } else {
    const sets = [['#3f8f55', '#56aa62', '#7cc96f'], ['#4a9a50', '#62b45e', '#8ad06b'], ['#3a8a5e', '#4fa572', '#76c48a']];
    [base, mid, hi] = sets[variant % 3];
  }
  const blobs = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + rng() * 0.4;
    blobs.push([Math.cos(a) * r * 0.48, Math.sin(a) * r * 0.48, r * (0.46 + rng() * 0.1)]);
  }
  ctx.fillStyle = base;
  for (const [x, y, rr] of blobs) circle(ctx, x, y, rr);
  circle(ctx, 0, 0, r * 0.6);
  ctx.fillStyle = mid;
  for (const [x, y, rr] of blobs) circle(ctx, x - r * 0.1, y - r * 0.12, rr * 0.78);
  ctx.fillStyle = hi;
  circle(ctx, -r * 0.28, -r * 0.3, r * 0.3);
  circle(ctx, r * 0.1, -r * 0.45, r * 0.16);
  circle(ctx, -r * 0.5, -r * 0.02, r * 0.14);
  ctx.fillStyle = rgba(PAL.ink, 0.12);
  for (let i = 0; i < 6; i++) circle(ctx, (rng() - 0.3) * r, (rng() - 0.2) * r, 1.6);
}

function drawCarBody(ctx, len, wid, col, shape) {
  const edge = shade(col, -0.38);
  // Wheels.
  ctx.fillStyle = PAL.ink;
  for (const wx of [len * 0.2, len * 0.72]) {
    roundRect(ctx, wx - 5, -1.5, 10, 5, 2); ctx.fill();
    roundRect(ctx, wx - 5, wid - 3.5, 10, 5, 2); ctx.fill();
  }
  ctx.fillStyle = edge;
  roundRect(ctx, 0, 0, len, wid, 7); ctx.fill();
  ctx.fillStyle = col;
  roundRect(ctx, 1.5, 1.5, len - 3, wid - 3, 6); ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.25);
  roundRect(ctx, 4, 3, len - 10, 3, 1.5); ctx.fill();
  const cabin0 = shape ? len * 0.3 : len * 0.24, cabin1 = shape ? len * 0.74 : len * 0.76;
  ctx.fillStyle = '#bfe9f2';
  roundRect(ctx, cabin0, 3.5, cabin1 - cabin0, wid - 7, 4); ctx.fill();
  ctx.fillStyle = shade(col, 0.12);
  roundRect(ctx, cabin0 + 5, 4.5, cabin1 - cabin0 - 12, wid - 9, 3); ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.35);
  ctx.fillRect(cabin1 - 6, 5, 2, wid - 10);
  ctx.fillStyle = PAL.cream;
  roundRect(ctx, len - 4, 2.5, 3, 5, 1.2); ctx.fill();
  roundRect(ctx, len - 4, wid - 7.5, 3, 5, 1.2); ctx.fill();
  ctx.fillStyle = '#d94452';
  roundRect(ctx, 0.8, 2.5, 2.5, 5, 1); ctx.fill();
  roundRect(ctx, 0.8, wid - 7.5, 2.5, 5, 1); ctx.fill();
  ctx.fillStyle = edge;
  roundRect(ctx, len * 0.66, -2, 4, 3, 1); ctx.fill();
  roundRect(ctx, len * 0.66, wid - 1, 4, 3, 1); ctx.fill();
}

function drawVanBody(ctx, skin, len, wid) {
  const a = SKIN_ART[skin] || SKIN_ART.classic;
  const body = a.body, edge = shade(body, -0.4);
  ctx.fillStyle = PAL.ink;
  for (const wx of [len * 0.2, len * 0.74]) {
    roundRect(ctx, wx - 6, -2, 12, 6, 2); ctx.fill();
    roundRect(ctx, wx - 6, wid - 4, 12, 6, 2); ctx.fill();
  }
  ctx.fillStyle = edge;
  roundRect(ctx, 0, 0, len, wid, 7); ctx.fill();
  ctx.fillStyle = body;
  roundRect(ctx, 1.5, 1.5, len - 3, wid - 3, 6); ctx.fill();
  if (a.shine) {
    const g = ctx.createLinearGradient(0, 0, len, wid);
    g.addColorStop(0, rgba('#ffffff', 0));
    g.addColorStop(0.45, rgba('#ffffff', 0.45));
    g.addColorStop(0.55, rgba('#ffffff', 0));
    ctx.fillStyle = g;
    roundRect(ctx, 1.5, 1.5, len - 3, wid - 3, 6); ctx.fill();
  }
  // Cargo bed.
  ctx.fillStyle = shade(body, -0.25);
  roundRect(ctx, 3, 3, 29, wid - 6, 3); ctx.fill();
  ctx.fillStyle = shade(body, -0.5);
  roundRect(ctx, 4.5, 4.5, 26, wid - 9, 2); ctx.fill();
  ctx.fillStyle = rgba('#000000', 0.12);
  for (let x = 8; x < 30; x += 5) ctx.fillRect(x, 4.5, 1, wid - 9);
  // Cab.
  ctx.fillStyle = shade(body, -0.15);
  roundRect(ctx, 33, 2.5, len - 36, wid - 5, 5); ctx.fill();
  ctx.fillStyle = shade(body, 0.14);
  roundRect(ctx, 34, 4, len - 44, wid - 8, 4); ctx.fill();
  ctx.fillStyle = a.accent;
  ctx.fillRect(37, 4, 4, wid - 8);
  if (a.stars) {
    ctx.fillStyle = a.trim;
    for (const [sx, sy] of [[44, 8], [38, 18], [46, 21]]) circle(ctx, sx, sy, 1.1);
  }
  ctx.fillStyle = '#bfe9f2';
  roundRect(ctx, len - 10, 4.5, 6, wid - 9, 2.5); ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.5);
  ctx.fillRect(len - 8.5, 6, 1.5, wid - 12);
  ctx.fillStyle = a.trim;
  roundRect(ctx, len - 3.5, 2.5, 3, 5, 1.2); ctx.fill();
  roundRect(ctx, len - 3.5, wid - 7.5, 3, 5, 1.2); ctx.fill();
  ctx.fillStyle = '#d94452';
  roundRect(ctx, 0.5, 2.5, 2.5, 6, 1); ctx.fill();
  roundRect(ctx, 0.5, wid - 8.5, 2.5, 6, 1); ctx.fill();
  ctx.fillStyle = edge;
  roundRect(ctx, len - 14, -2.5, 4, 3.5, 1); ctx.fill();
  roundRect(ctx, len - 14, wid - 1, 4, 3.5, 1); ctx.fill();
  // Side stripe.
  ctx.fillStyle = a.accent;
  ctx.fillRect(4, 1.5, len - 10, 1.6);
  ctx.fillRect(4, wid - 3.1, len - 10, 1.6);
}

function drawParcel(ctx, w, h, kind) {
  const p = PARCEL_COLORS[kind] || PARCEL_COLORS.normal;
  ctx.fillStyle = p.dark;
  roundRect(ctx, 0, 0, w, h, 2); ctx.fill();
  ctx.fillStyle = p.body;
  roundRect(ctx, 1, 1, w - 2, h - 2, 1.5); ctx.fill();
  ctx.fillStyle = p.tape;
  ctx.fillRect(w / 2 - 1, 1, 2, h - 2);
  if (kind === 'express') {
    ctx.beginPath();
    ctx.moveTo(w * 0.62, h * 0.12);
    ctx.lineTo(w * 0.3, h * 0.55);
    ctx.lineTo(w * 0.5, h * 0.55);
    ctx.lineTo(w * 0.38, h * 0.9);
    ctx.lineTo(w * 0.72, h * 0.42);
    ctx.lineTo(w * 0.52, h * 0.42);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'fragile') {
    ctx.fillRect(1, h / 2 - 1, w - 2, 2);
  } else {
    ctx.fillRect(1, h / 2 - 1, w - 2, 2);
  }
}

function drawBird(ctx, kind, frame) {
  if (kind === 'duck') {
    if (frame) {
      ctx.fillStyle = '#e9e1cf';
      ctx.beginPath();
      ctx.ellipse(0, -7, 4, 9, -0.3, 0, TAU);
      ctx.ellipse(0, 7, 4, 9, 0.3, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#efe7d6';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c9bea9';
    ctx.beginPath();
    ctx.ellipse(-2, 0, 4.5, 3.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2f8a5a';
    circle(ctx, 7, 0, 3.4);
    ctx.fillStyle = PAL.sun;
    roundRect(ctx, 9, -1.3, 4.5, 2.6, 1);
    ctx.fill();
    ctx.fillStyle = PAL.ink;
    circle(ctx, 7.5, -1.6, 0.7);
  } else {
    if (frame) {
      ctx.fillStyle = '#8a90a6';
      ctx.beginPath();
      ctx.ellipse(-1, -6, 3.5, 7.5, -0.25, 0, TAU);
      ctx.ellipse(-1, 6, 3.5, 7.5, 0.25, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#9aa0b4';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 3.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7c8399';
    ctx.beginPath();
    ctx.ellipse(-1.5, 0, 3.5, 2.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6b7590';
    circle(ctx, 5, 0, 2.5);
    ctx.fillStyle = '#5cc8a8';
    ctx.fillRect(3.4, -0.8, 1.2, 1.6);
    ctx.fillStyle = PAL.coral;
    ctx.fillRect(7, -0.6, 1.6, 1.2);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const Art = {
  S: 1,
  cache: new Map(),
  groundCache: new Map(),

  setScale(S) {
    if (S === this.S && this.cache.size) return false;
    this.S = S;
    this.cache.clear();
    this.groundCache.clear();
    return true;
  },

  get(key, make) {
    let s = this.cache.get(key);
    if (!s) {
      s = make();
      this.cache.set(key, s);
    }
    return s;
  },

  ground(info) {
    let c = this.groundCache.get(info.key);
    if (!c) {
      const S = this.S;
      c = makeCanvas(T * S, T * S);
      const ctx = c.getContext('2d');
      ctx.scale(S, S);
      renderGround(ctx, info, S);
      this.groundCache.set(info.key, c);
    }
    return c;
  },

  house(h) {
    return this.get(`house${h.style}:${h.color}:${h.chimney}`, () =>
      sprite(h.w, h.d, (ctx, S) => drawHouse(ctx, S, h.style, h.color, h.w, h.d, h.chimney, h.seed), 8));
  },

  shadow(w, h, r, blur = 6) {
    const key = `sh${w}x${h}r${r}b${blur}`;
    return this.get(key, () =>
      sprite(w, h, (ctx, S) => {
        ctx.shadowColor = C.shadowSolid;
        ctx.shadowBlur = blur * S;
        ctx.shadowOffsetX = 4000 * S;
        ctx.fillStyle = C.shadowSolid;
        roundRect(ctx, -4000, 0, w, h, r);
        ctx.fill();
      }, blur * 1.6));
  },

  tree(kind, variant) {
    return this.get(`tree${kind}:${variant}`, () =>
      sprite(64, 64, (ctx) => {
        ctx.translate(32, 32);
        treeCanopy(ctx, 30, kind, variant, mulberry32(hashStr(kind + variant)));
      }, 4));
  },

  car(shape, color) {
    const len = shape ? 48 : 44, wid = 24;
    return this.get(`car${shape}:${color}`, () => sprite(len, wid, (ctx) => drawCarBody(ctx, len, wid, CAR_COLORS[color], shape), 4));
  },

  fleetVan() {
    return this.get('fleetvan', () =>
      sprite(54, 28, (ctx) => {
        drawCarBody(ctx, 54, 28, '#e9e2d4', 1);
        ctx.fillStyle = PAL.sun;
        ctx.fillRect(6, 12, 30, 4);
      }, 4));
  },

  van(skin) {
    return this.get(`van${skin}`, () => sprite(54, 28, (ctx) => drawVanBody(ctx, skin, 54, 28), 5));
  },

  parcel(kind) {
    return this.get(`parcel${kind}`, () => sprite(14, 12, (ctx) => drawParcel(ctx, 14, 12, kind), 2));
  },

  bedBox(kind) {
    return this.get(`bedbox${kind}`, () => sprite(6, 10, (ctx) => drawParcel(ctx, 6, 10, kind), 1));
  },

  shed(color) {
    return this.get(`shed${color}`, () =>
      sprite(44, 32, (ctx) => {
        const col = [PAL.plum, PAL.teal, '#6cc08b', '#9aa0b4'][color];
        ctx.fillStyle = shade(col, -0.4);
        roundRect(ctx, 0, 0, 44, 32, 3); ctx.fill();
        ctx.fillStyle = shade(col, 0.12);
        ctx.fillRect(2, 2, 40, 14);
        ctx.fillStyle = shade(col, -0.12);
        ctx.fillRect(2, 16, 40, 14);
        ctx.fillStyle = rgba(PAL.ink, 0.15);
        for (let x = 7; x < 42; x += 5) ctx.fillRect(x, 2, 1, 28);
        ctx.fillStyle = shade(col, 0.4);
        ctx.fillRect(2, 15, 40, 2);
      }, 4));
  },

  lamp() {
    return this.get('lamp', () =>
      sprite(30, 30, (ctx) => {
        ctx.translate(15, 15);
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 15);
        g.addColorStop(0, rgba(PAL.sun, 0.45));
        g.addColorStop(1, rgba(PAL.sun, 0));
        ctx.fillStyle = g;
        circle(ctx, 0, 0, 15);
        ctx.fillStyle = PAL.ink;
        circle(ctx, 0, 0, 4);
        ctx.fillStyle = PAL.cream;
        circle(ctx, 0, 0, 3);
        ctx.fillStyle = PAL.sun;
        circle(ctx, 0, 0, 1.6);
      }, 2));
  },

  bin() {
    return this.get('bin', () =>
      sprite(14, 16, (ctx) => {
        ctx.fillStyle = '#2f6e57';
        roundRect(ctx, 0, 0, 14, 16, 3); ctx.fill();
        ctx.fillStyle = '#3f8a6a';
        roundRect(ctx, 1.2, 1.2, 11.6, 13.6, 2.5); ctx.fill();
        ctx.fillStyle = '#2f6e57';
        ctx.fillRect(1, 3.5, 12, 1.2);
        ctx.fillStyle = rgba('#ffffff', 0.25);
        ctx.fillRect(3, 6, 8, 1.5);
      }, 2));
  },

  cone() {
    return this.get('cone', () =>
      sprite(14, 14, (ctx) => {
        ctx.fillStyle = shade(PAL.coral, -0.3);
        roundRect(ctx, 0, 0, 14, 14, 3); ctx.fill();
        ctx.fillStyle = PAL.coral;
        circle(ctx, 7, 7, 5.5);
        ctx.fillStyle = PAL.cream;
        circle(ctx, 7, 7, 3.6);
        ctx.fillStyle = PAL.coral;
        circle(ctx, 7, 7, 2);
      }, 2));
  },

  ramp() {
    return this.get('ramp', () =>
      sprite(44, 62, (ctx, S) => {
        setShadow(ctx, S, 3, 4, 4);
        const g = ctx.createLinearGradient(0, 0, 44, 0);
        g.addColorStop(0, '#b98a5e');
        g.addColorStop(1, '#e9c08c');
        ctx.fillStyle = g;
        roundRect(ctx, 0, 6, 44, 50, 3); ctx.fill();
        clearShadow(ctx);
        ctx.fillStyle = rgba('#7a5532', 0.35);
        for (let x = 6; x < 44; x += 7) ctx.fillRect(x, 6, 1.2, 50);
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i % 2 ? PAL.ink : PAL.sun;
          ctx.fillRect(i * 7.33, 0, 7.33, 6);
          ctx.fillStyle = i % 2 ? PAL.sun : PAL.ink;
          ctx.fillRect(i * 7.33, 56, 7.33, 6);
        }
        ctx.strokeStyle = PAL.cream;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const x of [12, 26]) {
          ctx.beginPath();
          ctx.moveTo(x, 22);
          ctx.lineTo(x + 8, 31);
          ctx.lineTo(x, 40);
          ctx.stroke();
        }
      }, 6));
  },

  depot() {
    const b = DEPOT.building;
    const w = b.x1 - b.x0, h = b.y1 - b.y0;
    return this.get('depot', () =>
      sprite(w, h, (ctx) => {
        ctx.fillStyle = '#7c8399';
        roundRect(ctx, 0, 0, w, h, 5); ctx.fill();
        ctx.fillStyle = '#b4b9c9';
        ctx.fillRect(5, 5, w - 10, h - 10);
        ctx.fillStyle = rgba(PAL.ink, 0.1);
        for (let x = 12; x < w - 8; x += 12) ctx.fillRect(x, 5, 2, h - 10);
        ctx.fillStyle = '#9fdcea';
        for (let i = 0; i < 5; i++) {
          roundRect(ctx, 22 + i * ((w - 60) / 4), 14, 18, 26, 3); ctx.fill();
        }
        ctx.fillStyle = rgba('#ffffff', 0.5);
        for (let i = 0; i < 5; i++) ctx.fillRect(24 + i * ((w - 60) / 4), 16, 3, 22);
        // Big painted logo.
        const cx = w / 2, cy = h * 0.6;
        ctx.fillStyle = PAL.coral;
        roundRect(ctx, cx - 120, cy - 34, 240, 68, 16); ctx.fill();
        ctx.fillStyle = shade(PAL.coral, -0.3);
        roundRect(ctx, cx - 120, cy + 26, 240, 8, 4); ctx.fill();
        ctx.save();
        ctx.translate(cx - 86, cy);
        ctx.rotate(-0.12);
        drawParcel(ctx, 36, 30, 'normal');
        ctx.restore();
        ctx.font = `40px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 6;
        ctx.strokeStyle = PAL.ink;
        ctx.strokeText('DEPOT', cx + 22, cy + 2);
        ctx.fillStyle = PAL.cream;
        ctx.fillText('DEPOT', cx + 22, cy + 2);
        // Roll-up doors facing the loading bay.
        for (let i = 0; i < 3; i++) {
          const dx = 40 + i * ((w - 80) / 2) - 30;
          ctx.fillStyle = PAL.sun;
          roundRect(ctx, dx, h - 8, 60, 12, 3); ctx.fill();
          ctx.fillStyle = PAL.ink;
          for (let k = 0; k < 6; k++) ctx.fillRect(dx + 3 + k * 10, h - 8, 5, 12);
        }
        ctx.fillStyle = '#9aa0b4';
        roundRect(ctx, w - 50, 50, 30, 24, 3); ctx.fill();
        ctx.fillStyle = '#6b7183';
        circle(ctx, w - 35, 62, 8);
      }, 8));
  },

  bird(kind, frame) {
    return this.get(`bird${kind}${frame}`, () =>
      sprite(28, 28, (ctx) => {
        ctx.translate(14, 14);
        drawBird(ctx, kind, frame);
      }, 1));
  },

  // Soft round particle in a given colour.
  puff(color) {
    return this.get(`puff${color}`, () =>
      sprite(16, 16, (ctx) => {
        const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        g.addColorStop(0, rgba(color, 1));
        g.addColorStop(0.55, rgba(color, 0.85));
        g.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 16, 16);
      }, 0));
  },

  dot(color) {
    return this.get(`dot${color}`, () =>
      sprite(16, 16, (ctx) => {
        ctx.fillStyle = color;
        circle(ctx, 8, 8, 7.5);
      }, 0));
  },
};

// Draw a parcel box directly (used by UI icons).
export function paintParcel(ctx, x, y, w, h, kind) {
  ctx.save();
  ctx.translate(x - w / 2, y - h / 2);
  drawParcel(ctx, w, h, kind);
  ctx.restore();
}

export function paintVan(ctx, skin, x, y, scale, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.translate(-27, -14);
  drawVanBody(ctx, skin, 54, 28);
  ctx.restore();
}

export { C as SHADES, mix };
