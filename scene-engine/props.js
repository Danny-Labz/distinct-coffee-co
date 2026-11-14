// scene-engine/props.js
// ─────────────────────────────────────────────────────────────────────────────
// Reusable low-poly prop builders for the scene engine. Every builder returns a
// THREE.Group (units = metres, origin on the floor/base of the object) so a new
// business scene can mix and match: tents, counters, bottles, trees, people…
// Nothing in here knows about Distinct Coffee Co. — scene files do that.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from './vendor/three.module.min.js';

// ── helpers ──────────────────────────────────────────────────────────────────
export function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: o.rough ?? 0.75, metalness: o.metal ?? 0,
    map: o.map || null, transparent: !!o.opacity, opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide, flatShading: !!o.flat,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1,
  });
}

function shade(m, cast = true, receive = true) { m.castShadow = cast; m.receiveShadow = receive; return m; }

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material));
  m.position.set(x, y, z);
  return m;
}
export function cyl(rTop, rBottom, h, material, x = 0, y = 0, z = 0, seg = 28) {
  const m = shade(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), material));
  m.position.set(x, y, z);
  return m;
}
export function sphere(r, material, x = 0, y = 0, z = 0, seg = 20) {
  const m = shade(new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), material));
  m.position.set(x, y, z);
  return m;
}
/** Revolve a [radius, y] profile around the Y axis — bottles, jars, bowls. */
export function lathe(points, material, seg = 32) {
  const m = shade(new THREE.Mesh(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), seg), material));
  m.material.side = THREE.DoubleSide;
  return m;
}
/** A thin cylinder from point a to point b (frame bars, wires). */
export function rod(a, b, r, material) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const m = shade(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), material), true, false);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}

/** Draw into a canvas and get a texture back. draw(ctx, w, h) */
export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.userData.canvas = c;
  return t;
}
/** Redraw an existing canvas texture (used when live data arrives). */
export function redrawTex(tex, draw) {
  const c = tex.userData.canvas;
  draw(c.getContext('2d'), c.width, c.height);
  tex.needsUpdate = true;
}

const rand = (a, b) => a + Math.random() * (b - a);
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ── world ────────────────────────────────────────────────────────────────────
export function createSky(top = 0x9db8d4, horizon = 0xe6e9ec, radius = 90) {
  const g = new THREE.SphereGeometry(radius, 24, 16);
  const cols = [], pos = g.attributes.position;
  const ct = new THREE.Color(top), ch = new THREE.Color(horizon), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.pow(Math.max(0, pos.getY(i) / radius), 0.65);
    c.copy(ch).lerp(ct, t);
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -1;
  return m;
}

export function ground(size = 80, color = 0x74935a) {
  const tex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#' + new THREE.Color(color).getHexString(); ctx.fillRect(0, 0, w, h);
    const r = seeded(7);
    for (let i = 0; i < 5000; i++) {
      const l = r() > 0.5;
      ctx.fillStyle = l ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 2 + r() * 4);
    }
  }, [size / 4, size / 4]);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

export function tree({ height = 5, crown = 2.2, color = 0x4d7a3f, trunk = 0x5b4430, seed = 1 } = {}) {
  const g = new THREE.Group(), r = seeded(seed);
  g.add(cyl(0.16, 0.26, height * 0.55, mat(trunk, { rough: 1 }), 0, height * 0.275, 0, 8));
  const base = new THREE.Color(color);
  for (let i = 0; i < 5; i++) {
    const c = base.clone().offsetHSL(0, 0, (r() - 0.5) * 0.08);
    const s = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(crown * (0.6 + r() * 0.4), 1), mat(c, { rough: 1, flat: true })));
    s.position.set((r() - 0.5) * crown * 1.1, height * 0.62 + r() * crown * 0.7, (r() - 0.5) * crown * 1.1);
    g.add(s);
  }
  return g;
}

