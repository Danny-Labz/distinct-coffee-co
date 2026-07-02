// ─────────────────────────────────────────────
// DISTINCT COFFEE CO. — ORDER PAGE LOGIC
// ─────────────────────────────────────────────

const SUPABASE_URL      = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqc2l0cXZmaW13aXVvb2pzb2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzAwNzUsImV4cCI6MjA5ODUwNjA3NX0.p2qXO5-Z6uWd7n7slhHJT_s2NDvjRlsOMQLqCRxFIcU';

// ─── STATE ───────────────────────────────────
let cart          = {};
let addons        = [];
let milk          = 'Dairy';
let temp          = 'Hot';
let activeEvent   = null;
let paymentMethod = 'pay_now'; // 'pay_now' or 'pay_at_event' 

// ─── INIT ────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadEvent(), loadMenu()]);
});

// ─── SUPABASE HELPER ─────────────────────────
async function supaFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  if (!res.ok) throw new Error(`Supabase error: ${path}`);
  return res.json();
}

// ─── LOAD EVENT ──────────────────────────────
async function loadEvent() {
  const statusEl = document.getElementById('event-status');
  try {
    const params  = new URLSearchParams(window.location.search);
    const eventId = params.get('event_id');

    const path = eventId
      ? `events?id=eq.${eventId}&limit=1`
      : `events?is_active=eq.true&order=created_at.asc&limit=1`;

    const events = await supaFetch(path);

    if (!events || events.length === 0) { showNoEvent(); return; }

    activeEvent = events[0];

    // Check cutoff
    if (activeEvent.order_cutoff && new Date() > new Date(activeEvent.order_cutoff)) {
      showClosed(activeEvent); return;
    }

    // Populate banner
    document.getElementById('event-name').textContent     = activeEvent.name;
    document.getElementById('event-date').textContent     = activeEvent.date;
    document.getElementById('event-location').textContent = activeEvent.location;
    document.getElementById('event-pickup').textContent   = activeEvent.pickup_hours;

    if (activeEvent.order_cutoff) {
      const cutoff = new Date(activeEvent.order_cutoff);
      document.getElementById('event-cutoff').textContent =
        `Order by ${cutoff.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}`;
    }

    document.getElementById('ne-order-btn') &&
      (document.getElementById('ne-order-btn').href = `order.html?event_id=${activeEvent.id}`);

    document.getElementById('order-form').style.display = 'block';
    if (statusEl) statusEl.style.display = 'none';

  } catch (err) {
    console.error(err);
    showNoEvent();
  }
}

function showNoEvent() {
  document.getElementById('event-name').textContent     = 'No upcoming events';
  document.getElementById('event-date').textContent     = 'Follow @distinct.coffeeco for announcements';
  document.getElementById('event-location').textContent = '';
  document.getElementById('event-pickup').textContent   = '';
  document.getElementById('order-form').style.display   = 'none';
  const el = document.getElementById('event-status');
  if (el) { el.textContent = 'There are no upcoming events right now. Follow us on Instagram for announcements.'; el.style.display = 'block'; }
}

function showClosed(ev) {
  document.getElementById('event-name').textContent     = ev.name;
  document.getElementById('event-date').textContent     = ev.date;
  document.getElementById('event-location').textContent = ev.location;
  document.getElementById('event-pickup').textContent   = ev.pickup_hours;
  document.getElementById('order-form').style.display   = 'none';
  const el = document.getElementById('event-status');
  if (el) { el.textContent = 'Pre-orders for this event are now closed. See you there!'; el.style.display = 'block'; }
}

