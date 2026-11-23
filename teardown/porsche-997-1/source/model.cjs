'use strict';
/**
 * Stylized hidden-line 997.1 Carrera Coupé.
 * The body is one smooth loft: stations about every 52 mm, each section a
 * dense curve. The hood meets the fenders through a round fillet, not a crease.
 * Sharp lines are panel boundaries and the lamp, glass, intake and arch edges.
 * Not a class-A surface and not dimensionally exact.
 *
 * +X nose, +Y left, +Z up. Rear axle at X = 0. Ground at Z = 0.
 * Wheelbase 2350. Width 1808. Roof 1310. Length follows the side outline
 * scaled to that wheelbase (about 4430), between the EU 4427 and US 4461 figures.
 */

const G = require('./lib/geometry.js');
const TAU = Math.PI * 2;

const NOSE = 3340;
const TAIL = -1090;
const FRONT_AXLE = 2350;
const REAR_AXLE = 0;
const FRONT_R = 228.6 + 235 * 0.4;
const REAR_R = 228.6 + 265 * 0.4;
const STEP = 52;
const HALF_N = 40;
const GAP = 9;

// x, centreZ, crownZ, crownY, beltZ, beltY, rockerY
// Where crownZ is above centreZ, the fender is a round shoulder and the hood sits in the valley.
const KEYS = [
  [-1090, 780, 820, 700, 620, 680, 600],
  [-720, 1000, 1020, 840, 780, 820, 720],
  [-280, 1085, 1060, 890, 860, 880, 750],
  [0, 1135, 1100, 904, 1000, 904, 780],
  [420, 1235, 1180, 904, 1040, 904, 760],
  [820, 1295, 1240, 760, 860, 760, 660],
  [1080, 1310, 1260, 520, 820, 640, 600],
  [1480, 1245, 1140, 560, 830, 660, 610],
  [1760, 1085, 1020, 740, 860, 720, 650],
  [2020, 940, 1000, 860, 880, 830, 720],
  [2360, 800, 980, 890, 760, 870, 730],
  [2700, 720, 920, 900, 680, 880, 720],
  [3040, 660, 840, 870, 600, 840, 690],
  [3220, 610, 740, 800, 540, 760, 660],
  [3340, 560, 600, 690, 470, 650, 600]
];

const ARCH = [
  {x: FRONT_AXLE, z: FRONT_R, r: FRONT_R + 32, lip: 858},
  {x: REAR_AXLE, z: REAR_R, r: REAR_R + 30, lip: 898}
];

const NAMES = {
  body: ['车身', 'Body'],
  bumper_front: ['前保险杠', 'Front bumper'],
  bumper_rear: ['后保险杠', 'Rear bumper'],
  hood: ['前舱盖', 'Front hood'],
  lid: ['发动机舱盖', 'Engine lid'],
  spoiler: ['后扰流板', 'Spoiler'],
  door_l: ['左车门', 'Left door'],
  door_r: ['右车门', 'Right door'],
  fender_l: ['左前翼子板', 'Left fender'],
  fender_r: ['右前翼子板', 'Right fender'],
  wheel_fl: ['左前轮', 'Front left wheel'],
  wheel_fr: ['右前轮', 'Front right wheel'],
  wheel_rl: ['左后轮', 'Rear left wheel'],
  wheel_rr: ['右后轮', 'Rear right wheel'],
  engine: ['发动机包络', 'Flat-six, estimated']
};

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function smooth(t) { return t * t * (3 - 2 * t); }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a) {
  const L = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / L, a[1] / L, a[2] / L];
}
function centroid(pts) {
  const c = [0, 0, 0];
  for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
  return mul(c, 1 / pts.length);
}

function shape(x) {
  let i = 1;
  while (i < KEYS.length - 1 && KEYS[i][0] < x) i++;
  const A = KEYS[i - 1], B = KEYS[i];
  const t = smooth(clamp((x - A[0]) / (B[0] - A[0]), 0, 1));
  const v = [];
  for (let k = 1; k < A.length; k++) v.push(lerp(A[k], B[k], t));
  return {centerZ: v[0], crownZ: v[1], crownY: v[2], beltZ: v[3], beltY: v[4], rockerY: v[5]};
}

