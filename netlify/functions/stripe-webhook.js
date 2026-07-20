// netlify/functions/stripe-webhook.js
// Stripe calls this automatically when a payment succeeds.
// It updates the matching order in Supabase to status: 'paid',
// and sends the order confirmation email exactly once — right here,
// server-side, triggered only by a real confirmed payment. This is
// deliberately NOT done in the browser (order.html), because the
// browser flow can be re-triggered if a customer backs out and
// retries, which would otherwise send duplicate emails with
// duplicate PINs for what should be a single order.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL      = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqc2l0cXZmaW13aXVvb2pzb2dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MzAwNzUsImV4cCI6MjA5ODUwNjA3NX0.p2qXO5-Z6uWd7n7slhHJT_s2NDvjRlsOMQLqCRxFIcU';

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const orderId = session.metadata?.order_id;

    if (orderId) {
      try {
        // 1. Fetch the order first, so we know its current status
        const getRes = await fetch(
          `${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}&select=*`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        );
        const orders = await getRes.json();
        const order = orders && orders[0];

        if (!order) {
          console.warn(`Order ${orderId} not found — skipping.`);
          return { statusCode: 200, body: JSON.stringify({ received: true }) };
        }

        // 2. Idempotency guard — if this order is already marked paid,
        // Stripe is retrying a webhook delivery for an event we already
        // processed. Skip the email so we never send it twice.
        if (order.status === 'paid') {
          console.log(`Order ${orderId} already marked paid — skipping duplicate email.`);
          return { statusCode: 200, body: JSON.stringify({ received: true, duplicate: true }) };
        }

        // 3. Mark as paid
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

        // 4. Send the order confirmation email — exactly once, right here,
        // now that payment is genuinely confirmed.
        const siteUrl = process.env.SITE_URL || 'https://distinctcoffeeco.com';
        try {
          await fetch(`${siteUrl}/.netlify/functions/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'order',
              data: {
                event_name:     order.event_name,
                event_date:     order.event_date,
                customer_name:  order.customer_name,
                email:          order.email,
                phone:          order.phone,
                pickup_time:    order.pickup_time,
                milk_pref:      order.milk_pref,
                temp_pref:      order.temp_pref,
                addons:         order.addons,
                items:          order.items,
                total_cents:    order.total_cents,
                payment_method: order.payment_method,
                pickup_pin:     order.pickup_pin,
                notes:          order.notes,
                id:             order.id,
              },
            }),
          });
          console.log(`Confirmation email sent for order ${orderId}.`);
        } catch (emailErr) {
          console.error('Failed to send confirmation email:', emailErr);
          // Don't fail the webhook over an email issue — payment is already confirmed.
        }

      } catch (err) {
        console.error('Failed to process paid order:', err);
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