export function palm({ height = 6.5, seed = 3 } = {}) {
  const g = new THREE.Group(), r = seeded(seed);
  const trunk = mat(0x8a7357, { rough: 1 });
  let x = 0;
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const h = height / segs;
    x += 0.05 * (i / segs);
    g.add(cyl(0.13 - i * 0.008, 0.15 - i * 0.008, h + 0.02, trunk, x, h * i + h / 2, 0, 8));
  }
  const frond = mat(0x4b8a45, { rough: 0.9, side: THREE.DoubleSide, flat: true });
  for (let i = 0; i < 9; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(x, height + 0.05, 0);
    pivot.rotation.y = (i / 9) * Math.PI * 2 + r() * 0.3;
    const geo = new THREE.ConeGeometry(0.3, 2.4, 4); geo.translate(0, 1.2, 0);
    const f = shade(new THREE.Mesh(geo, frond), true, false);
    f.scale.set(1, 1, 0.12);
    f.rotation.z = -(1.0 + r() * 0.45);          // tip points outward, drooping
    pivot.add(f); g.add(pivot);
  }
  return g;
}

export function stringLights(points, { color = 0xffe2a8, sag = 0.25, bulbs = 14, size = 0.045 } = {}) {
  const g = new THREE.Group();
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: color, emissiveIntensity: 2.2 });
  for (let s = 0; s < points.length - 1; s++) {
    const A = new THREE.Vector3(...points[s]), B = new THREE.Vector3(...points[s + 1]);
    const pts = [];
    for (let i = 0; i <= bulbs; i++) {
      const t = i / bulbs, p = A.clone().lerp(B, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      pts.push(p);
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x222222 })));
    pts.forEach((p, i) => { if (i % 1 === 0 && i > 0 && i < bulbs) { const b = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), bulbMat); b.position.copy(p); g.add(b); } });
  }
  return g;
}

export function pavilion({ w = 9, d = 6, h = 3.2, roof = 0x6a5846 } = {}) {
  const g = new THREE.Group();
  const stone = mat(0xcfc8bc, { rough: 0.9 });
  g.add(box(w, 0.25, d, stone, 0, 0.125, 0));
  const cols = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]];
  cols.forEach(([cx, cz]) => g.add(cyl(0.16, 0.18, h, mat(0xe9e5dc, { rough: 0.8 }), cx * (w / 2 - 0.4), 0.25 + h / 2, cz * (d / 2 - 0.4), 12)));
  const r = shade(new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 1.8, 4), mat(roof, { rough: 0.9, flat: true })));
  r.rotation.y = Math.PI / 4; r.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
  r.position.y = 0.25 + h + 0.9;
  g.add(r);
  return g;
}

export function popupTent({ w = 3, d = 3, eave = 2.15, peak = 2.85, canopy = 0xf4f5f7, frame = 0xa5a9ae, overhang = 0.12 } = {}) {
  const g = new THREE.Group();
  const frameM = mat(frame, { metal: 0.7, rough: 0.35 });
  const hw = w / 2, hd = d / 2;
  // legs
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => g.add(cyl(0.022, 0.026, eave, frameM, sx * hw, eave / 2, sz * hd, 10)));
  // canopy: square pyramid + valance
  const cw = w + overhang * 2, cd = d + overhang * 2;
  const roofG = new THREE.ConeGeometry(0.5, peak - eave, 4, 1, true);
  roofG.rotateY(Math.PI / 4);
  const roofM = new THREE.MeshStandardMaterial({ color: canopy, roughness: 0.92, side: THREE.DoubleSide });
  const roof = shade(new THREE.Mesh(roofG, roofM), true, true);
  roof.scale.set(cw * Math.SQRT2, 1, cd * Math.SQRT2);
  roof.position.y = eave + (peak - eave) / 2;
  g.add(roof);
  const val = 0.22;
  [[0, -hd - overhang, cw, 0], [0, hd + overhang, cw, 0], [-hw - overhang, 0, cd, Math.PI / 2], [hw + overhang, 0, cd, Math.PI / 2]].forEach(([x, z, len, ry]) => {
    const v = shade(new THREE.Mesh(new THREE.PlaneGeometry(len, val), roofM), true, false);
    v.position.set(x, eave - val / 2, z); v.rotation.y = ry; g.add(v);
  });
  // under-canopy truss
  const top = eave + 0.02, mid = peak - 0.1;
  const corners = [[-hw, top, -hd], [hw, top, -hd], [hw, top, hd], [-hw, top, hd]];
  corners.forEach((c, i) => { g.add(rod(c, corners[(i + 1) % 4], 0.012, frameM)); g.add(rod(c, [0, mid, 0], 0.012, frameM)); });
  [[-hw / 2, -hd / 2], [hw / 2, -hd / 2], [hw / 2, hd / 2], [-hw / 2, hd / 2]].forEach(([x, z]) => g.add(cyl(0.012, 0.012, 0.12, frameM, x, top + 0.02, z, 6)));
  return g;
}

