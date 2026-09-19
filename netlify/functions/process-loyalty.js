// netlify/functions/process-loyalty.js
// Called once per order that opted into loyalty. Finds or creates a
// loyalty_members record by email/phone (whichever was given), then adds
// one punch per drink in the order. Every 10th punch triggers a free
// reward — count resets to 0, rewards_earned increments so staff can see
// it's owed next visit.

const SUPABASE_URL = 'https://qjsitqvfimwiuoojsoge.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PUNCHES_PER_REWARD = 10;

function countDrinksInOrder(items) {
  if (!items) return 0;
  return Object.values(items).reduce((sum, val) => {
    return sum + (Array.isArray(val) ? val.length : (val.qty || 0));
  }, 0);
}

// Normalize so "(305) 505-0002" and "3055050002" and "+13055050002" all
// match the same member instead of silently creating duplicates. Keeps the
// last 10 digits, which handles a leading US country code consistently.
function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : '';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const name = body.name;
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    const items = body.items;
    const total_cents = body.total_cents;

    if (!email && !phone) {
      return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'no identifier provided' }) };
    }

    const drinkCount = countDrinksInOrder(items);
    if (drinkCount <= 0) {
      return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'no drinks in order' }) };
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    };

    // Find existing member by whichever identifier was given — email first,
    // then phone, so a member found by either method is treated as the
    // same person on subsequent visits.
    let existing = null;
    if (email) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members?email=eq.${encodeURIComponent(email)}&limit=1`, { headers });
      const rows = await res.json();
      if (rows.length) existing = rows[0];
    }
    if (!existing && phone) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members?phone=eq.${encodeURIComponent(phone)}&limit=1`, { headers });
      const rows = await res.json();
      if (rows.length) existing = rows[0];
    }

    let newPunchCount, rewardEarnedThisOrder = false;

    if (existing) {
      // Add this order's drinks to their running punch count, rolling over
      // into a reward each time they cross the threshold. Handles orders
      // of more than 1 drink correctly even if it crosses multiple rewards.
      let punches = existing.punch_count + drinkCount;
      let rewardsThisOrder = 0;
      while (punches >= PUNCHES_PER_REWARD) {
        punches -= PUNCHES_PER_REWARD;
        rewardsThisOrder += 1;
      }
      newPunchCount = punches;
      rewardEarnedThisOrder = rewardsThisOrder > 0;

      await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members?id=eq.${existing.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name:               name || existing.name,
          email:              email || existing.email,
          phone:              phone || existing.phone,
          punch_count:        newPunchCount,
          total_drinks:       existing.total_drinks + drinkCount,
          total_spent_cents:  existing.total_spent_cents + (total_cents || 0),
          rewards_earned:     existing.rewards_earned + rewardsThisOrder,
          last_order_at:      new Date().toISOString(),
        }),
      });

    } else {
      // First-time member — same rollover logic starting from zero
      let punches = drinkCount;
      let rewardsThisOrder = 0;
      while (punches >= PUNCHES_PER_REWARD) {
        punches -= PUNCHES_PER_REWARD;
        rewardsThisOrder += 1;
      }
      newPunchCount = punches;
      rewardEarnedThisOrder = rewardsThisOrder > 0;

      await fetch(`${SUPABASE_URL}/rest/v1/loyalty_members`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name, email, phone,
          punch_count:       newPunchCount,
          total_drinks:      drinkCount,
          total_spent_cents: total_cents || 0,
          rewards_earned:    rewardsThisOrder,
          last_order_at:     new Date().toISOString(),
        }),
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, punch_count: newPunchCount, reward_earned: rewardEarnedThisOrder }),
    };

  } catch (err) {
    console.error('process-loyalty error:', err);
    // Never fail the caller's order flow over a loyalty processing issue —
    // the order itself is already saved and confirmed by this point.
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