function archAt(x) {
  for (const w of ARCH) {
    const dx = x - w.x;
    if (Math.abs(dx) < w.r - 1.5) {
      const h = Math.sqrt(Math.max(0, w.r * w.r - dx * dx));
      const s = shape(x);
      const lip = Math.max(w.lip * 0.98, Math.min(s.beltY, w.lip + 16));
      return {zL: Math.max(w.z - h, 150), zU: w.z + h, lip, w};
    }
  }
  return null;
}

function halfSection(x) {
  const s = shape(x);
  const a = archAt(x);
  const pts = new Array(HALF_N);
  const valley = x > 1920 && s.crownZ > s.centerZ + 48;
  const peakY = valley ? Math.max(s.crownY, s.beltY) : s.beltY;
  const peakZ = valley ? s.crownZ : s.beltZ;
  const z0 = 118;

  // Flat underbody, then a steep side. Over the rear axle the side reaches full
  // width early, so the haunch is a volume above the wheel, not a thin widest line.
  const full = smooth(clamp((1120 - x) / 480, 0, 1));
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    const base = Math.sin(u * Math.PI / 2);
    const hip = smooth(clamp((u - 0.22) / 0.45, 0, 1));
    pts[i] = [
      peakY * (base + (1 - base) * full * hip),
      z0 + (peakZ - z0) * Math.pow(u, 1.45)
    ];
  }
  pts[0] = [0, z0];

  if (valley) {
    for (let i = 17; i < HALF_N; i++) {
      const u = (i - 16) / (HALF_N - 1 - 16);
      const ang = u * Math.PI / 2;
      pts[i] = [
        Math.max(0, peakY * Math.cos(ang)),
        s.centerZ + (peakZ - s.centerZ) * Math.cos(ang)
      ];
    }
  } else {
    for (let i = 17; i < HALF_N; i++) {
      const u = (i - 16) / (HALF_N - 1 - 16);
      const ang = u * Math.PI / 2;
      pts[i] = [
        Math.max(0, peakY * Math.cos(ang)),
        peakZ + (s.centerZ - peakZ) * Math.sin(ang)
      ];
    }
  }
  pts[HALF_N - 1] = [0, s.centerZ];

  if (a) {
    pts[GAP] = [a.lip, a.zL];
    pts[GAP + 1] = [a.lip, a.zU];
    const y0 = pts[4][0];
    const z0 = Math.min(pts[4][1], a.zL);
    for (let i = 5; i < GAP; i++) {
      const t = smooth((i - 4) / (GAP - 4));
      pts[i] = [lerp(y0, a.lip, t), lerp(z0, a.zL, t)];
    }
    for (let i = GAP + 2; i <= 16; i++) {
      const t = (i - (GAP + 1)) / (16 - (GAP + 1));
      const e = Math.sin(t * Math.PI / 2);
      pts[i] = [lerp(a.lip, peakY, e), lerp(a.zU, Math.max(peakZ, a.zU + 8), e)];
    }
  }
  return pts;
}

function place(x, y, z) {
  let px = x;
  if (x > 3120) {
    const along = clamp((x - 3120) / (NOSE - 3120), 0, 1);
    const low = clamp((360 - z) / 160, 0, 1);
    px += 8 * along * low * low;
  }
  if (x < -680) {
    const t = clamp((-680 - x) / (-680 - TAIL), 0, 1);
    const up = clamp((z - 480) / 520, 0, 1);
    px += 200 * t * t * up * up;
  }
  return [px, y, z];
}

function ringAt(x) {
  const half = halfSection(x);
  const ring = [];
  for (let i = 0; i < half.length; i++) ring.push(place(x, half[i][0], half[i][1]));
  for (let i = half.length - 2; i >= 1; i--) ring.push(place(x, -half[i][0], half[i][1]));
  return ring;
}

function stations() {
  const xs = [];
  for (let x = TAIL; x <= NOSE; x += STEP) xs.push(Math.round(x));
  if (xs[xs.length - 1] !== NOSE) xs.push(NOSE);
  return xs;
}

function halfIndex(j, H) {
  if (j < H) return j;
  return 2 * H - 2 - j;
}

