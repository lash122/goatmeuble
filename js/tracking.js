/* Ad pixels — Meta (Facebook / Instagram) and TikTok.

   The shop's customers arrive from social ads, and an ad platform can only
   optimise for what it can measure. Without these events every campaign is
   spending blind: no "people who added to cart", no retargeting, no way to
   tell Ads Manager which creative actually produced an order.

   Nothing here runs unless an ID is set in js/config.js. With both blank the
   page loads no third-party script and sets no advertising cookie at all,
   which is the state the repository ships in.

   The event names are the standard ones both platforms document, so they map
   straight onto the Purchase / AddToCart optimisation goals with no custom
   conversion to configure.

   One honest caveat about cash on delivery: Purchase fires when the order is
   *placed*, not when the driver is paid — that is the only moment the browser
   ever sees. Some of those orders are refused at the door, so the platforms
   will report a few more conversions than the till does. Optimising on orders
   placed is the normal trade-off for COD; just don't read the pixel's revenue
   figure as takings. */
const Track = (() => {
  const cfg = window.ADS || {};
  const metaId = String(cfg.metaPixelId || '').trim();
  const tiktokId = String(cfg.tiktokPixelId || '').trim();
  const CURRENCY = 'DZD';

  /* Vendor loader snippets, copied verbatim from Meta's and TikTok's own
     install instructions. Minified and ugly on purpose: they are not ours to
     rewrite, and editing them is how pixels quietly stop reporting. */
  function loadMeta(id) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  function loadTikTok(id) {
    !function (w, d, t) {
      w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || []; ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'], ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } }; for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]); ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e }, ttq.load = function (e, n) { var i = 'https://analytics.tiktok.com/i18n/pixel/events.js'; ttq._i = ttq._i || {}, ttq._i[e] = [], ttq._i[e]._u = i, ttq._t = ttq._t || {}, ttq._t[e] = +new Date, ttq._o = ttq._o || {}, ttq._o[e] = n || {}; var o = d.createElement('script'); o.type = 'text/javascript', o.async = !0, o.src = i + '?sdkid=' + e + '&lib=' + t; var a = d.getElementsByTagName('script')[0]; a.parentNode.insertBefore(o, a) };
      ttq.load(id); ttq.page();
    }(window, document, 'ttq');
  }

  const on = { meta: false, tiktok: false };
  if (metaId) { try { loadMeta(metaId); on.meta = true; } catch (e) { console.warn('Meta pixel:', e); } }
  if (tiktokId) { try { loadTikTok(tiktokId); on.tiktok = true; } catch (e) { console.warn('TikTok pixel:', e); } }

  /* A blocked pixel (ad blocker, offline, a typo in the ID) must never take
     the checkout down with it — every send is wrapped and swallowed. */
  function send(metaEvent, metaData, tiktokEvent, tiktokData) {
    if (on.meta && window.fbq) {
      try { window.fbq('track', metaEvent, metaData); } catch (e) { /* blocked */ }
    }
    if (on.tiktok && window.ttq) {
      try { window.ttq.track(tiktokEvent, tiktokData); } catch (e) { /* blocked */ }
    }
  }

  const price = p => Number(p?.price) || 0;
  const label = p => (p?.name_fr || p?.name_en || p?.name_ar || '').slice(0, 100);

  /* Both platforms want the basket in the same shape; build it once. */
  function contents(items) {
    return (items || []).map(i => ({
      content_id: String(i.product_id ?? i.id),
      content_name: label(i),
      content_type: 'product',
      quantity: Number(i.qty) || 1,
      price: Number(i.price) || 0,
    }));
  }
  const sum = items => (items || [])
    .reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);

  return {
    get enabled() { return on.meta || on.tiktok; },

    /* A product window opened — the strongest interest signal before the
       cart, and what "view content" retargeting audiences are built from. */
    view(p) {
      if (!p) return;
      send('ViewContent', {
        content_ids: [String(p.id)], content_type: 'product',
        content_name: label(p), value: price(p), currency: CURRENCY,
      }, 'ViewContent', {
        contents: [{ content_id: String(p.id), content_name: label(p), content_type: 'product', quantity: 1, price: price(p) }],
        value: price(p), currency: CURRENCY,
      });
    },

    addToCart(p, qty = 1) {
      if (!p) return;
      const value = price(p) * qty;
      send('AddToCart', {
        content_ids: [String(p.id)], content_type: 'product',
        content_name: label(p), value, currency: CURRENCY,
      }, 'AddToCart', {
        contents: [{ content_id: String(p.id), content_name: label(p), content_type: 'product', quantity: qty, price: price(p) }],
        value, currency: CURRENCY,
      });
    },

    /* Reaching the checkout page with something in the basket. */
    beginCheckout(items) {
      if (!items?.length) return;
      const c = contents(items);
      send('InitiateCheckout', {
        content_ids: c.map(x => x.content_id), content_type: 'product',
        contents: c.map(x => ({ id: x.content_id, quantity: x.quantity })),
        num_items: c.reduce((s, x) => s + x.quantity, 0),
        value: sum(items), currency: CURRENCY,
      }, 'InitiateCheckout', { contents: c, value: sum(items), currency: CURRENCY });
    },

    /* Order placed. The value is the total place_order() computed — the
       amount the driver will collect — not whatever the cart previewed. */
    purchase(order, items) {
      if (!order) return;
      const c = contents(items);
      const value = Number(order.total) || sum(items);
      send('Purchase', {
        content_ids: c.map(x => x.content_id), content_type: 'product',
        contents: c.map(x => ({ id: x.content_id, quantity: x.quantity })),
        num_items: c.reduce((s, x) => s + x.quantity, 0),
        value, currency: CURRENCY, order_id: String(order.id ?? ''),
      }, 'CompletePayment', {
        contents: c, value, currency: CURRENCY, order_id: String(order.id ?? ''),
      });
    },
  };
})();
