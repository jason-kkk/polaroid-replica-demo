'use strict';
/**
 * Original simplified hidden-line model of a stock 997.1 Carrera Coupé.
 * Proportions are estimated from a side outline scaled to the known 2350 mm
 * wheelbase, then the roof is scaled to the 1310 mm factory height.
 * This is an illustration, not a class-A or manufacturing surface.
 *
 * Units: millimetres. +X nose, +Y left (driver side on an LHD car), +Z up.
 * Rear axle at X = 0. Ground at Z = 0.
 */

const G = require('./lib/geometry.js');

const TAU = Math.PI * 2;

// Side-outline samples, mm. X from the rear axle. Estimated, not a factory overhang table.
const TOP = [
  [-1083, 594], [-1008, 716], [-933, 794], [-859, 847], [-784, 892], [-709, 929],
  [-635, 958], [-560, 991], [-485, 991], [-411, 995], [-336, 1023], [-261, 1032],
  [-187, 1056], [-112, 1077], [-37, 1101], [37, 1142], [112, 1163], [187, 1183],
  [261, 1228], [336, 1245], [411, 1261], [485, 1273], [560, 1281], [635, 1290],
  [709, 1298], [784, 1306], [859, 1310], [1008, 1310], [1157, 1294], [1232, 1281],
  [1307, 1257], [1381, 1200], [1456, 1163], [1531, 1122], [1605, 1081], [1680, 1040],
  [1755, 999], [1829, 954], [1904, 913], [1979, 897], [2053, 913], [2128, 905],
  [2203, 892], [2277, 876], [2352, 864], [2501, 839], [2651, 823], [2800, 794],
  [2949, 716], [3099, 667], [3173, 618], [3248, 577], [3339, 512]
];
const BELLY = [
  [-1091, 360], [-1000, 230], [-820, 201], [-550, 168], [-200, 160],
  [400, 127], [900, 127], [1500, 123], [1900, 131], [2350, 125],
  [2750, 98], [3000, 147], [3200, 188], [3339, 230]
];
// Half-width of the widest plan section. 904 = 1808 / 2. Estimated plan taper.
const HW = [
  [-1091, 420], [-980, 740], [-700, 850], [-280, 890], [0, 904],
  [420, 820], [1000, 755], [1500, 790], [1860, 860], [2300, 900],
  [2680, 888], [3020, 800], [3200, 640], [3290, 420], [3339, 220]
];
// Height of the widest shoulder (flare), below the window belt on the haunches.
const FLAREZ = [
  [-1091, 470], [-800, 720], [-200, 620], [250, 680], [750, 800],
  [1200, 860], [1750, 830], [2150, 740], [2500, 680], [2950, 620],
  [3200, 500], [3339, 400]
];
// Window-belt / hood-edge height.
const BELT = [
  [-1091, 560], [-700, 980], [-150, 1040], [450, 980], [1100, 910],
  [1650, 920], [2000, 940], [2400, 880], [2850, 760], [3150, 640], [3339, 490]
];
// Half-width of the roof, deck or hood crown.
const CROWN = [
  [-1091, 180], [-820, 500], [-300, 640], [250, 520], [900, 500],
  [1400, 560], [1750, 640], [2050, 700], [2550, 660], [3000, 480],
  [3220, 300], [3339, 120]
];
const ROCKF = [[-1091, 0.78], [0, 0.70], [1100, 0.84], [2300, 0.74], [3339, 0.88]];
const BELTF = [[-1091, 0.72], [0, 0.86], [1100, 0.98], [1800, 0.94], [2500, 0.90], [3339, 0.72]];

const NOSE = 3339;
const TAIL = -1091;
const FRONT_AXLE = 2350;
const REAR_AXLE = 0;

const ARCH = [
  {x: FRONT_AXLE, z: 322.6, r: 390, yIn: 500},
  {x: REAR_AXLE, z: 334.6, r: 408, yIn: 530}
];

