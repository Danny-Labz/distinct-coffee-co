// scene-engine/props-hd.js
// ─────────────────────────────────────────────────────────────────────────────
// Photoreal-leaning prop library: physically based materials (real glass,
// brushed steel, acrylic, marble), bevelled geometry and procedural textures.
// Designed to be lit by an HDR environment (config.world.hdr).
// Every builder returns a THREE.Group, units = metres, origin at the base.
// Nothing in here is specific to one business.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTex } from './props.js';

let QUALITY = 'high';
/** 'high' → transmission glass, denser grass. 'low' → cheaper look-alikes for phones. */
export function setQuality(q) { QUALITY = q; }

const sh = (m, cast = true, receive = true) => { m.castShadow = cast; m.receiveShadow = receive; return m; };
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ── geometry helpers ─────────────────────────────────────────────────────────
export function rbox(w, h, d, r, material, x = 0, y = 0, z = 0) {
  const m = sh(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), material));
  m.position.set(x, y, z);
  return m;
}
export function cyl(rt, rb, h, material, x = 0, y = 0, z = 0, seg = 40) {
  const m = sh(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material));
  m.position.set(x, y, z);
  return m;
}
export function lathe(points, material, seg = 56) {
  return sh(new THREE.Mesh(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), seg), material));
}
/**
 * Give a thin surface real back faces (reversed copies of every triangle) so it can use a single-sided
 * material. Helper passes (ambient occlusion, depth of field) render with their own single-sided
 * materials, so a `DoubleSide` sheet would be invisible to them from behind.
 */
export function doubleFace(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name], n = a.itemSize, src = a.array, dst = new Float32Array(src.length * 2);
    dst.set(src, 0);
    for (let tri = 0; tri < a.count / 3; tri++) {
      for (let k = 0; k < 3; k++) {
        const from = (tri * 3 + (k === 0 ? 0 : 3 - k)) * n, to = src.length + (tri * 3 + k) * n;      // swap 2nd and 3rd vertex
        for (let c = 0; c < n; c++) dst[to + c] = name === 'normal' ? -src[from + c] : src[from + c];
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(dst, n));
  }
  return out;
}
export function tube(points, r, material, seg = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return sh(new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 10), material));
}

// ── procedural textures ──────────────────────────────────────────────────────
function grey(tex) { tex.colorSpace = THREE.NoColorSpace; return tex; }

