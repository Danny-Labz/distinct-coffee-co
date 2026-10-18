// netlify/functions/admin-site-content.js
// SECURED (service role key): saves landing-page text + photos managed from
// the admin "Landing Page" tab.
//   - site_content table: public SELECT (the landing page reads it with the
//     anon key); all writes go through here.
//   - site-images storage bucket: public read; uploads/deletes only here.
//
// Because this changes what every visitor sees, requests must carry the admin
// password in the `x-admin-password` header. Set ADMIN_PASSWORD in Netlify env
// vars to change it (falls back to the current admin password).
//
// POST actions:
//   { action:'save',   key, value, removePaths? }  upsert one section
//   { action:'reset',  key }                       delete section (back to defaults)
//   { action:'upload', key, data(base64), contentType }  -> { url, path }

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'distinct2024';
const BUCKET = 'site-images';
const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

const KEYS = new Set(['marquee', 'hero', 'about', 'menu', 'services', 'gallery', 'contact', 'no_event', 'footer']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Photos that ship with the site itself (not in storage) — may appear in an image list.
const BUILTIN_IMAGES = new Set(['hero-photo.jpg']);
const ALLOWED_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const json = (statusCode, obj) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
const dbHeaders = () => ({ 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` });

async function removeFiles(paths, key) {
  // Only ever delete files inside this section's own folder.
  const safe = (paths || []).filter(p => typeof p === 'string' && p.startsWith(`${key}/`) && !p.includes('..'));
  if (!safe.length) return;
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE', headers: dbHeaders(), body: JSON.stringify({ prefixes: safe }),
    });
  } catch (e) { console.warn('Could not delete old images:', e.message); }
}

// Keep stored content to plain strings + well-formed image records.
function cleanValue(v, key) {
  const out = { fields: {}, images: [] };
  if (v && typeof v.fields === 'object') {
    for (const [k, val] of Object.entries(v.fields)) {
      if (typeof val === 'string') out.fields[String(k).slice(0, 40)] = val.slice(0, 4000);
    }
  }
  if (v && Array.isArray(v.images)) {
    for (const im of v.images.slice(0, 30)) {
      if (im && BUILTIN_IMAGES.has(im.url)) {
        out.images.push({ url: im.url, path: null, builtin: true, alt: typeof im.alt === 'string' ? im.alt.slice(0, 200) : '' });
        continue;
      }
      if (!im || typeof im.url !== 'string' || !im.url.startsWith(PUBLIC_PREFIX)) continue;
      const path = im.url.slice(PUBLIC_PREFIX.length);
      if (!path.startsWith(`${key}/`)) continue;
      out.images.push({ url: im.url, path, alt: typeof im.alt === 'string' ? im.alt.slice(0, 200) : '' });
    }
  }
  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if ((event.headers['x-admin-password'] || '') !== ADMIN_PASSWORD) return json(401, { error: 'Not authorized' });

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, key } = body;
    if (!KEYS.has(key)) return json(400, { error: 'Unknown section' });

    if (action === 'upload') {
      const ext = ALLOWED_TYPES[body.contentType];
      if (!ext) return json(400, { error: 'Only JPEG, PNG or WebP images are allowed' });
      const buf = Buffer.from(String(body.data || ''), 'base64');
      if (!buf.length) return json(400, { error: 'Empty file' });
      if (buf.length > MAX_UPLOAD_BYTES) return json(400, { error: 'Image is too large (5 MB max)' });

      const path = `${key}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': body.contentType, 'cache-control': 'max-age=31536000' },
        body: buf,
      });
      if (!res.ok) throw new Error(await res.text());
      return json(200, { url: PUBLIC_PREFIX + path, path });
    }

    if (action === 'save') {
      const value = cleanValue(body.value, key);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/site_content?on_conflict=key`, {
        method: 'POST',
        headers: { ...dbHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(await res.text());
      await removeFiles(body.removePaths, key);
      return json(200, { ok: true, value });
    }

    if (action === 'reset') {
      // Grab existing images first so their files can be cleaned up too.
      let paths = [];
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/site_content?key=eq.${key}&select=value`, { headers: dbHeaders() });
        const rows = await r.json();
        paths = ((rows[0] && rows[0].value && rows[0].value.images) || []).map(i => i.path);
      } catch (_) { /* best effort */ }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/site_content?key=eq.${key}`, { method: 'DELETE', headers: dbHeaders() });
      if (!res.ok) throw new Error(await res.text());
      await removeFiles(paths, key);
      return json(200, { ok: true });
    }

    return json(400, { error: 'Unknown action' });
  } catch (err) {
    console.error('admin-site-content error:', err.message);
    return json(500, { error: err.message });
  }
};
