import * as THREE from 'three';
const gsap = window.gsap;
const $ = s => document.querySelector(s);
const { lerp, smoothstep, clamp } = THREE.MathUtils;
const DATA = await (await fetch('data.json')).json();
const N = DATA.items.length, HEADER = 15;
let W = innerWidth, H = innerHeight - HEADER;
const mobile = () => innerWidth < 768;

// ---------- renderer / ortho camera (y up, origin = centre) ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W, H); renderer.setClearColor(0xffffff);
$('#gl').appendChild(renderer.domElement);
const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 1, 100); cam.position.z = 10;
const scene = new THREE.Scene();

// ---------- atlas textures + instanced shader ----------
const loader = new THREE.TextureLoader(); let loaded = 0;
const atlases = DATA.atlases.map(src => { const t = loader.load(src, () => { loaded++; $('#pct').textContent = loaded === DATA.atlases.length ? '100%' : String(Math.round(loaded / DATA.atlases.length * 100)).padStart(3, '0'); if (loaded === DATA.atlases.length) start(); }); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; });
while (atlases.length < 4) atlases.push(atlases[0]);
const geo = new THREE.PlaneGeometry(1, 1);
const uvRect = new Float32Array(N * 4), atlasIdx = new Float32Array(N);
DATA.items.forEach((d, i) => { const a = d.atlas; uvRect.set([a.u, a.v, a.w, a.h], i * 4); atlasIdx[i] = a.i; });
geo.setAttribute('uvRect', new THREE.InstancedBufferAttribute(uvRect, 4));
geo.setAttribute('atlasIdx', new THREE.InstancedBufferAttribute(atlasIdx, 1));
const mat = new THREE.ShaderMaterial({
  uniforms: { t0: { value: atlases[0] }, t1: { value: atlases[1] }, t2: { value: atlases[2] }, t3: { value: atlases[3] } },
  vertexShader: `attribute vec4 uvRect; attribute float atlasIdx; varying vec2 vUv; varying float vA;
    void main(){ vUv = uvRect.xy + uv * uvRect.zw; vA = atlasIdx; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D t0,t1,t2,t3; varying vec2 vUv; varying float vA;
    void main(){ vec4 c = vA<.5?texture2D(t0,vUv):vA<1.5?texture2D(t1,vUv):vA<2.5?texture2D(t2,vUv):texture2D(t3,vUv); gl_FragColor = c;
    #include <colorspace_fragment>
    }`,
});
const mesh = new THREE.InstancedMesh(geo, mat, N); mesh.frustumCulled = false; scene.add(mesh);

// large image overlay
const bigMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false });
const big = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bigMat); big.visible = false; big.renderOrder = 2; scene.add(big);

// ---------- state ----------
const items = DATA.items.map((d, i) => ({ d, i, ratio: d.image.ratio, enabled: true, w: 40,
  pos: new THREE.Vector2(0, H), target: new THREE.Vector2(), scale: 0, targetScale: .9, hover: false }));
const S = { mode: 0, filter: null, scroll: 0, scrollTarget: 0, max: 0, fly: H, selected: -1 };
let hovered = -1, mouse = { x: -9999, y: -9999 };

// ---------- layout ----------
function layout() {
  const list = items.filter(i => i.enabled);
  if (S.mode === 0) {                                     // snake grid
    const w = mobile() ? lerp(64, 128, smoothstep(W, 390, 1280)) * .6 : lerp(36, 48, smoothstep(W, 1024, 1920));
    const pad = lerp(4, 8, smoothstep(W, 1024, 1920));
    const gridW = W * (mobile() ? .92 : .6), perRow = Math.max(1, Math.floor(gridW / (w + pad)));
    const m = (W - perRow * (w + pad)) / 2;                // centre the block
    let row = 0, col = 0, dir = 1, rowH = w / .75 + pad;
    list.forEach(it => {
      const c = dir > 0 ? col : perRow - 1 - col;
      it.w = w; it.target.set(-W / 2 + m + c * (w + pad) + w / 2, H / 2 - 30 - row * rowH - rowH / 2);
      if (++col === perRow) { col = 0; row++; dir *= -1; }
    });
    S.max = Math.max(0, (row + 1) * rowH + 60 - H);
  } else {                                                // single column + big image
    const w = mobile() ? 48 : 64, gap = 5; let y = 0;
    list.forEach(it => {
      const h = w / it.ratio; it.w = w;
      it.target.set(-W / 2 + 5 + w / 2, H / 2 - 20 - y - h / 2); it.listY = y; y += h + gap;
    });
    S.max = Math.max(0, y + 40 - H);
  }
  S.scrollTarget = clamp(S.scrollTarget, 0, S.max);
  setTargets();
}
function setTargets() {
  items.forEach(it => {
    if (!it.enabled) { it.targetScale = 0; return; }
    it.targetScale = it.i === hovered && it.i !== S.selected ? 1.25 : (S.mode ? 1 : .9);
  });
}
function bigRect(it) {            // right-hand area for the open image, left edge on column 4 of 12
  const left = mobile() ? 70 : W * 3 / 12, avW = W - left - 10, avH = H - 40;
  let h = avH, w = h * it.ratio; if (w > avW) { w = avW; h = w / it.ratio; }
  return { x: -W / 2 + left + avW / 2, y: 0, w, h };
}

