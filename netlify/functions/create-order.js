// netlify/functions/create-order.js
// SECURED (service role key): creates a customer order and returns the saved
// row. orders has RLS with a public INSERT policy but no public SELECT, so
// insert + return=representation from the browser fails with 42501.
// Same pattern as admin-addons.js.

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Customers may only create orders in these states; paid/fulfilled etc.
// are set server-side by the Stripe webhook and admin.
const ALLOWED_STATUSES = ['pending', 'reserved'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const order = JSON.parse(event.body || '{}');

    delete order.id;
    delete order.created_at;
    if (!ALLOWED_STATUSES.includes(order.status)) order.status = 'pending';

    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(order),
    });

    if (!res.ok) throw new Error(await res.text());
    const saved = await res.json();
    return { statusCode: 200, body: JSON.stringify(saved[0]) };
  } catch (err) {
    console.error('create-order error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
