// netlify/functions/admin-get-orders.js
// SECURED: uses the service role key to read full order data (including PII)
// for the admin dashboard, Reports, Costs Dashboard, and Prep View.
// This bypasses RLS by design — the service key is server-side only,
// never exposed to the browser. This is the ONLY path that can read
// customer names/emails/phones from the orders table now that public
// SELECT is disabled.

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Pass through any query filters the caller needs (event_id, status, pickup_time, etc.)
    // so this one function serves Orders tab, Reports, Costs, and Prep View alike.
    const params = event.queryStringParameters || {};
    const qs = new URLSearchParams(params).toString();

    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders${qs ? '?' + qs : '?select=*'}`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!res.ok) throw new Error(await res.text());
    const orders = await res.json();

    return { statusCode: 200, body: JSON.stringify(orders) };
  } catch (err) {
    console.error('admin-get-orders error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
