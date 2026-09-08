// netlify/functions/admin-update-order.js
// SECURED: updates an order's status/fulfillment via the service role key.
// Used by admin.html (status dropdown) and prep.html (Mark Fulfilled).

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { order_id, updates } = JSON.parse(event.body);
    if (!order_id || !updates) {
      return { statusCode: 400, body: JSON.stringify({ error: 'order_id and updates are required' }) };
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(updates),
    });

    if (!res.ok) throw new Error(await res.text());

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('admin-update-order error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
