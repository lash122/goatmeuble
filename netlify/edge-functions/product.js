/* Product pages, rendered at the edge — so adding a product never needs a
   rebuild and a price is never stale.
   ------------------------------------------------------------------------
   The build already writes a real p/<id>/index.html for every product that
   existed when it ran. That is correct but frozen: a product added since then
   has no page, and a price edited since then is wrong until someone rebuilds.
   Forgetting to rebuild is silent — the link still works, it just previews as
   the generic shop card, with nothing to tell you.

   So this runs first, on every /p/<id>: it fetches that one product from
   Supabase and fills the same shell the build uses, giving a page that is
   always current for any product, new or old.

   IT IS NOT LOAD-BEARING. Every failure path — bad id, database down, project
   paused, timeout, anything thrown — ends in context.next(), which hands the
   request back to Netlify and serves whatever the build produced. So the
   degradation ladder is:

     1. this function          — always current, any product
     2. the baked static page  — correct, possibly stale
     3. /p/* -> / in _redirects — the shop, which opens the product in a modal

   Nothing here can make the site worse than it was before it existed. */

const TIMEOUT_MS = 1500;   // an ad click will not wait; fall back instead

export default async (request, context) => {
  try {
    const id = new URL(request.url).pathname.match(/\/p\/(\d+)\/?$/)?.[1];
    if (!id) return context.next();

    const SUPABASE_URL = Netlify.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Netlify.env.get('SUPABASE_ANON_KEY');
    const SITE_URL = (Netlify.env.get('SITE_URL') || new URL(request.url).origin)
      .replace(/\/+$/, '');
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return context.next();

    // one round trip: the product and its category name together
    const select = 'id,name_fr,name_ar,name_en,description_fr,description_ar,' +
      'description_en,price,compare_at_price,photos,stock,sizes,category_id,' +
      'categories(name_fr)';
    const api = `${SUPABASE_URL}/rest/v1/products` +
      `?select=${select}&id=eq.${id}&active=eq.true&limit=1`;

    const rows = await withTimeout(
      fetch(api, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      }).then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))),
      TIMEOUT_MS);

    const p = Array.isArray(rows) ? rows[0] : null;
    // a hidden or deleted product is not this function's problem: let the
    // static page or the shop answer for it
    if (!p) return context.next();

    p.category_name = p.categories?.name_fr || '';
    delete p.categories;

    const shellRes = await withTimeout(fetch(new URL('/product-shell.html', request.url)), TIMEOUT_MS);
    if (!shellRes.ok) return context.next();

    const html = render(await shellRes.text(), p, SITE_URL);
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // the edge caches it briefly, the browser revalidates: a price edit
        // shows up in about a minute without the shop paying for a database
        // round trip on every single view
        'cache-control': 'public, max-age=0, must-revalidate',
        'netlify-cdn-cache-control': 'public, s-maxage=60, stale-while-revalidate=600',
        'x-rendered-by': 'edge',
      },
    });
  } catch (_) {
    return context.next();     // never let this be the reason a page fails
  }
};

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/* The same substitutions build-vip.py makes, against the same shell. */
function render(shell, p, site) {
  const name = (p.name_fr || '').trim();
  const price = fmtPrice(p.price);
  const brand = meta(shell, 'property', 'og:site_name') || '';
  const title = `${name} — ${price}${brand ? ' — ' + brand : ''}`;
  const desc = (p.description_fr || '').replace(/\s+/g, ' ').trim().slice(0, 155) ||
    meta(shell, 'name', 'description') || '';
  const url = `${site}/p/${p.id}/`;

  // a placeholder photo is a data: URI, which Facebook and WhatsApp refuse
  const photos = (p.photos || []).filter(u => String(u).startsWith('https://'));
  const image = photos[0] || `${site}/og-image.png`;

  let s = shell;
  s = s.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  s = setMeta(s, 'name', 'description', desc);
  s = setMeta(s, 'property', 'og:title', title);
  s = setMeta(s, 'property', 'og:description', desc);
  s = setMeta(s, 'property', 'og:image', image);
  s = setMeta(s, 'property', 'og:url', url);
  s = setMeta(s, 'name', 'twitter:title', title);
  s = setMeta(s, 'name', 'twitter:description', desc);
  s = setMeta(s, 'name', 'twitter:image', image);
  s = s.replace(/<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${esc(url)}">`);

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    image: photos.length ? photos : [image],
    description: desc || undefined,
    sku: String(p.id),
    offers: {
      '@type': 'Offer',
      url,
      price: String(p.price ?? 0),
      priceCurrency: 'DZD',
      availability: (p.stock ?? 0) > 0
        ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  // escaping < keeps a product name containing "</script>" from breaking out
  const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  return s.replace('</body>',
    `  <script type="application/ld+json">${json(ld)}</script>\n` +
    `  <script type="application/json" id="pdpData">${json(p)}</script>\n</body>`);
}

function setMeta(src, attr, name, value) {
  const pattern = new RegExp(`<meta ${attr}="${name.replace(':', ':')}" content="[^"]*"`);
  const tag = `<meta ${attr}="${name}" content="${esc(value)}"`;
  return pattern.test(src) ? src.replace(pattern, tag) : src.replace('</head>', `  ${tag}>\n</head>`);
}

function meta(src, attr, name) {
  return src.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1] || '';
}

function fmtPrice(v) {
  return Math.round(Number(v) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' DA';
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const config = { path: '/p/*' };
