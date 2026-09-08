// netlify/functions/get-order-confirmation.js
// Public, narrow-purpose endpoint: returns ONLY the non-sensitive fields
// the confirmation page needs to display (name, pickup info, total, PIN).
// Deliberately excludes email, phone, and full items detail — those aren't
// needed for the confirmation screen and shouldn't be exposed publicly
// even to the customer's own browser beyond what's displayed.

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const orderId = event.queryStringParameters?.order_id;
    if (!orderId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'order_id is required' }) };
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}&select=customer_name,pickup_time,event_name,event_date,total_cents,pickup_pin`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!res.ok) throw new Error(await res.text());
    const [order] = await res.json();

    if (!order) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
    }

    return { statusCode: 200, body: JSON.stringify(order) };
  } catch (err) {
    console.error('get-order-confirmation error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