/** Fine speckle for bump/roughness: paint, rubber, fabric, paper. */
export function noiseTex(size = 256, { contrast = 60, base = 128, seed = 3, repeat = [4, 4] } = {}) {
  return grey(canvasTex(size, size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h), r = seeded(seed);
    for (let i = 0; i < w * h; i++) { const v = base + (r() - 0.5) * contrast; img.data.set([v, v, v, 255], i * 4); }
    ctx.putImageData(img, 0, 0);
  }, repeat));
}
/** Straight brushed-metal streaks (use as roughnessMap/bumpMap). */
export function brushedTex({ vertical = false, seed = 5, repeat = [1, 1] } = {}) {
  return grey(canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8c8c8c'; ctx.fillRect(0, 0, w, h);
    const r = seeded(seed);
    for (let i = 0; i < 1400; i++) {
      const v = 90 + r() * 110; ctx.strokeStyle = `rgba(${v},${v},${v},${0.10 + r() * 0.25})`; ctx.lineWidth = 0.5 + r() * 1.2;
      const p = r() * w, a = r() * w, len = 60 + r() * 400;
      ctx.beginPath(); if (vertical) { ctx.moveTo(p, a); ctx.lineTo(p, a + len); } else { ctx.moveTo(a, p); ctx.lineTo(a + len, p); } ctx.stroke();
    }
  }, repeat));
}
/** Circular (spun) brushed metal — pot lids. */
export function spunTex(seed = 8) {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#d2d4d6'; ctx.fillRect(0, 0, w, h);
    const r = seeded(seed);
    for (let i = 0; i < 520; i++) {
      const v = 150 + r() * 100; ctx.strokeStyle = `rgba(${v},${v},${v + 2},${0.12 + r() * 0.3})`; ctx.lineWidth = 0.4 + r() * 1.1;
      const rad = r() * w * 0.5, a0 = r() * 6.28;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, rad, a0, a0 + 1 + r() * 5); ctx.stroke();
    }
    // conical highlights, like real spun steel
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.5;
      const g = ctx.createConicGradient ? ctx.createConicGradient(a, w / 2, h / 2) : null;
      if (!g) break;
      g.addColorStop(0, 'rgba(255,255,255,0.20)'); g.addColorStop(0.06, 'rgba(255,255,255,0)'); g.addColorStop(0.94, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.20)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  });
}
export function marbleTex(seed = 11) {
  return canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#f3f2ef'; ctx.fillRect(0, 0, w, h);
    const r = seeded(seed);
    // soft cloudy tone variation
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h, rad = 80 + r() * 260, g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const c = r() > 0.5 ? '255,255,255' : '176,180,188';
      g.addColorStop(0, `rgba(${c},${0.10 + r() * 0.12})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // veins: wandering lines, each drawn feathered (wide+faint → thin+dark)
    for (let i = 0; i < 16; i++) {
      const pts = []; let x = r() * w, y = r() * h, ang = r() * 6.28;
      for (let k = 0; k < 14; k++) { pts.push([x, y]); ang += (r() - 0.5) * 1.1; const st = 40 + r() * 80; x += Math.cos(ang) * st; y += Math.sin(ang) * st; }
      const tone = 110 + r() * 50, strength = 0.25 + r() * 0.75;
      [[14, 0.018], [7, 0.04], [3, 0.09], [1.1, 0.22]].forEach(([lw, a]) => {
        ctx.strokeStyle = `rgba(${tone},${tone + 4},${tone + 12},${a * strength})`; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length - 1; k++) { const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2; ctx.quadraticCurveTo(pts[k][0], pts[k][1], mx, my); }
        ctx.stroke();
      });
    }
  }, [1, 1]);
}
export function grassTex(seed = 21) {
  return canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#56792c'; ctx.fillRect(0, 0, w, h);
    const r = seeded(seed);
    for (let i = 0; i < 46000; i++) {
      const x = r() * w, y = r() * h, len = 4 + r() * 11, a = -Math.PI / 2 + (r() - 0.5) * 2.2;
      const g = 86 + r() * 92, rr = g * (0.56 + r() * 0.3), b = g * (0.16 + r() * 0.16);
      ctx.strokeStyle = `rgba(${rr},${g},${b},${0.3 + r() * 0.5})`; ctx.lineWidth = 0.7 + r() * 1.2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
      if (x < 14 || y < 14) { ctx.beginPath(); ctx.moveTo(x + w, y + h); ctx.lineTo(x + w + Math.cos(a) * len, y + h + Math.sin(a) * len); ctx.stroke(); }
    }
    for (let i = 0; i < 2500; i++) { ctx.fillStyle = `rgba(20,34,10,${0.25 + r() * 0.3})`; ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3); }
  }, [1, 1]);
}

// ── materials ────────────────────────────────────────────────────────────────
const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());
export const M = {
  /** Matte black paint (cart body). */
  blackPaint: () => once('blackPaint', () => new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.58, bumpMap: noiseTex(256, { contrast: 40, repeat: [10, 10] }), bumpScale: 0.0006 })),
  whitePaint: () => once('whitePaint', () => new THREE.MeshStandardMaterial({ color: 0xf1f0ec, roughness: 0.45 })),
  blackPlastic: () => once('blackPlastic', () => new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.42 })),
  blackSatin: () => once('blackSatin', () => new THREE.MeshPhysicalMaterial({ color: 0x0a0a0b, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.5 })),
  rubber: () => once('rubber', () => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.92, bumpMap: noiseTex(128, { contrast: 90, repeat: [6, 6] }), bumpScale: 0.0008 })),
  steel: () => once('steel', () => new THREE.MeshStandardMaterial({ color: 0xc9cbce, metalness: 1, roughness: 0.34, roughnessMap: brushedTex({ repeat: [1, 1] }) })),
  steelPolished: () => once('steelPolished', () => new THREE.MeshStandardMaterial({ color: 0xd9dbde, metalness: 1, roughness: 0.12 })),
  gold: () => once('gold', () => new THREE.MeshStandardMaterial({ color: 0xd8b46a, metalness: 1, roughness: 0.2 })),
  marble: () => once('marble', () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: marbleTex(), roughness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.12 })),
  paperWhite: () => once('paperWhite', () => new THREE.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.62 })),
  cloth: () => once('cloth', () => new THREE.MeshStandardMaterial({ color: 0xefeae0, roughness: 1, bumpMap: noiseTex(256, { contrast: 120, repeat: [14, 14] }), bumpScale: 0.002 })),
  orange: () => once('orange', () => new THREE.MeshStandardMaterial({ color: 0xe8591c, roughness: 0.5 })),
  canopy: () => once('canopy', () => new THREE.MeshStandardMaterial({ color: 0xf7f7f5, roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0.1 })),
  powderWhite: () => once('powderWhite', () => new THREE.MeshStandardMaterial({ color: 0xeceeef, roughness: 0.45, metalness: 0.15 })),
};

/** Clear or tinted glass / liquid. On 'high' it truly refracts; on 'low' it is a cheap transparent look-alike. */
export function glass({ tint = 0xffffff, liquid = null, thickness = 0.02, roughness = 0.02, opacity = 0.2 } = {}) {
  if (QUALITY === 'high') {
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness, metalness: 0, transmission: 1, ior: liquid ? 1.42 : 1.5, thickness,
      attenuationColor: new THREE.Color(liquid ?? tint), attenuationDistance: liquid ? 0.05 : 0.6, specularIntensity: 1,
    });
  }
  if (liquid != null) return new THREE.MeshPhysicalMaterial({ color: new THREE.Color(liquid).multiplyScalar(0.7), roughness: 0.07, transparent: true, opacity: 0.93, specularIntensity: 0.7 });
  return new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.04, transparent: true, opacity, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.03 });
}
/** Thin clear shell (plastic cups, jars) — never refracts, cheap and reliable around opaque contents. */
export function clearShell(opacity = 0.16) {
  return new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1 });
}

// ── ground + vegetation ──────────────────────────────────────────────────────
/**
 * Lawn: textured ground plus thousands of instanced, wind-blown grass clumps around the origin.
 * exclude: [{minX,maxX,minZ,maxZ}] footprints where no blades grow. map/normalMap: optional photo textures
 * (falls back to a procedural one). Returns { group, update(t) }.
 */
export function lawn({ size = 200, area = { minX: -4.2, maxX: 4.2, minZ: -1.6, maxZ: 6.2 }, count, exclude = [], tint = 0xffffff, map = null, normalMap = null, tile = 3.4 } = {}) {
  const g = new THREE.Group();
  const tex = map || grassTex();
  [tex, normalMap].forEach(t => { if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(size / tile, size / tile); t.anisotropy = 8; } });
  if (map) map.colorSpace = THREE.SRGBColorSpace;
  const groundMat = new THREE.MeshStandardMaterial({ map: tex, normalMap, color: tint, roughness: 0.95 });
  const plane = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 72), groundMat);
  plane.rotation.x = -Math.PI / 2; plane.receiveShadow = true; g.add(plane);
  // large-scale tone variation so the lawn never reads as a flat tiled colour
  const blot = canvasTex(512, 512, (ctx, w, h) => {
    const r = seeded(91);
    for (let i = 0; i < 150; i++) {
      const x = r() * w, y = r() * h, rad = 14 + r() * 60, gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const c = r() > 0.55 ? '196,188,96' : (r() > 0.5 ? '30,52,18' : '120,150,70');
      gr.addColorStop(0, `rgba(${c},${0.16 + r() * 0.2})`); gr.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = gr; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
  const over = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: blot, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  over.rotation.x = -Math.PI / 2; over.position.y = 0.001; over.receiveShadow = true; over.renderOrder = 1; g.add(over);

  const n = count ?? (QUALITY === 'high' ? 42000 : 12000);
  // one clump = 5 curved blades
  const pos = [], col = [], nor = [], idx = [];
  const segs = 3;
  for (let b = 0; b < 5; b++) {
    const ang = b * 2.4 + 0.4, ca = Math.cos(ang), sa = Math.sin(ang), lean = 0.3 + (b % 3) * 0.22, hgt = 1 - (b % 3) * 0.22, off = pos.length / 3, ox = Math.cos(b * 1.9) * 1.6, oz = Math.sin(b * 1.9) * 1.6;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, hw = 0.5 * (1 - t * 0.92), y = t * hgt, bend = t * t * lean;
      [-hw, hw].forEach(x => { pos.push(x * ca + bend * sa + ox, y, -x * sa + bend * ca + oz); nor.push(0, 1, 0); const k = 0.5 + t * 0.6; col.push(k, k, k * 0.9); });
      if (i < segs) { const a = off + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2, a, a + 2, a + 1, a + 1, a + 2, a + 3); }   // both windings: normals stay 'up' on either side
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  mat.onBeforeCompile = s => {
    s.uniforms.uTime = uniforms.uTime;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         float ph = instanceMatrix[3].x * 1.3 + instanceMatrix[3].z * 1.7;
         float sway = (sin(uTime * 1.5 + ph) + 0.5 * sin(uTime * 2.7 + ph * 1.9)) * 0.16 * position.y * position.y;
         transformed.x += sway; transformed.z += sway * 0.5;
       #endif`);
  };
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.userData.noAO = true; mesh.userData.noDofDepth = true;
  const r = seeded(77), d = new THREE.Object3D(), c = new THREE.Color();
  let placed = 0, guard = 0;
  while (placed < n && guard++ < n * 4) {
    const x = area.minX + r() * (area.maxX - area.minX), z = area.minZ + r() * (area.maxZ - area.minZ);
    if (exclude.some(e => x > e.minX && x < e.maxX && z > e.minZ && z < e.maxZ)) continue;
    d.position.set(x, 0, z); d.rotation.y = r() * 6.28;
    const h = 0.03 + r() * 0.045;
    const sw = 0.007 + r() * 0.004; d.scale.set(sw, h, sw); d.updateMatrix();
    mesh.setMatrixAt(placed, d.matrix);
    const gg = 0.15 + r() * 0.12; c.setRGB(gg * (0.36 + r() * 0.26), gg, gg * (0.05 + r() * 0.09));
    mesh.setColorAt(placed, c);
    placed++;
  }
  mesh.count = placed; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  g.add(mesh);
  return { group: g, update: t => { uniforms.uTime.value = t; }, groundMat, bladeMat: mat };
}

