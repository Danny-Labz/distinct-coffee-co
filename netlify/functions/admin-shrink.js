// netlify/functions/admin-shrink.js
// SECURED (service role key): log and list shrink (spilled/wasted/remade
// drinks) for cost tracking. Called from both Prep View (quick log while
// working) and the admin Costs > Shrink sub-tab (full history + logging).

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  };

  if (event.httpMethod === 'GET') {
    try {
      const eventId = event.queryStringParameters?.event_id;
      let url = `${SUPABASE_URL}/rest/v1/shrink_log?order=created_at.desc`;
      if (eventId) url += `&event_id=eq.${eventId}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(await res.text());
      const rows = await res.json();
      return { statusCode: 200, body: JSON.stringify(rows) };
    } catch (err) {
      console.error('admin-shrink GET error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const data = JSON.parse(event.body);
      if (!data.menu_item_name || !data.reason) {
        return { statusCode: 400, body: JSON.stringify({ error: 'menu_item_name and reason are required' }) };
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/shrink_log`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      return { statusCode: 200, body: JSON.stringify(created) };
    } catch (err) {
      console.error('admin-shrink POST error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === 'DELETE') {
    try {
      const { id } = JSON.parse(event.body);
      if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id is required' }) };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/shrink_log?id=eq.${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(await res.text());
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      console.error('admin-shrink DELETE error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
