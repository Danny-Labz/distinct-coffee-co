// netlify/functions/save-stripe-session.js
// Public, narrow-purpose endpoint: links a Stripe checkout session ID to
// an order the customer just created. Does NOT expose or require reading
// any order data back — write-only, one field, by ID only.

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
// Uses the SERVICE key server-side so this can update the row even though
// public UPDATE is disabled by RLS. The service key never reaches the browser.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { order_id, session_id } = JSON.parse(event.body);
    if (!order_id || !session_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'order_id and session_id are required' }) };
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ stripe_session: session_id }),
    });

    if (!res.ok) throw new Error(await res.text());

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('save-stripe-session error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