// ─── LOAD MENU ───────────────────────────────
async function loadMenu() {
  try {
    const items = await supaFetch('menu_items?is_available=eq.true&order=category.asc,sort_order.asc');

    if (!items || items.length === 0) {
      document.getElementById('menu-sections').innerHTML =
        '<p style="color:#999;font-size:12px;">Menu unavailable. Please check back soon.</p>';
      return;
    }

    // Group by category
    const categories = {};
    items.forEach(item => {
      if (!categories[item.category]) categories[item.category] = [];
      categories[item.category].push(item);
    });

    // Render
    const container = document.getElementById('menu-sections');
    container.innerHTML = Object.entries(categories).map(([cat, catItems]) => `
      <div class="menu-section">
        <div class="section-label">${cat}</div>
        ${catItems.map(item => `
          <div class="menu-item" data-item="${item.id}" data-price="${item.price_cents}">
            <div class="item-info">
              <div class="item-name">${item.name}</div>
              <div class="item-desc">${item.description || ''}</div>
            </div>
            <div class="item-price">$${(item.price_cents / 100).toFixed(2)}</div>
            <div class="qty-control">
              <button class="qty-btn" onclick="changeQty(this,-1)">−</button>
              <div class="qty-display">0</div>
              <button class="qty-btn" onclick="changeQty(this,1)">+</button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');

  } catch (err) {
    console.error('Menu load error:', err);
    document.getElementById('menu-sections').innerHTML =
      '<p style="color:#999;font-size:12px;">Could not load menu. Please refresh.</p>';
  }
}

// ─── QUANTITY CONTROLS ───────────────────────
function changeQty(btn, delta) {
  const row      = btn.closest('.menu-item');
  const display  = row.querySelector('.qty-display');
  const itemKey  = row.dataset.item;
  const itemName = row.querySelector('.item-name').textContent;
  const price    = parseInt(row.dataset.price, 10);

  let qty = parseInt(display.textContent, 10) + delta;
  if (qty < 0) qty = 0;
  display.textContent = qty;

  if (qty === 0) delete cart[itemKey];
  else cart[itemKey] = { name: itemName, price, qty };

  updateSummary();
}

// ─── CUSTOMISATION CHIPS ─────────────────────
function selectChip(btn) {
  const group = btn.dataset.group;
  document.querySelectorAll(`.custom-chip[data-group="${group}"]`)
    .forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
  if (group === 'milk') milk = btn.textContent.trim();
  if (group === 'temp') temp = btn.textContent.trim();
}

function toggleAddon(btn) {
  btn.classList.toggle('selected');
  const label = btn.textContent.split(' +')[0].trim();
  if (btn.classList.contains('selected')) {
    if (!addons.includes(label)) addons.push(label);
  } else {
    addons = addons.filter(a => a !== label);
  }
}

// ─── PAYMENT METHOD ──────────────────────────
function selectPayment(btn) {
  document.querySelectorAll('.payment-opt').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  paymentMethod = btn.dataset.method;

  const checkoutBtn = document.getElementById('checkout-btn');
  const secureNote  = document.getElementById('secure-note');

  if (paymentMethod === 'pay_at_event') {
    checkoutBtn.textContent = 'Reserve My Order →';
    if (secureNote) secureNote.textContent = '✓ No payment now — pay cash or card at the event.';
  } else {
    checkoutBtn.textContent = Object.keys(cart).length > 0 ? 'Proceed to Payment →' : 'Proceed to Payment →';
    if (secureNote) secureNote.textContent = '🔒 Secure checkout powered by Stripe';
  }

  updateSummary();
}

// ─── SUMMARY ─────────────────────────────────
function updateSummary() {
  const items       = Object.values(cart);
  const container   = document.getElementById('summary-items');
  const totalEl     = document.getElementById('summary-total');
  const checkoutBtn = document.getElementById('checkout-btn');

  if (items.length === 0) {
    container.innerHTML  = '<div class="summary-empty">No items selected yet</div>';
    totalEl.textContent  = '$0.00';
    checkoutBtn.disabled = true;
    return;
  }

  let total = 0;
  container.innerHTML = items.map(item => {
    const lineTotal = item.price * item.qty;
    total += lineTotal;
    return `<div class="summary-row">
      <span>${item.name} × ${item.qty}</span>
      <span>$${(lineTotal / 100).toFixed(2)}</span>
    </div>`;
  }).join('');

  totalEl.textContent  = `$${(total / 100).toFixed(2)}`;
  checkoutBtn.disabled = false;
}

// ─── VALIDATION ──────────────────────────────
function validate() {
  const errors = [];
  if (Object.keys(cart).length === 0)                      errors.push('Please add at least one item.');
  if (!document.getElementById('first-name').value.trim()) errors.push('First name is required.');
  if (!document.getElementById('email').value.trim())      errors.push('Email is required.');
  if (!document.getElementById('pickup-time').value)       errors.push('Please select a pickup time.');
  return errors;
}

// ─── CHECKOUT ────────────────────────────────
async function handleCheckout() {
  const errorEl = document.getElementById('error-msg');
  const btn     = document.getElementById('checkout-btn');

  errorEl.style.display = 'none';

  const errors = validate();
  if (errors.length > 0) {
    errorEl.textContent   = errors.join(' ');
    errorEl.style.display = 'block';
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Preparing checkout...';

  const orderData = {
    event_id:      activeEvent.id,
    event_name:    activeEvent.name,
    event_date:    activeEvent.date,
    customer_name: `${document.getElementById('first-name').value.trim()} ${document.getElementById('last-name').value.trim()}`.trim(),
    email:         document.getElementById('email').value.trim(),
    phone:         document.getElementById('phone').value.trim(),
    pickup_time:   document.getElementById('pickup-time').value,
    milk_pref:     milk,
    temp_pref:     temp,
    addons,
    items:         cart,
    total_cents:   Object.values(cart).reduce((sum, i) => sum + i.price * i.qty, 0),
    status:        paymentMethod === 'pay_at_event' ? 'reserved' : 'pending',
    payment_method: paymentMethod,
    notes:         document.getElementById('notes').value.trim(),
  };

  try {
    // Always log order to Supabase first
    const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer':        'return=representation',
      },
      body: JSON.stringify(orderData),
    });

    if (!supaRes.ok) throw new Error('Could not save your order. Please try again.');
    const [savedOrder] = await supaRes.json();

    // Generate PIN for the saved order
    const pin = String((parseInt(savedOrder.id.replace(/-/g,'').slice(0,8), 16) % 9000) + 1000);

    // Save PIN to order record
    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${savedOrder.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ pickup_pin: pin }),
    });

    // Send email notification (fire and forget — don't block checkout)
    fetch('/.netlify/functions/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'order',
        data: { ...orderData, pickup_pin: pin, id: savedOrder.id },
      }),
    }).catch(() => {}); // silent fail — never block the user flow

    if (paymentMethod === 'pay_at_event') {
      window.location.href = `confirmation.html?order_id=${savedOrder.id}&method=pay_at_event`;
      return;
    }

    // Pay now — create Stripe Checkout session
    const stripeRes = await fetch('/.netlify/functions/create-checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id:       savedOrder.id,
        items:          cart,
        addons,
        customer_email: orderData.email,
        event_name:     activeEvent.name,
      }),
    });

    if (!stripeRes.ok) throw new Error('Could not start checkout. Please try again.');
    const { url } = await stripeRes.json();

    // Redirect to Stripe
    window.location.href = url;

  } catch (err) {
    errorEl.textContent   = err.message || 'Something went wrong. Please try again.';
    errorEl.style.display = 'block';
    btn.disabled          = false;
    btn.textContent       = 'Proceed to Payment →';
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
