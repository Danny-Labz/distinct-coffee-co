// netlify/functions/admin-customers.js
// SECURED (service role key): aggregates order history into one profile per
// customer, grouped by normalized email/phone (same matching logic as
// process-loyalty.js), and cross-references loyalty_members data for
// anyone who's also enrolled in the rewards program.

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : '';
}

function countDrinksInOrder(items) {
  if (!items) return 0;
  return Object.values(items).reduce((sum, val) => {
    return sum + (Array.isArray(val) ? val.length : (val.qty || 0));
  }, 0);
}

// Flattens order.items (both legacy {qty} shape and current array shape)
// into a flat list of drink names, so we can compute each customer's
// favorite drink.
function drinkNamesInOrder(items) {
  if (!items) return [];
  const names = [];
  Object.values(items).forEach(val => {
    if (Array.isArray(val)) {
      val.forEach(d => names.push(d.name));
    } else if (val && typeof val === 'object') {
      for (let i = 0; i < (val.qty || 0); i++) names.push(val.name);
    }
  });
  return names;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  };

  try {
    // Pull every real order — same status filter as loyalty processing,
    // so "customer" means someone with a genuine committed sale, not an
    // abandoned pending order.
    const ordersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?status=in.(paid,reserved,fulfilled)&order=created_at.desc&select=*`,
      { headers }
    );
    if (!ordersRes.ok) throw new Error(await ordersRes.text());
    const orders = await ordersRes.json();

    // Pull all loyalty members once, keyed by normalized phone/email for
    // fast lookup while grouping orders below.
    const loyaltyRes = await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members?select=*`, { headers });
    if (!loyaltyRes.ok) throw new Error(await loyaltyRes.text());
    const loyaltyMembers = await loyaltyRes.json();

    const loyaltyByPhone = {};
    const loyaltyByEmail = {};
    loyaltyMembers.forEach(m => {
      if (m.phone) loyaltyByPhone[normalizePhone(m.phone)] = m;
      if (m.email) loyaltyByEmail[normalizeEmail(m.email)] = m;
    });

    // Group orders by identifier — email first, then phone, matching the
    // exact precedence process-loyalty.js uses so "the same customer"
    // means the same thing everywhere in the app.
    const customers = {}; // key -> aggregate record

    orders.forEach(o => {
      const email = normalizeEmail(o.email);
      const phone = normalizePhone(o.phone);
      const key = email || phone;
      if (!key) return; // anonymous walk-up order with no identifier — can't attribute to a customer

      if (!customers[key]) {
        customers[key] = {
          key,
          name: o.customer_name || 'Unknown',
          email: o.email || '',
          phone: o.phone || '',
          orderCount: 0,
          totalSpentCents: 0,
          drinkCounts: {},
          firstOrderAt: o.created_at,
          lastOrderAt: o.created_at,
          orders: [],
        };
      }

      const c = customers[key];
      c.orderCount += 1;
      c.totalSpentCents += o.total_cents || 0;
      // Most recent name/contact wins, in case it changed across visits
      if (o.created_at > c.lastOrderAt) {
        c.name = o.customer_name || c.name;
        c.email = o.email || c.email;
        c.phone = o.phone || c.phone;
        c.lastOrderAt = o.created_at;
      }
      if (o.created_at < c.firstOrderAt) c.firstOrderAt = o.created_at;

      drinkNamesInOrder(o.items).forEach(name => {
        c.drinkCounts[name] = (c.drinkCounts[name] || 0) + 1;
      });

      c.orders.push({
        id: o.id,
        created_at: o.created_at,
        event_name: o.event_name,
        pickup_time: o.pickup_time,
        total_cents: o.total_cents,
        status: o.status,
        pickup_pin: o.pickup_pin,
        drinkCount: countDrinksInOrder(o.items),
      });
    });

    // Attach loyalty data and compute favorite drink for each customer
    const result = Object.values(customers).map(c => {
      let favoriteDrink = null;
      let favoriteCount = 0;
      Object.entries(c.drinkCounts).forEach(([name, count]) => {
        if (count > favoriteCount) { favoriteDrink = name; favoriteCount = count; }
      });

      const loyalty = (c.email && loyaltyByEmail[c.email])
        || (c.phone && loyaltyByPhone[c.phone])
        || null;

      return {
        key: c.key,
        name: c.name,
        email: c.email,
        phone: c.phone,
        orderCount: c.orderCount,
        totalSpentCents: c.totalSpentCents,
        favoriteDrink,
        firstOrderAt: c.firstOrderAt,
        lastOrderAt: c.lastOrderAt,
        orders: c.orders,
        loyalty: loyalty ? {
          punchCount: loyalty.punch_count,
          totalDrinks: loyalty.total_drinks,
          rewardsEarned: loyalty.rewards_earned,
          rewardsRedeemed: loyalty.rewards_redeemed,
          smsOptedOut: loyalty.sms_opted_out || false,
        } : null,
      };
    });

    // Most recent activity first
    result.sort((a, b) => new Date(b.lastOrderAt) - new Date(a.lastOrderAt));

    return { statusCode: 200, body: JSON.stringify(result) };

  } catch (err) {
    console.error('admin-customers error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