function lerp(st, x) {
  if (x <= st[0][0]) return st[0][1];
  if (x >= st[st.length - 1][0]) return st[st.length - 1][1];
  let lo = 0, hi = st.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (st[m][0] <= x) lo = m;
    else hi = m;
  }
  const t = (x - st[lo][0]) / (st[hi][0] - st[lo][0]);
  return st[lo][1] + (st[hi][1] - st[lo][1]) * t;
}
function smooth(st, x) {
  if (x <= st[0][0]) return st[0][1];
  if (x >= st[st.length - 1][0]) return st[st.length - 1][1];
  let lo = 0, hi = st.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (st[m][0] <= x) lo = m;
    else hi = m;
  }
  const t = (x - st[lo][0]) / (st[hi][0] - st[lo][0]);
  const s = t * t * (3 - 2 * t);
  return st[lo][1] + (st[hi][1] - st[lo][1]) * s;
}

function stations() {
  const xs = [];
  for (let x = TAIL; x <= NOSE; x += 34) xs.push(Math.round(x * 10) / 10);
  if (xs[xs.length - 1] !== NOSE) xs.push(NOSE);
  return xs;
}

function chaikin(pts) {
  const n = [pts[0].slice()];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    n.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
    n.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  n.push(pts[pts.length - 1].slice());
  n[0][0] = 0;
  n[n.length - 1][0] = 0;
  return n;
}

function sectionYZ(x) {
  // One smooth half-section. z climbs once and y has a single shoulder,
  // so the hidden-line silhouette is a curve instead of a faceted slab.
  const hw = Math.max(40, smooth(HW, x));
  const zt = lerp(TOP, x);
  const zb = lerp(BELLY, x);
  const belt = Math.min(zt - 40, Math.max(zb + 100, lerp(BELT, x)));
  const flare = Math.min(belt - 28, Math.max(zb + 55, lerp(FLAREZ, x)));
  const crown = Math.max(30, Math.min(hw * 0.88, smooth(CROWN, x)));
  const n = 16;
  const uFlare = 0.36, uBelt = 0.50, uCrown = 0.76;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    let y, z;
    if (u <= uFlare) {
      const t = u / uFlare;
      y = hw * Math.sin(t * Math.PI / 2);
      z = zb + (flare - zb) * (1 - Math.cos(t * Math.PI / 2));
    } else if (u <= uBelt) {
      const t = (u - uFlare) / (uBelt - uFlare);
      y = hw * (1 - 0.03 * t);
      z = flare + (belt - flare) * t;
    } else if (u <= uCrown) {
      const t = (u - uBelt) / (uCrown - uBelt);
      const s = t * t * (3 - 2 * t);
      y = hw * 0.97 + (crown - hw * 0.97) * s;
      z = belt + (zt - belt) * Math.sin(t * Math.PI / 2) * 0.88;
    } else {
      const t = (u - uCrown) / (1 - uCrown);
      y = crown * Math.cos(t * Math.PI / 2);
      const z0 = belt + (zt - belt) * 0.88;
      z = z0 + (zt - z0) * Math.sin(t * Math.PI / 2);
    }
    pts.push([Math.max(0, y), z]);
  }
  for (let i = 1; i < pts.length; i++) if (pts[i][1] < pts[i - 1][1]) pts[i][1] = pts[i - 1][1] + 0.4;
  pts[0][0] = 0;
  pts[n][0] = 0;
  pts[n][1] = zt;
  return pts;
}

function conformArch(x, y, z) {
  let yy = y, zz = z;
  const side = Math.sign(y) || 1;
  for (const w of ARCH) {
    const dx = x - w.x;
    if (Math.abs(dx) >= w.r - 0.5) continue;
    if (Math.abs(yy) < w.yIn) continue;
    const h = Math.sqrt(Math.max(0, w.r * w.r - dx * dx));
    const zU = w.z + h, zL = w.z - h;
    if (zz > zL && zz < zU) {
      if (zz >= w.z - 20) zz = zU;
      else if (zL >= lerp(BELLY, x) + 6) zz = zL;
      else yy = side * (w.yIn - 6);
    }
  }
  return [yy, zz];
}