/** Leafy tree made of many soft foliage clumps (reads as real foliage once depth-of-field blurs it). */
export function tree({ height = 7, crown = 3, seed = 1, leaf = 0x3f6a2a, trunk = 0x4a3a2c } = {}) {
  const g = new THREE.Group(), r = seeded(seed * 13 + 1);
  const tm = new THREE.MeshStandardMaterial({ color: trunk, roughness: 1 });
  const th = height * 0.52;
  g.add(tube([[0, 0, 0], [0.05 * crown * (r() - 0.5), th * 0.5, 0.04], [0.12 * crown * (r() - 0.5), th, 0.05 * (r() - 0.5)]], 0.06 + height * 0.011, tm, 8));
  const n = 420, geo = new THREE.SphereGeometry(1, 9, 7);
  const lm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, emissive: new THREE.Color(leaf), emissiveIntensity: 0.05 });
  const im = new THREE.InstancedMesh(geo, lm, n); im.castShadow = true; im.receiveShadow = true;
  const d = new THREE.Object3D(), base = new THREE.Color(leaf), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    // points in a squashed ellipsoid, denser toward the shell
    const u = r() * 6.28, v = Math.acos(2 * r() - 1), rad = crown * (0.45 + 0.55 * Math.cbrt(r()));
    d.position.set(Math.sin(v) * Math.cos(u) * rad * (0.8 + r() * 0.4), height * 0.68 + Math.cos(v) * rad * 0.7, Math.sin(v) * Math.sin(u) * rad * (0.8 + r() * 0.4));
    const s = crown * (0.07 + r() * 0.1); d.scale.set(s, s * (0.6 + r() * 0.4), s); d.rotation.set(r() * 3, r() * 3, r() * 3); d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
    const up = (d.position.y - height * 0.45) / (crown * 1.2);
    c.copy(base).offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * 0.07 + up * 0.05); im.setColorAt(i, c);
  }
  im.instanceColor.needsUpdate = true;
  g.add(im);
  return g;
}

/** Distant ring of soft foliage masses — background for depth-of-field. */
export function treeLine({ count = 240, near = 34, far = 60, seed = 9, leaf = 0x49742e } = {}) {
  const r = seeded(seed), geo = new THREE.SphereGeometry(1, 12, 9);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), count);
  const d = new THREE.Object3D(), base = new THREE.Color(leaf), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = r() * 6.28, rad = near + r() * (far - near), s = 2.2 + r() * 3.2;
    d.position.set(Math.cos(a) * rad, s * (0.7 + r() * 1.4), Math.sin(a) * rad); d.scale.set(s * (1 + r() * 0.6), s, s * (1 + r() * 0.6)); d.rotation.set(r() * 3, r() * 3, r() * 3); d.updateMatrix();
    im.setMatrixAt(i, d.matrix); c.copy(base).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.12, (r() - 0.5) * 0.1); im.setColorAt(i, c);
  }
  im.instanceColor.needsUpdate = true; im.frustumCulled = false;
  return im;
}