function classify(x, z, iHalf) {
  if (x > 3180 && iHalf <= 10) return 'bumper_front';
  if (x < -980 && iHalf <= 16) return 'bumper_rear';
  if (x > 2060 && x < 3170 && iHalf >= 24) return 'hood';
  if (x > -800 && x < 260 && iHalf >= 22) return 'lid';
  if (x > 2680 && x < 3220 && iHalf >= 8 && iHalf <= 23) return 'fender';
  return 'body';
}

function emptyPart(id) {
  const [zh, en] = NAMES[id];
  const p = G.part(id, en);
  p.zh = zh;
  p.en = en;
  return p;
}

function doorWindowPoly() {
  // Tall at the A-pillar, short at the B-pillar, belt lowered so the glass is the greenhouse.
  const pts = [];
  const n = 16;
  const x0 = 1740, x1 = 880, zFront = 800, zRear = 740, topRear = 980, topFront = 1240;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([lerp(x0, x1, t), lerp(zFront, zRear, t)]);
  }
  for (let i = 1; i <= 5; i++) pts.push([x1, lerp(zRear, topRear, i / 5)]);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    pts.push([lerp(x1, x0, t), lerp(topRear, topFront, Math.pow(t, 0.7))]);
  }
  for (let i = 1; i < 7; i++) pts.push([x0, lerp(topFront, zFront, i / 7)]);
  return pts;
}

const WINDOW = doorWindowPoly();

function insidePoly(x, z, poly) {
  let n = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-9) + xi) n = !n;
  }
  return n;
}

function intakeHit(p) {
  if (p[0] < 3160 || p[2] < 250 || p[2] > 500) return false;
  const ay = Math.abs(p[1]);
  const half = lerp(430, 280, clamp((p[2] - 260) / 200, 0, 1));
  return ay < half - 20;
}

function buildSkin() {
  const xs = stations();
  const rings = xs.map(ringAt);
  const J = rings[0].length;
  const ids = ['body', 'bumper_front', 'bumper_rear', 'hood', 'lid', 'door_l', 'door_r', 'fender_l', 'fender_r'];
  const parts = {};
  for (const id of ids) parts[id] = emptyPart(id);
  const weld = {};
  const take = (id, i, j, point) => {
    if (!weld[id]) weld[id] = new Map();
    const map = weld[id];
    const key = i + ':' + j;
    if (map.has(key)) return map.get(key);
    const idx = parts[id].vertices.length;
    parts[id].vertices.push(point.slice());
    map.set(key, idx);
    return idx;
  };
  const rightGap = (J - 1) - GAP;

  for (let i = 0; i < xs.length - 1; i++) {
    const open = archAt(xs[i]) && archAt(xs[i + 1]);
    for (let j = 0; j < J; j++) {
      const j2 = (j + 1) % J;
      if (open && (j === GAP || j === rightGap)) continue;
      const quad = [rings[i][j], rings[i + 1][j], rings[i + 1][j2], rings[i][j2]];
      const ctd = centroid(quad);
      if (insidePoly(ctd[0], ctd[2], WINDOW) && Math.abs(ctd[1]) > 420 && ctd[2] > 660 && ctd[0] > 800 && ctd[0] < 1800) continue;
      if (intakeHit(ctd)) continue;
      const area = Math.hypot(...cross(sub(quad[1], quad[0]), sub(quad[3], quad[0])));
      if (area < 18) continue;
      const hi = Math.round((halfIndex(j, HALF_N) + halfIndex(j2, HALF_N)) / 2);
      let kind = classify(ctd[0], ctd[2], hi);
      if (kind === 'door') kind = ctd[1] >= 0 ? 'door_l' : 'door_r';
      if (kind === 'fender') kind = ctd[1] >= 0 ? 'fender_l' : 'fender_r';
      const ia = take(kind, i, j, quad[0]);
      const ib = take(kind, i + 1, j, quad[1]);
      const ic = take(kind, i + 1, j2, quad[2]);
      const idd = take(kind, i, j2, quad[3]);
      parts[kind].triangles.push([ia, ib, ic], [ia, ic, idd]);
    }
  }
  cap(parts.bumper_front, rings[rings.length - 1], true);
  cap(parts.bumper_rear, rings[0], false);
  return parts;
}

