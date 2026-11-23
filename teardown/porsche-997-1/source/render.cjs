'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {poseParts, baseParts} = require('./model.cjs');
const {render, createCamera} = require('./lib/projection.js');

const CAM = {azimuth: -50, elevation: 18, roll: 0};
const FRAMES = 41;

function explodedBounds() {
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of poseParts(1)) for (const v of p.vertices) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], v[k]);
      max[k] = Math.max(max[k], v[k]);
    }
  }
  return {min: min.map(n => n - 120), max: max.map(n => n + 160)};
}

let FRAME_PART = null;
function framePart() {
  if (FRAME_PART) return FRAME_PART;
  const {min, max} = explodedBounds();
  const frame = {id: 'frame', name: 'Frame', explosion: [0, 0, 0], vertices: [], triangles: [], lines: []};
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) frame.vertices.push([x, y, z]);
  FRAME_PART = frame;
  return frame;
}

function sheet(parts, camera, sample) {
  return render([...parts, framePart()], {explosion: 0, camera, sample, annotate: false, fill: false});
}

function stripFrame(markup) {
  return markup.replace(/<g id="part-frame-frame"[\s\S]*?<\/g>/, '');
}

function paperFn(scale, offset) {
  const cam = createCamera(CAM);
  return v => {
    const p = cam.project(v);
    return [offset[0] + p[0] * scale, offset[1] + p[1] * scale];
  };
}

function bboxOf(parts, paper) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of parts) for (const v of p.vertices) {
    const q = paper(v);
    minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]);
    minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]);
  }
  return [minX, minY, maxX, maxY];
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function labelsFor(parts, paper) {
  const samples = parts.map(p => ({p, pts: p.vertices.map(paper)}));
  const flat = samples.flatMap(s => s.pts);
  const cx0 = flat.reduce((s, q) => s + q[0], 0) / flat.length;
  const cy0 = flat.reduce((s, q) => s + q[1], 0) / flat.length;
  const anchors = samples.map(({p, pts}) => {
    let best = pts[0], score = -1;
    for (const q of pts) {
      const d = (q[0] - cx0) ** 2 + (q[1] - cy0) ** 2;
      if (d > score) { score = d; best = q; }
    }
    return {zh: p.zh, en: p.en, x: best[0], y: best[1]};
  });
  const cx = anchors.reduce((s, a) => s + a.x, 0) / anchors.length;
  const cy = anchors.reduce((s, a) => s + a.y, 0) / anchors.length;
  const placed = anchors.map(a => {
    const dx = a.x - cx, dy = a.y - cy;
    const L = Math.hypot(dx, dy) || 1;
    return {...a, lx: a.x + dx / L * 78, ly: a.y + dy / L * 58};
  });
  for (let iter = 0; iter < 16; iter++) {
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const A = placed[i], B = placed[j];
        const dx = B.lx - A.lx, dy = B.ly - A.ly;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 88) {
          const push = (88 - d) / 2;
          A.lx -= dx / d * push; A.ly -= dy / d * push;
          B.lx += dx / d * push; B.ly += dy / d * push;
        }
      }
    }
  }
  let svg = '';
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const a of placed) {
    const w = Math.max(a.zh.length * 15, a.en.length * 6.2) + 10;
    const h = 32;
    const rx = a.lx - w / 2, ry = a.ly - 14;
    minX = Math.min(minX, rx); maxX = Math.max(maxX, rx + w);
    minY = Math.min(minY, ry); maxY = Math.max(maxY, ry + h);
    svg += `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="4"/>`;
    svg += `<path d="M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${a.lx.toFixed(1)} ${a.ly.toFixed(1)}"/>`;
    svg += `<circle cx="${a.x.toFixed(1)}" cy="${a.y.toFixed(1)}" r="2.3"/>`;
    svg += `<text x="${a.lx.toFixed(1)}" y="${(a.ly - 1).toFixed(1)}" text-anchor="middle">`;
    svg += `<tspan class="zh" x="${a.lx.toFixed(1)}">${esc(a.zh)}</tspan>`;
    svg += `<tspan class="en" x="${a.lx.toFixed(1)}" dy="13">${esc(a.en)}</tspan></text>`;
  }
  const box = bboxOf(parts, paper);
  return {svg, labelTop: Math.min(minY, box[1]), labelBot: Math.max(maxY, box[3]), labelLeft: Math.min(minX, box[0]), labelRight: Math.max(maxX, box[2]), box};
}