function ringAt(x) {
  const half = sectionYZ(x).map(([y, z]) => conformArch(x, y, z));
  const n = half.length - 1;
  const ring = [];
  for (let i = 0; i <= n; i++) ring.push([x, half[i][0], half[i][1]]);
  for (let i = n - 1; i >= 1; i--) ring.push([x, -half[i][0], half[i][1]]);
  return ring;
}

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

function inArch(c, scale = 0.94) {
  const ay = Math.abs(c[1]);
  for (const w of ARCH) {
    if (ay < w.yIn + 8) continue;
    const dx = c[0] - w.x, dz = c[2] - w.z;
    const r = w.r * scale;
    if (dx * dx + dz * dz < r * r && c[2] > 60) return true;
  }
  return false;
}

function classify(x, y, z, n, u) {
  // Cuts follow a section parameter or a single station, so the seam is a
  // smooth surface curve instead of a staircase of quads.
  const ay = Math.abs(y);
  const crown = Math.max(80, smooth(CROWN, x));
  if (x > 3220) return 'bumper_front';
  if (x > 3000 && u < 0.40) return 'bumper_front';
  if (x < -760 && u < 0.46) return 'bumper_rear';
  if (x > 1980 && x < 3200 && u > 0.60 && ay < crown * 1.15 && z > 640) return 'hood';
  if (x > -820 && x < 160 && u > 0.64 && ay < 760 && z < 1120 && z > 860) return 'lid';
  if (x > 1680 && x < 3220 && u > 0.16 && u < 0.60 && ay > crown * 0.55 && !(x < 1900 && u > 0.48)) {
    return y >= 0 ? 'fender_l' : 'fender_r';
  }
  if (ay > 430 && u > 0.16 && u < 0.50 && x > 620 && x < 1760) return y >= 0 ? 'door_l' : 'door_r';
  return 'body';
}

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

function emptyPart(id) {
  const [zh, en] = NAMES[id];
  const p = G.part(id, en);
  p.zh = zh;
  p.en = en;
  return p;
}

function buildSkin() {
  const xs = stations();
  const rings = xs.map(ringAt);
  const J = rings[0].length;
  const ids = Object.keys(NAMES).filter(id => !id.startsWith('wheel') && id !== 'engine' && id !== 'spoiler');
  const parts = {};
  for (const id of ids) parts[id] = emptyPart(id);
  const vert = {};
  const vnorm = {};
  for (const id of ids) {
    vert[id] = new Map();
    vnorm[id] = [];
  }
  const quads = [];

  const take = (id, i, j) => {
    const key = i + ':' + j;
    const map = vert[id];
    if (map.has(key)) return map.get(key);
    const idx = parts[id].vertices.length;
    parts[id].vertices.push(rings[i][j].slice());
    vnorm[id].push([0, 0, 0]);
    map.set(key, idx);
    return idx;
  };

  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < J; j++) {
      const j2 = (j + 1) % J;
      const a = rings[i][j], b = rings[i + 1][j], c = rings[i + 1][j2], d = rings[i][j2];
      const ctd = centroid([a, b, c, d]);
      if (inArch(ctd)) {
        quads.push({i, j, id: null});
        continue;
      }
      const span = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) + Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
      if (span < 8) {
        quads.push({i, j, id: null});
        continue;
      }
      let n = norm(cross(sub(b, a), sub(d, a)));
      const interior = [ctd[0], 0, Math.min(lerp(TOP, ctd[0]) - 30, Math.max(lerp(BELLY, ctd[0]) + 80, 620))];
      if (dot(n, sub(ctd, interior)) < 0) n = mul(n, -1);
      const halfN = J / 2;
      const uOf = k => (k <= halfN ? k : J - k) / halfN;
      const u = (uOf(j) + uOf(j2)) / 2;
      const id = classify(ctd[0], ctd[1], ctd[2], n, u);
      quads.push({i, j, id, n});
      const ia = take(id, i, j), ib = take(id, i + 1, j), ic = take(id, i + 1, j2), idd = take(id, i, j2);
      const part = parts[id];
      part.triangles.push([ia, ib, ic], [ia, ic, idd]);
      for (const ix of [ia, ib, ic, idd]) vnorm[id][ix] = add(vnorm[id][ix], n);
    }
  }

  // Caps close the nose and tail. Panel gaps are drawn later as smooth
  // curves. Grid-boundary rims were the zigzag lines across the roof.
  cap(parts.bumper_front, rings[rings.length - 1], true);
  cap(parts.bumper_rear, rings[0], false);
  return {parts, rings, xs};
}

