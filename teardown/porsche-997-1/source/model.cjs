'use strict';
/**
 * Stylized hidden-line 997.1 Carrera Coupé, rebuilt from section lofts.
 * The sections are the side silhouette, the front 3/4 (hood valley, fried-egg
 * lamps, bumper lip) and the rear 3/4 (haunch, fastback, thick sail).
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
const STEP = 12;

// x, centre height, fender-crown height, crown half-width, belt height, belt half-width, rocker half-width.
// Crown above the centre is the hood valley. Belt wider than the doors is the rear haunch.
const KEYS = [
  [-1090, 600, 660, 660, 500, 640, 580],
  [-860, 940, 980, 820, 680, 800, 700],
  [-420, 1045, 1030, 890, 760, 880, 740],
  [0, 1100, 1050, 904, 820, 904, 760],
  [420, 1210, 1165, 840, 940, 850, 720],
  [760, 1288, 1245, 680, 1005, 710, 680],
  [1040, 1310, 1265, 520, 1005, 680, 660],
  [1420, 1265, 1160, 560, 1008, 720, 675],
  [1700, 1120, 1040, 720, 990, 770, 690],
  [1980, 930, 1005, 850, 900, 840, 730],
  [2280, 790, 970, 890, 760, 875, 745],
  [2600, 700, 920, 900, 680, 880, 740],
  [2920, 640, 850, 885, 600, 855, 715],
  [3140, 600, 760, 810, 530, 770, 685],
  [3340, 490, 530, 670, 420, 650, 610]
];

const ARCH = [
  {x: FRONT_AXLE, z: FRONT_R, r: FRONT_R + 34, lip: 868},
  {x: REAR_AXLE, z: REAR_R, r: REAR_R + 32, lip: 900}
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
  return {cz: v[0], sz: v[1], sy: v[2], bz: v[3], by: v[4], ry: v[5]};
}

function archAt(x) {
  for (const w of ARCH) if (Math.abs(x - w.x) < w.r - 1) return w;
  return null;
}

function lampFrame(side) {
  const center = [3125, side * 790, 690];
  const N = norm([0.72, side * 0.64, 0.2]);
  const long = norm(cross(N, [0, 0, 1]));
  const up = norm(cross(long, N));
  return {center, N, long, up, A: 175, B: 108, side};
}

function lampLocal(frame, x, y, z) {
  const d = [x - frame.center[0], y - frame.center[1], z - frame.center[2]];
  return {depth: dot(d, frame.N), u: dot(d, frame.long) / frame.A, v: dot(d, frame.up) / frame.B};
}

function inLamp(x, y, z, scale) {
  for (const side of [-1, 1]) {
    const f = lampFrame(side);
    const q = lampLocal(f, x, y, z);
    if (q.depth > -50 && q.depth < 70 && q.u * q.u + q.v * q.v < scale * scale) return true;
  }
  return false;
}

function dentPoint(x, y, z) {
  let p = [x, y, z];
  for (const side of [-1, 1]) {
    const f = lampFrame(side);
    const q = lampLocal(f, x, y, z);
    const e = q.u * q.u + q.v * q.v;
    if (q.depth > -8 && q.depth < 40 && e < 0.7) {
      const push = (1 - e) * 8;
      p = [p[0] - f.N[0] * push, p[1] - f.N[1] * push, p[2] - f.N[2] * push];
    }
  }
  if (p[0] > 3120 && p[2] < 400 && Math.abs(p[1]) < 700) {
    const tz = clamp((380 - p[2]) / 160, 0, 1);
    const tx = clamp((p[0] - 3120) / 180, 0, 1);
    p[0] += 26 * tz * tx;
  }
  if (p[0] > 3000) {
    const ay = Math.abs(p[1]);
    const corner = clamp((ay - 420) / 280, 0, 1);
    const along = clamp((p[0] - 3000) / 340, 0, 1);
    const high = clamp((p[2] - 460) / 280, 0, 1);
    p[0] -= along * (corner * 55 + high * high * 36);
  }
  return p;
}

function halfPoints(x) {
  const s = shape(x);
  const a = archAt(x);
  let lo, hi;
  if (a) {
    const dx = x - a.x;
    const h = Math.sqrt(Math.max(0, a.r * a.r - dx * dx));
    lo = [a.lip, Math.max(a.z - h, 140)];
    hi = [a.lip, a.z + h];
  } else {
    lo = [lerp(s.ry, s.by, 0.42), lerp(200, s.bz, 0.4)];
    hi = [lerp(s.ry, s.by, 0.78), lerp(230, s.bz, 0.78)];
  }
  const beltZ = Math.max(s.bz, hi[1] + 4);
  const pts = [
    [0, 118],
    [s.ry * 0.5, 128],
    [s.ry, 156],
    lo,
    hi
  ];
  const valley = x > 1920 && s.sz > s.cz + 50;
  const outerY = Math.max(s.by, hi[0]);
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    if (valley) {
      let y, z;
      if (t <= 0.3) {
        const u = Math.sin((t / 0.3) * Math.PI / 2);
        y = lerp(outerY, s.sy, u);
        z = lerp(beltZ, s.sz, u);
      } else {
        const u = (t - 0.3) / 0.7;
        const e = (1 - Math.cos(Math.PI * u)) / 2;
        y = s.sy * Math.cos(u * Math.PI / 2);
        z = lerp(s.sz, s.cz, e);
      }
      pts.push([Math.max(0, y), z]);
    } else {
      const e = (1 - Math.cos(Math.PI * t)) / 2;
      pts.push([outerY * Math.pow(1 - t, 0.7), lerp(beltZ, s.cz, e)]);
    }
  }
  pts[pts.length - 1][0] = 0;
  pts[pts.length - 1][1] = s.cz;
  return pts;
}

const GAP = 3;

function ringAt(x) {
  const half = halfPoints(x);
  const ring = [];
  for (let i = 0; i < half.length; i++) ring.push(dentPoint(x, half[i][0], half[i][1]));
  for (let i = half.length - 2; i >= 1; i--) ring.push(dentPoint(x, -half[i][0], half[i][1]));
  return ring;
}

function stations() {
  const xs = [];
  for (let x = TAIL; x <= NOSE; x += STEP) xs.push(x);
  if (xs[xs.length - 1] !== NOSE) xs.push(NOSE);
  return xs;
}

function halfIndex(j, H) {
  if (j < H) return j;
  return 2 * H - 2 - j;
}

function inDoor(x, z) {
  // Lower door skin only. The glass and its frame sit above the belt as a smooth loop.
  if (z < 175 || z > 1012) return false;
  if (x < 1044 || x > 1676) return false;
  return true;
}

function classify(x, y, z) {
  const ay = Math.abs(y);
  const s = shape(x);
  if (x > 3240 && z < 560) return 'bumper_front';
  if (x < -800 && z < 740) return 'bumper_rear';
  if (inDoor(x, z) && ay > 520) return y >= 0 ? 'door_l' : 'door_r';
  if (x > 2060 && x < 3200 && z < s.sz - 30 && ay < s.sy * 0.56 && z > s.cz - 15) return 'hood';
  if (x > -880 && x < 260 && z > 990 && ay < 500) return 'lid';
  if (x > 1860 && x < 3290 && ay > 500 && z > 460) return y >= 0 ? 'fender_l' : 'fender_r';
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
  // Tall at the A-pillar, short at the B-pillar. The top follows the roof down.
  const pts = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([lerp(1590, 1120, t), lerp(1015, 985, t)]);
  }
  for (let i = 1; i <= 4; i++) pts.push([1120, lerp(985, 1145, i / 4)]);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    pts.push([lerp(1120, 1590, t), lerp(1145, 1272, Math.pow(t, 0.82))]);
  }
  for (let i = 1; i < 6; i++) pts.push([1590, lerp(1272, 1015, i / 6)]);
  return pts;
}

const WINDOW = doorWindowPoly();

function insidePoly(x, z, poly) {
  let n = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi + 1e-9) + xi) n = !n;
  }
  return n;
}

function buildSkin() {
  const xs = stations();
  const rings = xs.map(ringAt);
  const J = rings[0].length;
  const ids = Object.keys(NAMES).filter(id => !id.startsWith('wheel') && id !== 'engine' && id !== 'spoiler');
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
      const a = rings[i][j], b = rings[i + 1][j], c = rings[i + 1][j2], d = rings[i][j2];
      const ctd = centroid([a, b, c, d]);
      if (inLamp(ctd[0], ctd[1], ctd[2], 0.55)) continue;
      if (insidePoly(ctd[0], ctd[2], WINDOW) && Math.abs(ctd[1]) > 480 && ctd[0] > 1080 && ctd[0] < 1640 && ctd[2] > 900) continue;
      const area = Math.hypot(...cross(sub(b, a), sub(d, a)));
      if (area < 30) continue;
      const id = classify(ctd[0], ctd[1], ctd[2]);
      const ia = take(id, i, j, a), ib = take(id, i + 1, j, b);
      const ic = take(id, i + 1, j2, c), idd = take(id, i, j2, d);
      parts[id].triangles.push([ia, ib, ic], [ia, ic, idd]);
    }
  }
  cap(parts.bumper_front, rings[rings.length - 1], true);
  cap(parts.bumper_rear, rings[0], false);
  return parts;
}

function cap(part, ring, nose) {
  if (!part) return;
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

function yOnFlank(x, z) {
  const half = halfPoints(x);
  let best = half[2][0], bestD = Infinity;
  for (let i = 2; i < half.length - 1; i++) {
    const a = half[i], b = half[i + 1];
    if ((z - a[1]) * (z - b[1]) <= 0 && Math.abs(b[1] - a[1]) > 1) {
      const t = (z - a[1]) / (b[1] - a[1]);
      return Math.abs(lerp(a[0], b[0], t));
    }
    const d = Math.abs(a[1] - z);
    if (d < bestD) { bestD = d; best = a[0]; }
  }
  return best;
}

function skinPoint(x, side, z, out) {
  const y = yOnFlank(x, z);
  return [x, side * (y + (out || 0)), z];
}

function ellipsePts(frame, scale, along, n = 40) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = TAU * i / n;
    pts.push(add(frame.center, add(add(mul(frame.long, Math.cos(a) * frame.A * scale), mul(frame.up, Math.sin(a) * frame.B * scale)), mul(frame.N, along))));
  }
  return pts;
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

function addFriedEgg(part, side) {
  const f = lampFrame(side);
  const bezel = ellipsePts(f, 1, 18, 44);
  const lip = ellipsePts(f, 0.9, 18, 44);
  const recess = ellipsePts(f, 0.9, -8, 44);
  const lens = ellipsePts(f, 0.78, -2, 44);
  addBand(part, bezel, lip);
  addBand(part, lip, recess);
  addBand(part, recess, lens);
  addLoop(part, bezel, 'edge');
  addLoop(part, lens, 'edge');
  const outboard = norm(sub([0, side, 0], mul(f.N, dot([0, side, 0], f.N))));
  const pc = add(add(f.center, mul(f.N, 2)), mul(outboard, 28));
  const ring = [];
  for (let i = 0; i < 36; i++) {
    const a = TAU * i / 36;
    ring.push(add(pc, add(mul(f.long, Math.cos(a) * 58), mul(f.up, Math.sin(a) * 58))));
  }
  addLoop(part, ring, 'edge');
  const li = part.vertices.length;
  for (const p of lens) part.vertices.push(p.slice());
  const ri = part.vertices.length;
  for (const p of ring) part.vertices.push(p.slice());
  const n = lens.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const k = Math.round(i * 36 / n) % 36;
    const m = Math.round(j * 36 / n) % 36;
    part.triangles.push([li + i, li + j, ri + m], [li + i, ri + m, ri + k]);
  }
}

function placeRoundLamp(part, at, radius) {
  const piece = G.piece();
  G.lathe(piece, [[0, 0], [4, radius * 0.7], [10, radius], [18, radius * 0.72], [24, 0]], {axis: 'x', segments: 22, role: 'edge'});
  const shift = v => [v[0] + at[0], v[1] + at[1], v[2] + at[2]];
  piece.vertices = piece.vertices.map(shift);
  piece.lines = piece.lines.map(l => ({role: l.role, a: shift(l.a), b: shift(l.b)}));
  G.merge(part, piece);
}

function roundedRect(x, y0, y1, z0, z1, ry, rz, n = 8) {
  const pts = [];
  const corners = [[y1, z1, -1, 1], [y0, z1, 1, 1], [y0, z0, 1, -1], [y1, z0, -1, -1]];
  for (const [y, z, sy, sz] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = (Math.PI / 2) * (i / n);
      pts.push([x, y + sy * Math.cos(a) * ry, z + sz * Math.sin(a) * rz]);
    }
  }
  return pts;
}

function addDetails(parts) {
  for (const side of [-1, 1]) addFriedEgg(parts[side > 0 ? 'fender_l' : 'fender_r'], side);

  const intake = roundedRect(3324, -360, 360, 250, 455, 36, 28, 6);
  const intakeIn = intake.map(p => [p[0] - 26, p[1] * 0.9, 250 + (p[2] - 250) * 0.82]);
  addBand(parts.bumper_front, intake, intakeIn);
  addLoop(parts.bumper_front, intake, 'edge');
  addOpen(parts.bumper_front, [[3336, -420, 214], [3352, 0, 188], [3336, 420, 214]], 'edge');
  for (const side of [-1, 1]) {
    placeRoundLamp(parts.bumper_front, [3308, side * 575, 385], 46);
    addLoop(parts.bumper_front, ellipsePts({
      center: [3316, side * 575, 385],
      N: [1, 0, 0], long: [0, 1, 0], up: [0, 0, 1], A: 62, B: 62
    }, 1, 0, 24), 'edge');
  }

  const shut = [];
  const shutR = [];
  for (let x = 2140; x <= 3160; x += 40) {
    const s = shape(x);
    const y = s.sy * 0.62;
    const z = lerp(s.sz, s.cz, 0.22);
    shut.push([x, y, z + 8]);
    shutR.push([x, -y, z + 8]);
  }
  addOpen(parts.body, shut, 'edge');
  addOpen(parts.body, shutR, 'edge');

  const hip = [];
  const hipR = [];
  for (let x = -780; x <= 980; x += 36) {
    const s = shape(x);
    hip.push([x, s.by + 10, Math.min(s.bz, s.sz) - 20]);
    hipR.push([x, -(s.by + 10), Math.min(s.bz, s.sz) - 20]);
  }
  addOpen(parts.body, hip, 'detail');
  addOpen(parts.body, hipR, 'detail');

  addGlass(parts);
  for (const side of [-1, 1]) {
    addLoop(parts.body, tailLamp(side), 'edge');
    addLoop(parts.bumper_rear, exhaustOval(side), 'edge');
  }
  for (let i = 0; i < 6; i++) {
    const x = -80 - i * 90;
    const z = 1045 - i * 16;
    const half = 340 - Math.abs(i - 2.5) * 16;
    G.line(parts.lid, [x, -half, z], [x, half, z], 'detail');
  }
}

function tailLamp(side) {
  const pts = [];
  for (let i = 0; i < 32; i++) {
    const a = TAU * i / 32;
    const along = Math.cos(a);
    const up = Math.sin(a);
    pts.push([-1005 - Math.max(0, -along) * 18, side * (560 + along * 210), 830 + up * 48]);
  }
  return pts;
}

function exhaustOval(side) {
  const pts = [];
  for (let i = 0; i < 28; i++) {
    const a = TAU * i / 28;
    pts.push([TAIL - 8, side * 440 + Math.cos(a) * 78, 275 + Math.sin(a) * 30]);
  }
  return pts;
}

function addGlass(parts) {
  const windshield = [];
  for (let i = 0; i <= 10; i++) windshield.push([1965, -560 + 112 * i, 955]);
  for (let i = 1; i <= 7; i++) {
    const t = i / 7;
    windshield.push([lerp(1965, 1460, t), 560 - t * 150, lerp(955, 1272, t)]);
  }
  for (let i = 1; i <= 10; i++) windshield.push([1460, 410 - 82 * i, 1272]);
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    windshield.push([lerp(1460, 1965, t), -410 - t * 150, lerp(1272, 955, t)]);
  }
  addLoop(parts.body, windshield, 'edge');

  const rear = [];
  for (let i = 0; i <= 8; i++) rear.push([220, -480 + 120 * i, 1065]);
  for (let i = 1; i <= 7; i++) {
    const t = i / 7;
    rear.push([lerp(220, 980, t), 480 - t * 180, lerp(1065, 1284, t)]);
  }
  for (let i = 1; i <= 8; i++) rear.push([980, 300 - 75 * i, 1284]);
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    rear.push([lerp(980, 220, t), -300 - t * 180, lerp(1284, 1065, t)]);
  }
  addLoop(parts.body, rear, 'edge');

  for (const side of [-1, 1]) {
    const door = parts[side > 0 ? 'door_l' : 'door_r'];
    const outer = WINDOW.map(([x, z]) => skinPoint(x, side, z, 9));
    const inner = WINDOW.map(([x, z]) => {
      const cx = 1360, cz = 1100;
      return skinPoint(cx + (x - cx) * 0.78, side, cz + (z - cz) * 0.72, 9);
    });
    addBand(door, outer, inner);
    addLoop(door, outer, 'edge');
    addLoop(door, inner, 'edge');
    const glass = inner.map(p => [p[0], p[1] - side * 16, p[2]]);
    const base = door.vertices.length;
    for (const p of glass) door.vertices.push(p);
    for (let i = 1; i < glass.length - 1; i++) door.triangles.push([base, base + i, base + i + 1]);
    addLoop(door, glass, 'detail');

    const q = [];
    const qx0 = 860, qx1 = 1005, qz0 = 1135, qz1 = 1240;
    for (let i = 0; i <= 4; i++) q.push(skinPoint(lerp(qx0, qx1, i / 4), side, qz0, 8));
    for (let i = 1; i <= 3; i++) q.push(skinPoint(qx1, side, lerp(qz0, qz1, i / 3), 8));
    for (let i = 1; i <= 4; i++) q.push(skinPoint(lerp(qx1, qx0, i / 4), side, qz1, 8));
    for (let i = 1; i < 3; i++) q.push(skinPoint(qx0, side, lerp(qz1, qz0, i / 3), 8));
    addLoop(parts.body, q, 'edge');
  }
}

function addMirrors(parts) {
  const add = (door, side) => {
    const y0 = side * 730, y1 = side * 900;
    G.box(door, [1565, Math.min(y0, y1), 1025], [1660, Math.max(y0, y1), 1080], {radius: 18, role: 'edge'});
    G.box(door, [1605, Math.min(side * 690, side * 745), 1040], [1638, Math.max(side * 690, side * 745), 1068], {radius: 4, role: 'edge'});
    G.line(door, skinPoint(1280, side, 900, 8), skinPoint(1210, side, 900, 8), 'detail');
  };
  add(parts.door_l, 1);
  add(parts.door_r, -1);
}

function addSpoilerAndEngine(parts) {
  const spoiler = emptyPart('spoiler');
  const y = 340;
  const top = [[-760, -y, 1012], [-640, -y, 1024], [-640, y, 1024], [-760, y, 1012]];
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
  G.box(engine, [-520, -330, 320], [40, 330, 680], {radius: 40, role: 'edge'});
  G.line(engine, [-500, 0, 620], [20, 0, 620], 'detail');
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
  const near = part.vertices.filter(v => Math.abs(v[0] - target) < 50 && Math.abs(v[1]) < 980);
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
  apply('bumper_front', v => move(v, [340, 0, 12], e));
  apply('bumper_rear', v => move(v, [-320, 0, 8], e));
  apply('hood', v => rotYAround(v, base._hingeHood, -1.05 * e));
  apply('lid', v => rotYAround(v, base._hingeLid, 0.95 * e));
  apply('spoiler', v => move(rotYAround(v, base._hingeLid, 0.95 * e), [0, 0, 160], e));
  apply('door_l', v => move(rotZAround(v, base._hingeDoorL, -0.72 * e), [0, 30, 16], e));
  apply('door_r', v => move(rotZAround(v, base._hingeDoorR, 0.72 * e), [0, -30, 16], e));
  apply('fender_l', v => move(v, [70, 240, 24], e));
  apply('fender_r', v => move(v, [70, -240, 24], e));
  apply('wheel_fl', v => move(v, [30, 440, -8], e));
  apply('wheel_fr', v => move(v, [30, -440, -8], e));
  apply('wheel_rl', v => move(v, [-20, 480, -8], e));
  apply('wheel_rr', v => move(v, [-20, -480, -8], e));
  apply('engine', v => move(v, [-80, 0, -230], e));
  return Object.values(parts);
}

module.exports = {poseParts, baseParts, NAMES, NOSE, TAIL, shape, lampFrame};