function cap(part, ring, nose) {
  if (!part || !ring) return;
  const c = centroid(ring);
  const ci = part.vertices.length;
  part.vertices.push(c.slice());
  const base = part.vertices.length;
  for (const p of ring) part.vertices.push(p.slice());
  for (let j = 0; j < ring.length; j++) {
    const a = base + j, b = base + (j + 1) % ring.length;
    part.triangles.push(nose ? [ci, a, b] : [ci, b, a]);
  }
}

function addLoop(part, pts, role) {
  if (!part || pts.length < 3) return;
  for (let i = 0; i < pts.length; i++) G.line(part, pts[i], pts[(i + 1) % pts.length], role);
}
function addOpen(part, pts, role) {
  if (!part || pts.length < 2) return;
  for (let i = 0; i < pts.length - 1; i++) G.line(part, pts[i], pts[i + 1], role);
}
function addBand(part, outer, inner) {
  const base = part.vertices.length;
  for (const p of outer) part.vertices.push(p.slice());
  for (const p of inner) part.vertices.push(p.slice());
  const n = outer.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    part.triangles.push([base + i, base + j, base + n + j], [base + i, base + n + j, base + n + i]);
  }
}

function yOnFlank(x, z) {
  const half = halfSection(x);
  let best = half[4][0], bestD = Infinity;
  for (let i = 2; i < half.length - 1; i++) {
    const a = half[i], b = half[i + 1];
    if ((z - a[1]) * (z - b[1]) <= 0 && Math.abs(b[1] - a[1]) > 1) {
      const t = (z - a[1]) / (b[1] - a[1]);
      return Math.abs(lerp(a[0], b[0], t));
    }
    const d = Math.abs(a[1] - z);
    if (d < bestD) { bestD = d; best = Math.abs(a[0]); }
  }
  return best;
}

function skinPoint(x, side, z, out) {
  return place(x, side * (yOnFlank(x, z) + (out || 0)), z);
}

function lampFrame(side) {
  const x = 3160;
  const z = 690;
  const ySurf = yOnFlank(x, z);
  const N = norm([0.9, side * 0.34, 0.16]);
  const center = add([x, side * (ySurf * 0.78), z], mul(N, 20));
  const long = norm(cross(N, [0, 0, 1]));
  const up = norm(cross(long, N));
  return {center, N, long, up, A: 210, B: 130, side};
}

function ellipsePts(frame, scale, along, n = 42) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = TAU * i / n;
    pts.push(add(frame.center, add(
      add(mul(frame.long, Math.cos(a) * frame.A * scale), mul(frame.up, Math.sin(a) * frame.B * scale)),
      mul(frame.N, along)
    )));
  }
  return pts;
}

function addFriedEgg(part, side) {
  const f = lampFrame(side);
  const bezel = ellipsePts(f, 1, 10, 52);
  const lip = ellipsePts(f, 0.92, 10, 52);
  const recess = ellipsePts(f, 0.9, -18, 52);
  const lens = ellipsePts(f, 0.78, -8, 52);
  addBand(part, bezel, lip);
  addBand(part, lip, recess);
  addBand(part, recess, lens);
  addLoop(part, bezel, 'edge');
  addLoop(part, lens, 'edge');
  const outboard = norm(sub([0, side, 0], mul(f.N, dot([0, side, 0], f.N))));
  const projector = add(add(f.center, mul(f.N, -2)), mul(outboard, 36));
  const ring = (c, r, n) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = TAU * i / n;
      pts.push(add(c, add(mul(f.long, Math.cos(a) * r), mul(f.up, Math.sin(a) * r))));
    }
    return pts;
  };
  addLoop(part, ring(projector, 58, 36), 'edge');
}

function placeRoundLamp(part, at, radius) {
  const piece = G.piece();
  G.lathe(piece, [[0, 0], [3, radius * 0.72], [8, radius], [14, radius * 0.7], [18, 0]], {axis: 'x', segments: 28, role: 'edge'});
  const shift = v => [v[0] + at[0], v[1] + at[1], v[2] + at[2]];
  piece.vertices = piece.vertices.map(shift);
  piece.lines = piece.lines.map(l => ({role: l.role, a: shift(l.a), b: shift(l.b)}));
  G.merge(part, piece);
}