function cap(part, ring, nose) {
  const c = centroid(ring);
  const ci = part.vertices.length;
  part.vertices.push(c);
  const base = part.vertices.length;
  for (const p of ring) part.vertices.push(p.slice());
  for (let j = 0; j < ring.length; j++) {
    const a = base + j, b = base + (j + 1) % ring.length;
    part.triangles.push(nose ? [ci, a, b] : [ci, b, a]);
  }
}

function addLoop(part, pts, role) {
  if (!part || pts.length < 2) return;
  for (let i = 0; i < pts.length; i++) G.line(part, pts[i], pts[(i + 1) % pts.length], role);
}
function addOpen(part, pts, role) {
  if (!part || pts.length < 2) return;
  for (let i = 0; i < pts.length - 1; i++) G.line(part, pts[i], pts[i + 1], role);
}

function onSkin(x, side, zTarget) {
  const ring = ringAt(x);
  let best = null, score = 1e18;
  for (const p of ring) {
    if (side && Math.sign(p[1]) !== side && Math.abs(p[1]) > 25) continue;
    const dz = p[2] - zTarget;
    const inward = Math.max(0, smooth(HW, x) - Math.abs(p[1]));
    const s = dz * dz + inward * 0.35;
    if (s < score) { score = s; best = p; }
  }
  if (!best) return [x, side * 400, zTarget];
  const hw = smooth(HW, x);
  const crown = smooth(CROWN, x);
  if (Math.abs(best[1]) < crown * 0.8 && best[2] > lerp(BELT, x) - 20) return [best[0], best[1], best[2] + 8];
  if (x > 3120) return [best[0] + 8, best[1], best[2]];
  if (x < -900) return [best[0] - 8, best[1], best[2]];
  const sy = Math.sign(best[1] || side || 1);
  return [best[0], best[1] + sy * 8, best[2]];
}

function tailLamp(side) {
  // Rounder 997.1 lens on the rear quarter, one each side. Not the 997.2 LED shape.
  const pts = [];
  for (let i = 0; i < 26; i++) {
    const a = TAU * i / 26;
    pts.push([-1015 - Math.sin(a) * 10, side * (560 + Math.cos(a) * 155), 790 + Math.sin(a) * 52]);
  }
  return pts;
}

function lampOval(side) {
  // One clear oval on the wing, outer end up and back. No second jagged seam.
  const pts = [];
  for (let i = 0; i < 28; i++) {
    const a = TAU * i / 28;
    const x = 3090 - Math.cos(a) * 155;
    const u = 0.47 + Math.sin(a) * 0.07 - Math.cos(a) * 0.02;
    pts.push(lift(skin(x, side, u), side));
  }
  return pts;
}

function ellipse(cx, cz, rx, rz, tilt, side, n = 28) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = TAU * i / n;
    const dx = Math.cos(a) * rx, dz = Math.sin(a) * rz;
    const x = cx + dx * Math.cos(tilt) - dz * Math.sin(tilt);
    const z = cz + dx * Math.sin(tilt) + dz * Math.cos(tilt);
    pts.push(onSkin(x, side, z));
  }
  return pts;
}

function slotLine(x0, x1, z, y0, y1, lift = 8) {
  return [[x0, y0, z + lift], [x1, y1, z + lift]];
}