// ── people ───────────────────────────────────────────────────────────────────
export function person({ shirt = 0x222222, pants = 0x2b2f3a, skin = 0xc99674, hair = 0x1b1410, beard = false, height = 1.74, arms = 'down' } = {}) {
  const g = new THREE.Group();
  const s = height / 1.74;
  const skinM = mat(skin, { rough: 0.8 }), shirtM = mat(shirt, { rough: 0.9 }), pantsM = mat(pants, { rough: 0.9 });
  const legs = new THREE.Group();
  [-0.09, 0.09].forEach(x => legs.add(cyl(0.075, 0.065, 0.82, pantsM, x, 0.41, 0, 10)));
  g.add(legs);
  const torso = shade(new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 6, 14), shirtM));
  torso.scale.set(1.15, 1, 0.7); torso.position.y = 1.2; g.add(torso);
  [-1, 1].forEach(side => {
    const a = shade(new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.46, 4, 8), shirtM));
    a.position.set(side * 0.24, 1.22, 0); a.rotation.z = side * 0.07;
    if (arms === 'counter') { a.position.set(side * 0.23, 1.14, 0.12); a.rotation.set(-0.95, 0, side * 0.1); }
    g.add(a);
    g.add(sphere(0.046, skinM, a.position.x + (arms === 'counter' ? 0 : side * 0.02), arms === 'counter' ? 1.0 : 0.88, arms === 'counter' ? 0.33 : 0, 10));
  });
  g.add(cyl(0.055, 0.06, 0.1, skinM, 0, 1.5, 0, 10));
  g.add(sphere(0.125, skinM, 0, 1.64, 0, 20));
  const hairM = mat(hair, { rough: 1 });
  const cap = shade(new THREE.Mesh(new THREE.SphereGeometry(0.133, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), hairM));
  cap.position.set(0, 1.652, -0.014); cap.rotation.x = -0.32; g.add(cap);
  if (beard) {
    const b = shade(new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 10, 0, Math.PI * 2, Math.PI * 0.63, Math.PI * 0.37), hairM));
    b.position.set(0, 1.642, 0.016); g.add(b);
    g.add(box(0.05, 0.009, 0.01, mat(0xf2ece4, { rough: 0.6 }), 0, 1.622, 0.128));          // smile
  }
  const eye = mat(0x14100d);
  [-0.045, 0.045].forEach(x => g.add(sphere(0.012, eye, x, 1.668, 0.117, 6)));
  g.scale.setScalar(s);
  g.userData.legs = legs;
  return g;
}