function roundedRect(x, y0, y1, z0, z1, n = 8) {
  const pts = [];
  const ry = 42, rz = 32;
  const corners = [[y1, z1, -1, 1], [y0, z1, 1, 1], [y0, z0, 1, -1], [y1, z0, -1, -1]];
  for (const [y, z, sy, sz] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = (Math.PI / 2) * (i / n);
      pts.push([x, y + sy * Math.cos(a) * ry, z + sz * Math.sin(a) * rz]);
    }
  }
  return pts;
}

function bumperPoint(y, z, proud) {
  let chosen = 3180;
  for (let x = NOSE; x >= 3060; x -= 15) {
    if (yOnFlank(x, z) + 40 >= Math.abs(y)) { chosen = x; break; }
  }
  const yClamped = Math.sign(y || 1) * Math.min(Math.abs(y), yOnFlank(chosen, z));
  const p = place(chosen, yClamped, z);
  p[0] += proud || 0;
  return p;
}

function addDetails(parts) {
  for (const side of [-1, 1]) addFriedEgg(parts[side > 0 ? 'fender_l' : 'fender_r'], side);

  const intake = [];
  const corners = [[-420, 270], [420, 270], [300, 450], [-300, 450]];
  for (let e = 0; e < 4; e++) {
    const a = corners[e], b = corners[(e + 1) % 4];
    for (let i = 0; i < 8; i++) {
      const t = i / 8;
      intake.push(bumperPoint(lerp(a[0], b[0], t), lerp(a[1], b[1], t), 12));
    }
  }
  const intakeIn = intake.map(p => [p[0] - 28, p[1] * 0.86, 300 + (p[2] - 300) * 0.72]);
  addBand(parts.bumper_front, intake, intakeIn);
  addLoop(parts.bumper_front, intake, 'edge');
  for (let k = -1; k <= 1; k++) {
    addOpen(parts.bumper_front, [bumperPoint(-280, 318 + k * 28, -6), bumperPoint(280, 318 + k * 28, -6)], 'detail');
  }
  const lip = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const y = lerp(-520, 520, t);
    lip.push(bumperPoint(y, 210 + Math.cos((t - 0.5) * Math.PI) * 18, 22));
  }
  addOpen(parts.bumper_front, lip, 'edge');
  for (const side of [-1, 1]) {
    const at = bumperPoint(side * 700, 340, 12);
    placeRoundLamp(parts.bumper_front, at, 52);
    const bezel = [];
    for (let i = 0; i < 24; i++) {
      const a = TAU * i / 24;
      bezel.push([at[0] + 6, at[1] + Math.cos(a) * 68, at[2] + Math.sin(a) * 68]);
    }
    addLoop(parts.bumper_front, bezel, 'edge');
  }

  addGlass(parts);
  for (const side of [-1, 1]) {
    addLoop(parts.body, tailLamp(side), 'edge');
    addLoop(parts.bumper_rear, exhaustOval(side), 'edge');
  }
  for (let i = 0; i < 6; i++) {
    const x = -70 - i * 88;
    const z = 1048 - i * 14;
    const half = 320 - Math.abs(i - 2.5) * 14;
    G.line(parts.lid, [x, -half, z], [x, half, z], 'detail');
  }
}

function tailLamp(side) {
  const pts = [];
  for (let i = 0; i < 36; i++) {
    const a = TAU * i / 36;
    const along = Math.cos(a);
    pts.push([-1008 - Math.max(0, -along) * 14, side * (540 + along * 200), 835 + Math.sin(a) * 42]);
  }
  return pts;
}

function exhaustOval(side) {
  const pts = [];
  for (let i = 0; i < 28; i++) {
    const a = TAU * i / 28;
    pts.push([TAIL - 6, side * 430 + Math.cos(a) * 82, 268 + Math.sin(a) * 28]);
  }
  return pts;
}

