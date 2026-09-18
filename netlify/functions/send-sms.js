// netlify/functions/send-sms.js
// Sends an order confirmation SMS via Twilio's REST API directly (no SDK
// needed — one HTTP call, consistent with how the other integrations here
// are built). Called from the same place the confirmation email fires, so
// SMS and email always go out together, exactly once per real order.

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

    // Assume US numbers if no country code was given
    const toFormatted = digits.startsWith('+') ? digits : `+1${digits.replace(/\D/g, '')}`;

    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const params = new URLSearchParams({
      To:   toFormatted,
      From: TWILIO_PHONE_NUMBER,
      Body: message,
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
