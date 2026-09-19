// netlify/functions/parse-receipt.js
// Sends a photographed receipt to Claude's vision API and extracts
// structured line items (name, price, quantity) as JSON. This is
// extraction only — nothing gets written to Supabase here. The admin
// review screen decides what to do with each line before anything is
// saved, so a bad read never silently corrupts ingredient costs.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  try {
    const { image_base64, media_type } = JSON.parse(event.body);

    if (!image_base64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'image_base64 is required' }) };
    }

    const prompt = `You are looking at a photo of a store receipt for coffee shop supplies (milk, cups, syrups, coffee beans, etc). Extract every purchasable line item you can read.

For each item, return:
- "raw_text": the item description exactly as printed on the receipt
- "price_cents": the line price in cents (integer, e.g. $19.95 -> 1995). Use the line total if a quantity was purchased (e.g. "2 @ $4.99" -> price_cents for the full line, and quantity: 2).
- "quantity": how many of that item were purchased on this line (integer, default 1 if not specified)

Skip subtotal, tax, and total lines — only include actual purchased items.

Respond with ONLY a JSON array, no other text, no markdown code fences. Example format:
[{"raw_text":"OATMILK HALF GAL","price_cents":499,"quantity":2},{"raw_text":"VANILLA SYRUP 1L","price_cents":1995,"quantity":1}]

If you cannot read the receipt clearly enough to extract items, respond with exactly: []`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: media_type || 'image/jpeg',
                  data: image_base64,
                },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Anthropic API error:', errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not read receipt — please try again or enter items manually.' }) };
    }

    const result = await res.json();
    const textBlock = result.content?.find(c => c.type === 'text');
    const rawText = textBlock ? textBlock.text.trim() : '[]';

    // Claude should return pure JSON per the prompt, but strip markdown
    // fences defensively in case it wraps the response anyway.
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

    let items;
    try {
      items = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Could not parse Claude response as JSON:', rawText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not read receipt clearly — please try a clearer photo or enter items manually.' }) };
    }

    if (!Array.isArray(items)) items = [];

    return { statusCode: 200, body: JSON.stringify({ items }) };

  } catch (err) {
    console.error('parse-receipt error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
