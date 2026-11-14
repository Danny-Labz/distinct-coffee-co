// scene-engine/scenes/distinct-coffee.js
// ─────────────────────────────────────────────────────────────────────────────
// The Distinct. Coffee Co. cart, as a customer sees it walking up at an event.
// Layout mirrors the real setup (white pop-up tent, black cart with marble top and
// acrylic logo sign, cups, cold brew pot, syrups, espresso machine, caddy, A-frame
// order sign), rendered with HDR lighting and physically based materials. Menu / add-ons / events come live from Supabase.
//
// This file is the *only* business-specific part — copy it to start a new scene.
// ─────────────────────────────────────────────────────────────────────────────
import { esc } from '../engine.js';

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_KEY = 'sb_publishable_edpOH0H5-T6E1A5NOjOcnw_ikl5TzTv';   // public read-only key (same as the main site)
const money = c => `$${(c / 100).toFixed(2)}`;

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) throw new Error(path);
  return r.json();
}
const safe = p => p.catch(() => []);
const loadImage = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

// white-on-transparent copy of the (black) logo, for dark surfaces
function whiteLogo(img) {
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  return c;
}

// ── textures ────────────────────────────────────────────────────────────────
function drawSign(ctx, w, h, logo) {
  ctx.fillStyle = '#0b0b0c'; ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (logo) { const k = Math.min((w * 0.86) / logo.width, (h * 0.8) / logo.height); ctx.drawImage(logo, (w - logo.width * k) / 2, (h - logo.height * k) / 2, logo.width * k, logo.height * k); }
}

function drawMenuScreen(ctx, w, h, logo, menu) {
  ctx.fillStyle = '#242528'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#b79b6b'; ctx.lineWidth = 3; ctx.strokeRect(14, 14, w - 28, h - 28);
  if (logo) { const k = 96 / logo.height; ctx.drawImage(logo, w / 2 - (logo.width * k) / 2, 28, logo.width * k, 96); }
  ctx.fillStyle = '#d9c9a8'; ctx.font = '600 15px Montserrat, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('DIFFERENT STORIES. ONE COMMUNITY.', w / 2, 146);

  const cats = {};
  (menu || []).forEach(m => { (cats[m.category] = cats[m.category] || []).push(m); });
  let entries = Object.entries(cats);
  if (!entries.length) entries = [['Hot Drinks', [{ name: 'Latte', price_cents: 0 }, { name: 'Cappuccino', price_cents: 0 }, { name: 'Americano', price_cents: 0 }]], ['Iced Drinks', [{ name: 'Iced Latte', price_cents: 0 }, { name: 'Iced Americano', price_cents: 0 }, { name: 'Iced Matcha Latte', price_cents: 0 }]]];
  entries = entries.slice(0, 3);
  const cols = entries.length, colW = (w - 90) / cols, top = 188;
  entries.forEach(([cat, items], i) => {
    const x = 45 + i * colW;
    ctx.textAlign = 'left'; ctx.fillStyle = '#b79b6b'; ctx.font = '700 17px Montserrat, sans-serif';
    ctx.fillText(String(cat).toUpperCase(), x, top);
    ctx.fillRect(x, top + 10, colW - 30, 2);
    const rows = Math.min(items.length, 8), rh = Math.min(46, (h - top - 70) / Math.max(rows, 1));
    items.slice(0, rows).forEach((it, r) => {
      const y = top + 48 + r * rh;
      ctx.textAlign = 'left'; ctx.fillStyle = '#f4f1ea'; ctx.font = `500 ${Math.min(22, rh * 0.5)}px Montserrat, sans-serif`;
      let name = it.name; while (ctx.measureText(name).width > colW - 120 && name.length > 4) name = name.slice(0, -2) + '…';
      ctx.fillText(name, x, y);
      if (it.price_cents) { ctx.textAlign = 'right'; ctx.fillStyle = '#d9c9a8'; ctx.fillText(money(it.price_cents), x + colW - 30, y); }
    });
  });
  ctx.textAlign = 'center'; ctx.fillStyle = '#8f8f94'; ctx.font = '500 13px Montserrat, sans-serif';
  ctx.fillText('@distinct.coffeeco   ·   SPECIALTY COFFEE WITH PURPOSE', w / 2, h - 30);
}

