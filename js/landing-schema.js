// js/landing-schema.js
// ─────────────────────────────────────────────────────────────
// Single description of everything editable on the public landing
// page. Used by BOTH admin.html (to build the "Landing Page" editor)
// and index.html (to apply saved edits). The `def` values mirror the
// markup already in index.html, so with nothing saved the site looks
// exactly as built.
//
// Field types:
//   text   — one line, plain text
//   area   — multi-line plain text
//   title  — headline: Enter = line break, *word* = emphasised word
//   lines  — one item per line (banner items, bullet lists)
// Image sections list `images`: { label, hint, max }.
// ─────────────────────────────────────────────────────────────
(function () {
  const S = [
    {
      key: 'marquee', label: 'Scrolling Banner',
      hint: 'The black strip of words that scrolls under the header.',
      fields: [
        { id: 'items', label: 'Banner items (one per line)', type: 'lines', rows: 8,
          def: 'Espresso Drinks\nCold Brew\nMatcha\nIced Teas\nCorporate Events\nWeddings\nPrivate Parties\nSourced Origins' },
      ],
    },
    {
      key: 'hero', label: 'Hero (top of page)',
      hint: 'The big headline and photo at the top of the page.',
      images: { label: 'Hero photos', max: 8,
        hint: 'Shown beside the headline on desktop. Add more than one and they fade between each other automatically.' },
      fields: [
        { id: 'title', label: 'Headline', type: 'title', rows: 4, def: 'Coffee\n*crafted*\nfor every\noccasion.' },
        { id: 'desc', label: 'Description', type: 'area', rows: 3,
          def: 'Premium espresso drinks, cold brew, matcha, and more — brought directly to your event. Sourced from the finest origins, served with precision.' },
        { id: 'cta', label: 'Button text', type: 'text', def: 'Pre-Order for Next Event' },
      ],
    },
    {
      key: 'about', label: 'About / Our Story',
      hint: 'Story text and the three numbers. On desktop, photos replace the bean pattern on the left.',
      images: { label: 'About photos', max: 8,
        hint: 'Replaces the bean pattern beside the story on desktop. Several photos become a slideshow.' },
      fields: [
        { id: 'eyebrow', label: 'Small label', type: 'text', def: 'Our Story' },
        { id: 'title', label: 'Headline', type: 'title', rows: 2, def: 'More than\n*coffee.*' },
        { id: 'p1', label: 'Paragraph 1', type: 'area', rows: 3,
          def: 'Distinct. Coffee Co. serves handcrafted specialty coffee with an emphasis on quality, simplicity, and connection.' },
        { id: 'p2', label: 'Paragraph 2', type: 'area', rows: 4,
          def: "From espresso to matcha, every drink is prepared with intention using quality ingredients and a respect for classic coffee traditions. Whether you're grabbing a coffee on the go, sharing a conversation with friends, or taking a quiet moment for yourself, we hope every cup adds something meaningful to your day." },
        { id: 'p3', label: 'Paragraph 3', type: 'area', rows: 3,
          def: 'We believe every person has a distinct story, and every drink has its own character. Together, those differences create something worth celebrating—a community where everyone belongs.' },
        { id: 'tagline', label: 'Sign-off line', type: 'text', def: 'Different Stories. One Community.' },
        { id: 's1n', label: 'Stat 1 — number', type: 'text', def: '100%' },
        { id: 's1l', label: 'Stat 1 — label', type: 'text', def: 'Mobile Setup' },
        { id: 's2n', label: 'Stat 2 — number', type: 'text', def: '∞' },
        { id: 's2l', label: 'Stat 2 — label', type: 'text', def: 'Event Types' },
        { id: 's3n', label: 'Stat 3 — number', type: 'text', def: '1' },
        { id: 's3l', label: 'Stat 3 — label', type: 'text', def: 'Standard of Quality' },
      ],
    },
    {
      key: 'menu', label: 'Menu Section',
      hint: 'Wording around the menu. The drinks themselves come from the Menu tab.',
      fields: [
        { id: 'eyebrow', label: 'Small label', type: 'text', def: 'The Menu' },
        { id: 'title', label: 'Headline', type: 'title', rows: 2, def: 'Crafted with\n*intention*' },
        { id: 'note', label: 'Note beside headline', type: 'text', def: 'Menu subject to seasonal updates & sourcing.' },
        { id: 'footnote', label: 'Line under the menu', type: 'text',
          def: 'All drinks available hot or iced · Dairy alternatives available · Custom syrups upon request' },
      ],
    },
    {
      key: 'services', label: 'Catering / What We Offer',
      hint: 'The three catering cards.',
      fields: [
        { id: 'eyebrow', label: 'Small label', type: 'text', def: 'What We Offer' },
        { id: 'title', label: 'Headline', type: 'title', rows: 2, def: 'Built for your\n*event*' },
        { id: 'note', label: 'Note beside headline', type: 'text', def: 'Every setup tailored to your scale and vision.' },
        { id: 'c1name', label: 'Card 1 — name', type: 'title', rows: 2, def: 'Corporate\nEvents' },
        { id: 'c1desc', label: 'Card 1 — description', type: 'area', rows: 3,
          def: 'Keep your team energized and clients impressed. Professional setup with zero friction.' },
        { id: 'c1items', label: 'Card 1 — bullet list (one per line)', type: 'lines', rows: 4,
          def: 'Office meetings & all-hands\nClient entertainment\nLaunch events & activations\nFull bar setup & breakdown' },
        { id: 'c2name', label: 'Card 2 — name', type: 'title', rows: 2, def: 'Weddings &\nCelebrations' },
        { id: 'c2desc', label: 'Card 2 — description', type: 'area', rows: 3,
          def: 'Make your special day unforgettable with a curated coffee experience your guests will talk about.' },
        { id: 'c2items', label: 'Card 2 — bullet list (one per line)', type: 'lines', rows: 4,
          def: 'Weddings & receptions\nRehearsal dinners\nBridal & baby showers\nCustom menu curation' },
        { id: 'c3name', label: 'Card 3 — name', type: 'title', rows: 2, def: 'Private &\nSocial' },
        { id: 'c3desc', label: 'Card 3 — description', type: 'area', rows: 3,
          def: 'From intimate gatherings to large social events, we bring the café experience to you.' },
        { id: 'c3items', label: 'Card 3 — bullet list (one per line)', type: 'lines', rows: 4,
          def: 'Birthday & milestone events\nPop-ups & markets\nCommunity gatherings\nFlexible packages' },
      ],
    },
    {
      key: 'gallery', label: 'Photo Gallery (new section)',
      hint: 'A photo section between Catering and Contact. It stays hidden until you add at least one photo.',
      images: { label: 'Gallery photos', max: 20,
        hint: 'Show off the cart and events. Add several and visitors can flip through them (arrows, dots, swipe).' },
      fields: [
        { id: 'eyebrow', label: 'Small label', type: 'text', def: 'The Cart' },
        { id: 'title', label: 'Headline', type: 'title', rows: 2, def: 'Our setup,\n*up close*' },
        { id: 'note', label: 'Note beside headline', type: 'text', def: 'Handbuilt for the road. Ready for your event.' },
      ],
    },
    {
      key: 'contact', label: 'Contact',
      hint: 'Text beside the inquiry form.',
      fields: [
        { id: 'eyebrow', label: 'Small label', type: 'text', def: 'Get In Touch' },
        { id: 'title', label: 'Headline', type: 'title', rows: 2, def: "Let's make your\nevent *distinct.*" },
        { id: 'desc', label: 'Description', type: 'area', rows: 3,
          def: "Ready to bring premium coffee to your next event? Fill out the form and we'll get back to you within 24 hours to discuss packages, availability, and customization." },
        { id: 'email', label: 'Email shown on page (display only)', type: 'text', def: 'Danny@DistinctCoffeeCo.com' },
        { id: 'service', label: 'Service line', type: 'text', def: 'Mobile — We come to you' },
      ],
    },
    {
      key: 'no_event', label: '"No Upcoming Event" Message',
      hint: 'Shown instead of the Next Event banner when no event is active.',
      fields: [
        { id: 'label', label: 'Small label', type: 'text', def: 'Coming Soon' },
        { id: 'headline', label: 'Headline', type: 'text', def: 'Something distinct is brewing.' },
        { id: 'message', label: 'Message', type: 'text', def: 'Stay tuned — our next pop-up is on its way.' },
      ],
    },
    {
      key: 'footer', label: 'Footer',
      fields: [
        { id: 'tagline', label: 'Footer tagline', type: 'text', def: 'Coffee crafted for every occasion.' },
      ],
    },
  ];

  window.LANDING_SCHEMA = S;
  window.LANDING_IMG_BASE = 'https://qjsitqvfimwiuoojsoge.supabase.co/storage/v1/object/public/site-images/';
})();
