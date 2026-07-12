// netlify/functions/stripe-webhook.js
// Stripe calls this automatically when a payment succeeds.
// It updates the matching order in Supabase to status: 'paid'.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL      = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqc2l0cXZmaW13aXVvb2pzb2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzAwNzUsImV4cCI6MjA5ODUwNjA3NX0.p2qXO5-Z6uWd7n7slhHJT_s2NDvjRlsOMQLqCRxFIcU';

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    // Verify the webhook actually came from Stripe using the signing secret
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // We only care about successful checkout completions
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const orderId = session.metadata?.order_id;

    if (orderId) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            status: 'paid',
            stripe_session: session.id,
          }),
        });
        console.log(`Order ${orderId} marked as paid.`);
      } catch (err) {
        console.error('Failed to update order status:', err);
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