function addDetails(parts) {
  // 997.1 headlamps sit on the outer wing, clear and oval, outer corner up and back.
  // Drawn just proud of the fender so they are not swallowed by the hood crown.
  for (const side of [-1, 1]) {
    const fender = parts[side > 0 ? 'fender_l' : 'fender_r'];
    addLoop(fender, lampOval(side), 'edge');
  }
  for (const side of [-1, 1]) {
    addLoop(parts.bumper_front, ellipse(3235, 455, 78, 24, 0, side, 16), 'edge');
  }
  // One wide centre mouth, two side intakes, blank plate. No crest or script.
  addIntake(parts.bumper_front, 3295, 0, 250, 520, 90);
  addIntake(parts.bumper_front, 3260, 560, 230, 170, 64);
  addIntake(parts.bumper_front, 3260, -560, 230, 170, 64);
  addPlate(parts.bumper_front, 3310, 0, 400, 200, 72);
  // Tail lamps — rounder 997.1 lenses, one each side.
  for (const side of [-1, 1]) {
    addLoop(parts.body, tailLamp(side), 'edge');
  }
  // One elongated oval outlet each side, just proud of the rear face.
  for (const side of [-1, 1]) {
    addLoop(parts.bumper_rear, ovalYZ(-1102, side * 400, 280, 70, 34, 18), 'edge');
  }
  addPlate(parts.bumper_rear, -1104, 0, 460, 140, 100);
  // Engine-lid slats, transverse, retracted-spoiler car.
  for (let i = 0; i < 8; i++) {
    const x = -40 - i * 78;
    const z = lerp(TOP, x);
    const half = 430 - Math.abs(i - 3.5) * 18;
    G.line(parts.lid, [x, -half, z + 7], [x, half, z + 7], 'detail');
    G.line(parts.lid, [x - 10, -half + 24, z + 7], [x - 10, half - 24, z + 7], 'detail');
  }
  // Glass frames kept on the body. Door shell stops at the belt.
  addGlass(parts);
  // Door handles and fuel filler (right front fender, the side this view shows).
  for (const side of [-1, 1]) {
    const door = parts[side > 0 ? 'door_l' : 'door_r'];
    const h = onSkin(1180, side, lerp(BELT, 1180) - 70);
    G.line(door, [h[0] - 46, h[1], h[2]], [h[0] + 46, h[1], h[2]], 'detail');
  }
  addLoop(parts.fender_r, (() => {
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = TAU * i / 16;
      pts.push(lift(skin(2060 + Math.cos(a) * 28, -1, 0.52 + Math.sin(a) * 0.025), -1));
    }
    return pts;
  })(), 'detail');
}

function ovalYZ(x, y, z, ry, rz, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = TAU * i / n;
    pts.push([x, y + Math.cos(a) * ry, z + Math.sin(a) * rz]);
  }
  return pts;
}

function addIntake(part, x, y, z, w, h) {
  addLoop(part, ovalYZ(x, y, z, w / 2, h / 2, 18), 'detail');
  addLoop(part, ovalYZ(x + 6, y, z, w / 2 - 16, h / 2 - 12, 14), 'detail');
}

function addPlate(part, x, y, z, w, h) {
  const rx = w / 2, rz = h / 2;
  addLoop(part, [
    [x, y - rx, z - rz], [x, y + rx, z - rz], [x, y + rx, z + rz], [x, y - rx, z + rz]
  ], 'detail');
}

function skin(x, side, u) {
  const half = sectionYZ(Math.max(TAIL, Math.min(NOSE, x)));
  const f = Math.max(0, Math.min(0.999, u)) * (half.length - 1);
  const i = Math.floor(f);
  const t = f - i;
  const a = half[i], b = half[i + 1];
  return [x, side * (a[0] * (1 - t) + b[0] * t), a[1] * (1 - t) + b[1] * t];
}