/** White pop-up canopy tent with scissor trusses. */
export function canopyTent({ w = 3, d = 3, eave = 2.2, peak = 2.95, overhang = 0.06 } = {}) {
  const g = new THREE.Group();
  const fm = M.powderWhite(), cm = M.canopy();
  const hw = w / 2, hd = d / 2;
  const bar = (a, b, t = 0.016) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
    const m = sh(new THREE.Mesh(new THREE.BoxGeometry(t, len, t * 0.6), fm), true, false);
    m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.sub(A).normalize());
    return m;
  };
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    g.add(rbox(0.034, eave, 0.034, 0.004, fm, sx * hw, eave / 2, sz * hd));
    g.add(rbox(0.09, 0.008, 0.09, 0.002, fm, sx * hw, 0.004, sz * hd));
    g.add(rbox(0.05, 0.07, 0.05, 0.006, M.blackPlastic(), sx * hw, eave - 0.035, sz * hd));          // corner bracket
    g.add(bar([sx * hw, eave - 0.03, sz * hd], [0, peak - 0.12, 0], 0.014));                         // rafters
  });
  // scissor trusses along each side
  const top = eave - 0.02, bot = eave - 0.42;
  const side = (ax, az, bx, bz) => {
    const n = 2;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const p = t => [ax + (bx - ax) * t, 0, az + (bz - az) * t];
      const a = p(t0), b = p(t1);
      g.add(bar([a[0], top, a[2]], [b[0], bot, b[2]])); g.add(bar([a[0], bot, a[2]], [b[0], top, b[2]]));
    }
  };
  side(-hw, -hd, hw, -hd); side(-hw, hd, hw, hd); side(-hw, -hd, -hw, hd); side(hw, -hd, hw, hd);
  g.add(rbox(0.07, 0.07, 0.07, 0.008, M.blackPlastic(), 0, peak - 0.14, 0));
  // canopy
  const cw = w + overhang * 2, cd = d + overhang * 2;
  const roofG = new THREE.ConeGeometry(Math.SQRT1_2, peak - eave, 4, 6, true); roofG.rotateY(Math.PI / 4);
  let flat = roofG.toNonIndexed(); flat.computeVertexNormals(); flat = doubleFace(flat);
  const roof = sh(new THREE.Mesh(flat, cm), true, false); roof.scale.set(cw, 1, cd); roof.position.y = eave + (peak - eave) / 2; g.add(roof);
  const val = 0.24;
  [[0, -cd / 2, cw, 0], [0, cd / 2, cw, 0], [-cw / 2, 0, cd, Math.PI / 2], [cw / 2, 0, cd, Math.PI / 2]].forEach(([x, z, len, ry]) => {
    const v = sh(new THREE.Mesh(doubleFace(new THREE.PlaneGeometry(len, val)), cm), true, false); v.position.set(x, eave - val / 2 + 0.002, z); v.rotation.y = ry; g.add(v);
  });
  return g;
}

// ── the cart ─────────────────────────────────────────────────────────────────
/**
 * Mobile bar cart: matte black body, white corner trims, marble top, acrylic sign on gold standoffs, casters.
 * userData: { topY, plate (the sign mesh), width, depth }
 */
export function cart({ width = 2.0, depth = 0.75, bodyH = 0.8, signTexture = null, signW = 1.0, signH = 0.62, casterColor } = {}) {
  const g = new THREE.Group();
  const casterH = 0.105, plinthH = 0.05, topH = 0.05;
  const y0 = casterH, yb = y0 + plinthH, yt = yb + bodyH, topY = yt + topH;
  g.add(rbox(width + 0.1, plinthH, depth + 0.1, 0.006, M.blackSatin(), 0, y0 + plinthH / 2, 0));       // base skirt
  g.add(rbox(width, bodyH, depth, 0.004, M.blackPaint(), 0, yb + bodyH / 2, 0));                       // body
  const t = 0.04;
  [-1, 1].forEach(s => {                                                                               // white corner posts (front)
    g.add(rbox(t, bodyH, 0.012, 0.003, M.whitePaint(), s * (width / 2 - t / 2), yb + bodyH / 2, depth / 2 + 0.004));
    g.add(rbox(0.012, bodyH, t, 0.003, M.whitePaint(), s * (width / 2 + 0.004), yb + bodyH / 2, depth / 2 - t / 2));
  });
  g.add(rbox(width + 0.1, topH, depth + 0.1, 0.007, M.marble(), 0, yt + topH / 2, 0));                 // marble top
  // acrylic sign on standoffs
  const fz = depth / 2, cy = yb + bodyH * 0.5;
  const acrylic = new THREE.MeshPhysicalMaterial({ color: signTexture ? 0xffffff : 0x050505, map: signTexture, roughness: 0.07, specularIntensity: 0.9 });
  const edge = new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.08, clearcoat: 1 });
  const plate = sh(new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.008), [edge, edge, edge, edge, acrylic, edge]));
  plate.position.set(0, cy, fz + 0.026); g.add(plate);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const x = sx * (signW / 2 - 0.045), y = cy + sy * (signH / 2 - 0.045);
    const post = cyl(0.0085, 0.0085, 0.024, M.gold(), x, y, fz + 0.012, 20); post.rotation.x = Math.PI / 2; g.add(post);
    const cap = cyl(0.0135, 0.0135, 0.007, M.gold(), x, y, fz + 0.0335, 28); cap.rotation.x = Math.PI / 2; g.add(cap);
  });
  // casters
  const wheelM = casterColor != null ? new THREE.MeshStandardMaterial({ color: casterColor, roughness: 0.5 }) : M.orange();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const c = new THREE.Group();
    c.add(rbox(0.075, 0.006, 0.06, 0.002, M.steelPolished(), 0, casterH - 0.003, 0));
    [-1, 1].forEach(s => c.add(rbox(0.004, 0.07, 0.04, 0.001, M.blackPlastic(), s * 0.02, casterH - 0.04, 0.012)));
    const wheel = cyl(0.038, 0.038, 0.03, wheelM, 0, 0.038, 0.014, 32); wheel.rotation.z = Math.PI / 2; c.add(wheel);
    const hub = cyl(0.016, 0.016, 0.034, M.blackPlastic(), 0, 0.038, 0.014, 20); hub.rotation.z = Math.PI / 2; c.add(hub);
    c.position.set(sx * (width / 2 - 0.06), 0, sz * (depth / 2 - 0.05)); c.rotation.y = sx * 0.3 * sz;
    g.add(c);
  });
  g.userData = { topY, plate, width, depth };
  return g;
}

// ── counter-top props ────────────────────────────────────────────────────────
export function barMat(w = 0.6, d = 0.2) {
  const g = new THREE.Group();
  const tex = grey(canvasTex(256, 256, (ctx, W, H) => {
    ctx.fillStyle = '#404040'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#d0d0d0'; for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { ctx.beginPath(); ctx.arc(i * 16 + 8, j * 16 + 8, 4.2, 0, 7); ctx.fill(); }
  }, [w / 0.1, d / 0.1]));
  const top = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.88, bumpMap: tex, bumpScale: 0.004 });
  g.add(rbox(w, 0.007, d, 0.003, M.rubber(), 0, 0.0035, 0));
  const p = sh(new THREE.Mesh(new THREE.PlaneGeometry(w - 0.02, d - 0.02), top), false, true); p.rotation.x = -Math.PI / 2; p.position.y = 0.0074; g.add(p);
  return g;
}