function drawBeanLabel(ctx, w, h) {
  ctx.fillStyle = '#e8613a'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = '800 40px Montserrat, sans-serif'; ctx.fillText('HARMONY', w / 2, 90); ctx.fillText('BLEND', w / 2, 136);
  ctx.fillRect(w * 0.18, 160, w * 0.64, 3);
  ctx.font = '600 16px Montserrat, sans-serif';
  ctx.fillText('MILK CHOCOLATE', w / 2, 200); ctx.fillText('STONE FRUIT · HAZELNUT', w / 2, 224);
  ctx.font = '500 14px Montserrat, sans-serif'; ctx.fillText('COLOMBIA · BRAZIL', w / 2, 266); ctx.fillText('NICARAGUA', w / 2, 286);
  ctx.font = '700 14px Montserrat, sans-serif'; ctx.fillText('MEDIUM DARK', w / 2, 316);
}

function drawChalk(ctx, w, h, logo) {
  ctx.fillStyle = '#141414'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 3; ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.textAlign = 'center'; ctx.fillStyle = '#f6f5f2';
  ctx.font = '800 54px Montserrat, sans-serif'; ctx.fillText('PRE-ORDER', w / 2, 150);
  ctx.font = '300 40px Montserrat, sans-serif'; ctx.fillText('skip the line', w / 2, 210);
  ctx.fillRect(w * 0.3, 250, w * 0.4, 3);
  ctx.font = '600 22px Montserrat, sans-serif'; ctx.fillText('SCAN THE QR', w / 2, 320); ctx.fillText('ORDER FROM YOUR PHONE', w / 2, 354);
  ctx.fillStyle = '#fff'; ctx.fillRect(w / 2 - 60, 400, 120, 120);
  ctx.fillStyle = '#141414';
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if ((x * 7 + y * 13 + x * y) % 3 === 0 || (x < 3 && y < 3) || (x > 5 && y < 3) || (x < 3 && y > 5)) ctx.fillRect(w / 2 - 54 + x * 12, 406 + y * 12, 10, 10);
}

function drawLoyalty(ctx, w, h) {
  ctx.fillStyle = '#f6f5f2'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0a0a0a'; ctx.font = '700 22px Montserrat, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('LOYALTY CARD', w / 2, 40);
  for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(w * 0.14 + (i % 5) * w * 0.18, 92 + Math.floor(i / 5) * 62, 22, 0, 7); ctx.lineWidth = 3; ctx.strokeStyle = '#0a0a0a'; ctx.stroke(); if (i < 4) { ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(w * 0.14 + (i % 5) * w * 0.18, 92, 12, 0, 7); ctx.fill(); } }
}

function drawSyrupLabel(ctx, w, h, logo, name, accent) {
  ctx.fillStyle = '#f3ecdd'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = accent; ctx.lineWidth = 5; ctx.strokeRect(16, 16, w - 32, h - 32);
  ctx.lineWidth = 1.5; ctx.strokeRect(26, 26, w - 52, h - 52);
  if (logo) { const k = 64 / logo.height; ctx.drawImage(logo, w / 2 - (logo.width * k) / 2, 44, logo.width * k, 64); }
  ctx.fillStyle = accent; ctx.fillRect(w / 2 - 70, 124, 140, 2);
  ctx.fillStyle = '#1a1612'; ctx.textAlign = 'center';
  ctx.font = '700 36px Montserrat, sans-serif'; ctx.fillText(name.toUpperCase(), w / 2, 176);
  ctx.font = '500 15px Montserrat, sans-serif'; ctx.fillStyle = '#6b6156'; ctx.fillText('HOUSE SYRUP', w / 2, 206);
}

function drawCupLogo(ctx, w, h, logo) {
  ctx.clearRect(0, 0, w, h);
  if (logo) { const k = Math.min((w * 0.9) / logo.width, (h * 0.9) / logo.height); ctx.drawImage(logo, (w - logo.width * k) / 2, (h - logo.height * k) / 2, logo.width * k, logo.height * k); }
}