function pageHtml(frames, boxes, labels, initial, full) {
  const groups = frames.map((markup, i) => `<g id="f${i}"${i ? ' style="display:none"' : ''}>${markup}</g>`).join('');
  const boxJson = JSON.stringify(boxes.map(b => b.map(n => Math.round(n * 10) / 10)));
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#ffffff">
<title>Porsche 911 Carrera 997.1 拆解图</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Hiragino Sans GB","Microsoft YaHei",Roboto,Arial,sans-serif;-webkit-text-size-adjust:100%}
#scroller{height:480vh;position:relative}
#stage{position:sticky;top:0;height:100vh;height:100svh;display:flex;flex-direction:column;overflow:hidden;background:#fff}
a.back{position:absolute;z-index:3;left:10px;top:8px;font-size:12px;line-height:1;color:#555;text-decoration:none;border:1px solid #e6e6e6;border-radius:999px;padding:5px 10px;background:rgba(255,255,255,.92)}
header{padding:28px 16px 0;text-align:center}
h1{margin:0;font-size:16px;font-weight:700;letter-spacing:.2px}
h1 span{display:block;margin-top:2px;font-size:11px;font-weight:500;color:#777;letter-spacing:.4px}
#stateline{font-size:10.5px;color:#999;letter-spacing:1px;margin-top:4px}
#bar{height:2px;background:#eee;margin:5px auto 0;width:120px;border-radius:2px;overflow:hidden}
#bar i{display:block;height:100%;width:0;background:#111}
#wrap{flex:1;min-height:0;position:relative}
#car{width:100%;height:100%;display:block}
#car path{fill:none;stroke:#111;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}
#car .outline,[data-line-role="outline"]{stroke-width:1.15px}
#car [data-line-role="edge"]{stroke-width:.75px}
#car [data-line-role="detail"]{stroke-width:.5px}
#labels path{stroke-width:.8px}
#labels circle{fill:#111}
#labels rect{fill:#fff;stroke:#111;stroke-width:.6px}
#labels text{fill:#111;font-size:13px}
#labels .zh{font-weight:650}
#labels .en{fill:#444;font-size:9px;font-weight:500}
#hint{position:absolute;left:0;right:0;bottom:52px;text-align:center;font-size:14px;color:#333;pointer-events:none}
#hint b{display:inline-block;background:rgba(255,255,255,.94);border:1px solid #e4e4e4;border-radius:20px;padding:7px 14px;font-weight:600}
#hint em{font-style:normal;display:inline-block;animation:bob 1.4s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}
#controls{display:flex;align-items:center;gap:8px;padding:0 14px 2px}
#controls input{flex:1;accent-color:#111}
#controls span{font-size:10px;color:#888;letter-spacing:.4px}
footer{padding:2px 14px calc(6px + env(safe-area-inset-bottom));font-size:10px;line-height:1.45;color:#888;text-align:center}
@media (prefers-reduced-motion: reduce){
  #scroller{height:auto}
  #stage{position:relative;height:auto;min-height:100svh}
  #hint em{animation:none}
}
</style>
</head>
<body>
<a class="back" href="../">图集</a>
<div id="scroller">
<div id="stage">
<header>
<h1>911 Carrera 997.1 拆解图<span>原创线稿 · 2005–2008 窄体 Coupé · 非工程图</span></h1>
<div id="stateline">Assembled · 组装状态</div>
<div id="bar"><i></i></div>
</header>
<div id="wrap">
<svg id="car" xmlns="http://www.w3.org/2000/svg" viewBox="${initial.map(n => Number(n).toFixed(1)).join(' ')}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="原创意向的 Porsche 911 Carrera 997.1 隐藏线拆解图">
${groups}
<g id="labels" opacity="0">${labels}</g>
</svg>
<div id="hint"><b>往下滑动，拆开车身 <em>↓</em></b></div>
</div>
<div id="controls"><span>组装</span><input id="slider" type="range" min="0" max="1000" value="0" aria-label="拆解进度"><span>拆开</span></div>
<footer>示意线稿，不是保时捷官方图，也不是尺寸精确的工程图。车身按轴距 2350 mm 对照侧视轮廓估算；欧规资料全长 4427 mm，2007 美国产品册写 4461 mm，前/后悬均为估算。轮距 1486/1534，18 英寸，单侧一条扁圆排气，扰流板收起。细部、玻璃与发动机包络均为估算。<br>Illustrative hidden-line drawing, not a Porsche document and not dimensionally exact. Wheelbase 2350 mm; EU length 4427 mm vs US brochure 4461 mm. Overhangs estimated. NTS.</footer>
</div>
</div>
<script>
(function(){
var N=${FRAMES}, BOX=${boxJson}, FINAL=${JSON.stringify(full.map(n => Math.round(n * 10) / 10))};
var svg=document.getElementById('car'), hint=document.getElementById('hint'), bar=document.querySelector('#bar i');
var st=document.getElementById('stateline'), lb=document.getElementById('labels'), slider=document.getElementById('slider');
var frames=[]; for(var i=0;i<N;i++) frames.push(document.getElementById('f'+i));
var cur=0, last=-1, req=0, fromSlider=false;
var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function cl(x){return x<0?0:x>1?1:x}
function ss(a,b,x){x=cl((x-a)/(b-a));return x*x*(3-2*x)}
function progress(){
  if(reduce) return cl(slider.value/1000);
  var m=document.documentElement.scrollHeight-window.innerHeight;
  return m>0?cl(window.scrollY/(m*0.95)):0;
}
function show(p){
  var u=cl(p)*(N-1), i=Math.round(u);
  if(i!==cur){frames[cur].style.display='none'; frames[i].style.display=''; cur=i;}
  var k0=Math.floor(u), k1=Math.min(N-1,k0+1), t=u-k0, a=BOX[k0], b=BOX[k1], bx=[];
  for(var j=0;j<4;j++) bx.push(a[j]+(b[j]-a[j])*t);
  var fl=ss(.72,.96,p), v=[];
  for(j=0;j<4;j++) v.push((bx[j]+(FINAL[j]-bx[j])*fl).toFixed(1));
  svg.setAttribute('viewBox', v.join(' '));
  lb.setAttribute('opacity', ss(.78,.96,p).toFixed(3));
  hint.style.opacity=(1-ss(0,.08,p)).toFixed(3);
  bar.style.width=(p*100).toFixed(1)+'%';
  st.textContent=p<.02?'Assembled · 组装状态':p>.97?'Exploded · 拆解完成':'Disassembling · 拆解中 '+Math.round(p*100)+'%';
  if(!fromSlider) slider.value=Math.round(p*1000);
}
function render(){req=0; var p=progress(); if(Math.abs(p-last)<1e-4) return; last=p; show(p);}
function onScroll(){if(!req) req=requestAnimationFrame(render)}
window.addEventListener('scroll', onScroll, {passive:true});
window.addEventListener('resize', function(){last=-1; onScroll()});
slider.addEventListener('input', function(){
  var p=cl(slider.value/1000);
  if(!reduce){
    var m=document.documentElement.scrollHeight-window.innerHeight;
    fromSlider=true;
    window.scrollTo(0, p*m*0.95);
    fromSlider=false;
  }
  last=-1; show(p); last=p;
});
window.addEventListener('keydown', function(e){
  if(e.target===slider) return;
  var step=e.shiftKey?80:40, v=+slider.value;
  if(e.key==='ArrowDown'||e.key==='ArrowRight'||e.key==='PageDown') v+=step;
  else if(e.key==='ArrowUp'||e.key==='ArrowLeft'||e.key==='PageUp') v-=step;
  else if(e.key==='Home') v=0;
  else if(e.key==='End') v=1000;
  else return;
  e.preventDefault();
  slider.value=Math.max(0,Math.min(1000,v));
  slider.dispatchEvent(new Event('input'));
});
if(reduce){
  hint.innerHTML='<b>拖动滑杆查看拆解</b>';
}
render();
})();
</script>
</body>
</html>
`;
}

function build(outFile) {
  baseParts();
  const t0 = Date.now();
  let scale, offset, paper;
  const frames = [];
  const boxes = [];
  let labelPack = null;
  for (let i = 0; i < FRAMES; i++) {
    const parts = poseParts(i / (FRAMES - 1));
    const drawn = sheet(parts, CAM, 0.12);
    if (!paper) {
      scale = drawn.scale;
      offset = drawn.offset;
      paper = paperFn(scale, offset);
    }
    frames.push(stripFrame(drawn.markup));
    const box = bboxOf(parts, paper);
    const pad = 28;
    boxes.push([box[0] - pad, box[1] - pad, box[2] - box[0] + pad * 2, box[3] - box[1] + pad * 2]);
    if (i === FRAMES - 1) labelPack = labelsFor(parts, paper);
    if (i % 10 === 0) console.log('frame', i, 'ms', Date.now() - t0);
  }
  const x = labelPack.labelLeft - 18;
  const y = labelPack.labelTop - 18;
  const w = (labelPack.labelRight - labelPack.labelLeft) + 36;
  const h = (labelPack.labelBot - y) + 22;
  const html = pageHtml(frames, boxes, labelPack.svg, boxes[0], [x, y, w, h]);
  fs.mkdirSync(path.dirname(outFile), {recursive: true});
  fs.writeFileSync(outFile, html);
  console.log('wrote', outFile, 'bytes', html.length, 'in', Date.now() - t0, 'ms');
}

if (require.main === module && process.argv.includes('--preview')) {
  const base = baseParts();
  console.log('triangles', base._counts);
  console.log('hinges', base._hingeHood, base._hingeLid, base._hingeDoorL, base._hingeDoorR);
  const outDir = process.argv[process.argv.indexOf('--preview') + 1] || '/tmp/porsche-preview';
  fs.mkdirSync(outDir, {recursive: true});
  const cams = {
    side: {azimuth: -90, elevation: 0, roll: 0},
    front: {azimuth: 0, elevation: 0, roll: 0},
    rear: {azimuth: 180, elevation: 8, roll: 0},
    hero: CAM
  };
  const color = {
    body: '#222', bumper_front: '#b00', bumper_rear: '#06a', hood: '#c60', lid: '#0a7',
    spoiler: '#90c', door_l: '#d4a', door_r: '#a0a', fender_l: '#da0', fender_r: '#a60',
    wheel_fl: '#444', wheel_fr: '#444', wheel_rl: '#444', wheel_rr: '#444', engine: '#888'
  };
  const css = Object.entries(color).map(([id, c]) => `[data-item="${id}"] path{stroke:${c}}`).join('');
  for (const [name, cam] of Object.entries(cams)) {
    const t0 = Date.now();
    const parts = poseParts(0);
    const drawn = sheet(parts, cam, 0.16);
    const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640"><style>path{fill:none;stroke-linecap:round;stroke-linejoin:round}[data-line-role="outline"]{stroke-width:1.3}[data-line-role="edge"]{stroke-width:.8}[data-line-role="detail"]{stroke-width:.55}${css}</style>${stripFrame(drawn.markup)}</svg>`;
    fs.writeFileSync(path.join(outDir, name + '.svg'), svg);
    console.log(name, 'in', Date.now() - t0, 'ms');
  }
} else if (require.main === module) {
  const out = process.argv[2] || path.resolve(__dirname, '../index.html');
  build(out);
}

module.exports = {sheet, stripFrame, CAM, build};