/** Nested stack of disposable cups. */
export function cupStack({ count = 26, rim = 0.046, base = 0.031, cupH = 0.115, gap = 0.0105, color = 0xf7f6f2 } = {}) {
  const g = new THREE.Group();
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.4, side: THREE.DoubleSide });
  const pts = [[0, 0], [base, 0], [base + 0.0015, 0.004]];
  pts.push([rim - 0.001, cupH - 0.004]);
  for (let i = 0; i < count; i++) {
    const y = cupH + i * gap;
    pts.push([rim + 0.0018, y - 0.003], [rim + 0.0022, y], [rim + 0.0008, y + 0.002], [rim - 0.0004, y + 0.0035]);
  }
  const H = cupH + (count - 1) * gap + 0.0035;
  pts.push([rim - 0.003, H], [rim - 0.012, H - 0.05], [0, H - 0.06]);
  g.add(lathe(pts, m, 48));
  g.userData.height = H;
  return g;
}

/** Iced drink in a clear cup with dome lid and straw. logo: canvas/texture printed on the cup. */
export function icedCup({ logoTexture = null, top = 0xb0845a, bottom = 0xdcc29e } = {}) {
  const g = new THREE.Group();
  const H = 0.132, rim = 0.046, base = 0.031;
  const shell = clearShell(0.2);
  const cup = lathe([[0, 0], [base, 0], [base + 0.001, 0.003], [rim, H], [rim + 0.002, H + 0.002]], shell, 48); cup.castShadow = false; cup.renderOrder = 3; g.add(cup);
  const tex = canvasTex(256, 256, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, 0, h), ct = new THREE.Color(top), cb = new THREE.Color(bottom);
    gr.addColorStop(0, '#' + ct.getHexString()); gr.addColorStop(0.55, '#' + ct.clone().lerp(cb, 0.35).getHexString()); gr.addColorStop(1, '#' + cb.getHexString());
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    const r = seeded(4);
    for (let i = 0; i < 16; i++) {                                    // ice cubes pressed against the wall
      const x = r() * w, y = r() * h * 0.75, s = 26 + r() * 22;
      ctx.save(); ctx.translate(x, y); ctx.rotate(r() * 1.5);
      ctx.fillStyle = `rgba(255,248,235,${0.10 + r() * 0.14})`; ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5; ctx.strokeRect(-s / 2, -s / 2, s, s); ctx.restore();
    }
    for (let i = 0; i < 9; i++) {                                     // milk swirls
      ctx.strokeStyle = `rgba(250,238,220,${0.10 + r() * 0.12})`; ctx.lineWidth = 6 + r() * 14; ctx.beginPath();
      const y = h * (0.35 + r() * 0.6); ctx.moveTo(0, y); ctx.bezierCurveTo(w * 0.3, y - 40 + r() * 80, w * 0.6, y - 40 + r() * 80, w, y); ctx.stroke();
    }
  });
  const drink = lathe([[0, 0.004], [base - 0.002, 0.004], [rim - 0.0045, H - 0.014], [0, H - 0.014]], new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25 }), 40);
  drink.renderOrder = 1; g.add(drink);
  // dome lid
  const dome = sh(new THREE.Mesh(new THREE.SphereGeometry(rim + 0.0015, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), shell), false, false);
  dome.scale.y = 0.62; dome.position.y = H + 0.001; dome.renderOrder = 4; g.add(dome);
  const ring = sh(new THREE.Mesh(new THREE.TorusGeometry(rim + 0.002, 0.0022, 8, 48), clearShell(0.4)), false, false); ring.rotation.x = Math.PI / 2; ring.position.y = H + 0.001; ring.renderOrder = 4; g.add(ring);
  // straw
  const straw = cyl(0.0036, 0.0036, 0.215, new THREE.MeshPhysicalMaterial({ color: 0xfbfaf6, roughness: 0.3, transparent: true, opacity: 0.92 }), 0.006, 0.118, -0.006, 14);
  straw.rotation.z = -0.1; straw.rotation.x = -0.07; g.add(straw);
  if (logoTexture) {
    const yb = 0.036, ht = 0.058, rb = base + (rim - base) * (yb / H) + 0.0006, rt = base + (rim - base) * ((yb + ht) / H) + 0.0006;
    const lg = new THREE.CylinderGeometry(rt, rb, ht, 32, 1, true, -0.95, 1.9);
    const lm = new THREE.MeshStandardMaterial({ map: logoTexture, transparent: true, roughness: 0.5, depthWrite: false });
    const l = new THREE.Mesh(lg, lm); l.position.y = yb + ht / 2; l.renderOrder = 5; g.add(l);
  }
  return g;
}

/** Pump bottle (sanitizer / soap). */
export function pumpBottle() {
  const g = new THREE.Group();
  const body = lathe([[0, 0], [0.03, 0], [0.032, 0.004], [0.032, 0.11], [0.028, 0.125], [0.013, 0.135], [0.013, 0.146]], clearShell(0.22), 36); body.renderOrder = 3; g.add(body);
  const gel = lathe([[0, 0.003], [0.0295, 0.003], [0.0295, 0.085], [0, 0.085]], new THREE.MeshPhysicalMaterial({ color: 0xdfeef2, roughness: 0.1, transparent: true, opacity: 0.55 }), 28); gel.castShadow = false; g.add(gel);
  const w = M.paperWhite();
  g.add(cyl(0.0145, 0.0145, 0.016, w, 0, 0.152, 0, 24));
  g.add(cyl(0.004, 0.004, 0.03, w, 0, 0.172, 0, 12));
  g.add(rbox(0.014, 0.01, 0.05, 0.004, w, 0, 0.188, 0.014));
  g.add(cyl(0.0018, 0.0018, 0.1, w, 0, 0.07, 0, 8));
  return g;
}

/** Tumbler full of straws. */
export function strawGlass({ color = 0x0c0c0c, n = 16 } = {}) {
  const g = new THREE.Group(), r = seeded(31);
  const gl = lathe([[0, 0], [0.03, 0], [0.034, 0.004], [0.037, 0.11], [0.0355, 0.11], [0.0325, 0.008], [0, 0.008]], clearShell(0.2), 36); gl.renderOrder = 3; g.add(gl);
  const sm = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, rad = r() * 0.02, s = cyl(0.003, 0.003, 0.2, sm, Math.cos(a) * rad, 0.108, Math.sin(a) * rad, 8);
    s.rotation.set((r() - 0.5) * 0.22, 0, (r() - 0.5) * 0.22); g.add(s);
  }
  return g;
}

