// netlify/functions/admin-get-inquiries.js
// SECURED: same pattern as admin-get-orders, for the Inquiries tab.

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    try {
      const params = event.queryStringParameters || {};
      const qs = new URLSearchParams(params).toString();

      const res = await fetch(`${SUPABASE_URL}/rest/v1/inquiries${qs ? '?' + qs : '?select=*'}`, {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      });
      if (!res.ok) throw new Error(await res.text());
      const inquiries = await res.json();
      return { statusCode: 200, body: JSON.stringify(inquiries) };
    } catch (err) {
      console.error('admin-get-inquiries error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    // Reused for status updates too, keeps the inquiries admin surface to one function
    try {
      const { inquiry_id, updates } = JSON.parse(event.body);
      if (!inquiry_id || !updates) {
        return { statusCode: 400, body: JSON.stringify({ error: 'inquiry_id and updates are required' }) };
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/inquiries?id=eq.${inquiry_id}`, {
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
      console.error('admin-get-inquiries update error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