// ── scene definition ────────────────────────────────────────────────────────
export default {
  id: 'distinct-coffee',
  title: 'Distinct. Coffee Co.',

  ui: {
    logo: 'scene-engine/assets/logo.png',
    exit: { label: 'Back to site', href: '/' },
    loading: 'Setting up the cart…',
  },
  theme: { bg: '#0a0a0a', accent: '#ffffff', font: "'Montserrat', system-ui, sans-serif" },

  // photographic lighting: HDR panorama (Poly Haven "Rooitou Park", CC0) + a matching sun
  world: {
    hdr: 'scene-engine/assets/env/park.hdr', backgroundBlur: 0.08, backgroundIntensity: 0.55, envIntensity: 1.0, exposure: 1.18,
    fog: 0xd9e2e6, fogNear: 25, fogFar: 260,
    hemi: 0.4, hemiSky: 0xfff0dc, hemiGround: 0xd6cfbd,   // warm fill so whites in the shade don't go blue
    low: { fogNear: 10, fogFar: 95 },            // phones: no depth-of-field, so haze softens the distance instead
    sun: { position: [-16.8, 9.6, -5.2], color: 0xffe9cc, intensity: 3.4, extent: 6.5, far: 60, bias: -0.0002, normalBias: 0.012 },
  },
  post: { ao: { radius: 0.28, intensity: 1 }, dof: { aperture: 0.0016, focusAperture: 0.007, maxblur: 0.015 }, bloom: { strength: 0.2, radius: 0.7, threshold: 1.0 } },

  camera: {
    fov: 50,
    start: { from: [0.2, 1.55, 2.85], to: [0, 1.0, 0] },
    startPortrait: { from: [0.2, 1.6, 3.9], to: [0, 1.12, 0] },
    focusPoint: [0, 1.05, 0.2],
    bounds: { minX: -3.4, maxX: 3.4, minZ: 1.5, maxZ: 6.5 },
    colliders: [{ minX: 1.2, maxX: 1.95, minZ: 1.15, maxZ: 2.05 }],   // the A-frame sign
    lookYaw: 105, lookPitch: 36, speed: 1.7,
  },

  // live data (menu, events, add-ons, logo). Runs once before build().
  async load() {
    const [menu, events, addons, logoImg] = await Promise.all([
      safe(sb('menu_items?is_available=eq.true&order=category.asc,sort_order.asc')),
      safe(sb('events?is_active=eq.true&order=date_value.asc.nullslast,created_at.asc').catch(() => sb('events?is_active=eq.true&order=created_at.asc'))),
      safe(sb('addons?is_available=eq.true&order=type.asc,sort_order.asc')),
      loadImage('scene-engine/assets/logo.png'),
    ]);
    try { await Promise.all([document.fonts.load('800 20px Montserrat'), document.fonts.load('500 20px Montserrat'), document.fonts.load('300 20px Montserrat')]); } catch (e) {}
    return { menu, events, addons, logoImg, logoWhite: logoImg ? whiteLogo(logoImg) : null };
  },

  build({ THREE, scene, props: P, hd: H, quality, data, hotspot, animate }) {
    const { menu, events, addons, logoWhite, logoImg } = data;
    const nextEvent = events && events[0];
    const orderHref = nextEvent ? `order.html?event_id=${nextEvent.id}` : 'order.html';

    // ── lawn + trees (the HDR panorama supplies sky, horizon and light) ──
    const tl = new THREE.TextureLoader();
    const lawn = H.lawn({ map: tl.load('scene-engine/assets/textures/grass.jpg'), normalMap: tl.load('scene-engine/assets/textures/grass-nm.jpg'), tint: 0xe6dcc0, exclude: [{ minX: -1.2, maxX: 1.2, minZ: -0.48, maxZ: 0.48 }, { minX: 1.25, maxX: 1.9, minZ: 1.25, maxZ: 1.95 }] });
    scene.add(lawn.group);
    animate((dt, t) => lawn.update(t));
    // individual trees only where depth-of-field can blur them; phones get the hazy tree line alone
    if (quality === 'high') [[-16, -30, 15, 6.5], [-2, -38, 17, 7.5], [13, -31, 15, 6.5], [27, -25, 16, 7], [40, -30, 17, 7.5], [-33, -30, 16, 7], [-42, -14, 17, 7.5], [44, -10, 16, 7], [-30, 16, 16, 7], [33, 15, 15, 6.5], [3, -52, 18, 8], [-21, -48, 17, 7.5], [24, -48, 17, 7.8]]
      .forEach(([x, z, h, c], i) => { const t = H.tree({ height: h, crown: c, seed: i + 2, leaf: [0x5c8a38, 0x6a9840, 0x507c32][i % 3] }); t.position.set(x, 0, z); t.rotation.y = i * 1.7; scene.add(t); });

    scene.add(H.treeLine({ near: 52, far: 85, count: 260 }));

    // ── tent + cart ──
    const tent = H.canopyTent({ w: 3.5, d: 3.0 }); tent.position.set(0, 0, -0.3); scene.add(tent);

    const signTex = P.canvasTex(1024, 640, (c, w, h) => drawSign(c, w, h, logoWhite));
    const cart = H.cart({ width: 2.2, depth: 0.75, signTexture: signTex });
    scene.add(cart);
    const Y = cart.userData.topY;

    const put = (obj, x, z, ry = 0, y = Y) => { obj.position.set(x, y, z); obj.rotation.y = ry; scene.add(obj); return obj; };

    // left: iced drink, cups, sanitizer, straws, plant
    const service = new THREE.Group(); service.position.y = Y; scene.add(service);
    const sm = H.barMat(0.17, 0.17); sm.position.set(-1.02, 0, 0.28); service.add(sm);
    const iced = H.icedCup({ logoTexture: logoImg ? P.canvasTex(512, 256, (c, w, h) => drawCupLogo(c, w, h, logoImg)) : null }); iced.position.set(-1.02, 0.0075, 0.28); iced.rotation.y = 0.15; service.add(iced);
    const stack = H.cupStack(); stack.position.set(-0.9, 0, 0.06); service.add(stack);
    put(H.pumpBottle(), -1.06, 0.0, 0.5);
    put(H.strawGlass(), -0.77, -0.1);
    put(H.plant(), -1.0, -0.27, 0.6);

    // menu display on a bar mat
    put(H.barMat(0.62, 0.2), -0.4, 0.3);
    const screenTex = P.canvasTex(1024, 640, (c, w, h) => drawMenuScreen(c, w, h, logoWhite, menu));
    const tablet = put(H.menuDisplay({ screen: screenTex }), -0.4, 0.06, 0.02);
    const lcard = put(H.cardStand({ texture: P.canvasTex(512, 320, drawLoyalty) }), -0.02, 0.31, 0.12);

    // beans + cold brew
    const jar = put(H.beanJar({ labelTexture: P.canvasTex(256, 320, drawBeanLabel) }), -0.1, -0.03);
    const pot = put(H.brewPot({ lidAngle: -0.5 }), 0.2, -0.07);

    // syrups
    const syrups = new THREE.Group(); syrups.position.y = Y; scene.add(syrups);
    [['Vanilla', 0xe2b24a, '#a8842c', 0.42, 0.2], ['Caramel', 0xc67a1e, '#a35a14', 0.505, 0.215], ['Hazelnut', 0x5a2a10, '#5a2a10', 0.59, 0.2]].forEach(([name, liquid, accent, x, z], i) => {
      const b = H.syrupBottle({ liquid, labelTexture: P.canvasTex(512, 256, (c, w, h) => drawSyrupLabel(c, w, h, logoImg, name, accent)) });
      b.position.set(x, 0, z); b.rotation.y = (i - 1) * -0.12; syrups.add(b);
    });

    // espresso machine + caddy
    const machine = put(H.espressoMachine(), 0.72, -0.03);
    put(H.organizer(), 1.02, 0.0, -0.06);

    // A-frame + pendant light
    const aframe = H.aFrame({ face: P.canvasTex(512, 800, (c, w, h) => drawChalk(c, w, h)) });
    aframe.position.set(1.55, 0, 1.6); aframe.rotation.y = -0.5; scene.add(aframe);
    const lantern = H.pendant({ drop: 0.33 }); lantern.position.set(0, 2.35, -0.3); scene.add(lantern);
    const warm = new THREE.PointLight(0xffdfb0, 0.5, 4, 2); warm.position.set(0, 2.3, -0.3); scene.add(warm);

    // ─────────────── hotspots (tour order) ───────────────
    const row = (name, sub, price) => `<div class="row"><div><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${price ? `<span class="p">${esc(price)}</span>` : ''}</div>`;

    hotspot({
      id: 'menu', label: 'The Menu', object: tablet, marker: [-0.4, Y + 0.37, 0.06],
      focus: { from: [-0.4, Y + 0.33, 0.8], to: [-0.4, Y + 0.17, 0.05], fov: 40 },
      panel: {
        eyebrow: 'The Menu', title: 'Crafted with intention',
        html: () => {
          if (!menu.length) return '<p>Our menu is updated before every event — head to the order page to see what’s on.</p>';
          const cats = {}; menu.forEach(m => (cats[m.category] = cats[m.category] || []).push(m));
          return Object.entries(cats).map(([c, items]) => `<h4>${esc(c)}</h4>${items.map(i => row(i.name, i.description, money(i.price_cents))).join('')}`).join('')
            + '<p style="margin-top:14px">All drinks available hot or iced · Dairy alternatives available · Custom syrups upon request.</p>';
        },
        ctas: [{ label: 'Pre-order a drink', href: orderHref }, { label: 'Full menu', href: '/#menu' }],
      },
    });

    hotspot({
      id: 'espresso', label: 'Espresso', object: machine, marker: [0.74, Y + 0.5, 0.0],
      focus: { from: [0.5, Y + 0.36, 1.05], to: [0.7, Y + 0.2, -0.03], fov: 38 },
      panel: {
        eyebrow: 'The Espresso', title: 'Pulled fresh, made to order',
        html: () => '<p>Every drink starts with a freshly pulled shot. Espresso drinks prepared with intention, quality ingredients and a respect for classic coffee traditions — right at your event.</p><p>Lattes, cappuccinos, americanos, cortados and more, hot or iced.</p><p><a href="#" data-hotspot="menu" style="color:#0a0a0a">See everything on the menu →</a></p>',
        ctas: [{ label: 'Pre-order', href: orderHref }],
      },
    });

    hotspot({
      id: 'beans', label: 'The Beans', object: jar, marker: [-0.1, Y + 0.34, -0.03],
      focus: { from: [-0.06, Y + 0.27, 0.74], to: [-0.1, Y + 0.13, -0.03], fov: 36 },
      panel: {
        eyebrow: 'The Beans', title: 'Harmony Blend',
        html: () => '<p>The beans in our jar: a medium-dark roast of coffees from Colombia, Brazil and Nicaragua.</p><div style="margin:14px 0 6px"><span class="tag">Milk chocolate</span><span class="tag">Stone fruit</span><span class="tag">Hazelnut</span></div><h4>Origins</h4><p>Colombia · Brazil · Nicaragua</p><h4>Roast</h4><p>Medium dark</p>',
        ctas: [{ label: 'Taste it — pre-order', href: orderHref }],
      },
    });

    hotspot({
      id: 'coldbrew', label: 'Cold Brew', object: pot, marker: [0.2, Y + 0.3, -0.07],
      focus: { from: [0.16, Y + 0.36, 0.9], to: [0.16, Y + 0.12, 0.0], fov: 40 },
      panel: {
        eyebrow: 'Cold Brew & Iced', title: 'Made for warm days',
        html: () => '<p>Cold brew, iced lattes, matcha and iced teas — all poured cold for outdoor markets and warm afternoons.</p><div style="margin-top:12px"><span class="tag">Cold brew</span><span class="tag">Matcha</span><span class="tag">Iced teas</span><span class="tag">Refreshers</span></div>',
        ctas: [{ label: 'Pre-order', href: orderHref }],
      },
    });

    hotspot({
      id: 'syrups', label: 'Syrups & Milks', object: syrups, marker: [0.505, Y + 0.42, 0.2],
      focus: { from: [0.46, Y + 0.3, 0.95], to: [0.505, Y + 0.16, 0.2], fov: 36 },
      panel: {
        eyebrow: 'Make it yours', title: 'Syrups & milks',
        html: () => {
          const milks = addons.filter(a => a.type === 'milk'), syr = addons.filter(a => a.type === 'syrup');
          let out = '<p>Customize every drink — pick your milk and add syrups when you order. Custom syrups upon request.</p>';
          if (syr.length) out += `<h4>Syrups</h4>${syr.map(a => row(a.name, '', a.price_cents ? `+${money(a.price_cents)}` : 'Free')).join('')}`;
          if (milks.length) out += `<h4>Milk</h4>${milks.map(a => row(a.name, '', a.price_cents ? `+${money(a.price_cents)}` : '')).join('')}`;
          return out;
        },
        ctas: [{ label: 'Build my drink', href: orderHref }],
      },
    });

    hotspot({
      id: 'story', label: 'Our Story', object: cart.userData.plate, hitPad: 0.04,
      focus: { from: [0, 0.95, 2.25], to: [0, 0.56, 0.4], fov: 44 },
      panel: {
        eyebrow: 'Our Story', title: 'More than coffee.',
        html: () => '<p>Distinct. Coffee Co. serves handcrafted specialty coffee with an emphasis on quality, simplicity, and connection.</p><p>We believe every person has a distinct story, and every drink has its own character. Together, those differences create something worth celebrating — a community where everyone belongs.</p><p><b style="color:#0a0a0a;letter-spacing:2px;font-size:10px">DIFFERENT STORIES. ONE COMMUNITY.</b></p>',
        ctas: [{ label: 'Read more', href: '/#about' }],
      },
    });

    hotspot({
      id: 'events', label: 'Find Us', object: lantern, marker: [0, 2.52, -0.3], hitPad: 0.14,
      focus: { from: [0, 1.55, 1.9], to: [0, 2.32, -0.3], fov: 50 },
      panel: {
        eyebrow: 'Where we’ll be', title: events.length ? 'Upcoming events' : 'Something distinct is brewing',
        html: () => events.length
          ? events.map(e => `<div class="event"><b>${esc(e.name)}</b>${esc(e.date || '')}${e.location ? `<br>${esc(e.location)}` : ''}${e.pickup_hours ? `<br>${esc(e.pickup_hours)}` : ''}</div>`).join('')
          : '<p>Stay tuned — our next pop-up is on its way. Follow along to be the first to know.</p>',
        ctas: events.length ? [{ label: 'Pre-order for next event', href: orderHref }, { label: 'Follow @distinct.coffeeco', href: 'https://instagram.com/distinct.coffeeco', external: true }] : [{ label: 'Follow @distinct.coffeeco', href: 'https://instagram.com/distinct.coffeeco', external: true }],
      },
    });

    hotspot({
      id: 'order', label: 'Order Ahead', object: aframe, marker: [1.55, 1.05, 1.6],
      focus: { from: [1.1, 0.9, 2.9], to: [1.52, 0.5, 1.6], fov: 44 },
      panel: {
        eyebrow: 'Skip the line', title: 'Order ahead',
        html: () => '<p>Pre-order for an upcoming event and pay online, or reserve and pay at the event. At the cart, scan the QR code to order and pay from your phone — then we’ll call your name.</p>',
        ctas: [{ label: 'Pre-order now', href: orderHref }],
      },
    });

    hotspot({
      id: 'loyalty', label: 'Rewards', object: lcard, marker: [-0.02, Y + 0.15, 0.31], hitPad: 0.04,
      focus: { from: [0.04, Y + 0.26, 0.82], to: [-0.02, Y + 0.06, 0.31], fov: 32 },
      panel: {
        eyebrow: 'Rewards', title: 'Every drink counts',
        html: () => '<p>Join our loyalty card when you order — with just your email or phone number. Every drink earns a punch, and when your card is full a drink is on us.</p>',
        ctas: [{ label: 'Start earning', href: orderHref }],
      },
    });

    hotspot({
      id: 'book', label: 'Book Us', object: service, marker: [-0.9, Y + 0.48, 0.06], hitPad: 0.02,
      focus: { from: [-0.86, Y + 0.36, 1.0], to: [-0.95, Y + 0.16, 0.15], fov: 38 },
      panel: {
        eyebrow: 'Catering', title: 'Your event, our cart',
        html: () => '<p>We bring the café to you. Mobile setup, full bar, zero friction.</p><div style="margin:12px 0"><span class="tag">Corporate events</span><span class="tag">Weddings &amp; celebrations</span><span class="tag">Private &amp; social</span><span class="tag">Family events</span><span class="tag">Pop-ups &amp; markets</span></div><p>Tell us about your event and we’ll reply within 24 hours with packages and availability.</p>',
        ctas: [{ label: 'Book us', href: '/#contact' }, { label: 'See catering', href: '/#services' }],
      },
    });
  },
};
