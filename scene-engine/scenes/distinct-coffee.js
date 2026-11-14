// scene-engine/scenes/distinct-coffee.js
// ─────────────────────────────────────────────────────────────────────────────
// The Distinct. Coffee Co. cart, as a customer sees it walking up at an event.
// Layout mirrors the real setup (white pop-up tent, black cart with marble top,
// menu display on the left, espresso machine on the right, beans, cold brew pot,
// syrups, A-frame order sign). Menu / add-ons / events come live from Supabase.
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

  world: { skyTop: 0x86a9d1, horizon: 0xe4e8ec, fogNear: 15, fogFar: 78, hemi: 0.8, envIntensity: 0.75, exposure: 1.0, sun: { position: [4, 9, 6.5], intensity: 2.1, extent: 6.5 } },

  camera: {
    fov: 58,
    start: { from: [0.15, 1.62, 3.2], to: [0, 1.2, 0] },
    bounds: { minX: -3.2, maxX: 3.2, minZ: 1.45, maxZ: 6.5 },
    colliders: [{ minX: 1.0, maxX: 1.7, minZ: 1.1, maxZ: 1.95 }],   // the A-frame sign
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

  build({ THREE, scene, props: P, data, hotspot, animate }) {
    const { menu, events, addons, logoWhite } = data;
    const nextEvent = events && events[0];
    const orderHref = nextEvent ? `order.html?event_id=${nextEvent.id}` : 'order.html';

    // ── ground + backdrop ──
    scene.add(P.ground(110, 0x78965c));
    [[-7, -7, 1], [8.5, -9.5, 2], [-12, -3, 3], [14, -6, 4], [-4, -15, 5], [19, -12, 6]].forEach(([x, z, s]) => {
      const t = P.tree({ height: 4.6 + (s % 3), crown: 2 + (s % 2) * 0.5, seed: s, color: [0x4d7a3f, 0x5b8a46, 0x45703a][s % 3] }); t.position.set(x, 0, z); scene.add(t);
    });
    [[10, -3, 3], [-9.5, -9, 5], [6, -12.5, 8]].forEach(([x, z, s]) => { const p = P.palm({ height: 6 + (s % 3), seed: s }); p.position.set(x, 0, z); scene.add(p); });
    const pav = P.pavilion(); pav.position.set(2, 0, -16); scene.add(pav);
    scene.add(P.stringLights([[-4, 3.6, -13.2], [-1.5, 3.6, -13.2], [1.5, 3.6, -13.2], [4.2, 3.6, -13.2], [6.4, 3.6, -13.2]], { sag: 0.3, bulbs: 10 }));
    [[-6.5, -10.5, 0x2d6cdf], [7, -9.5, 0xf4f5f7], [-2.8, -12.2, 0xe9742a], [11.5, -10.5, 0x2d6cdf]].forEach(([x, z, c]) => {
      const t = P.popupTent({ w: 3, d: 3, canopy: c }); t.position.set(x, 0, z); t.scale.setScalar(0.9); scene.add(t);
    });
    const crowd = P.walkers(13, { bounds: { x: [-14, 14], z: [-13, -4.2] } });
    crowd.forEach(p => scene.add(p));
    animate((dt, t) => crowd.forEach(p => P.stepWalker(p, dt, t)));

    // ── tent + cart ──
    const tent = P.popupTent({ w: 3.2, d: 3.0 }); tent.position.set(0, 0, -0.35); scene.add(tent);

    const signTex = P.canvasTex(1024, 640, (c, w, h) => drawSign(c, w, h, logoWhite));
    const cart = P.cart({ width: 2.0, depth: 0.75, signTexture: signTex });
    scene.add(cart);
    const Y = cart.userData.topY;

    const put = (obj, x, z, ry = 0, y = Y) => { obj.position.set(x, y, z); obj.rotation.y = ry; scene.add(obj); return obj; };

    // menu display (left)
    put(P.barMat(0.72, 0.24), -0.58, 0.2);
    const screenTex = P.canvasTex(1024, 640, (c, w, h) => drawMenuScreen(c, w, h, logoWhite, menu));
    const tablet = put(P.tabletDisplay({ screen: screenTex }), -0.62, 0.2, 0.02, Y + 0.008);
    // loyalty card
    const lcard = put(P.loyaltyCard({ texture: P.canvasTex(512, 320, drawLoyalty) }), -0.96, 0.26, 0.2);
    // cans + water
    put(P.can(0x2fa24a), -0.26, 0.22); put(P.can(0xd2262d), -0.18, 0.23); put(P.waterBottle(), -0.095, 0.22);
    // beans, kettle, cold brew
    const jar = put(P.beanJar({ labelTexture: P.canvasTex(256, 320, drawBeanLabel) }), 0.06, 0.05);
    put(P.kettle(), -0.13, -0.17, 0.6);
    const pot = put(P.stockPot(), 0.32, -0.02);
    // espresso machine + bowl/towel + speaker + syrups
    const machine = put(P.espressoMachine(), 0.7, -0.03);
    put(P.bowlAndTowel(), 0.7, -0.03, 0.3, Y + 0.39);
    put(P.speaker(), 0.5, 0.29);
    const syrups = new THREE.Group();
    const s1 = P.syrupBottle(), s2 = P.syrupBottle({ glass: 0x23130d });
    s1.position.set(0.94, 0, 0.1); s2.position.set(0.9, 0, -0.06);
    syrups.add(s1, s2); syrups.position.y = Y; scene.add(syrups);

    // barista behind the counter
    const barista = P.person({ shirt: 0x151515, pants: 0x20232b, skin: 0xc79876, hair: 0x17110d, beard: true, arms: 'counter' });
    barista.position.set(-0.12, 0, -0.5); scene.add(barista);

    // A-frame + lantern
    const aframe = P.aFrame({ face: P.canvasTex(512, 800, (c, w, h) => drawChalk(c, w, h)) });
    aframe.position.set(1.35, 0, 1.5); aframe.rotation.y = -0.5; scene.add(aframe);
    const lantern = P.lantern(); lantern.position.set(0, 2.38, -0.3); scene.add(lantern);
    scene.add(P.rod([0, 2.75, -0.3], [0, 2.43, -0.3], 0.004, P.mat(0x222222)));
    const warm = new THREE.PointLight(0xffe2b0, 0.9, 5, 2); warm.position.set(0, 2.2, -0.3); scene.add(warm);

    // ─────────────── hotspots (tour order) ───────────────
    const row = (name, sub, price) => `<div class="row"><div><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${price ? `<span class="p">${esc(price)}</span>` : ''}</div>`;

    hotspot({
      id: 'menu', label: 'The Menu', object: tablet, marker: [-0.62, Y + 0.36, 0.22],
      focus: { from: [-0.6, Y + 0.36, 0.92], to: [-0.62, Y + 0.18, 0.2], fov: 42 },
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
      id: 'espresso', label: 'Espresso', object: machine, marker: [0.7, Y + 0.5, 0.0],
      focus: { from: [0.52, Y + 0.36, 1.05], to: [0.7, Y + 0.2, -0.03], fov: 40 },
      panel: {
        eyebrow: 'The Espresso', title: 'Pulled fresh, made to order',
        html: () => '<p>Every drink starts with a freshly pulled shot. Espresso drinks prepared with intention, quality ingredients and a respect for classic coffee traditions — right at your event.</p><p>Lattes, cappuccinos, americanos, cortados and more, hot or iced.</p><p><a href="#" data-hotspot="menu" style="color:#0a0a0a">See everything on the menu →</a></p>',
        ctas: [{ label: 'Pre-order', href: orderHref }],
      },
    });

    hotspot({
      id: 'beans', label: 'The Beans', object: jar, marker: [0.06, Y + 0.34, 0.05],
      focus: { from: [0.1, Y + 0.28, 0.8], to: [0.06, Y + 0.14, 0.05], fov: 38 },
      panel: {
        eyebrow: 'The Beans', title: 'Harmony Blend',
        html: () => '<p>The beans in our jar: a medium-dark roast of coffees from Colombia, Brazil and Nicaragua.</p><div style="margin:14px 0 6px"><span class="tag">Milk chocolate</span><span class="tag">Stone fruit</span><span class="tag">Hazelnut</span></div><h4>Origins</h4><p>Colombia · Brazil · Nicaragua</p><h4>Roast</h4><p>Medium dark</p>',
        ctas: [{ label: 'Taste it — pre-order', href: orderHref }],
      },
    });

    hotspot({
      id: 'coldbrew', label: 'Cold Brew', object: pot, marker: [0.32, Y + 0.3, -0.02],
      focus: { from: [0.38, Y + 0.34, 0.82], to: [0.32, Y + 0.1, -0.02], fov: 40 },
      panel: {
        eyebrow: 'Cold Brew & Iced', title: 'Made for warm days',
        html: () => '<p>Cold brew, iced lattes, matcha and iced teas — all poured cold for outdoor markets and warm afternoons.</p><div style="margin-top:12px"><span class="tag">Cold brew</span><span class="tag">Matcha</span><span class="tag">Iced teas</span><span class="tag">Refreshers</span></div>',
        ctas: [{ label: 'Pre-order', href: orderHref }],
      },
    });

    hotspot({
      id: 'syrups', label: 'Syrups & Milks', object: syrups, marker: [0.92, Y + 0.38, 0.02],
      focus: { from: [0.8, Y + 0.36, 0.85], to: [0.92, Y + 0.14, 0.02], fov: 38 },
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
      focus: { from: [0, 0.98, 2.1], to: [0, 0.5, 0.4], fov: 46 },
      panel: {
        eyebrow: 'Our Story', title: 'More than coffee.',
        html: () => '<p>Distinct. Coffee Co. serves handcrafted specialty coffee with an emphasis on quality, simplicity, and connection.</p><p>We believe every person has a distinct story, and every drink has its own character. Together, those differences create something worth celebrating — a community where everyone belongs.</p><p><b style="color:#0a0a0a;letter-spacing:2px;font-size:10px">DIFFERENT STORIES. ONE COMMUNITY.</b></p>',
        ctas: [{ label: 'Read more', href: '/#about' }],
      },
    });

    hotspot({
      id: 'events', label: 'Find Us', object: lantern, marker: [0, 2.58, -0.3], hitPad: 0.18,
      focus: { from: [0, 1.55, 1.9], to: [0, 2.3, -0.3], fov: 52 },
      panel: {
        eyebrow: 'Where we’ll be', title: events.length ? 'Upcoming events' : 'Something distinct is brewing',
        html: () => events.length
          ? events.map(e => `<div class="event"><b>${esc(e.name)}</b>${esc(e.date || '')}${e.location ? `<br>${esc(e.location)}` : ''}${e.pickup_hours ? `<br>${esc(e.pickup_hours)}` : ''}</div>`).join('')
          : '<p>Stay tuned — our next pop-up is on its way. Follow along to be the first to know.</p>',
        ctas: events.length ? [{ label: 'Pre-order for next event', href: orderHref }, { label: 'Follow @distinct.coffeeco', href: 'https://instagram.com/distinct.coffeeco', external: true }] : [{ label: 'Follow @distinct.coffeeco', href: 'https://instagram.com/distinct.coffeeco', external: true }],
      },
    });

    hotspot({
      id: 'order', label: 'Order Ahead', object: aframe, marker: [1.35, 1.0, 1.5],
      focus: { from: [0.95, 0.9, 2.75], to: [1.33, 0.5, 1.5], fov: 44 },
      panel: {
        eyebrow: 'Skip the line', title: 'Order ahead',
        html: () => '<p>Pre-order for an upcoming event and pay online, or reserve and pay at the event. At the cart, scan the QR code to order and pay from your phone — then we’ll call your name.</p>',
        ctas: [{ label: 'Pre-order now', href: orderHref }],
      },
    });

    hotspot({
      id: 'loyalty', label: 'Rewards', object: lcard, marker: [-0.96, Y + 0.14, 0.26], hitPad: 0.05,
      focus: { from: [-0.86, Y + 0.3, 0.8], to: [-0.96, Y + 0.07, 0.26], fov: 34 },
      panel: {
        eyebrow: 'Rewards', title: 'Every drink counts',
        html: () => '<p>Join our loyalty card when you order — with just your email or phone number. Every drink earns a punch, and when your card is full a drink is on us.</p>',
        ctas: [{ label: 'Start earning', href: orderHref }],
      },
    });

    hotspot({
      id: 'book', label: 'Book Us', object: barista, marker: [-0.12, 1.98, -0.5], hitPad: 0.05,
      focus: { from: [0.05, 1.6, 1.35], to: [-0.12, 1.42, -0.5], fov: 40 },
      panel: {
        eyebrow: 'Catering', title: 'Your event, our cart',
        html: () => '<p>We bring the café to you. Mobile setup, full bar, zero friction.</p><div style="margin:12px 0"><span class="tag">Corporate events</span><span class="tag">Weddings &amp; celebrations</span><span class="tag">Private &amp; social</span><span class="tag">Family events</span><span class="tag">Pop-ups &amp; markets</span></div><p>Tell us about your event and we’ll reply within 24 hours with packages and availability.</p>',
        ctas: [{ label: 'Book us', href: '/#contact' }, { label: 'See catering', href: '/#services' }],
      },
    });
  },
};
