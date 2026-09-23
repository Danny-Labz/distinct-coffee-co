// netlify/functions/send-sms.js
// Sends an order confirmation SMS via Twilio's REST API directly (no SDK
// needed — one HTTP call, consistent with how the other integrations here
// are built). Called from the same place the confirmation email fires, so
// SMS and email always go out together, exactly once per real order.
//
// Every order-confirmation SMS always sends regardless of consent status —
// it's transactional, tied to something the customer just did. But the
// FIRST message ever sent to a given phone number gets a consent line
// appended ("Reply YES for future order & loyalty texts"), so future
// non-transactional messages (like a loyalty reward notice) have a real
// opt-in to point to, per how the Twilio campaign is registered.

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const TWILIO_ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

  try {
    const { to, message } = JSON.parse(event.body);

    if (!to || !message) {
      return { statusCode: 400, body: JSON.stringify({ error: 'to and message are required' }) };
    }

    // Basic normalization — require a phone number with at least 10 digits.
    // If it doesn't look like a real number, skip silently rather than fail
    // the whole order over a malformed phone field.
    const digits = to.replace(/[^\d+]/g, '');
    if (digits.replace(/\D/g, '').length < 10) {
      return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'invalid phone number' }) };
    }

    const normalized = normalizePhone(to);
    const supaHeaders = { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` };

    let finalMessage = message;

    // Belt-and-suspenders: carrier-level STOP blocking happens regardless of
    // this check, but we also honor our own opt-out record so this never
    // even attempts a send to someone who's told us to stop. Also doubles
    // as our "have we ever contacted this number before" lookup.
    let existingMember = null;
    try {
      const lookupRes = await fetch(
        `${SUPABASE_URL}/rest/v1/loyalty_members?phone=eq.${encodeURIComponent(normalized)}&select=id,sms_opted_out,sms_consented`,
        { headers: supaHeaders }
      );
      const matches = await lookupRes.json();
      if (matches.length) {
        existingMember = matches[0];
        if (existingMember.sms_opted_out) {
          return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'recipient opted out' }) };
        }
      }
    } catch (lookupErr) {
      console.warn('Opt-out lookup failed, proceeding with send:', lookupErr);
      // Don't block a legitimate send over a lookup hiccup — carrier-level
      // STOP enforcement is still the backstop either way.
    }

    if (!existingMember) {
      // First message ever to this number — append the consent request and
      // create a bare tracking record so we don't ask again on their next order.
      finalMessage = `${message} Reply YES for future order & loyalty texts.`;
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members`, {
          method: 'POST',
          headers: supaHeaders,
          body: JSON.stringify({ phone: normalized, sms_consented: false, sms_opted_out: false }),
        });
      } catch (createErr) {
        console.warn('Could not create tracking record for new phone number:', createErr);
        // Not fatal — worst case we ask for consent again next time.
      }
    }

    // Assume US numbers if no country code was given
    const toFormatted = digits.startsWith('+') ? digits : `+1${digits.replace(/\D/g, '')}`;

    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const params = new URLSearchParams({
      To:   toFormatted,
      From: TWILIO_PHONE_NUMBER,
      Body: finalMessage,
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );

    const result = await res.json();

    if (!res.ok) {
      console.error('Twilio error:', result);
      // Don't fail the caller's flow over an SMS delivery issue — email is
      // the reliable fallback. Just report it so it shows in function logs.
      return { statusCode: 200, body: JSON.stringify({ sent: false, error: result.message || 'Twilio send failed' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ sent: true, sid: result.sid }) };

  } catch (err) {
    console.error('send-sms error:', err);
    return { statusCode: 200, body: JSON.stringify({ sent: false, error: err.message }) };
  }
};
