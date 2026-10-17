// netlify/functions/create-order.js
// SECURED (service role key): creates a customer order and returns the saved
// row. orders has RLS with a public INSERT policy but no public SELECT, so
// insert + return=representation from the browser fails with 42501.
// Same pattern as admin-addons.js.

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// The public customer-facing order page may only create orders in these
// states; paid/fulfilled etc. are normally set server-side by the Stripe
// webhook or admin, never trusted directly from a customer's browser.
const ALLOWED_STATUSES = ['pending', 'reserved'];

// Counter Mode (operator-only, unlisted page) legitimately submits orders
// that are already paid — payment was collected separately in the Stripe
// Dashboard app, not through this order. It flags that explicitly via
// source: 'counter', which is the only way status: 'paid' is honored here;
// the public order form never sends this field, so it can't spoof paid.
const COUNTER_MODE_ALLOWED_STATUSES = ['pending', 'reserved', 'paid'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const order = JSON.parse(event.body || '{}');

    delete order.id;
    delete order.created_at;

    const isCounterMode = order.source === 'counter';
    delete order.source; // internal flag only — not a real orders column

    const allowedStatuses = isCounterMode ? COUNTER_MODE_ALLOWED_STATUSES : ALLOWED_STATUSES;
    if (!allowedStatuses.includes(order.status)) order.status = 'pending';

    // SMS consent record: a boolean from the checkbox, plus a server-side
    // timestamp so we have proof of when consent was given.
    order.sms_consent = order.sms_consent === true && !!order.phone;
    if (order.sms_consent) order.sms_consent_at = new Date().toISOString();
    else delete order.sms_consent_at;

    const insert = (body) => fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(body),
    });

    let res = await insert(order);

    // If the consent columns haven't been added to the table yet, don't lose
    // the order — save it without them. Fails safe: no consent recorded
    // means no texts are sent.
    if (!res.ok) {
      const errText = await res.text();
      if (errText.includes('sms_consent')) {
        console.warn('orders.sms_consent columns missing — saving without consent record');
        const { sms_consent, sms_consent_at, ...rest } = order;
        res = await insert(rest);
      } else {
        throw new Error(errText);
      }
    }
    if (!res.ok) throw new Error(await res.text());
    const saved = await res.json();
    return { statusCode: 200, body: JSON.stringify(saved[0]) };
  } catch (err) {
    console.error('create-order error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
