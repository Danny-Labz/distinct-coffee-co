// netlify/functions/admin-menu-data.js
// SECURED (service role key): create/update/delete for menu_items,
// recipe_items, ingredients, and events — the admin-managed tables that
// customers only ever need to READ (menu display, recipe costing, event
// info). Reads stay on the public anon key via the existing SELECT
// policies; only writes route through here, same reasoning as addons,
// orders, and inquiries.
//
// One shared function for all four tables since they follow an identical
// shape (id-keyed CRUD, admin-only), rather than four near-duplicate files.

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ALLOWED_TABLES = new Set(['menu_items', 'recipe_items', 'ingredients', 'events']);

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  };

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { table } = body;

    if (!ALLOWED_TABLES.has(table)) {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown or disallowed table: ${table}` }) };
    }

    if (event.httpMethod === 'POST') {
      const { data } = body;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      return { statusCode: 200, body: JSON.stringify(created) };
    }

    if (event.httpMethod === 'PUT') {
      const { id, data } = body;
      if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id is required' }) };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (event.httpMethod === 'DELETE') {
      // recipe_items is often deleted by a compound filter (menu_item_id +
      // ingredient_id) rather than a single id, so accept either an id or
      // a raw filter query string built by the caller.
      const { id, filter } = body;
      let url;
      if (filter) {
        url = `${SUPABASE_URL}/rest/v1/${table}?${filter}`;
      } else if (id) {
        url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
      } else {
        return { statusCode: 400, body: JSON.stringify({ error: 'id or filter is required' }) };
      }
      const res = await fetch(url, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(await res.text());
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };

  } catch (err) {
    console.error('admin-menu-data error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
