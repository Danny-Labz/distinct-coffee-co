// scene-engine/engine.js
// ─────────────────────────────────────────────────────────────────────────────
// A small first-person "explore the business" engine.
//
//   import { SceneEngine } from './scene-engine/engine.js';
//   import scene from './scene-engine/scenes/my-business.js';
//   new SceneEngine(document.getElementById('stage'), scene).start();
//
// The engine owns everything generic: renderer, lighting rig, camera (drag /
// touch / arrow keys / WASD), hotspot picking + glow, fly-to-and-zoom, info
// panels, tour bar, loading screen and the no-WebGL fallback.
// A scene file owns everything specific to one business: the 3D objects, the
// hotspots and what each panel says. See README.md.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from './vendor/three.module.min.js';
import { createSky } from './props.js';
import * as props from './props.js';
import * as hd from './props-hd.js';
import { RGBELoader } from './vendor/jsm/loaders/RGBELoader.js';
import { EffectComposer } from './vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from './vendor/jsm/postprocessing/GTAOPass.js';
import { BokehPass } from './vendor/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from './vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/jsm/postprocessing/OutputPass.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const deg = d => (d * Math.PI) / 180;

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Camera pose that looks from `from` toward `to`. */
export function poseLook(from, to, fov) {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  return { x: from[0], y: from[1], z: from[2], yaw: Math.atan2(-dx, -dz), pitch: Math.asin(dy / Math.hypot(dx, dy, dz)), fov };
}

export class SceneEngine {
  constructor(root, config) {
    this.root = root;
    this.cfg = config;
    this.hotspots = [];
    this.animators = [];
    this.keys = new Set();
    this.hovered = null;
    this.active = null;
    this.tween = null;
    this.mode = 'free';           // 'free' | 'focus'
    this.reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.cam = { x: 0, y: 1.6, z: 3, yaw: 0, pitch: 0, fov: 55 };
    this.base = { yaw: 0 };
    this.shift = { x: 0, y: 0 };
    this.par = { x: 0, y: 0, tx: 0, ty: 0 };
    this.vel = { f: 0, s: 0 };
    this.fovTarget = null;
    this.clock = new THREE.Clock();
    this.interacted = false;
  }

  // ───────────────────────────── startup ─────────────────────────────
  async start() {
    const root = this.root;
    root.classList.add('se-root');
    const t = this.cfg.theme || {};
    Object.entries({ '--se-bg': t.bg, '--se-fg': t.fg, '--se-accent': t.accent, '--se-card': t.card, '--se-font': t.font }).forEach(([k, v]) => v && root.style.setProperty(k, v));
    this.buildUI();

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      return this.showFallback();
    }
    if (!this.renderer.getContext()) return this.showFallback();