function lift(p, side) {
  // Far enough outside the skin that a short chord is not swallowed by the surface.
  if (!side) return [p[0], p[1], p[2] + 16];
  return [p[0], p[1] + side * 16, p[2] + 4];
}

function addGlass(parts) {
  const body = parts.body;
  // Windshield: raked 911 screen, curved in plan, A-pillars included.
  const wind = [];
  for (let i = 0; i <= 16; i++) wind.push(lift(skin(1965, -1 + 2 * i / 16, 0.58), 0));
  for (let i = 1; i <= 14; i++) wind.push(lift(skin(1965 + (1160 - 1965) * i / 14, 1, 0.58 + (0.90 - 0.58) * i / 14), 1));
  for (let i = 1; i <= 16; i++) wind.push(lift(skin(1160, 1 - 2 * i / 16, 0.90), 0));
  for (let i = 1; i < 14; i++) wind.push(lift(skin(1160 + (1965 - 1160) * i / 14, -1, 0.90 + (0.58 - 0.90) * i / 14), -1));
  addLoop(body, wind, 'edge');
  // Rear screen, long and sloping down to the deck.
  const rear = [];
  for (let i = 0; i <= 14; i++) rear.push(lift(skin(240, -1 + 2 * i / 14, 0.66), 0));
  for (let i = 1; i <= 14; i++) rear.push(lift(skin(240 + (900 - 240) * i / 14, 1, 0.66 + (0.90 - 0.66) * i / 14), 1));
  for (let i = 1; i <= 14; i++) rear.push(lift(skin(900, 1 - 2 * i / 14, 0.90), 0));
  for (let i = 1; i < 14; i++) rear.push(lift(skin(900 + (240 - 900) * i / 14, -1, 0.90 + (0.66 - 0.90) * i / 14), -1));
  addLoop(body, rear, 'edge');
  for (const side of [-1, 1]) {
    const glass = [];
    const xs = [1720, 1500, 1240, 980, 760];
    for (const x of xs) glass.push(lift(skin(x, side, 0.54), side));
    glass.push(lift(skin(700, side, 0.66), side));
    glass.push(lift(skin(860, side, 0.76), side));
    glass.push(lift(skin(1180, side, 0.80), side));
    glass.push(lift(skin(1560, side, 0.74), side));
    glass.push(lift(skin(1720, side, 0.62), side));
    addLoop(body, glass, 'edge');
    const quarter = [];
    for (const [x, u] of [[680, 0.55], [480, 0.56], [280, 0.60], [240, 0.70], [360, 0.78], [560, 0.76], [680, 0.66]]) {
      quarter.push(lift(skin(x, side, u), side));
    }
    addLoop(body, quarter, 'edge');
    addOpen(side > 0 ? parts.fender_l : parts.fender_r, archPoints(ARCH[0], side), 'edge');
    addOpen(body, archPoints(ARCH[1], side), 'edge');
    // Hood shutline, one deliberate curve along the wing, plus the cowl.
    const shut = [];
    for (let x = 1980; x <= 3180; x += 80) shut.push(lift(skin(x, side, 0.60), side));
    addOpen(parts.hood, shut, 'edge');
  }
  const cowl = [];
  for (let i = 0; i <= 12; i++) cowl.push(lift(skin(1960, -1 + 2 * i / 12, 0.60), 0));
  addOpen(body, cowl, 'edge');
}

function archPoints(w, side) {
  const pts = [];
  for (let i = 0; i <= 22; i++) {
    const a = Math.PI * (0.12 + 0.76 * i / 22);
    const x = w.x + Math.cos(a) * w.r;
    const z = w.z + Math.sin(a) * w.r;
    const y = side * (smooth(HW, x) * 0.98);
    pts.push([x, y, z]);
  }
  return pts;
}