/** Matte black pot with a spun-steel lid leaning against it. */
export function brewPot({ r = 0.15, h = 0.2, lidAngle = -0.75 } = {}) {
  const g = new THREE.Group();
  const bm = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide });
  g.add(lathe([[0, 0], [r * 0.9, 0], [r * 0.95, 0.008], [r, h - 0.008], [r + 0.005, h - 0.002], [r + 0.004, h], [r - 0.007, h], [r - 0.011, 0.014], [0, 0.014]], bm, 64));
  g.add(cyl(r - 0.012, r - 0.012, 0.004, new THREE.MeshPhysicalMaterial({ color: 0x100905, roughness: 0.05, clearcoat: 1 }), 0, h - 0.035, 0, 48));   // cold brew surface
  const lidR = r + 0.012, lid = new THREE.Group();
  const spun = spunTex();
  const lm = new THREE.MeshStandardMaterial({ color: 0xc4c8cd, map: spun, metalness: 1, roughness: 0.24 });
  const disc = lathe([[0, -0.004], [lidR, -0.004], [lidR, 0], [lidR - 0.012, 0.004], [lidR * 0.5, 0.01], [0, 0.012]], lm, 64);
  // planar UVs so the spun texture is centred on the lid
  const p = disc.geometry.attributes.position, uv = disc.geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (lidR * 2), 0.5 + p.getZ(i) / (lidR * 2));
  lid.add(disc);
  lid.add(cyl(0.012, 0.016, 0.012, M.steelPolished(), 0, 0.018, 0, 24));
  lid.add(rbox(0.044, 0.012, 0.044, 0.0058, M.blackPlastic(), 0, 0.03, 0));
  const tilt = 0.26;                                                 // lean back against the pot
  lid.rotation.x = Math.PI / 2 - tilt;
  lid.position.set(0, lidR * Math.cos(tilt) + 0.002, r + 0.012 + lidR * Math.sin(tilt) * 0.2);
  const holder = new THREE.Group(); holder.add(lid); holder.rotation.y = lidAngle; g.add(holder);
  g.userData = { lid: holder };
  return g;
}

/** Glass syrup bottle with pourer and paper label. liquid = colour of the syrup. */
export function syrupBottle({ liquid = 0xd9a441, labelTexture = null, pourer = 0x0b0b0b } = {}) {
  const g = new THREE.Group();
  const body = lathe([[0, 0.0005], [0.033, 0.0005], [0.0365, 0.006], [0.0365, 0.168], [0.0345, 0.188], [0.024, 0.224], [0.0148, 0.25], [0.0142, 0.276], [0.0162, 0.279], [0.0162, 0.286], [0, 0.286]],
    glass({ liquid, thickness: 0.07 }), 56);
  g.add(body);
  const pm = new THREE.MeshStandardMaterial({ color: pourer, roughness: 0.4 });
  g.add(cyl(0.0135, 0.0165, 0.012, pm, 0, 0.291, 0, 24));
  const sp = lathe([[0.0105, 0], [0.0095, 0.012], [0.0042, 0.05], [0.0034, 0.066], [0, 0.066]], pm, 20); sp.position.y = 0.296; sp.rotation.z = 0.08; g.add(sp);
  if (labelTexture) {
    const lm = new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.72 });
    const l = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.0371, 0.0371, 0.092, 48, 1, true, -1.45, 2.9), lm), false, false);
    l.position.y = 0.108; g.add(l);
  }
  return g;
}

export function towelStack(n = 3, w = 0.2, d = 0.13) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const t = rbox(w - i * 0.004, 0.024, d - i * 0.003, 0.011, M.cloth(), (i % 2) * 0.004, 0.012 + i * 0.0235, 0); t.rotation.y = (i - 1) * 0.03; g.add(t); }
  return g;
}

export function pitcher({ r = 0.038, h = 0.095 } = {}) {
  const g = new THREE.Group(), m = M.steelPolished().clone(); m.side = THREE.DoubleSide; m.roughness = 0.18;
  g.add(lathe([[0, 0], [r * 0.92, 0], [r, 0.006], [r * 0.96, h * 0.55], [r * 0.82, h * 0.82], [r * 0.9, h], [r * 0.86, h], [r * 0.78, h * 0.82], [r * 0.92, h * 0.5], [r * 0.95, 0.01], [0, 0.008]], m, 40));
  const hd = sh(new THREE.Mesh(new THREE.TorusGeometry(h * 0.3, 0.004, 8, 24, Math.PI), M.steelPolished())); hd.rotation.z = -Math.PI / 2; hd.position.set(r * 0.9, h * 0.5, 0); g.add(hd);
  return g;
}

/**
 * Semi-automatic espresso machine as seen from the customer side: steel group-head tower on the left,
 * black upper housing over a brushed-steel base. Unbranded. ~0.36 wide, 0.37 tall.
 */
