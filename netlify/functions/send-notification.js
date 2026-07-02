// netlify/functions/send-notification.js
// Called after every new order or inquiry to email Danny

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL   = 'Danny@DistinctCoffeeCo.com';
const FROM_EMAIL     = 'onboarding@resend.dev'; // Update to orders@distinctcoffeeco.com once domain is verified

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { type, data } = JSON.parse(event.body);

    let subject, html;

    if (type === 'order') {
      const items = data.items
        ? Object.values(data.items).map(i => `${i.name} ×${i.qty} — $${(i.price * i.qty / 100).toFixed(2)}`).join('<br>')
        : '—';
      const addons = data.addons && data.addons.length ? data.addons.join(', ') : 'None';
      const total  = data.total_cents ? `$${(data.total_cents / 100).toFixed(2)}` : '—';

      subject = `☕ New Order — ${data.customer_name} · PIN ${data.pickup_pin || '—'}`;
      html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0a0a0a;">
          <div style="background:#0a0a0a;padding:24px 32px;">
            <p style="color:#f8f6f2;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0;">Distinct. Coffee Co.</p>
            <p style="color:rgba(248,246,242,0.4);font-size:10px;letter-spacing:1px;margin:4px 0 0;">New Order Received</p>
          </div>
          <div style="padding:32px;">
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;width:120px;letter-spacing:1px;text-transform:uppercase;">Customer</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;font-weight:600;">${data.customer_name || '—'}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;">${data.email || '—'}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;">${data.phone || '—'}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">Event</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;">${data.event_name || '—'} · ${data.event_date || ''}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">Pickup</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;">${data.pickup_time || '—'}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">Milk</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;">${data.milk_pref || '—'} · ${data.temp_pref || '—'}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">Add-ons</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;">${addons}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">Payment</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;">${data.payment_method === 'pay_at_event' ? 'Pay at Event' : 'Paid Online'}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">PIN</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:20px;font-weight:700;letter-spacing:6px;font-family:monospace;">${data.pickup_pin || '—'}</td></tr>
              ${data.notes ? `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">Notes</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;">${data.notes}</td></tr>` : ''}
            </table>

            <div style="background:#f8f6f2;padding:20px 24px;border-radius:2px;margin-bottom:24px;">
              <p style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Order Items</p>
              <p style="font-size:13px;line-height:2;margin:0;">${items}</p>
              <p style="font-size:16px;font-weight:700;margin:16px 0 0;border-top:1px solid #ddd;padding-top:12px;">Total: ${total}</p>
            </div>

            <a href="https://distinctcoffeeco.com/admin.html" style="display:inline-block;background:#0a0a0a;color:#f8f6f2;text-decoration:none;padding:13px 28px;font-size:9px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;border-radius:2px;">View in Admin →</a>
          </div>
          <div style="padding:20px 32px;border-top:1px solid #eee;">
            <p style="font-size:10px;color:#aaa;margin:0;">Distinct. Coffee Co. · distinctcoffeeco.com</p>
          </div>
        </div>`;

    } else if (type === 'inquiry') {
      subject = `📬 New Inquiry — ${data.name} · ${data.event_type || 'Event'}`;
      html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0a0a0a;">
          <div style="background:#0a0a0a;padding:24px 32px;">
            <p style="color:#f8f6f2;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0;">Distinct. Coffee Co.</p>
            <p style="color:rgba(248,246,242,0.4);font-size:10px;letter-spacing:1px;margin:4px 0 0;">New Inquiry Received</p>
          </div>
          <div style="padding:32px;">
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;width:120px;letter-spacing:1px;text-transform:uppercase;">Name</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;font-weight:600;">${data.name || '—'}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;">${data.email || '—'}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;">${data.phone || '—'}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">Event Type</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;">${data.event_type || '—'}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">Guests</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;">${data.guests || '—'}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">Event Date</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;">${data.event_date || '—'}</td></tr>
            </table>

            <div style="background:#f8f6f2;padding:20px 24px;border-radius:2px;margin-bottom:24px;">
              <p style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">Message</p>
              <p style="font-size:13px;line-height:1.8;margin:0;">${data.message || '—'}</p>
            </div>

            <a href="https://distinctcoffeeco.com/admin.html" style="display:inline-block;background:#0a0a0a;color:#f8f6f2;text-decoration:none;padding:13px 28px;font-size:9px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;border-radius:2px;">View in Admin →</a>
          </div>
          <div style="padding:20px 32px;border-top:1px solid #eee;">
            <p style="font-size:10px;color:#aaa;margin:0;">Distinct. Coffee Co. · distinctcoffeeco.com</p>
          </div>
        </div>`;
    } else {
      return { statusCode: 400, body: 'Invalid type' };
    }

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      NOTIFY_EMAIL,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error('Notification error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