// ── counter-top props ────────────────────────────────────────────────────────
export function marbleTexture() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f4f3f1'; ctx.fillRect(0, 0, w, h);
    const r = seeded(11);
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(${90 + r() * 40},${95 + r() * 40},${105 + r() * 40},${0.05 + r() * 0.12})`;
      ctx.lineWidth = 0.6 + r() * 2.2;
      ctx.beginPath();
      let x = r() * w, y = r() * h; ctx.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (r() - 0.35) * 110; y += (r() - 0.5) * 90; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }, [2, 1]);
}

/** Black cart/counter with white trim and a logo plate on the customer-facing (+z) side. */
export function cart({ width = 2.0, depth = 0.75, height = 0.92, signTexture = null, signW = 1.05, signH = 0.66 } = {}) {
  const g = new THREE.Group();
  const black = mat(0x0d0d0e, { rough: 0.55 }), white = mat(0xf6f5f2, { rough: 0.5 });
  g.add(box(width, height, depth, black, 0, height / 2 + 0.04, 0));
  g.add(box(width + 0.12, 0.08, depth + 0.1, mat(0x050505, { rough: 0.6 }), 0, 0.04, 0));         // plinth
  const fz = depth / 2 + 0.006, t = 0.045;
  g.add(box(width, t, 0.012, white, 0, 0.1 + t / 2 + 0.02, fz));                                    // front frame
  g.add(box(width, t, 0.012, white, 0, height - 0.02 - t / 2, fz));
  g.add(box(t, height - 0.1, 0.012, white, -width / 2 + t / 2, height / 2 + 0.04, fz));
  g.add(box(t, height - 0.1, 0.012, white, width / 2 - t / 2, height / 2 + 0.04, fz));
  // top slab (marble)
  const top = box(width + 0.12, 0.05, depth + 0.12, mat(0xffffff, { map: marbleTexture(), rough: 0.25 }), 0, height + 0.065, 0);
  g.add(top);
  const topY = height + 0.09;
  // logo plate
  const plateMat = signTexture ? new THREE.MeshStandardMaterial({ map: signTexture, roughness: 0.35, metalness: 0.1 }) : mat(0x111111);
  const plate = shade(new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.02), plateMat), true, false);
  plate.position.set(0, height * 0.48 + 0.04, fz + 0.016);
  g.add(plate);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const bolt = cyl(0.012, 0.012, 0.014, mat(0xcfd2d6, { metal: 0.9, rough: 0.25 }), sx * (signW / 2 - 0.03), plate.position.y + sy * (signH / 2 - 0.03), fz + 0.034, 12);
    bolt.rotation.x = Math.PI / 2; g.add(bolt);
  });
  g.userData = { topY, plate, width, depth, height };
  return g;
}

export function barMat(w = 0.7, d = 0.22) {
  const g = new THREE.Group();
  g.add(box(w, 0.008, d, mat(0x0a0a0a, { rough: 0.95 }), 0, 0.004, 0));
  for (let i = 0; i < 9; i++) g.add(box(w - 0.04, 0.003, 0.008, mat(0x1b1b1b, { rough: 0.9 }), 0, 0.0095, -d / 2 + 0.02 + i * ((d - 0.04) / 8)));
  return g;
}

export function can(color = 0x2f9a47, band = 0xffffff) {
  const g = new THREE.Group();
  g.add(cyl(0.033, 0.033, 0.122, mat(color, { metal: 0.6, rough: 0.3 }), 0, 0.061, 0, 24));
  g.add(cyl(0.0335, 0.0335, 0.04, mat(band, { metal: 0.3, rough: 0.4 }), 0, 0.06, 0, 24));
  g.add(cyl(0.029, 0.033, 0.006, mat(0xc9ccd0, { metal: 0.95, rough: 0.2 }), 0, 0.125, 0, 24));
  return g;
}

export function waterBottle() {
  const g = new THREE.Group();
  const body = mat(0xcfe8f4, { opacity: 0.55, rough: 0.1 });
  g.add(lathe([[0, 0], [0.032, 0], [0.034, 0.02], [0.034, 0.17], [0.03, 0.2], [0.014, 0.225], [0.014, 0.24]], body, 24));
  g.add(cyl(0.017, 0.017, 0.022, mat(0x3a8fd0, { rough: 0.5 }), 0, 0.251, 0, 16));
  g.add(cyl(0.0345, 0.0345, 0.07, mat(0x3a8fd0, { rough: 0.7 }), 0, 0.09, 0, 24));
  return g;
}

export function beanJar({ labelTexture = null, h = 0.27, r = 0.095 } = {}) {
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: 0xeaf2f4, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, side: THREE.DoubleSide });
  g.add(lathe([[0, 0], [r, 0], [r + 0.004, 0.01], [r + 0.004, h - 0.05], [r - 0.02, h - 0.025], [r - 0.03, h]], glass, 32));
  // beans
  const beanTex = canvasTex(128, 128, (ctx, w, hh) => {
    ctx.fillStyle = '#3b2415'; ctx.fillRect(0, 0, w, hh);
    const rr = seeded(5);
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = `rgba(${40 + rr() * 60},${20 + rr() * 30},${8 + rr() * 16},0.9)`;
      ctx.beginPath(); ctx.ellipse(rr() * w, rr() * hh, 5 + rr() * 4, 3 + rr() * 2, rr() * 3, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
    }
  }, [4, 2]);
  g.add(cyl(r - 0.004, r - 0.004, h * 0.88, mat(0xffffff, { map: beanTex, rough: 0.55 }), 0, h * 0.44 + 0.01, 0, 32));
  const mound = shade(new THREE.Mesh(new THREE.SphereGeometry(r - 0.004, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffffff, { map: beanTex, rough: 0.55 })));
  mound.scale.y = 0.25; mound.position.y = h * 0.88 + 0.01; g.add(mound);
  g.add(cyl(r - 0.012, r - 0.012, 0.035, mat(0xf3f3f1, { rough: 0.4 }), 0, h + 0.015, 0, 32));         // lid
  if (labelTexture) {
    const lab = shade(new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.085), new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.6 })), false, false);
    lab.position.set(0, h * 0.42, r + 0.0065); g.add(lab);
  }
  return g;
}

export function stockPot({ r = 0.17, h = 0.2 } = {}) {
  const g = new THREE.Group(), body = mat(0x0f0f10, { rough: 0.4, metal: 0.4 });
  g.add(cyl(r, r, h, body, 0, h / 2, 0, 36));
  g.add(cyl(r + 0.006, r + 0.006, 0.02, mat(0xc3c6ca, { metal: 0.9, rough: 0.28 }), 0, h + 0.01, 0, 36));
  g.add(cyl(0.02, 0.02, 0.025, mat(0xc3c6ca, { metal: 0.9, rough: 0.28 }), 0, h + 0.03, 0, 12));
  [-1, 1].forEach(s => g.add(box(0.05, 0.015, 0.02, body, s * (r + 0.02), h - 0.04, 0)));
  return g;
}

export function kettle() {
  const g = new THREE.Group(), b = mat(0x131314, { rough: 0.4, metal: 0.5 });
  g.add(lathe([[0, 0], [0.085, 0], [0.095, 0.02], [0.09, 0.12], [0.06, 0.16], [0.03, 0.17], [0, 0.17]], b, 28));
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.08, 0.04, 0), new THREE.Vector3(0.14, 0.12, 0), new THREE.Vector3(0.2, 0.22, 0), new THREE.Vector3(0.24, 0.24, 0)]);
  g.add(shade(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.011, 8), b)));
  const handle = shade(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 8, 18, Math.PI), b));
  handle.position.set(-0.07, 0.1, 0); handle.rotation.z = Math.PI / 2 + 0.15; g.add(handle);
  return g;
}

export function syrupBottle({ glass = 0x1a0f0b, label = 0xe8e2d4 } = {}) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.04, 0], [0.043, 0.02], [0.043, 0.17], [0.034, 0.21], [0.014, 0.245], [0.014, 0.27], [0, 0.27]], mat(glass, { rough: 0.12, metal: 0.1 }), 24));
  g.add(cyl(0.0425, 0.0425, 0.07, mat(label, { rough: 0.7 }), 0, 0.1, 0, 24));
  g.add(cyl(0.016, 0.02, 0.035, mat(0x1d1d1d, { rough: 0.5 }), 0, 0.285, 0, 16));
  return g;
}

export function espressoMachine() {
  const g = new THREE.Group();
  const steel = mat(0xb6b9bd, { metal: 0.85, rough: 0.28 }), dark = mat(0x161617, { rough: 0.35, metal: 0.2 }), glassy = mat(0x050506, { rough: 0.08, metal: 0.3 });
  g.add(box(0.36, 0.03, 0.34, steel, 0, 0.015, 0));                          // drip tray
  g.add(box(0.36, 0.32, 0.30, dark, 0, 0.19, -0.02));                         // body
  g.add(box(0.30, 0.035, 0.012, glassy, 0, 0.27, 0.14));                      // front display strip
  g.add(box(0.36, 0.1, 0.30, steel, 0, 0.09, -0.02));
  g.add(box(0.28, 0.05, 0.05, mat(0x2a2a2c, { rough: 0.4, metal: 0.6 }), 0, 0.2, 0.155)); // group head
  g.add(cyl(0.012, 0.012, 0.09, mat(0x111111), 0.0, 0.16, 0.2, 10).rotateX(Math.PI / 2));// portafilter handle
  g.add(cyl(0.028, 0.026, 0.06, dark, 0, 0.35, -0.05, 24));                   // top shoulder (hopper base)
  g.add(box(0.36, 0.045, 0.30, dark, 0, 0.365, -0.02));
  g.add(cyl(0.035, 0.035, 0.012, steel, 0.11, 0.2, 0.17, 18).rotateX(Math.PI / 2));// dial
  g.add(cyl(0.035, 0.035, 0.012, steel, -0.11, 0.2, 0.17, 18).rotateX(Math.PI / 2));
  g.add(cyl(0.006, 0.006, 0.16, steel, 0.19, 0.2, 0.08, 8));                  // steam wand
  return g;
}

export function bowlAndTowel() {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [0.07, 0], [0.11, 0.04], [0.125, 0.085], [0.118, 0.085], [0.104, 0.045], [0, 0.012]], mat(0xe9742a, { rough: 0.35 }), 28));
  g.add(box(0.3, 0.012, 0.22, mat(0x7a7d82, { rough: 1 }), 0, -0.006, 0));
  return g;
}

export function speaker() {
  const g = new THREE.Group(), body = mat(0x1d1f22, { rough: 0.8 });
  g.add(lathe([[0, 0], [0.058, 0], [0.065, 0.02], [0.065, 0.11], [0.05, 0.128], [0, 0.128]], body, 28));
  const plus = mat(0xe6e6e6, { rough: 0.6 });
  g.add(box(0.006, 0.042, 0.004, plus, 0, 0.062, 0.067));
  g.add(box(0.03, 0.006, 0.004, plus, 0, 0.062, 0.067));
  g.add(box(0.03, 0.006, 0.004, plus, 0, 0.032, 0.067));
  return g;
}

/** Small display on a stand. The `screen` texture is what customers read. */
export function tabletDisplay({ w = 0.44, h = 0.275, screen } = {}) {
  const g = new THREE.Group(), bezel = mat(0x191a1c, { rough: 0.5 });
  const slab = box(w + 0.02, h + 0.02, 0.012, bezel, 0, h / 2 + 0.03, 0);
  const sm = new THREE.MeshStandardMaterial({ map: screen, roughness: 0.4, emissive: 0xffffff, emissiveMap: screen, emissiveIntensity: 0.35 });
  sm.userData.noHighlight = true;
  const scr = shade(new THREE.Mesh(new THREE.PlaneGeometry(w, h), sm), false, false);
  scr.position.set(0, h / 2 + 0.03, 0.0065);
  const stand = box(w * 0.5, h * 0.8, 0.01, bezel, 0, h * 0.4 + 0.03, -0.05);
  stand.rotation.x = 0.55; stand.position.z = -0.08;
  const inner = new THREE.Group();
  inner.add(slab, scr, stand);
  inner.rotation.x = -0.2;                               // lean back
  g.add(inner);
  g.userData = { screenMesh: scr, screenMat: sm };
  return g;
}

/** Chalk A-frame sign. `face` texture shows on the +z side. */
export function aFrame({ w = 0.5, h = 0.85, face } = {}) {
  const g = new THREE.Group(), wood = mat(0x171717, { rough: 0.9 }), trim = mat(0xf6f5f2, { rough: 0.7 });
  const frontBoard = new THREE.Group(), backBoard = new THREE.Group();
  const front = box(w, h, 0.025, wood, 0, h / 2, 0); frontBoard.add(front);
  const faceMat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.85 });
  const f = shade(new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, h - 0.04), faceMat), false, false); f.position.set(0, h / 2, 0.014); frontBoard.add(f);
  [[0, h - 0.005, w, 0.03], [0, 0.005, w, 0.03]].forEach(([x, y, ww, hh]) => frontBoard.add(box(ww, hh, 0.03, trim, x, y, 0)));
  backBoard.add(box(w, h, 0.025, wood, 0, h / 2, 0));
  frontBoard.rotation.x = -0.17; frontBoard.position.z = 0.17;
  backBoard.rotation.x = 0.17; backBoard.position.z = -0.17;
  frontBoard.position.y = 0.0; backBoard.position.y = 0.0;
  g.add(frontBoard, backBoard);
  return g;
}

export function lantern() {
  const g = new THREE.Group();
  const body = mat(0x1a1a1b, { rough: 0.5 });
  g.add(cyl(0.065, 0.075, 0.1, body, 0, 0, 0, 24));
  g.add(cyl(0.077, 0.077, 0.02, mat(0xe9742a, { rough: 0.5 }), 0, -0.04, 0, 24));
  g.add(cyl(0.05, 0.05, 0.02, new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffe2a8, emissiveIntensity: 1.6 }), 0, -0.058, 0, 20));
  g.add(cyl(0.008, 0.008, 0.07, body, 0, 0.085, 0, 8));
  return g;
}

export function loyaltyCard({ texture } = {}) {
  const g = new THREE.Group();
  const card = shade(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.004), [mat(0xf6f5f2), mat(0xf6f5f2), mat(0xf6f5f2), mat(0xf6f5f2), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 }), mat(0xf6f5f2)]));
  card.position.set(0, 0.045, 0); card.rotation.x = -0.35;
  g.add(card);
  g.add(box(0.12, 0.012, 0.045, mat(0x111111, { rough: 0.6 }), 0, 0.006, 0.0));
  return g;
}

export function walkers(count, { bounds = { x: [-12, 12], z: [-14, -4] }, seed = 9 } = {}) {
  const r = seeded(seed), shirts = [0xd8d2c4, 0x4a6fa5, 0xc4574a, 0x3d3d3d, 0x7da36a, 0xe3b04b, 0x8a5fa8, 0xf0efe9];
  const pants = [0x2b2f3a, 0x3a3328, 0x1f2430, 0x59606b];
  const skins = [0xe0b48f, 0xc99674, 0x9c6a48, 0x6e4631, 0xf0c9a6];
  const list = [];
  for (let i = 0; i < count; i++) {
    const p = person({ shirt: shirts[Math.floor(r() * shirts.length)], pants: pants[Math.floor(r() * pants.length)], skin: skins[Math.floor(r() * skins.length)], hair: [0x1b1410, 0x3b2a1f, 0x8a6a3b, 0x151515][Math.floor(r() * 4)], height: 1.45 + r() * 0.4 });
    const z = bounds.z[0] + r() * (bounds.z[1] - bounds.z[0]);
    const x0 = bounds.x[0] + r() * (bounds.x[1] - bounds.x[0]);
    p.position.set(x0, 0, z);
    p.userData.walk = { dir: r() > 0.5 ? 1 : -1, speed: 0.25 + r() * 0.45, phase: r() * 6.28, min: bounds.x[0], max: bounds.x[1] };
    p.rotation.y = p.userData.walk.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    list.push(p);
  }
  return list;
}
export function stepWalker(p, dt, t) {
  const w = p.userData.walk;
  p.position.x += w.dir * w.speed * dt;
  if (p.position.x > w.max || p.position.x < w.min) { w.dir *= -1; p.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  p.position.y = Math.abs(Math.sin(t * w.speed * 7 + w.phase)) * 0.03;
}