function addGlass(parts) {
  for (const side of [-1, 1]) {
    const door = parts[side > 0 ? 'door_l' : 'door_r'];
    const outer = WINDOW.map(([x, z]) => skinPoint(x, side, z, 7));
    const inner = WINDOW.map(([x, z]) => {
      const cx = 1370, cz = 1110;
      return skinPoint(cx + (x - cx) * 0.8, side, cz + (z - cz) * 0.74, 7);
    });
    addBand(door, outer, inner);
    addLoop(door, outer, 'edge');
    addLoop(door, inner, 'edge');
    const glass = inner.map(p => [p[0], p[1] - side * 14, p[2]]);
    const base = door.vertices.length;
    for (const p of glass) door.vertices.push(p);
    for (let i = 1; i < glass.length - 1; i++) door.triangles.push([base, base + i, base + i + 1]);
  }
}

function addMirrors(parts) {
  const add = (door, side) => {
    const y0 = side * 735, y1 = side * 905;
    G.box(door, [1568, Math.min(y0, y1), 1030], [1655, Math.max(y0, y1), 1082], {radius: 16, role: 'edge'});
  };
  add(parts.door_l, 1);
  add(parts.door_r, -1);
}

function addSpoilerAndEngine(parts) {
  const spoiler = emptyPart('spoiler');
  const y = 330;
  const top = [[-740, -y, 1016], [-630, -y, 1026], [-630, y, 1026], [-740, y, 1016]];
  const bot = top.map(p => [p[0], p[1], p[2] - 8]);
  for (const p of [...bot, ...top]) spoiler.vertices.push(p);
  const face = (a, b, c, d, flip) => {
    spoiler.triangles.push(flip ? [a, c, b] : [a, b, c], flip ? [a, d, c] : [a, c, d]);
  };
  face(4, 5, 6, 7, false);
  face(0, 1, 2, 3, true);
  for (let i = 0; i < 4; i++) G.line(spoiler, top[i], top[(i + 1) % 4], 'edge');
  parts.spoiler = spoiler;

  const engine = emptyPart('engine');
  G.box(engine, [-520, -330, 340], [20, 330, 700], {radius: 36, role: 'edge'});
  parts.engine = engine;
}

function makeWheel(id, spec) {
  const p = emptyPart(id);
  const R = spec.radius, W = spec.width;
  const profile = [
    [-W / 2, R * 0.68], [-W / 2 + W * 0.12, R * 0.88], [-W / 2 + W * 0.22, R],
    [W / 2 - W * 0.22, R], [W / 2 - W * 0.1, R * 0.82], [W / 2, R * 0.62],
    [W / 2, R * 0.42], [-W / 2, R * 0.5]
  ];
  G.lathe(p, profile, {axis: 'y', segments: 40, role: 'edge'});
  for (let k = 0; k < 5; k++) {
    const spoke = G.piece();
    G.box(spoke, [-12, W / 2 - 22, R * 0.22], [12, W / 2 - 4, R * 0.78]);
    rotateY(spoke, k * TAU / 5 + 0.15);
    G.merge(p, spoke);
  }
  G.circle(p, [0, W / 2 + 1, 0], 34, [0, 1, 0], {segments: 20, role: 'detail'});
  if (spec.mirror) mirrorY(p);
  translate(p, spec.at);
  return p;
}

function rotateY(p, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const r = v => [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]];
  p.vertices = p.vertices.map(r);
  p.lines = p.lines.map(l => ({...l, a: r(l.a), b: r(l.b)}));
}
function mirrorY(p) {
  for (const v of p.vertices) v[1] *= -1;
  for (const l of p.lines) { l.a[1] *= -1; l.b[1] *= -1; }
  for (const t of p.triangles) { const s = t[1]; t[1] = t[2]; t[2] = s; }
}
function translate(p, d) {
  for (const v of p.vertices) { v[0] += d[0]; v[1] += d[1]; v[2] += d[2]; }
  for (const l of p.lines) {
    l.a = [l.a[0] + d[0], l.a[1] + d[1], l.a[2] + d[2]];
    l.b = [l.b[0] + d[0], l.b[1] + d[1], l.b[2] + d[2]];
  }
}

function ease(t) { return t * t * (3 - 2 * t); }
function mapPart(p, fn) {
  p.vertices = p.vertices.map(fn);
  p.lines = p.lines.map(l => ({...l, a: fn(l.a), b: fn(l.b)}));
}
function rotYAround(v, o, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const x = v[0] - o[0], z = v[2] - o[2];
  return [o[0] + c * x + s * z, v[1], o[2] - s * x + c * z];
}
function rotZAround(v, o, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const x = v[0] - o[0], y = v[1] - o[1];
  return [o[0] + c * x - s * y, o[1] + s * x + c * y, v[2]];
}
function move(v, d, s) { return [v[0] + d[0] * s, v[1] + d[1] * s, v[2] + d[2] * s]; }