// ---------- open / close ----------
let loadTok = 0;
function open(i) {
  const it = items[i]; if (S.mode === 0) setMode(1, false);
  S.selected = i; bigMat.opacity = 0; big.visible = true;
  $('#t1').textContent = it.d.title; $('#t2').textContent = it.d.categories.join(', ');
  const info = $('#info'); info.classList.remove('active'); setTimeout(() => S.selected === i && info.classList.add('active'), 500);
  const tok = ++loadTok, src = it.d.image.large;
  loader.load(src, tex => { if (tok !== loadTok) return; tex.colorSpace = THREE.SRGBColorSpace;
    bigMat.map?.dispose(); bigMat.map = tex; bigMat.needsUpdate = true;
    gsap.to(bigMat, { opacity: 1, duration: 2, ease: 'cubic.out', overwrite: true }); });
  // keep the selected thumb visible in the column
  if (it.listY != null) S.scrollTarget = clamp(it.listY - H / 2, 0, S.max);
}
function close() { S.selected = -1; loadTok++; big.visible = false; $('#info').classList.remove('active'); }
function step(dir) {
  const list = items.filter(i => i.enabled); if (!list.length) return;
  let k = list.findIndex(i => i.i === S.selected); k = (k + dir + list.length) % list.length; open(list[k].i);
}
function setMode(m, anim = true) {
  if (m === S.mode) return;
  const apply = () => { S.mode = m; if (m === 0) close(); S.scroll = S.scrollTarget = 0; layout(); $('#sb').classList.toggle('active', true); };
  if (!anim) return apply();
  // outro: fly up 2.5s expo.out, then re-flow and intro back in 3s
  gsap.to(S, { fly: H * 2, duration: 2.5, ease: 'expo.out', overwrite: true });
  setTimeout(() => { apply(); S.fly = -H; items.forEach(it => it.pos.y -= H * 3);
    gsap.to(S, { fly: 0, duration: 3, ease: 'expo.out', overwrite: true });
    if (m === 1) open(items.find(i => i.enabled)?.i ?? 0); }, 600);
}
function setFilter(slug, label) {
  S.filter = slug;
  items.forEach(it => { const on = !slug || it.d.categories.includes(slug); it.enabled = on; if (!on) it.scale = 0; });
  $('#menuFilter').textContent = label || 'All';
  document.querySelectorAll('#sub a').forEach(a => a.classList.toggle('on', (a.dataset.slug || null) === slug));
  $('#count').textContent = items.filter(i => i.enabled).length + ' / ' + N;
  if (S.selected >= 0 && !items[S.selected].enabled) step(1);
  layout();
}

// ---------- nav ----------
const sub = $('#sub');
[{ title: 'All', slug: '' }, ...DATA.categories].forEach((c, i) => {
  const li = document.createElement('li'); li.style.setProperty('--i', i);
  li.innerHTML = `<a data-slug="${c.slug}">${c.title}</a>`; sub.appendChild(li);
});
function placeSub() { const r = $('#menuFilter').getBoundingClientRect(); sub.style.left = r.left + 'px'; }
$('#menuFilter').onclick = e => { e.stopPropagation(); placeSub(); sub.classList.toggle('active'); };
sub.onclick = e => { const a = e.target.closest('a'); if (!a) return; setFilter(a.dataset.slug || null, a.textContent); sub.classList.remove('active'); };
document.addEventListener('click', e => { if (!e.target.closest('#sub,#menuFilter')) sub.classList.remove('active'); });
$('#menuMode').onclick = () => setMode(S.mode ? 0 : 1);
$('#root').onclick = () => { setFilter(null); setMode(0); };
addEventListener('keydown', e => {
  if (e.key === 'Escape') setMode(0);
  if (S.mode === 1 && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) step(1);
  if (S.mode === 1 && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) step(-1);
});

