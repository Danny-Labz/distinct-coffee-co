// netlify/functions/send-notification.js
// Sends emails to both Danny and the customer on new orders/inquiries

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL   = 'Danny@DistinctCoffeeCo.com';
const FROM_EMAIL     = 'orders@distinctcoffeeco.com';

async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend error: ${await res.text()}`);
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { type, data } = JSON.parse(event.body);

    // ── SHARED STYLES ────────────────────────────────────
    const header = (subtitle) => `
      <div style="background:#0a0a0a;padding:24px 32px;">
        <p style="color:#f8f6f2;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0;">Distinct. Coffee Co.</p>
        <p style="color:rgba(248,246,242,0.4);font-size:10px;letter-spacing:1px;margin:4px 0 0;">${subtitle}</p>
      </div>`;

    const footer = `
      <div style="padding:20px 32px;border-top:1px solid #eee;">
        <p style="font-size:10px;color:#aaa;margin:0;">Distinct. Coffee Co. · distinctcoffeeco.com · orders@distinctcoffeeco.com</p>
      </div>`;

    const row = (label, value) => value ? `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;width:130px;letter-spacing:1px;text-transform:uppercase;">${label}</td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:13px;">${value}</td>
      </tr>` : '';

    const adminBtn = `<a href="https://distinctcoffeeco.com/admin.html" style="display:inline-block;background:#0a0a0a;color:#f8f6f2;text-decoration:none;padding:13px 28px;font-size:9px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;border-radius:2px;">View in Admin →</a>`;

    // ── ORDER EMAILS ──────────────────────────────────────
    if (type === 'order') {
      const items    = data.items
        ? Object.values(data.items).map(i => `${i.name} ×${i.qty} — $${(i.price * i.qty / 100).toFixed(2)}`).join('<br>')
        : '—';
      const addons   = data.addons && data.addons.length ? data.addons.join(', ') : 'None';
      const total    = data.total_cents ? `$${(data.total_cents / 100).toFixed(2)}` : '—';
      const payLabel = data.payment_method === 'pay_at_event' ? 'Pay at Event (cash or card)' : 'Paid Online';
      const pin      = data.pickup_pin || '—';

      // Email to Danny
      const adminSubject = `☕ New Order — ${data.customer_name} · PIN ${pin}`;
      const adminHtml = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0a0a0a;">
          ${header('New Order Received')}
          <div style="padding:32px;">
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
              ${row('Customer', `<strong>${data.customer_name}</strong>`)}
              ${row('Email', data.email)}
              ${row('Phone', data.phone)}
              ${row('Event', `${data.event_name} · ${data.event_date}`)}
              ${row('Pickup', data.pickup_time)}
              ${row('Milk / Temp', `${data.milk_pref} · ${data.temp_pref}`)}
              ${row('Add-ons', addons)}
              ${row('Payment', payLabel)}
              ${row('Notes', data.notes)}
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">PIN</td>
                <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:22px;font-weight:700;letter-spacing:8px;font-family:monospace;">${pin}</td>
              </tr>
            </table>
            <div style="background:#f8f6f2;padding:20px 24px;border-radius:2px;margin-bottom:24px;">
              <p style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Order Items</p>
              <p style="font-size:13px;line-height:2;margin:0;">${items}</p>
              <p style="font-size:16px;font-weight:700;margin:16px 0 0;border-top:1px solid #ddd;padding-top:12px;">Total: ${total}</p>
            </div>
            ${adminBtn}
          </div>
          ${footer}
        </div>`;

      // Email to customer
      const customerSubject = `Your order is confirmed — Distinct. Coffee Co.`;
      const customerHtml = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0a0a0a;">
          ${header('Order Confirmed')}
          <div style="padding:32px;">
            <p style="font-size:15px;font-weight:300;margin:0 0 8px;">Hi ${data.customer_name?.split(' ')[0] || 'there'},</p>
            <p style="font-size:13px;color:#555;line-height:1.8;margin:0 0 28px;">Your order is confirmed for <strong>${data.event_name}</strong>. Show your pickup PIN when you arrive and we'll have everything ready.</p>

            <div style="background:#0a0a0a;border-radius:4px;padding:28px;text-align:center;margin-bottom:28px;">
              <p style="color:rgba(248,246,242,0.4);font-size:9px;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px;">Your Pickup PIN</p>
              <p style="color:#f8f6f2;font-size:42px;font-weight:700;letter-spacing:14px;font-family:monospace;margin:0;">${pin}</p>
              <p style="color:rgba(248,246,242,0.35);font-size:10px;margin:12px 0 0;">Show this at your pickup window · No receipt needed</p>
            </div>

            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
              ${row('Event', `${data.event_name} · ${data.event_date}`)}
              ${row('Pickup Time', data.pickup_time)}
              ${row('Milk / Temp', `${data.milk_pref} · ${data.temp_pref}`)}
              ${addons !== 'None' ? row('Add-ons', addons) : ''}
              ${row('Payment', payLabel)}
            </table>

            <div style="background:#f8f6f2;padding:20px 24px;border-radius:2px;margin-bottom:24px;">
              <p style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Your Order</p>
              <p style="font-size:13px;line-height:2;margin:0;">${items}</p>
              <p style="font-size:15px;font-weight:600;margin:16px 0 0;border-top:1px solid #ddd;padding-top:12px;">Total: ${total}</p>
            </div>

            ${data.payment_method === 'pay_at_event'
              ? `<div style="background:#fff8e1;border-left:3px solid #f57f17;padding:14px 18px;border-radius:2px;margin-bottom:24px;font-size:12px;color:#555;line-height:1.7;">
                  <strong>Reminder:</strong> Payment is due at pickup — we accept cash or card on the day.
                </div>`
              : `<div style="background:#e8f5e9;border-left:3px solid #2e7d32;padding:14px 18px;border-radius:2px;margin-bottom:24px;font-size:12px;color:#555;line-height:1.7;">
                  ✓ Payment confirmed. Nothing to do on the day except show your PIN.
                </div>`
            }

            <p style="font-size:12px;color:#888;line-height:1.8;">Questions? Reply to this email or reach us at <a href="mailto:Danny@DistinctCoffeeCo.com" style="color:#0a0a0a;">Danny@DistinctCoffeeCo.com</a></p>
          </div>
          ${footer}
        </div>`;

      // Send both emails in parallel
      await Promise.all([
        sendEmail(NOTIFY_EMAIL, adminSubject, adminHtml),
        sendEmail(data.email, customerSubject, customerHtml),
      ]);

    // ── INQUIRY EMAILS ────────────────────────────────────
    } else if (type === 'inquiry') {

      // Email to Danny
      const adminSubject = `📬 New Inquiry — ${data.name} · ${data.event_type || 'Event'}`;
      const adminHtml = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0a0a0a;">
          ${header('New Inquiry Received')}
          <div style="padding:32px;">
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
              ${row('Name', `<strong>${data.name}</strong>`)}
              ${row('Email', data.email)}
              ${row('Phone', data.phone)}
              ${row('Event Type', data.event_type)}
              ${row('Guests', data.guests)}
              ${row('Event Date', data.event_date)}
            </table>
            <div style="background:#f8f6f2;padding:20px 24px;border-radius:2px;margin-bottom:24px;">
              <p style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">Message</p>
              <p style="font-size:13px;line-height:1.8;margin:0;">${data.message || '—'}</p>
            </div>
            ${adminBtn}
          </div>
          ${footer}
        </div>`;

      // Email to customer
      const customerSubject = `We received your inquiry — Distinct. Coffee Co.`;
      const customerHtml = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0a0a0a;">
          ${header('Inquiry Received')}
          <div style="padding:32px;">
            <p style="font-size:15px;font-weight:300;margin:0 0 8px;">Hi ${data.name?.split(' ')[0] || 'there'},</p>
            <p style="font-size:13px;color:#555;line-height:1.8;margin:0 0 28px;">Thanks for reaching out! Danny will get back to you within 24 hours. Here's a copy of what you submitted for your records.</p>

            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
              ${row('Name', data.name)}
              ${row('Email', data.email)}
              ${row('Phone', data.phone)}
              ${row('Event Type', data.event_type)}
              ${row('Guests', data.guests)}
              ${row('Event Date', data.event_date)}
            </table>

            <div style="background:#f8f6f2;padding:20px 24px;border-radius:2px;margin-bottom:24px;">
              <p style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">Your Message</p>
              <p style="font-size:13px;line-height:1.8;margin:0;">${data.message || '—'}</p>
            </div>

            <p style="font-size:12px;color:#888;line-height:1.8;">In the meantime, feel free to follow us on Instagram <a href="https://instagram.com/distinct.coffeeco" style="color:#0a0a0a;">@distinct.coffeeco</a> or reply directly to this email with any questions.</p>
          </div>
          ${footer}
        </div>`;

      await Promise.all([
        sendEmail(NOTIFY_EMAIL, adminSubject, adminHtml),
        sendEmail(data.email, customerSubject, customerHtml),
      ]);

    } else {
      return { statusCode: 400, body: 'Invalid type' };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };

  } catch (err) {
    console.error('Notification error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