function makeWheel(id, spec) {
  const p = emptyPart(id);
  const R = spec.radius, W = spec.width;
  const profile = [
    [-W / 2, R * 0.70],
    [-W / 2 + W * 0.10, R * 0.86],
    [-W / 2 + W * 0.20, R * 0.985],
    [-W / 2 + W * 0.34, R],
    [W / 2 - W * 0.34, R],
    [W / 2 - W * 0.18, R * 0.985],
    [W / 2 - W * 0.08, R * 0.80],
    [W / 2, R * 0.64],
    [W / 2, R * 0.46],
    [W * 0.08, R * 0.40],
    [-W * 0.08, R * 0.40],
    [-W / 2, R * 0.55]
  ];
  G.lathe(p, profile, {axis: 'y', segments: 32, role: 'edge'});
  // Five spokes on the outer face. Phase keeps a spoke off dead-vertical.
  for (let k = 0; k < 5; k++) {
    const spoke = G.piece();
    const y0 = W / 2 - 18, y1 = W / 2 - 4;
    G.box(spoke, [-10, y0, R * 0.22], [10, y1, R * 0.78]);
    rotateY(spoke, k * TAU / 5 + 0.18);
    G.merge(p, spoke);
  }
  G.circle(p, [0, W / 2 + 1.5, 0], 30, [0, 1, 0], {segments: 20, role: 'detail'});
  G.circle(p, [0, W / 2 + 1.5, 0], 14, [0, 1, 0], {segments: 12, role: 'detail'});
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
    l.a[0] += d[0]; l.a[1] += d[1]; l.a[2] += d[2];
    l.b[0] += d[0]; l.b[1] += d[1]; l.b[2] += d[2];
  }
}

function addMirrors(parts) {
  // Single-arm 997.1 mirror, rooted in the A-pillar triangle of each door.
  const add = (door, side) => {
    const ySkin = side * (smooth(HW, 1720) - 6);
    const yOut = side * 980;
    const z0 = 990, z1 = 1055;
    G.box(door, [1688, Math.min(ySkin, yOut), z0], [1784, Math.max(ySkin, yOut), z1], {radius: 12, role: 'edge'});
    const a0 = side > 0 ? ySkin - 4 : yOut + 55;
    const a1 = side > 0 ? yOut - 55 : ySkin + 4;
    G.box(door, [1710, Math.min(a0, a1), 1012], [1748, Math.max(a0, a1), 1038], {radius: 5, role: 'edge'});
  };
  add(parts.door_l, 1);
  add(parts.door_r, -1);
}

