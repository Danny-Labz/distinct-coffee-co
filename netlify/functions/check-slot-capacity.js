// netlify/functions/check-slot-capacity.js
// Public, narrow-purpose endpoint: returns ONLY aggregate item counts per
// pickup slot for a given event, or for one specific slot. Never returns
// customer names, emails, or any identifying order data — just numbers,
// which is all the order page needs to gray out full time slots.

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function countItemsInOrder(items) {
  if (!items) return 0;
  return Object.values(items).reduce((sum, val) => {
    if (Array.isArray(val)) return sum + val.length;
    return sum + (val.qty || 0);
  }, 0);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const eventId = event.queryStringParameters?.event_id;
    const pickupTime = event.queryStringParameters?.pickup_time; // optional — for the single-slot recheck at submit time
    if (!eventId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'event_id is required' }) };
    }

    let url = `${SUPABASE_URL}/rest/v1/orders?event_id=eq.${eventId}&status=neq.cancelled&select=pickup_time,items`;
    if (pickupTime) url += `&pickup_time=eq.${encodeURIComponent(pickupTime)}`;

    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!res.ok) throw new Error(await res.text());
    const orders = await res.json();

    if (pickupTime) {
      // Single-slot mode — return one total count (used for the final re-check before booking)
      const total = orders.reduce((sum, o) => sum + countItemsInOrder(o.items), 0);
      return { statusCode: 200, body: JSON.stringify({ count: total }) };
    }

    // Full breakdown mode — used to gray out slots in the dropdown
    const slotCounts = {};
    orders.forEach(o => {
      if (!o.pickup_time) return;
      slotCounts[o.pickup_time] = (slotCounts[o.pickup_time] || 0) + countItemsInOrder(o.items);
    });

    return { statusCode: 200, body: JSON.stringify({ slotCounts }) };

  } catch (err) {
    console.error('check-slot-capacity error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