function hingeOf(part, end, centerline) {
  let target = end === 'front' ? -Infinity : Infinity;
  for (const v of part.vertices) target = end === 'front' ? Math.max(target, v[0]) : Math.min(target, v[0]);
  const near = part.vertices.filter(v => Math.abs(v[0] - target) < 60 && Math.abs(v[1]) < 980);
  const pool = near.length ? near : part.vertices;
  const c = centroid(pool);
  return [target, centerline ? 0 : c[1], c[2]];
}

let BASE = null;
function baseParts() {
  if (BASE) return BASE;
  const parts = buildSkin();
  addDetails(parts);
  addMirrors(parts);
  addSpoilerAndEngine(parts);
  parts.wheel_fl = makeWheel('wheel_fl', {radius: FRONT_R, width: 235, at: [FRONT_AXLE, 743, FRONT_R], mirror: false});
  parts.wheel_fr = makeWheel('wheel_fr', {radius: FRONT_R, width: 235, at: [FRONT_AXLE, -743, FRONT_R], mirror: true});
  parts.wheel_rl = makeWheel('wheel_rl', {radius: REAR_R, width: 265, at: [REAR_AXLE, 767, REAR_R], mirror: false});
  parts.wheel_rr = makeWheel('wheel_rr', {radius: REAR_R, width: 265, at: [REAR_AXLE, -767, REAR_R], mirror: true});
  const counts = {};
  for (const [id, p] of Object.entries(parts)) if (p && p.triangles) counts[id] = p.triangles.length;
  parts._counts = counts;
  parts._hingeHood = hingeOf(parts.hood, 'rear', true);
  parts._hingeLid = hingeOf(parts.lid, 'front', true);
  parts._hingeDoorL = hingeOf(parts.door_l, 'front', false);
  parts._hingeDoorR = hingeOf(parts.door_r, 'front', false);
  BASE = parts;
  return BASE;
}

function clonePart(p) {
  return {
    id: p.id, name: p.name, zh: p.zh, en: p.en, explosion: [0, 0, 0],
    vertices: p.vertices.map(v => v.slice()),
    triangles: p.triangles.map(t => t.slice()),
    lines: p.lines.map(l => ({role: l.role, a: l.a.slice(), b: l.b.slice()}))
  };
}

function poseParts(t) {
  const base = baseParts();
  const e = ease(Math.max(0, Math.min(1, t)));
  const parts = {};
  for (const id of Object.keys(NAMES)) parts[id] = clonePart(base[id]);
  const apply = (id, fn) => mapPart(parts[id], fn);
  apply('bumper_front', v => move(v, [320, 0, 10], e));
  apply('bumper_rear', v => move(v, [-300, 0, 8], e));
  apply('hood', v => rotYAround(v, base._hingeHood, -1.02 * e));
  apply('lid', v => rotYAround(v, base._hingeLid, 0.92 * e));
  apply('spoiler', v => move(rotYAround(v, base._hingeLid, 0.92 * e), [0, 0, 150], e));
  apply('door_l', v => move(rotZAround(v, base._hingeDoorL, -0.7 * e), [0, 24, 12], e));
  apply('door_r', v => move(rotZAround(v, base._hingeDoorR, 0.7 * e), [0, -24, 12], e));
  apply('fender_l', v => move(v, [60, 220, 18], e));
  apply('fender_r', v => move(v, [60, -220, 18], e));
  apply('wheel_fl', v => move(v, [24, 420, -8], e));
  apply('wheel_fr', v => move(v, [24, -420, -8], e));
  apply('wheel_rl', v => move(v, [-16, 460, -8], e));
  apply('wheel_rr', v => move(v, [-16, -460, -8], e));
  apply('engine', v => move(v, [-70, 0, -220], e));
  return Object.values(parts);
}

module.exports = {poseParts, baseParts, NAMES, NOSE, TAIL, shape, halfSection, lampFrame};