export function espressoMachine({ towels = true } = {}) {
  const g = new THREE.Group();
  const steel = M.steel(), black = M.blackSatin(), pl = M.blackPlastic();
  const W = 0.36, D = 0.3;
  g.add(rbox(W, 0.012, D + 0.02, 0.004, pl, 0, 0.006, 0));                                    // feet plate
  // right housing: steel base + black upper
  const hx = 0.05, hw = 0.26;
  g.add(rbox(hw, 0.125, D, 0.01, steel, hx, 0.012 + 0.0625, 0));
  g.add(rbox(hw, 0.205, D, 0.012, black, hx, 0.14 + 0.1025, 0));
  g.add(rbox(hw - 0.02, 0.0025, D + 0.002, 0.001, pl, hx, 0.1385, 0));                         // shadow gap
  // left tower with group head
  const tx = -0.13;
  g.add(rbox(0.1, 0.33, D * 0.82, 0.01, steel, tx, 0.012 + 0.165, -0.02));
  g.add(rbox(0.1, 0.085, 0.12, 0.012, steel, tx, 0.3, 0.13));                                 // head overhang
  g.add(cyl(0.031, 0.034, 0.03, M.steelPolished(), tx, 0.243, 0.14, 36));                      // group
  g.add(cyl(0.035, 0.03, 0.026, M.steelPolished(), tx, 0.216, 0.14, 36));                      // portafilter basket
  const handle = cyl(0.0105, 0.013, 0.12, pl, tx, 0.214, 0.225, 20); handle.rotation.x = Math.PI / 2 - 0.12; g.add(handle);
  g.add(cyl(0.006, 0.006, 0.018, M.steelPolished(), tx - 0.012, 0.196, 0.14, 12)); g.add(cyl(0.006, 0.006, 0.018, M.steelPolished(), tx + 0.012, 0.196, 0.14, 12));
  // drip tray
  g.add(rbox(0.105, 0.03, 0.15, 0.006, steel, tx, 0.027, 0.15));
  const grate = grey(canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#000'; for (let i = 0; i < 8; i++) c.fillRect(4, i * 8 + 2, w - 8, 3); }, [1, 2.4]));
  const gr = sh(new THREE.Mesh(new THREE.PlaneGeometry(0.092, 0.135), new THREE.MeshStandardMaterial({ color: 0xbfc1c4, metalness: 1, roughness: 0.3, bumpMap: grate, bumpScale: 0.004 })), false, true);
  gr.rotation.x = -Math.PI / 2; gr.position.set(tx, 0.0425, 0.15); g.add(gr);
  // steam wand
  g.add(tube([[tx - 0.058, 0.3, 0.06], [tx - 0.075, 0.26, 0.09], [tx - 0.078, 0.16, 0.115], [tx - 0.074, 0.09, 0.125]], 0.0048, M.steelPolished(), 20));
  g.add(cyl(0.0062, 0.005, 0.016, M.steelPolished(), tx - 0.0735, 0.084, 0.126, 12));
  // side lever + small dial
  const lv = cyl(0.008, 0.008, 0.03, pl, hx + hw / 2 + 0.014, 0.075, 0.04, 14); lv.rotation.z = Math.PI / 2; g.add(lv);
  g.add(rbox(0.012, 0.02, 0.05, 0.005, pl, hx + hw / 2 + 0.03, 0.07, 0.055));
  const dial = cyl(0.02, 0.02, 0.012, M.steelPolished(), tx, 0.3, 0.193, 28); dial.rotation.x = Math.PI / 2; g.add(dial);
  // cup rail on top
  const ty = 0.347;
  [[-1, 1]].forEach(() => {
    const rail = M.steelPolished(), y = ty + 0.022, x0 = -W / 2 + 0.012, x1 = W / 2 - 0.012, z0 = -D / 2 + 0.012, z1 = D / 2 - 0.012;
    [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].forEach(([x, z]) => g.add(cyl(0.003, 0.003, 0.024, rail, x, ty + 0.011, z, 8)));
    g.add(tube([[x0, y, z0], [x1, y, z0]], 0.003, rail, 2)); g.add(tube([[x0, y, z1], [x1, y, z1]], 0.003, rail, 2));
    g.add(tube([[x0, y, z0], [x0, y, z1]], 0.003, rail, 2)); g.add(tube([[x1, y, z0], [x1, y, z1]], 0.003, rail, 2));
  });
  if (towels) {
    const t = towelStack(3, 0.19, 0.13); t.position.set(0.065, ty, 0.03); t.rotation.y = 0.04; g.add(t);
    const p = pitcher(); p.position.set(-0.115, ty, 0.01); p.rotation.y = 2.4; g.add(p);
  }
  g.userData = { height: ty };
  return g;
}

/** Condiment caddy: lids, stirrers, wrapped straws. */
export function organizer() {
  const g = new THREE.Group(), pl = M.blackPlastic(), r = seeded(12);
  const W = 0.21, D = 0.13, T = 0.005;
  g.add(rbox(W, T, D, 0.002, pl, 0, T / 2, 0));
  g.add(rbox(W, 0.135, T, 0.002, pl, 0, 0.0675, -D / 2 + T / 2));                              // back
  [-W / 2 + T / 2, -0.035, 0.04, W / 2 - T / 2].forEach(x => {                                 // sides + dividers (stepped)
    g.add(rbox(T, 0.135, D * 0.45, 0.002, pl, x, 0.0675, -D * 0.275));
    g.add(rbox(T, 0.075, D * 0.55, 0.002, pl, x, 0.0375, D * 0.225));
  });
  g.add(rbox(W, 0.075, T, 0.002, pl, 0, 0.0375, D / 2 - T / 2));                               // front lip
  // lids on edge
  for (let i = 0; i < 7; i++) { const l = cyl(0.045, 0.045, 0.006, pl, -0.07, 0.05, -0.04 + i * 0.012, 28); l.rotation.x = Math.PI / 2 - 0.1; g.add(l); }
  // stirrers
  const dark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.45 });
  for (let i = 0; i < 12; i++) { const s = cyl(0.0022, 0.0022, 0.17, dark, 0.002 + (r() - 0.5) * 0.04, 0.09, -0.02 + (r() - 0.5) * 0.05, 6); s.rotation.set(-0.12 + (r() - 0.5) * 0.1, 0, (r() - 0.5) * 0.14); g.add(s); }
  // wrapped straws
  const paper = M.paperWhite();
  for (let i = 0; i < 22; i++) { const s = cyl(0.0034, 0.0034, 0.2, paper, 0.072 + (r() - 0.5) * 0.045, 0.104, -0.02 + (r() - 0.5) * 0.06, 6); s.rotation.set(-0.1 + (r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.12); g.add(s); }
  return g;
}

/** Glass jar of coffee beans with a wooden lid. */
export function beanJar({ labelTexture = null, h = 0.25, r = 0.085 } = {}) {
  const g = new THREE.Group();
  const jar = lathe([[0, 0], [r - 0.004, 0], [r, 0.006], [r, h - 0.045], [r - 0.012, h - 0.02], [r - 0.016, h]], clearShell(0.1), 48); jar.renderOrder = 3; jar.castShadow = false; g.add(jar);
  const beanTex = canvasTex(256, 256, (ctx, w, hh) => {
    ctx.fillStyle = '#2a170c'; ctx.fillRect(0, 0, w, hh);
    const rr = seeded(5);
    for (let i = 0; i < 620; i++) {
      const x = rr() * w, y = rr() * hh, a = rr() * 3.14, rx = 9 + rr() * 4, ry = 6 + rr() * 2.5, v = 0.7 + rr() * 0.6;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      const gr = ctx.createRadialGradient(-2, -2, 1, 0, 0, rx);
      gr.addColorStop(0, `rgb(${96 * v},${56 * v},${28 * v})`); gr.addColorStop(1, `rgb(${40 * v},${21 * v},${9 * v})`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(12,6,2,0.85)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-rx * 0.8, 0); ctx.quadraticCurveTo(0, ry * 0.5, rx * 0.8, 0); ctx.stroke();
      ctx.restore();
    }
  }, [2, 1]);
  const bm = new THREE.MeshStandardMaterial({ map: beanTex, roughness: 0.5 });
  const fill = h * 0.8;
  g.add(cyl(r - 0.005, r - 0.008, fill, bm, 0, fill / 2 + 0.006, 0, 48));
  const mound = sh(new THREE.Mesh(new THREE.SphereGeometry(r - 0.005, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), bm)); mound.scale.y = 0.22; mound.position.y = fill + 0.006; g.add(mound);
  g.add(cyl(r - 0.012, r - 0.012, 0.03, new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.6 }), 0, h + 0.012, 0, 40));
  if (labelTexture) {
    const l = sh(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.0012, r + 0.0012, 0.1, 40, 1, true, -0.62, 1.24), new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.65 })), false, false);
    l.position.y = h * 0.42; l.renderOrder = 4; g.add(l);
  }
  return g;
}

