// netlify/functions/create-checkout.js
// ─────────────────────────────────────────────
// Runs on Netlify's servers — your Stripe secret
// key is NEVER exposed to the browser.
//
// items format: { menuItemId: [ {name, price, label, milk, addons}, ... ] }
// Each array entry is one individually-configured drink (own name/milk/addons).
// ─────────────────────────────────────────────

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { order_id, items, customer_email, event_name } = JSON.parse(event.body);

    const addonPrices = {
      'Extra Shot':      100,
      'Vanilla Syrup':    75,
      'Caramel Syrup':    75,
      'Hazelnut Syrup':   75,
    };

    const lineItems = [];

    // Flatten every individual drink across every menu item into its own Stripe line item,
    // so the receipt reflects exactly what was configured (name, milk, add-ons).
    Object.values(items).forEach(drinkArray => {
      drinkArray.forEach(drink => {
        const extras = [drink.milk, ...(drink.addons || [])].filter(Boolean).join(', ');
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${drink.name}${drink.label ? ` (${drink.label})` : ''}`,
              description: extras
                ? `${extras} — Distinct. Coffee Co. — ${event_name}`
                : `Distinct. Coffee Co. — ${event_name}`,
            },
            unit_amount: drink.price,
          },
          quantity: 1,
        });

        // Each add-on the customer picked for this specific drink becomes its own line
        (drink.addons || []).forEach(addonName => {
          if (addonPrices[addonName]) {
            lineItems.push({
              price_data: {
                currency: 'usd',
                product_data: { name: `${addonName} (for ${drink.label || drink.name})` },
                unit_amount: addonPrices[addonName],
              },
              quantity: 1,
            });
          }
        });
      });
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
      body: JSON.stringify({ url: session.url, session_id: session.id }),
    };

  } catch (err) {
    console.error('Stripe error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
