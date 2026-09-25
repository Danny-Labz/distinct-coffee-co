// netlify/functions/admin-addons.js
// SECURED (service role key): create, update, and delete milk/syrup add-on
// options from the admin Menu/Inventory tab. addons has RLS enabled with
// only a public SELECT policy — writes must go through the service key,
// same pattern as admin-get-orders / admin-update-order.

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  };

  try {
    if (event.httpMethod === 'POST') {
      // Create a new addon
      const { data } = JSON.parse(event.body);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/addons`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      return { statusCode: 200, body: JSON.stringify(created) };
    }

    if (event.httpMethod === 'PUT') {
      // Update an existing addon by id
      const { id, data } = JSON.parse(event.body);
      if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id is required' }) };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/addons?id=eq.${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (event.httpMethod === 'DELETE') {
      const { id } = JSON.parse(event.body);
      if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id is required' }) };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/addons?id=eq.${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(await res.text());
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };

  } catch (err) {
    console.error('admin-addons error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