// ---------- input: wheel / touch inertial scroll ----------
let lock = false;
const inList = x => x < (mobile() ? 60 : 64 * 3);
addEventListener('wheel', e => {
  if (e.target.closest('header,.sub')) return;
  if (S.mode === 1 && !inList(e.clientX)) {                // big image area: step, 500ms lock
    if (lock || Math.abs(e.deltaY) < 4) return; lock = true; setTimeout(() => lock = false, 500); step(e.deltaY > 0 ? 1 : -1); return;
  }
  S.scrollTarget = clamp(S.scrollTarget + e.deltaY, 0, S.max);
}, { passive: true });
let ty = null, tv = 0, tx0 = 0, ty0 = 0;
addEventListener('touchstart', e => { ty = ty0 = e.touches[0].clientY; tx0 = e.touches[0].clientX; tv = 0; }, { passive: true });
addEventListener('touchmove', e => { const y = e.touches[0].clientY; tv = (ty - y) * 1.5; ty = y; S.scrollTarget = clamp(S.scrollTarget + tv, 0, S.max); }, { passive: true });
addEventListener('touchend', () => { const v0 = tv; let v = v0; (function glide() { v *= .92; S.scrollTarget = clamp(S.scrollTarget + v, 0, S.max); if (Math.abs(v) > .5) requestAnimationFrame(glide); })(); ty = null; });

// ---------- hover / click picking (screen-space rects, padded so gaps count) ----------
const toWorld = (cx, cy) => ({ x: cx - W / 2, y: H / 2 - (cy - HEADER) });
function pick(cx, cy) {
  const p = toWorld(cx, cy), oy = S.scroll * 1 + S.fly;
  for (const it of items) {
    if (!it.enabled || it.i === S.selected && S.mode) continue;
    const h = it.w / it.ratio, x = it.target.x, y = it.target.y + oy;
    if (Math.abs(p.x - x) < it.w / 2 + 3 && Math.abs(p.y - y) < h / 2 + 3) return it.i;
  }
  return -1;
}
addEventListener('mousemove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  const h = e.target.closest('header,.sub') ? -1 : pick(e.clientX, e.clientY);
  if (h !== hovered) { hovered = h; if (h >= 0) items[h].scale = lerp(items[h].scale, 1.25, .1); setTargets(); }
  document.body.style.cursor = h >= 0 ? 'zoom-in' : '';
});
renderer.domElement.addEventListener('click', e => {
  const h = pick(e.clientX, e.clientY);
  if (h >= 0) open(h);
  else if (S.mode === 1) { const p = toWorld(e.clientX, e.clientY); step(p.x > bigRect(items[S.selected] || items[0]).x ? 1 : -1); }
});

// ---------- scrollbar ----------
const sbt = $('#sbt');
function updateScrollbar() { const p = S.max ? S.scroll / S.max : 0; sbt.style.transform = `translateX(${p * (innerWidth - 48)}px)`; }

// ---------- loop ----------
const dummy = new THREE.Object3D(); let last = performance.now();
function tick(now) {
  const dt = Math.min(now - last, 100) / (1000 / 60); last = now;
  S.scroll = lerp(S.scroll, S.scrollTarget, Math.min(1, .36 * dt));
  const drag = Math.min(1, (mobile() ? .1 : .04) * dt);
  for (const it of items) {
    let tx = it.target.x, tyv = it.target.y + S.scroll + S.fly, ts = it.targetScale, w = it.w, h = it.w / it.ratio;
    if (it.i === S.selected && S.mode === 1) { const r = bigRect(it); tx = r.x; tyv = r.y + S.fly; ts = r.w / w; }
    it.scale = lerp(it.scale, ts, drag);
    it.pos.x = lerp(it.pos.x, tx, drag); it.pos.y = lerp(it.pos.y, tyv, drag);
    dummy.position.set(it.pos.x, it.pos.y, it.i === hovered ? 2 : (it.i === S.selected ? 1 : 0));
    dummy.scale.set(Math.max(1e-4, w * it.scale), Math.max(1e-4, h * it.scale), 1);
    dummy.updateMatrix(); mesh.setMatrixAt(it.i, dummy.matrix);
    if (it.i === S.selected) { big.position.set(it.pos.x, it.pos.y, 3); big.scale.copy(dummy.scale); }
  }
  mesh.instanceMatrix.needsUpdate = true;
  updateScrollbar();
  gsap.updateRoot(now / 1000);
  renderer.render(scene, cam); requestAnimationFrame(tick);
}
gsap.ticker.remove(gsap.updateRoot); gsap.ticker.lagSmoothing(0);

addEventListener('resize', () => { W = innerWidth; H = innerHeight - HEADER; renderer.setSize(W, H);
  Object.assign(cam, { left: -W / 2, right: W / 2, top: H / 2, bottom: -H / 2 }); cam.updateProjectionMatrix(); layout(); });

let started = false;
function start() {
  if (started) return; started = true;
  $('#intro').classList.add('disabled'); $('#sb').classList.add('active');
  S.fly = H; gsap.to(S, { fly: 0, duration: 3, ease: "expo.out" });   // intro: grid slides in from above
}
setFilter(null); layout(); requestAnimationFrame(tick);
setTimeout(start, 8000);   // safety
