// netlify/functions/create-checkout.js
// ─────────────────────────────────────────────
// Runs on Netlify's servers — your Stripe secret
// key is NEVER exposed to the browser.
// ─────────────────────────────────────────────

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { order_id, items, addons, customer_email, event_name } = JSON.parse(event.body);

    // Build Stripe line items from cart
    const lineItems = Object.values(items).map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: `Distinct. Coffee Co. — ${event_name}`,
        },
        unit_amount: item.price, // already in cents
      },
      quantity: item.qty,
    }));

    // Add add-ons as line items
    const addonPrices = {
      'Extra Shot':      100,
      'Vanilla Syrup':    75,
      'Caramel Syrup':    75,
      'Hazelnut Syrup':   75,
    };

    addons.forEach(addon => {
      if (addonPrices[addon]) {
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: { name: addon },
            unit_amount: addonPrices[addon],
          },
          quantity: 1,
        });
      }
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email,
      line_items: lineItems,
      metadata: { order_id },
      success_url: `${process.env.SITE_URL}/confirmation.html?order_id=${order_id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.SITE_URL}/order.html`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error('Stripe error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