function addSpoilerAndEngine(parts) {
  const spoiler = emptyPart('spoiler');
  // Retracted blade, just proud of the slatted lid. Not a fixed wing.
  const x0 = -830, x1 = -560;
  const z0 = lerp(TOP, x0) + 16, z1 = lerp(TOP, x1) + 10;
  const y = 390;
  const thick = 14;
  const top = [[x0, -y, z0], [x1, -y, z1], [x1, y, z1], [x0, y, z0]];
  const bot = top.map(p => [p[0], p[1], p[2] - thick]);
  const base = spoiler.vertices.length;
  for (const p of [...bot, ...top]) spoiler.vertices.push(p);
  const face = (a, b, c, d, flip) => {
    spoiler.triangles.push(flip ? [a, c, b] : [a, b, c], flip ? [a, d, c] : [a, c, d]);
  };
  // bottom 0..3, top 4..7
  face(base + 4, base + 5, base + 6, base + 7, false);
  face(base + 0, base + 1, base + 2, base + 3, true);
  face(base + 0, base + 1, base + 5, base + 4, false);
  face(base + 1, base + 2, base + 6, base + 5, false);
  face(base + 2, base + 3, base + 7, base + 6, false);
  face(base + 3, base + 0, base + 4, base + 7, false);
  for (let i = 0; i < 4; i++) G.line(spoiler, top[i], top[(i + 1) % 4], 'edge');
  parts.spoiler = spoiler;

  const engine = emptyPart('engine');
  // Clearly simplified rear flat-six envelope. No intake plumbing.
  G.box(engine, [-560, -340, 300], [80, 340, 690], {radius: 36, role: 'edge'});
  // A shallow valley line so it reads as a boxer, not a crate.
  G.line(engine, [-540, 0, 640], [60, 0, 640], 'detail');
  G.line(engine, [-540, 0, 360], [60, 0, 360], 'detail');
  parts.engine = engine;
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

function hingeOf(part, end) {
  // Front hinge: outermost vertex on the forward edge. Rear hinge: outermost on the back edge.
  let target = end === 'front' ? -Infinity : Infinity;
  for (const v of part.vertices) target = end === 'front' ? Math.max(target, v[0]) : Math.min(target, v[0]);
  const near = part.vertices.filter(v => Math.abs(v[0] - target) < 55 && Math.abs(v[1]) < 930);
  const pool = near.length ? near : part.vertices;
  return pool.reduce((best, v) => Math.abs(v[1]) > Math.abs(best[1]) ? v : best);
}

let BASE = null;
function baseParts() {
  if (BASE) return BASE;
  const {parts} = buildSkin();
  addDetails(parts);
  addMirrors(parts);
  addSpoilerAndEngine(parts);
  const frontR = 228.6 + 235 * 0.4;
  const rearR = 228.6 + 265 * 0.4;
  parts.wheel_fl = makeWheel('wheel_fl', {radius: frontR, width: 235, at: [FRONT_AXLE, 743, frontR], mirror: false});
  parts.wheel_fr = makeWheel('wheel_fr', {radius: frontR, width: 235, at: [FRONT_AXLE, -743, frontR], mirror: true});
  parts.wheel_rl = makeWheel('wheel_rl', {radius: rearR, width: 265, at: [REAR_AXLE, 767, rearR], mirror: false});
  parts.wheel_rr = makeWheel('wheel_rr', {radius: rearR, width: 265, at: [REAR_AXLE, -767, rearR], mirror: true});
  BASE = parts;
  const counts = {};
  for (const [id, p] of Object.entries(parts)) counts[id] = p.triangles.length;
  BASE._counts = counts;
  BASE._hingeHood = hingeOf(parts.hood, 'rear');
  BASE._hingeLid = hingeOf(parts.lid, 'front');
  // Hood and lid hinges stay on the centreline so the panel rises squarely.
  BASE._hingeHood = [BASE._hingeHood[0], 0, BASE._hingeHood[2]];
  BASE._hingeLid = [BASE._hingeLid[0], 0, BASE._hingeLid[2]];
  BASE._hingeDoorL = hingeOf(parts.door_l, 'front');
  BASE._hingeDoorR = hingeOf(parts.door_r, 'front');
  return BASE;
}

function clonePart(p) {
  return {
    id: p.id,
    name: p.name,
    zh: p.zh,
    en: p.en,
    explosion: [0, 0, 0],
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
  apply('bumper_front', v => move(v, [360, 0, 18], e));
  apply('bumper_rear', v => move(v, [-340, 0, 12], e));
  apply('hood', v => rotYAround(v, base._hingeHood, -1.12 * e));
  apply('lid', v => rotYAround(v, base._hingeLid, 1.02 * e));
  apply('spoiler', v => move(rotYAround(v, base._hingeLid, 1.02 * e), [0, 0, 210], e));
  apply('door_l', v => move(rotZAround(v, base._hingeDoorL, -0.95 * e), [0, 30, 36], e));
  apply('door_r', v => move(rotZAround(v, base._hingeDoorR, 0.95 * e), [0, -30, 36], e));
  apply('fender_l', v => move(v, [110, 250, 46], e));
  apply('fender_r', v => move(v, [110, -250, 46], e));
  apply('wheel_fl', v => move(v, [70, 460, -16], e));
  apply('wheel_fr', v => move(v, [70, -460, -16], e));
  apply('wheel_rl', v => move(v, [-60, 500, -16], e));
  apply('wheel_rr', v => move(v, [-60, -500, -16], e));
  apply('engine', v => move(v, [-160, 0, -280], e));
  return Object.values(parts);
}

module.exports = {poseParts, baseParts, NAMES, TOP, lerp, NOSE, TAIL};
