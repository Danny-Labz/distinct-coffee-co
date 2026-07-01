<div align="center">
  <img src="social-preview.png" alt="Distinct. Coffee Co." width="600" />

  # Distinct. Coffee Co.
  **Mobile coffee catering — distinctcoffeeco.com**

  ![Netlify Status](https://img.shields.io/badge/Deployed%20on-Netlify-00C7B7?style=flat-square&logo=netlify)
  ![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square&logo=supabase)
  ![Stripe](https://img.shields.io/badge/Payments-Stripe-635BFF?style=flat-square&logo=stripe)
</div>

---

## About

Website and pre-order system for **Distinct. Coffee Co.**, a mobile coffee catering business. Customers can browse the menu, pre-order drinks for upcoming pop-up events, and pay online or reserve to pay at the event.

**Stack:**
- Frontend — Vanilla HTML/CSS/JS, hosted on Netlify
- Database — Supabase (PostgreSQL) for orders, events, and menu items
- Payments — Stripe Checkout via Netlify serverless function
- CI/CD — Auto-deploys on every push to `main`

---

## Project Structure

```
distinct-coffee-co/
├── index.html                     ← Main site (hero, menu, about, contact)
├── order.html                     ← Pre-order page (dynamic menu + cart)
├── confirmation.html              ← Post-order confirmation + pickup PIN
├── social-preview.png             ← OG image for link previews (iMessage etc.)
├── js/
│   └── order.js                   ← Cart logic, Supabase logging, Stripe redirect
├── netlify/
│   └── functions/
│       └── create-checkout.js     ← Serverless function: creates Stripe session
├── netlify.toml                   ← Netlify build + functions config
├── package.json                   ← Stripe dependency for Netlify function
└── README.md
```

---

## Supabase Tables

### `events`
Manages upcoming pop-up events. Update this table to change what appears on the site — no code changes needed.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Auto-generated |
| `name` | text | Event name (e.g. "Palmetto Farmers Market") |
| `date` | text | Display date (e.g. "Saturday, July 12") |
| `location` | text | Venue name |
| `pickup_hours` | text | Hours (e.g. "9 AM – 11 AM") |
| `is_active` | bool | `true` = show on site |
| `order_cutoff` | timestamptz | Auto-closes orders after this time |

### `menu_items`
All drink items. Toggle `is_available` to hide/show. Change `price_cents` to update pricing.

| Column | Type | Description |
|---|---|---|
| `name` | text | Drink name |
| `description` | text | Subtitle |
| `price_cents` | int8 | Price in cents (550 = $5.50) |
| `category` | text | "Espresso Bar" or "Cold Drinks" |
| `is_available` | bool | Show/hide without deleting |
| `sort_order` | int4 | Display order within category |

### `orders`
Every order placed, whether paid online or reserved for event payment.

| Column | Type | Description |
|---|---|---|
| `customer_name` | text | Full name |
| `email` / `phone` | text | Contact info |
| `event_name` / `event_date` | text | Which event |
| `pickup_time` | text | Selected pickup window |
| `items` | jsonb | Full drink order |
| `milk_pref` / `temp_pref` | text | Customizations |
| `addons` | jsonb | Add-ons selected |
| `total_cents` | int8 | Order total |
| `payment_method` | text | `pay_now` or `pay_at_event` |
| `status` | text | `pending`, `paid`, or `reserved` |
| `pickup_pin` | text | 4-digit PIN for event pickup |

---

## Environment Variables

Set these in **Netlify → Site configuration → Environment variables**:

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | From Stripe dashboard → Developers → API Keys |
| `SITE_URL` | `https://distinctcoffeeco.com` |

> ⚠️ Never commit secret keys to this repo.

---

## Local Development

```bash
# Install dependencies
npm install

# Run with Netlify Dev (includes serverless functions)
npx netlify dev
```

Requires [Netlify CLI](https://docs.netlify.com/cli/get-started/).

---

## Deployment

Push to `main` → Netlify auto-deploys. That's it.

```bash
git add .
git commit -m "your message"
git push origin main
```

---

## Day-to-Day Operations

**Adding a new event:**
1. Supabase → `events` table → Insert row
2. Set `is_active = true`, fill in details
3. Set old events to `is_active = false`
4. Site updates instantly — no deploy needed

**Updating the menu:**
- Change a price → edit `price_cents`
- Hide an item → set `is_available = false`
- Add a drink → insert a new row

**Viewing orders:**
Supabase → Table Editor → `orders`
Filter by `status`, `payment_method`, or `event_name`

---

## Contact

Danny@DistinctCoffeeCo.com
[@distinct.coffeeco](https://instagram.com/distinct.coffeeco)
[@distinct_coffee_co](https://venmo.com/distinct_coffee_co)