/** Counter display (menu screen) on an easel foot. `screen` texture is what customers read. */
export function menuDisplay({ w = 0.44, h = 0.275, screen, glow = 0.55 } = {}) {
  const g = new THREE.Group(), inner = new THREE.Group();
  const frame = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  inner.add(rbox(w + 0.022, h + 0.022, 0.011, 0.005, frame, 0, h / 2 + 0.02, 0));
  const sm = new THREE.MeshPhysicalMaterial({ map: screen, roughness: 0.4, clearcoat: 0.25, clearcoatRoughness: 0.25, emissive: 0xffffff, emissiveMap: screen, emissiveIntensity: glow });
  sm.userData.noHighlight = true;
  const scr = sh(new THREE.Mesh(new THREE.PlaneGeometry(w, h), sm), false, false); scr.position.set(0, h / 2 + 0.02, 0.0058); inner.add(scr);
  const foot = rbox(w * 0.42, h * 0.85, 0.006, 0.002, M.blackPlastic(), 0, h * 0.42, -0.07); foot.rotation.x = 0.5; inner.add(foot);
  inner.rotation.x = -0.2; g.add(inner);
  g.userData = { screenMesh: scr, screenMat: sm };
  return g;
}

/** Small card on a holder (loyalty / QR / price card). */
export function cardStand({ texture, w = 0.11, h = 0.075 } = {}) {
  const g = new THREE.Group();
  const paper = M.paperWhite();
  const card = sh(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.0015), [paper, paper, paper, paper, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55 }), paper]));
  card.position.set(0, h / 2 + 0.012, 0); card.rotation.x = -0.3; g.add(card);
  g.add(rbox(w + 0.012, 0.012, 0.04, 0.004, M.blackPlastic(), 0, 0.006, 0.004));
  return g;
}

/** Folding A-frame sign. `face` texture shows on the +z side. */
export function aFrame({ w = 0.52, h = 0.9, face } = {}) {
  const g = new THREE.Group(), wood = M.blackPaint(), front = new THREE.Group(), back = new THREE.Group();
  front.add(rbox(w, h, 0.02, 0.004, wood, 0, h / 2, 0));
  const fm = new THREE.MeshStandardMaterial({ map: face, roughness: 0.8 });
  const f = sh(new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), fm), false, true); f.position.set(0, h / 2, 0.0105); front.add(f);
  back.add(rbox(w, h, 0.02, 0.004, wood, 0, h / 2, 0));
  front.rotation.x = -0.17; front.position.z = 0.16; back.rotation.x = 0.17; back.position.z = -0.16;
  g.add(front, back);
  g.add(rbox(0.012, 0.012, 0.3, 0.003, M.steelPolished(), w / 2 - 0.03, h * 0.45, 0)); g.add(rbox(0.012, 0.012, 0.3, 0.003, M.steelPolished(), -w / 2 + 0.03, h * 0.45, 0));
  return g;
}

/** Hanging pendant lamp. */
export function pendant({ drop = 0.35, shade = 0x0c0c0d } = {}) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: shade, roughness: 0.4, side: THREE.DoubleSide });
  g.add(lathe([[0.02, 0.1], [0.03, 0.095], [0.075, 0.02], [0.085, 0], [0.082, 0], [0.072, 0.018], [0.027, 0.09]], m, 40));
  g.add(cyl(0.022, 0.022, 0.03, M.gold(), 0, 0.112, 0, 20));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffd9a0, emissiveIntensity: 5 }));
  bulb.position.y = 0.04; g.add(bulb);
  g.add(cyl(0.002, 0.002, drop, M.blackPlastic(), 0, 0.127 + drop / 2, 0, 6));
  return g;
}

/** Small potted plant. */
export function plant({ seed = 4 } = {}) {
  const g = new THREE.Group(), r = seeded(seed);
  g.add(lathe([[0, 0], [0.045, 0], [0.06, 0.09], [0.056, 0.09], [0.043, 0.006], [0, 0.006]], new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.5, side: THREE.DoubleSide }), 32));
  g.add(cyl(0.054, 0.05, 0.01, new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 }), 0, 0.08, 0, 24));
  const lm = new THREE.MeshStandardMaterial({ color: 0x5f8a56, roughness: 0.6, side: THREE.DoubleSide });
  const leaf = new THREE.CircleGeometry(0.016, 10); leaf.scale(1, 1.25, 1);
  for (let s = 0; s < 9; s++) {
    const a = r() * 6.28, lean = 0.15 + r() * 0.5, len = 0.1 + r() * 0.09;
    const dir = new THREE.Vector3(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean));
    g.add(tube([[0, 0.08, 0], dir.clone().multiplyScalar(len * 0.5).add(new THREE.Vector3(0, 0.08, 0)).toArray(), dir.clone().multiplyScalar(len).add(new THREE.Vector3(0, 0.085, 0)).toArray()], 0.0014, lm, 6));
    for (let k = 1; k <= 6; k++) {
      [-1, 1].forEach(sd => {
        const l = sh(new THREE.Mesh(leaf, lm), true, false);
        l.position.copy(dir).multiplyScalar(len * k / 6).add(new THREE.Vector3(0, 0.082, 0));
        l.position.x += Math.cos(a + sd * 1.57) * 0.014; l.position.z += Math.sin(a + sd * 1.57) * 0.014;
        l.rotation.set(-1.1 + r() * 0.5, a + sd * 0.9, r() * 0.6); g.add(l);
      });
    }
  }
  return g;
}
