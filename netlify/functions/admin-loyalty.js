// netlify/functions/admin-loyalty.js
// SECURED (service role key): list/search loyalty members for the admin
// Loyalty tab, and redeem a reward when a member cashes one in.

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
      const search = event.queryStringParameters?.search;
      let url = `${SUPABASE_URL}/rest/v1/loyalty_members?order=last_order_at.desc.nullslast`;
      if (search) {
        const q = encodeURIComponent(`%${search}%`);
        url = `${SUPABASE_URL}/rest/v1/loyalty_members?or=(name.ilike.${q},email.ilike.${q},phone.ilike.${q})&order=last_order_at.desc.nullslast`;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(await res.text());
      const members = await res.json();
      return { statusCode: 200, body: JSON.stringify(members) };
    } catch (err) {
      console.error('admin-loyalty GET error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    // Redeem a reward — decrements rewards_earned, increments rewards_redeemed
    try {
      const { member_id } = JSON.parse(event.body);
      if (!member_id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'member_id is required' }) };
      }

      const getRes = await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members?id=eq.${member_id}&limit=1`, { headers });
      const [member] = await getRes.json();
      if (!member) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Member not found' }) };
      }
      if (member.rewards_earned <= member.rewards_redeemed) {
        return { statusCode: 400, body: JSON.stringify({ error: 'No unredeemed rewards for this member' }) };
      }

      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members?id=eq.${member_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ rewards_redeemed: member.rewards_redeemed + 1 }),
      });
      if (!patchRes.ok) throw new Error(await patchRes.text());

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      console.error('admin-loyalty POST error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
