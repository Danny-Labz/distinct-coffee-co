// netlify/functions/sms-webhook.js
// Receives inbound SMS replies from Twilio (STOP, START, HELP, and anything
// else). Twilio's carrier network already auto-blocks future sends to a
// number that replied STOP — that part happens regardless of this code.
// This function's job is to also reflect that opt-out inside our own
// database (loyalty_members), so a member who texted STOP is correctly
// shown as opted out in admin, and to reply to HELP with real information
// instead of relying on Twilio's generic default response.
//
// Twilio sends this as application/x-www-form-urlencoded, not JSON, and
// expects a TwiML (XML) response back, not JSON.

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function twimlResponse(message) {
  const escaped = message
    ? message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : '';
  const body = message
    ? `<Response><Message>${escaped}</Message></Response>`
    : `<Response></Response>`;
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Twilio sends form-encoded data, e.g. "From=%2B17865551234&Body=STOP"
    const params = new URLSearchParams(event.body);
    const from = params.get('From') || '';
    const bodyText = (params.get('Body') || '').trim().toUpperCase();
    const phone = normalizePhone(from);

    if (!phone) {
      return twimlResponse(''); // nothing we can do without a number
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    };

    const STOP_KEYWORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
    const START_KEYWORDS = ['START', 'UNSTOP'];
    const YES_KEYWORDS = ['YES', '1'];
    const HELP_KEYWORDS = ['HELP', 'INFO'];

    if (STOP_KEYWORDS.includes(bodyText)) {
      // Mark this member opted out in our own records too, so admin sees
      // accurate status. Twilio/the carrier handles the actual message
      // blocking independently of this — this is just keeping our data
      // in sync with that reality.
      const res = await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members?phone=eq.${encodeURIComponent(phone)}`, { headers });
      const members = await res.json();
      if (members.length) {
        await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members?phone=eq.${encodeURIComponent(phone)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ sms_opted_out: true, sms_consented: false }),
        });
      }
      // Twilio auto-sends its own STOP confirmation for most number types,
      // so we reply with nothing to avoid sending a duplicate message.
      return twimlResponse('');
    }

    if (START_KEYWORDS.includes(bodyText)) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members?phone=eq.${encodeURIComponent(phone)}`, { headers });
      const members = await res.json();
      if (members.length) {
        await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members?phone=eq.${encodeURIComponent(phone)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ sms_opted_out: false }),
        });
      }
      return twimlResponse('Distinct. Coffee Co: You are re-subscribed to order texts. Reply STOP to opt out anytime.');
    }

    if (YES_KEYWORDS.includes(bodyText)) {
      // Consent specifically for non-transactional (loyalty) messages —
      // order confirmations always send regardless of this flag, since
      // those are transactional and tied to something the customer just did.
      const res = await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members?phone=eq.${encodeURIComponent(phone)}`, { headers });
      const members = await res.json();

      if (members.length) {
        await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members?phone=eq.${encodeURIComponent(phone)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ sms_consented: true, sms_opted_out: false }),
        });
      } else {
        // Someone replied YES before ever checking the loyalty box on an
        // order — create a bare record so their consent is captured and
        // matched up automatically if they enroll properly later (same
        // phone-based lookup process-loyalty.js already uses).
        await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone, sms_consented: true, sms_opted_out: false }),
        });
      }
      return twimlResponse('Distinct. Coffee Co: You\'re in! We\'ll text you about loyalty rewards. Reply STOP to opt out anytime.');
    }

    if (HELP_KEYWORDS.includes(bodyText)) {
      return twimlResponse('Distinct. Coffee Co: We send order confirmations and loyalty updates. Msg & data rates may apply. Reply STOP to opt out. Questions? distinctcoffeeco.com');
    }

    // Anything else — no automated reply needed
    return twimlResponse('');

  } catch (err) {
    console.error('sms-webhook error:', err);
    return twimlResponse('');
  }
};