    const r = this.renderer;
    this.noDegrade = new URLSearchParams(location.search).has('nodegrade');
    // quality tier: 'high' = HDR lighting + post-processing + real glass; 'low' = phones / weak GPUs
    const q = new URLSearchParams(location.search).get('quality');
    // a device that struggled (or lost its WebGL context) on an earlier visit starts light next time
    let saved = 0; try { saved = +localStorage.getItem('se-tier') || 0; if (q === 'high') localStorage.removeItem('se-tier'); } catch (e) { /* storage blocked */ }
    this.tier = q === 'high' ? 0 : Math.min(saved, 1);      // start light, then let the watchdog re-measure
    this.quality = q === 'low' || q === 'high' ? q : (this.cfg.quality || (this.coarse || saved ? 'low' : 'high'));
    document.addEventListener('visibilitychange', () => { this._skipSample = true; });
    r.domElement.addEventListener('webglcontextlost', e => {
      // the GPU gave up (usually out of memory): remember that and restart once in the light mode
      e.preventDefault();
      try { localStorage.setItem('se-tier', '2'); if (!sessionStorage.getItem('se-reloaded')) { sessionStorage.setItem('se-reloaded', '1'); location.reload(); return; } } catch (err) { /* ignore */ }
      this.showFallback();
    });
    hd.setQuality(this.quality);
    this.maxDpr = 1.5;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxDpr));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = this.cfg.world?.exposure ?? 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.stage.appendChild(r.domElement);
    r.domElement.className = 'se-canvas';

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.cfg.camera?.fov ?? 55, 1, 0.05, 200);
    try { await this.setupWorld(); } catch (e) { console.error('[scene] world setup failed', e); return this.showFallback(); }

    this.data = {};
    const ctx = this.makeContext();
    try {
      if (this.cfg.load) this.data = (await Promise.race([this.cfg.load(ctx), new Promise(res => setTimeout(() => res({}), 6000))])) || {};
    } catch (e) { console.warn('[scene] data load failed', e); }
    ctx.data = this.data;
    try { await this.cfg.build(ctx); } catch (e) { console.error('[scene] build failed', e); return this.showFallback(); }

    this.scene.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m && 'envMapIntensity' in m) m.envMapIntensity = this.envIntensity; }); });
    this.finalizeHotspots();
    this.buildChips();
    this.placeStart();
    this.bind();
    this.setupPost();
    this.resize();
    this.clock.start();
    r.setAnimationLoop(() => this.frame());
    this.root.classList.add('se-ready');
    setTimeout(() => this.loader.classList.add('gone'), 250);
    setTimeout(() => this.hint.classList.add('show'), 900);
    window.__scene = this;      // handy for debugging / tests
  }

  makeContext() {
    return {
      THREE, props, hd, quality: this.quality, esc, scene: this.scene, renderer: this.renderer, camera: this.camera, engine: this, data: this.data,
      hotspot: def => this.addHotspot(def),
      animate: fn => this.animators.push(fn),
    };
  }

  async setupWorld() {
    // world.low = overrides applied on the low quality tier (e.g. more haze to stand in for depth of field)
    const w = { ...(this.cfg.world || {}), ...(this.quality === 'low' ? this.cfg.world?.low : null) };
    const sc = this.scene;
    const s = w.sun || {};
    const sun = new THREE.DirectionalLight(s.color ?? 0xfff3df, s.intensity ?? 2.1);
    sun.position.set(...(s.position ?? [6, 11, 7]));
    sun.castShadow = true;
    const size = this.quality === 'high' ? 4096 : 2048;
    sun.shadow.mapSize.set(size, size);
    const e = s.extent ?? 9;
    Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: s.far ?? 40 });
    sun.shadow.bias = s.bias ?? -0.0004; sun.shadow.normalBias = s.normalBias ?? 0.02;
    if (s.radius) sun.shadow.radius = s.radius;
    sc.add(sun);
    this.sun = sun;

    if (w.hdr) {
      // photographic image-based lighting: an HDR panorama lights and reflects in everything
      const tex = await new RGBELoader().loadAsync(w.hdr);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(this.renderer);
      const env = pm.fromEquirectangular(tex).texture;
      pm.dispose(); tex.dispose();
      sc.environment = env;
      sc.background = env;
      sc.backgroundBlurriness = w.backgroundBlur ?? 0.12;
      sc.backgroundIntensity = w.backgroundIntensity ?? 1;
      this.envIntensity = w.envIntensity ?? 1;
      if (w.fogFar) sc.fog = new THREE.Fog(w.fog ?? 0xcfd8cf, w.fogNear ?? 30, w.fogFar);
      if (w.hemi) sc.add(new THREE.HemisphereLight(w.hemiSky ?? 0xdfe9f5, w.hemiGround ?? 0x7d8a6a, w.hemi));
      return;
    }

    // legacy stylized sky (no HDR file)
    sc.background = new THREE.Color(w.horizon ?? 0xe6e9ec);
    sc.fog = new THREE.Fog(w.fog ?? w.horizon ?? 0xe6e9ec, w.fogNear ?? 14, w.fogFar ?? 70);
    sc.add(createSky(w.skyTop ?? 0x9db8d4, w.horizon ?? 0xe6e9ec));
    const pm = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(createSky(w.skyTop ?? 0x9db8d4, w.horizon ?? 0xe6e9ec, 40));
    const soft = new THREE.Mesh(new THREE.PlaneGeometry(26, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    soft.position.set(0, 14, 4); soft.rotation.x = Math.PI / 2; envScene.add(soft);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    strip.position.set(-16, 6, 0); strip.rotation.y = Math.PI / 2; envScene.add(strip);
    sc.environment = pm.fromScene(envScene, 0.03).texture;
    this.envIntensity = w.envIntensity ?? 0.7;
    pm.dispose();
    sc.add(new THREE.HemisphereLight(w.hemiSky ?? 0xdfe9f5, w.hemiGround ?? 0x7d8a6a, w.hemi ?? 0.75));
  }

  /** Post-processing (high tier only): ambient occlusion, depth of field, bloom, filmic output. */
  setupPost() {
    const qs = new URLSearchParams(location.search), off = (qs.get('off') || '').split(',');      // ?off=ao,dof,bloom for debugging
    const p = this.cfg.post && { ...this.cfg.post };
    if (!p || this.quality !== 'high' || off.includes('post')) return;
    off.forEach(k => { if (k) p[k] = false; });
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(r, rt);
    // objects can opt out of the helper passes: userData.noAO (thin/grazing surfaces, grass) and userData.noDofDepth
    const skipping = (pass, flag) => {
      const list = []; this.scene.traverse(o => { if (o.userData && o.userData[flag]) list.push(o); });
      if (!list.length) return;
      const render = pass.render.bind(pass);
      pass.render = (...a) => { const was = list.map(o => o.visible); list.forEach(o => { o.visible = false; }); render(...a); list.forEach((o, i) => { o.visible = was[i]; }); };
    };
    c.addPass(new RenderPass(this.scene, this.camera));
    if (p.ao !== false) {
      const ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      ao.updateGtaoMaterial({ radius: p.ao?.radius ?? 0.3, distanceExponent: 1.5, thickness: 1.2, scale: p.ao?.scale ?? 1.15, samples: 12, screenSpaceRadius: false });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      ao.blendIntensity = p.ao?.intensity ?? 1;
      skipping(ao, 'noAO');
      c.addPass(ao); this.aoPass = ao;
    }
    if (p.dof !== false) {
      this.dof = Object.assign({ aperture: 0.00055, focusAperture: 0.0035, maxblur: 0.0075 }, p.dof === true ? {} : p.dof || {});
      const bk = new BokehPass(this.scene, this.camera, { focus: 3, aperture: this.dof.aperture, maxblur: this.dof.maxblur });
      skipping(bk, 'noDofDepth');
      c.addPass(bk); this.bokeh = bk;
      this.dofState = { focus: 3, aperture: this.dof.aperture };
    }
    if (p.bloom !== false) {
      const b = p.bloom || {};
      c.addPass(new UnrealBloomPass(new THREE.Vector2(size.x, size.y), b.strength ?? 0.22, b.radius ?? 0.7, b.threshold ?? 1.0));
    }
    c.addPass(new OutputPass());
    this.composer = c;
  }

  /**
   * Step the rendering load down one notch. Called by the frame-rate watchdog, so a slow machine settles on
   * something smooth within a second or two instead of sitting on a frozen picture.
   *   1 → no post-processing   2 → lower resolution, smaller shadows, thinner grass   3 → minimum
   */
  degrade() {
    if (this.tier >= 3) return;
    this.tier++;
    console.info('[scene] low frame rate — stepping quality down to level', this.tier);
    try { localStorage.setItem('se-tier', String(this.tier)); } catch (e) { /* ignore */ }
    if (this.composer) { try { this.composer.dispose?.(); } catch (e) { /* ignore */ } this.composer = null; this.bokeh = null; }
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(Math.min(dpr, this.tier === 1 ? 1.25 : this.tier === 2 ? 1 : 0.75));
    if (this.tier >= 2 && this.sun) {
      const sh = this.sun.shadow;
      if (this.tier === 2) { sh.mapSize.set(2048, 2048); if (sh.map) { sh.map.dispose(); sh.map = null; } }
      else { this.sun.castShadow = false; }
      if (!this._thinned) { this._thinned = true; this.scene.traverse(o => { if (o.isInstancedMesh && o.userData.noDofDepth) o.count = Math.floor(o.count / 3); }); }
    }
    this.resize();
  }


  // ───────────────────────────── hotspots ─────────────────────────────
  addHotspot(def) {
    const h = Object.assign({ glow: 0, panel: {}, focus: null }, def);
    this.hotspots.push(h);
    return h;
  }

  finalizeHotspots() {
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    this.proxies = [];
    this.hotspots.forEach((h, i) => {
      h.index = i;
      h.object.updateWorldMatrix(true, true);
      // each hotspot owns its materials so highlighting never bleeds onto neighbours
      const seen = new Map();
      h.mats = [];
      h.object.traverse(o => {
        if (!o.isMesh) return;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        const cloned = list.map(m => {
          if (m.userData?.noHighlight || !m.emissive) return m;
          if (!seen.has(m)) { const c = m.clone(); c.userData = { ...m.userData }; seen.set(m, c); h.mats.push({ m: c, base: c.emissive.clone(), baseI: c.emissiveIntensity }); }
          return seen.get(m);
        });
        o.material = Array.isArray(o.material) ? cloned : cloned[0];
      });
      const box = new THREE.Box3().setFromObject(h.object);
      const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      const pad = h.hitPad ?? 0.03;
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x + pad * 2, size.y + pad * 2, size.z + pad * 2), proxyMat);
      proxy.position.copy(center);
      proxy.userData.hotspot = h;
      this.scene.add(proxy);
      this.proxies.push(proxy);
      h.anchor = h.marker ? new THREE.Vector3(...h.marker) : new THREE.Vector3(center.x, box.max.y + 0.03 + (h.markerLift ?? 0), center.z);

      // marker button
      const b = document.createElement('button');
      b.className = 'se-marker';
      b.type = 'button';
      b.setAttribute('aria-label', h.label);
      b.innerHTML = `<span class="se-dot"></span><span class="se-label">${esc(h.label)}</span>`;
      b.addEventListener('click', e => { e.stopPropagation(); this.openHotspot(h); });
      b.addEventListener('pointerenter', () => { this.hovered = h; });
      b.addEventListener('pointerleave', () => { if (this.hovered === h) this.hovered = null; });
      this.markerLayer.appendChild(b);
      h.markerEl = b;
    });
  }

  buildChips() {
    this.chips.innerHTML = '';
    this.hotspots.forEach(h => {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'se-chip'; c.textContent = h.label;
      c.addEventListener('click', () => this.openHotspot(h));
      h.chipEl = c;
      this.chips.appendChild(c);
    });
  }

  pick(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const rc = this.raycaster || (this.raycaster = new THREE.Raycaster());
    rc.setFromCamera(ndc, this.camera);
    return this.bestHit(rc);
  }

  /**
   * Hit boxes of neighbouring things overlap, so "first box hit" picks the wrong one. Among every box the ray
   * passes through, take the one whose centre the ray passes closest to (relative to that box's size).
   */
  bestHit(rc) {
    const hits = rc.intersectObjects(this.proxies, false);
    let best = null, score = Infinity;
    const v = this._bv || (this._bv = new THREE.Vector3());
    for (const hit of hits) {
      const o = hit.object;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const sc = rc.ray.distanceToPoint(v.copy(o.position)) / o.geometry.boundingSphere.radius;
      if (sc < score) { score = sc; best = o; }
    }
    return best ? best.userData.hotspot : null;
  }

  /** What the centre-of-screen aim point is resting on. */
  pickCenter() {
    const rc = this.raycaster || (this.raycaster = new THREE.Raycaster());
    rc.setFromCamera(this._zero || (this._zero = new THREE.Vector2(0, 0)), this.camera);
    return this.bestHit(rc);
  }

  /**
   * Aim point + quick-look popup. Whatever the reticle (or the mouse) rests on gets a small card with its
   * summary; clicking the card, the object, or pressing Enter opens the full panel.
   */
  updateAim(dt) {
    const free = this.mode === 'free' && !this.tween;
    this.aimEl.classList.toggle('hide', !free || this.cfg.aim === false);
    this.aimed = free && this.cfg.aim !== false ? this.pickCenter() : null;
    const target = free ? (this.hovered || this.aimed) : null;
    this.aimEl.classList.toggle('on', !!this.aimed);
    // small dwell so the card doesn't flicker while sweeping across things
    const st = this.popState || (this.popState = { cand: null, t: 0, gone: 0 });
    if (target !== st.cand) { st.cand = target; st.t = 0; }
    st.t += dt;
    if (target && target !== this.popFor && st.t > (this.popFor ? 0.08 : 0.16)) this.showPop(target);
    if (!target) { st.gone += dt; if (this.popFor && st.gone > 0.28) this.hidePop(); } else st.gone = 0;
    if (!this.popFor) return;
    // keep the card pinned above the object, inside the viewport
    const v = (this._pv || (this._pv = new THREE.Vector3())).copy(this.popFor.anchor).project(this.camera);
    const x = ((v.x + 1) / 2) * this.width, y = ((1 - v.y) / 2) * this.height;
    const pw = this.pop.offsetWidth, ph = this.pop.offsetHeight, m = 12;
    const side = y - ph - 30 < 64;                                    // no room above → sit beside the object instead
    let px, py;
    if (side) {
      px = x + 46 + pw < this.width - m ? x + 46 : x - 46 - pw;
      px = clamp(px, m, this.width - pw - m);
      py = clamp(y - 24, 64, this.height - ph - 70);
    } else {
      px = clamp(x - pw / 2, m, this.width - pw - m);
      py = y - ph - 30;
    }
    this.pop.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px)`;
    this.pop.classList.toggle('side', side);
  }

  showPop(h) {
    this.popFor = h;
    const p = h.panel || {};
    let body = '';
    try { body = typeof h.summary === 'function' ? h.summary({ ...this.makeContext(), data: this.data }) : (h.summary || ''); } catch (e) { console.warn(e); }
    this.pop.querySelector('.se-pop-eyebrow').textContent = p.eyebrow || h.label;
    this.pop.querySelector('.se-pop-title').textContent = p.title || h.label;
    this.pop.querySelector('.se-pop-body').innerHTML = body;
    this.pop.querySelector('.se-pop-more').textContent = this.coarse ? 'Tap for more →' : 'Click or press Enter for more →';
    this.pop.classList.add('show');
    this.root.classList.add('se-popping');
  }

  hidePop() {
    this.popFor = null;
    this.pop.classList.remove('show');
    this.root.classList.remove('se-popping');
  }

  // ───────────────────────────── camera ─────────────────────────────
  placeStart() {
    const c = this.cfg.camera || {};
    const portrait = window.innerHeight > window.innerWidth * 1.15;
    const s = (portrait && c.startPortrait) || c.start || { from: [0, 1.6, 3], to: [0, 1.2, 0] };
    const pose = poseLook(s.from, s.to, c.fov ?? 55);
    Object.assign(this.cam, pose);
    this.base.yaw = pose.yaw;
    this.basePose = { ...pose };
    this.baseFov = c.fov ?? 55;
  }

  applyCamera() {
    const c = this.cam, cam = this.camera;
    cam.position.set(c.x, c.y, c.z);
    cam.rotation.set(c.pitch + this.par.y, c.yaw + this.par.x, 0, 'YXZ');
    const aspect = cam.aspect;
    const widen = aspect < 1.3 ? lerp(1, 1.55, clamp((1.3 - aspect) / 0.8, 0, 1)) : 1;
    const fov = Math.min(88, c.fov * widen);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const w = this.width, h = this.height;
    if (Math.abs(this.shift.x) > 0.5 || Math.abs(this.shift.y) > 0.5) cam.setViewOffset(w, h, this.shift.x, this.shift.y, w, h);
    else if (cam.view && cam.view.enabled) cam.clearViewOffset();
  }

  flyTo(pose, { duration = 1.15, shift = { x: 0, y: 0 }, then } = {}) {
    const from = { ...this.cam, sx: this.shift.x, sy: this.shift.y };
    const d = this.reduceMotion ? 0.01 : duration;
    this.tween = {
      t: 0, d, from, then,
      to: { ...pose, yaw: from.yaw + angDiff(from.yaw, pose.yaw), sx: shift.x, sy: shift.y },
    };
  }

  panelShift() {
    if (this.width > 900) return { x: Math.min(190, this.width * 0.2), y: 0 };
    return { x: 0, y: Math.min(this.height * 0.17, 150) };
  }

  openHotspot(h) {
    if (!h) return;
    if (this.mode === 'free') this.returnPose = { x: this.cam.x, y: this.cam.y, z: this.cam.z, yaw: this.cam.yaw, pitch: this.cam.pitch, fov: this.cam.fov };
    this.mode = 'focus';
    this.active = h;
    this.hidePop();
    this.interacted = true; this.hint.classList.remove('show');
    this.root.classList.add('se-focus');
    this.hotspots.forEach(o => { o.chipEl?.classList.toggle('on', o === h); });
    // Centre the chip by scrolling the chip bar itself. (scrollIntoView also pans the whole page on iOS,
    // which slid the scene off-screen for chips far along the row.)
    const bar = h.chipEl && h.chipEl.parentElement;
    if (bar) bar.scrollTo({ left: h.chipEl.offsetLeft - (bar.clientWidth - h.chipEl.offsetWidth) / 2, behavior: this.reduceMotion ? 'auto' : 'smooth' });
    const f = h.focus || {};
    const pose = f.from && f.to ? poseLook(f.from, f.to, f.fov ?? 40) : this.returnPose;
    this.flyTo(pose, { shift: this.panelShift() });
    this.renderPanel(h);
    this.cfg.onOpen && this.cfg.onOpen(h);
  }

  /** Fly back to the opening view (button in the top bar, or the Home / R key). */
  recenter() {
    this.returnPose = null;
    this.vel.f = 0; this.vel.s = 0;
    if (this.mode === 'focus') return this.closePanel();
    this.flyTo(this.basePose, { shift: { x: 0, y: 0 }, duration: 0.9 });
  }

  closePanel() {
    if (this.mode !== 'focus') return;
    this.mode = 'free';
    this.active = null;
    this.root.classList.remove('se-focus');
    this.panel.classList.remove('open');
    this.hotspots.forEach(o => o.chipEl?.classList.remove('on'));
    const p = this.returnPose || this.basePose;
    this.flyTo(p, { shift: { x: 0, y: 0 }, duration: 1.0 });
  }

  step(dir) {
    if (!this.active) return;
    const n = this.hotspots.length;
    this.openHotspot(this.hotspots[(this.active.index + dir + n) % n]);
  }

  async renderPanel(h) {
    const p = h.panel || {};
    const token = (this._pt = (this._pt || 0) + 1);
    this.panel.classList.add('open');
    this.panelBody.innerHTML = `<div class="se-eyebrow">${esc(p.eyebrow || '')}</div><h2 class="se-title">${esc(p.title || h.label)}</h2><div class="se-body"><div class="se-skel"></div></div>`;
    this.panel.scrollTop = 0;
    let html = '';
    try { html = typeof p.html === 'function' ? await p.html({ ...this.makeContext(), data: this.data }) : (p.html || ''); }
    catch (e) { console.warn(e); html = '<p>Something went wrong loading this. Please try again.</p>'; }
    if (token !== this._pt) return;           // user moved on
    const ctas = (p.ctas || (p.cta ? [p.cta] : [])).map((c, i) => `<a class="se-cta${i ? ' alt' : ''}" href="${esc(c.href)}"${c.external ? ' target="_blank" rel="noopener"' : ''}>${esc(c.label)}</a>`).join('');
    this.panelBody.innerHTML = `<div class="se-eyebrow">${esc(p.eyebrow || '')}</div><h2 class="se-title">${esc(p.title || h.label)}</h2><div class="se-body">${html}</div>${ctas ? `<div class="se-ctas">${ctas}</div>` : ''}`;
    this.panel.scrollTop = 0;
    this.panelCount.textContent = `${h.index + 1} / ${this.hotspots.length}`;
  }

  // ───────────────────────────── per-frame ─────────────────────────────
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    // frame-rate watchdog (real time, not the clamped dt): judge every 20 frames, step down while it is slow
    const now = performance.now(), raw = now - (this._lastFrame || now); this._lastFrame = now;
    if (this._skipSample || document.hidden) { this._skipSample = false; }                // just came back from a hidden tab
    else if (!this.noDegrade && t > 0.8 && raw > 0) {
      const w = this.watch || (this.watch = { n: 0, t: 0, slow: 0 });
      w.n++; w.t += raw; if (raw > 42) w.slow++;
      // "slow" = most frames in the window are slow, so a one-off hitch (shader compile, tab switch) doesn't count
      if (w.n >= 20 || w.t > 2500) { if (w.slow / w.n > 0.6) this.degrade(); w.n = 0; w.t = 0; w.slow = 0; }
    }
    this.updateTween(dt);
    if (this.mode === 'free' && !this.tween) this.updateFree(dt);

    // parallax breathing
    if (!this.reduceMotion) {
      this.par.x = lerp(this.par.x, this.par.tx, 0.06);
      this.par.y = lerp(this.par.y, this.par.ty, 0.06);
    }
    this.animators.forEach(fn => fn(dt, t));

    // glow
    this.hotspots.forEach(h => {
      const target = ((h === this.hovered || h === this.aimed) && this.mode === 'free') ? 1 : 0;
      h.glow = lerp(h.glow, target, 0.16);
      const g = h.glow;
      h.mats.forEach(({ m, base, baseI }) => { m.emissive.setRGB(base.r + 0.30 * g, base.g + 0.26 * g, base.b + 0.2 * g); m.emissiveIntensity = baseI; });
    });

    this.applyCamera();
    this.camera.updateMatrixWorld();
    this.updateAim(dt);
    this.updateMarkers();
    if (this.composer) {
      if (this.bokeh) {
        // focus on whatever the visitor is looking at: the active hotspot, else the scene's focal point
        const f = (this.active && this.active.focus && this.active.focus.to) || this.cfg.camera?.focusPoint || [0, 1, 0];
        const d = Math.hypot(f[0] - this.cam.x, f[1] - this.cam.y, f[2] - this.cam.z);
        const st = this.dofState, close = this.mode === 'focus' || !!this.active;
        st.focus = lerp(st.focus, d, 0.12);
        st.aperture = lerp(st.aperture, close ? this.dof.focusAperture : this.dof.aperture, 0.08);
        this.bokeh.uniforms.focus.value = st.focus;
        this.bokeh.uniforms.aperture.value = st.aperture;
      }
      try { this.composer.render(dt); } catch (e) { console.error('[scene] post-processing failed', e); this.degrade(); }
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  updateTween(dt) {
    const tw = this.tween;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + dt / tw.d);
    const e = ease(tw.t), a = tw.from, b = tw.to, c = this.cam;
    c.x = lerp(a.x, b.x, e); c.y = lerp(a.y, b.y, e); c.z = lerp(a.z, b.z, e);
    c.yaw = lerp(a.yaw, b.yaw, e); c.pitch = lerp(a.pitch, b.pitch, e); c.fov = lerp(a.fov, b.fov, e);
    this.shift.x = lerp(a.sx, b.sx, e); this.shift.y = lerp(a.sy, b.sy, e);
    if (tw.t >= 1) { this.tween = null; tw.then && tw.then(); }
  }

  updateFree(dt) {
    const cfg = this.cfg.camera || {};
    const k = this.keys, c = this.cam;
    const turn = (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0);
    const fwd = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
    const str = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    if (turn || fwd || str) { this.interacted = true; this.hint.classList.remove('show'); }
    c.yaw += turn * 1.5 * dt;
    const speed = cfg.speed ?? 1.7;
    this.vel.f = lerp(this.vel.f, fwd * speed, 0.14);
    this.vel.s = lerp(this.vel.s, str * speed, 0.14);
    if (Math.abs(this.vel.f) > 0.002 || Math.abs(this.vel.s) > 0.002) {
      const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
      c.x += (-sy * this.vel.f + cy * this.vel.s) * dt;
      c.z += (-cy * this.vel.f - sy * this.vel.s) * dt;
      this.constrain();
    }
    // limits
    const ly = deg(cfg.lookYaw ?? 100), lp = deg(cfg.lookPitch ?? 38);
    c.yaw = this.base.yaw + clamp(angDiff(this.base.yaw, c.yaw), -ly, ly);
    c.pitch = clamp(c.pitch, -lp, lp);
    // wheel zoom eases back to target
    if (this.fovTarget != null) c.fov = lerp(c.fov, this.fovTarget, 0.15);
  }

  constrain() {
    const b = (this.cfg.camera || {}).bounds;
    if (!b) return;
    const c = this.cam;
    c.x = clamp(c.x, b.minX, b.maxX); c.z = clamp(c.z, b.minZ, b.maxZ);
    (this.cfg.camera.colliders || []).forEach(o => {
      if (c.x > o.minX && c.x < o.maxX && c.z > o.minZ && c.z < o.maxZ) {
        const d = [c.x - o.minX, o.maxX - c.x, c.z - o.minZ, o.maxZ - c.z], m = Math.min(...d), i = d.indexOf(m);
        if (i === 0) c.x = o.minX; else if (i === 1) c.x = o.maxX; else if (i === 2) c.z = o.minZ; else c.z = o.maxZ;
      }
    });
  }

  updateMarkers() {
    const show = this.mode === 'free' && !this.tween && !this.hideMarkers;
    const v = new THREE.Vector3();
    this.markerLayer.classList.toggle('hide', !show);
    if (!show) return;
    this.hotspots.forEach(h => {
      v.copy(h.anchor).project(this.camera);
      const ok = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      const el = h.markerEl;
      if (!ok) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.transform = `translate(${((v.x + 1) / 2) * this.width}px, ${((1 - v.y) / 2) * this.height}px) translate(-50%, -50%)`;
      el.classList.toggle('hot', h === this.hovered || h === this.aimed);
    });
  }

  // ───────────────────────────── input ─────────────────────────────
  bind() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', e => {
      el.setPointerCapture(e.pointerId);
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0, t: performance.now() };
    });
    el.addEventListener('pointermove', e => {
      if (down) {
        const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
        down.lx = e.clientX; down.ly = e.clientY;
        down.moved += Math.abs(dx) + Math.abs(dy);
        if (this.mode === 'free' && !this.tween && down.moved > 5) {
          this.cam.yaw += dx * 0.0042 * (this.cam.fov / 55);
          this.cam.pitch += dy * 0.0042 * (this.cam.fov / 55);
          this.interacted = true; this.hint.classList.remove('show');
          el.style.cursor = 'grabbing';
        }
        return;
      }
      if (e.pointerType === 'mouse') {
        const rect = el.getBoundingClientRect();
        this.par.tx = -((e.clientX - rect.left) / rect.width - 0.5) * deg(3.2);
        this.par.ty = -((e.clientY - rect.top) / rect.height - 0.5) * deg(2.2);
        if (this.mode === 'free' && !this.tween) {
          this.hovered = this.pick(e.clientX, e.clientY);
          el.style.cursor = this.hovered ? 'pointer' : 'grab';
        }
      }
    });
    const up = e => {
      if (!down) return;
      const wasClick = down.moved < 7 && performance.now() - down.t < 600;
      down = null;
      el.style.cursor = this.hovered ? 'pointer' : 'grab';
      if (!wasClick || this.tween) return;
      const h = this.pick(e.clientX, e.clientY) || (e.pointerType === 'mouse' && this.mode === 'free' ? this.aimed : null);
      if (h) this.openHotspot(h);
      else if (this.mode === 'focus') this.closePanel();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => { down = null; });
    el.addEventListener('pointerleave', () => { if (!down) { this.hovered = null; this.par.tx = this.par.ty = 0; } });
    el.style.cursor = 'grab';
    el.addEventListener('wheel', e => {
      if (this.mode !== 'free' || this.tween) return;
      e.preventDefault();
      const base = this.baseFov;
      this.fovTarget = clamp((this.fovTarget ?? this.cam.fov) + e.deltaY * 0.03, base * 0.55, base * 1.25);
    }, { passive: false });

    window.addEventListener('keydown', e => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.code === 'Escape') { this.closePanel(); return; }
      if (e.code === 'Home' || e.code === 'KeyR') { e.preventDefault(); this.recenter(); return; }
      if (this.mode === 'focus') {
        if (e.code === 'ArrowRight') { e.preventDefault(); this.step(1); }
        if (e.code === 'ArrowLeft') { e.preventDefault(); this.step(-1); }
        return;
      }
      if ((e.code === 'Enter' || e.code === 'Space') && !this.tween && (this.popFor || this.aimed) && !/BUTTON|A/.test(e.target.tagName)) { e.preventDefault(); this.openHotspot(this.popFor || this.aimed); return; }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('resize', () => this.resize());
    const pin = () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); if (this.root.scrollLeft || this.root.scrollTop) { this.root.scrollLeft = 0; this.root.scrollTop = 0; } };
    window.addEventListener('scroll', pin, { passive: true }); this.root.addEventListener('scroll', pin, { passive: true });

    // on-screen walk pad for touch devices
    this.pad.querySelectorAll('button').forEach(b => {
      const code = b.dataset.key;
      const on = e => { e.preventDefault(); this.keys.add(code); this.interacted = true; this.hint.classList.remove('show'); };
      const off = () => this.keys.delete(code);
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    });
  }

  resize() {
    const rect = this.stage.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width)); this.height = Math.max(1, Math.round(rect.height));
    this.renderer.setSize(this.width, this.height);
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(this.width, this.height); }
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    if (this.mode === 'focus') { const s = this.panelShift(); this.shift.x = s.x; this.shift.y = s.y; }
  }

  // ───────────────────────────── UI shell ─────────────────────────────
  buildUI() {
    const ui = this.cfg.ui || {};
    const r = this.root;
    r.innerHTML = `
      <div class="se-stage"></div>
      <div class="se-markers"></div>
      <div class="se-aim" aria-hidden="true"><i></i></div>
      <button type="button" class="se-pop" tabindex="-1"><span class="se-pop-eyebrow"></span><span class="se-pop-title"></span><span class="se-pop-body"></span><span class="se-pop-more"></span></button>
      <header class="se-top">
        ${ui.logo ? `<a class="se-brand" href="${esc(ui.exit?.href || '/')}"><img src="${esc(ui.logo)}" alt="${esc(this.cfg.title || '')}"></a>` : `<span class="se-brand-text">${esc(this.cfg.title || '')}</span>`}
        <div class="se-top-r">
          <button type="button" class="se-btn se-recenter" title="Back to the starting view"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg><span>Recenter</span></button>
          <button type="button" class="se-btn se-dots-toggle" aria-pressed="true" title="Show or hide the glowing dots">Dots</button>
          ${ui.exit ? `<a class="se-btn" href="${esc(ui.exit.href)}">${esc(ui.exit.label)}</a>` : ''}
        </div>
      </header>
      <aside class="se-panel" aria-live="polite">
        <div class="se-panel-bar">
          <button type="button" class="se-nav se-prev" aria-label="Previous">‹</button>
          <span class="se-count"></span>
          <button type="button" class="se-nav se-next" aria-label="Next">›</button>
          <button type="button" class="se-close" aria-label="Close">✕ <span>Back</span></button>
        </div>
        <div class="se-panel-body"></div>
      </aside>
      <div class="se-chips" role="toolbar" aria-label="Places to explore"></div>
      <div class="se-hint">${this.coarse ? 'Drag to look · aim the circle at things' : 'Drag to look · ← ↑ ↓ → to walk · aim the circle at things'}</div>
      <div class="se-pad"><button data-key="ArrowUp" aria-label="Walk forward">▲</button><button data-key="ArrowDown" aria-label="Walk back">▼</button></div>
      <div class="se-loader">${ui.logo ? `<img src="${esc(ui.logo)}" alt="">` : ''}<div>${esc(ui.loading || 'Setting up…')}</div></div>
      <div class="se-fallback"></div>`;
    this.stage = r.querySelector('.se-stage');
    this.markerLayer = r.querySelector('.se-markers');
    this.aimEl = r.querySelector('.se-aim');
    this.pop = r.querySelector('.se-pop');
    this.pop.addEventListener('click', () => { if (this.popFor) this.openHotspot(this.popFor); });
    this.panel = r.querySelector('.se-panel');
    this.panelBody = r.querySelector('.se-panel-body');
    this.panelCount = r.querySelector('.se-count');
    this.chips = r.querySelector('.se-chips');
    this.hint = r.querySelector('.se-hint');
    this.pad = r.querySelector('.se-pad');
    this.loader = r.querySelector('.se-loader');
    r.querySelector('.se-close').addEventListener('click', () => this.closePanel());
    this.panelBody.addEventListener('click', e => {
      const a = e.target.closest('[data-hotspot]');
      if (!a) return;
      e.preventDefault();
      const h = this.hotspots.find(x => x.id === a.dataset.hotspot);
      if (h) this.openHotspot(h);
    });
    r.querySelector('.se-prev').addEventListener('click', () => this.step(-1));
    r.querySelector('.se-next').addEventListener('click', () => this.step(1));
    r.querySelector('.se-recenter').addEventListener('click', () => this.recenter());
    const tgl = r.querySelector('.se-dots-toggle');
    tgl.addEventListener('click', () => { this.hideMarkers = !this.hideMarkers; tgl.setAttribute('aria-pressed', String(!this.hideMarkers)); });
  }

  showFallback() {
    const f = this.root.querySelector('.se-fallback');
    const ui = this.cfg.ui || {};
    f.innerHTML = `<div><h2>${esc(this.cfg.title || '')}</h2><p>Your browser couldn't start the 3D view. You can still see everything on the main site.</p>${ui.exit ? `<a class="se-cta" href="${esc(ui.exit.href)}">${esc(ui.exit.label)}</a>` : ''}</div>`;
    f.classList.add('show');
    this.loader.classList.add('gone');
  }
}
