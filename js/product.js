/* Dedicated product page (prototype).

   The difference from the modal version is what this file does NOT do: it
   never loads the catalogue. The product is baked into the page as JSON at
   build time, so the page is complete before any request goes out. Only two
   things are fetched afterwards, and neither blocks what the customer came
   to read: the shop settings (phone, socials, template) and a handful of
   related products.

   Everything the shop's modal offers — sizes, add to cart, gallery, wishlist,
   share — is here, because a product page that cannot sell is a brochure. */

const PDP = (() => {
  let p = null;          // the product, from the baked JSON
  let store = {};
  let selectedSize = null;
  let photoIndex = 0;

  function baked() {
    const el = document.getElementById('pdpData');
    try { return JSON.parse(el.textContent); } catch { return null; }
  }

  function photos() {
    const list = (p.photos || []).filter(Boolean);
    return list.length ? list : [DB.photoOf(p)];
  }

  /* The shelf price with any global sale applied. The sale lives in settings,
     which arrives after first paint, so the baked price is the shelf price and
     this corrects it if a sale is running — place_order() decides the real
     figure either way. */
  function effPrice(promo) {
    const pct = promo?.active ? Math.min(Math.max(Number(promo.percent) || 0, 0), 90) : 0;
    return Math.round(Number(p.price) * (100 - pct)) / 100;
  }

  function renderPrice(promo) {
    const price = effPrice(promo);
    document.getElementById('pdpPrice').textContent = I18N.fmtPrice(price);
    const old = promo?.active && Number(promo.percent) > 0
      ? Number(p.price)
      : (p.compare_at_price && Number(p.compare_at_price) > price ? Number(p.compare_at_price) : null);
    document.getElementById('pdpOld').textContent = old ? I18N.fmtPrice(old) : '';
    document.getElementById('pdpStickyPrice').textContent = I18N.fmtPrice(price);
  }

  function renderGallery() {
    const list = photos();
    const main = document.getElementById('pdpPhoto');
    main.src = list[photoIndex] || list[0];
    main.alt = I18N.localize(p, 'name');
    const thumbs = document.getElementById('pdpThumbs');
    thumbs.hidden = list.length < 2;
    thumbs.innerHTML = '';
    if (list.length < 2) return;
    list.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.loading = 'lazy';
      if (i === photoIndex) img.className = 'active';
      img.addEventListener('click', () => { photoIndex = i; renderGallery(); });
      thumbs.appendChild(img);
    });
  }

  function renderSizes() {
    const wrap = document.getElementById('pdpSizes');
    const block = document.getElementById('pdpSizeBlock');
    const list = p.sizes || [];
    block.hidden = !list.length;
    wrap.innerHTML = '';
    list.forEach(s => {
      const b = document.createElement('button');
      b.className = 'size-btn' + (s === selectedSize ? ' selected' : '');
      b.textContent = s;
      b.addEventListener('click', () => {
        selectedSize = s;
        document.getElementById('pdpSizeError').classList.remove('show');
        renderSizes();
      });
      wrap.appendChild(b);
    });
  }

  function renderWish() {
    const on = Wishlist.has(p.id);
    document.getElementById('pdpWish').textContent =
      (on ? '♥ ' : '♡ ') + I18N.t(on ? 'wl_remove' : 'wl_add');
  }

  function addToCart() {
    // no silent fallback to the first option: guessing here ships the wrong
    // colour or the wrong storage, and the customer never chose it
    if ((p.sizes || []).length && !selectedSize) {
      document.getElementById('pdpSizeError').classList.add('show');
      document.getElementById('pdpSizeBlock').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    Cart.add(p, selectedSize || '');
    Track.addToCart(p);
    const btn = document.getElementById('pdpAdd');
    const was = btn.textContent;
    btn.textContent = I18N.t('add_to_cart') + ' ✓';
    setTimeout(() => { btn.textContent = was; }, 1400);
  }

  async function renderRelated() {
    if (!p.category_id) return;
    let list = [];
    try { list = await DB.getRelated(p.category_id, p.id, 4); } catch { return; }
    if (!list.length) return;
    const row = document.getElementById('pdpRelated');
    row.innerHTML = '';
    list.forEach(x => {
      // a real link, not a modal swap: on a page, related products are
      // navigation, and each one has its own URL to be shared or indexed
      const a = document.createElement('a');
      a.className = 'card';
      a.href = `../${x.id}/`;
      a.style.textDecoration = 'none';
      a.innerHTML = `
        <div class="photo"><img src="${esc(DB.photoOf(x))}" alt="" loading="lazy"></div>
        <div class="info">
          <span class="cat">${esc(p.category_name || '')}</span>
          <h3>${esc(I18N.localize(x, 'name'))}</h3>
          <div class="price">${I18N.fmtPrice(x.price)}</div>
        </div>`;
      row.appendChild(a);
    });
    document.getElementById('pdpRelatedBlock').hidden = false;
  }

  function renderText() {
    document.getElementById('pdpCat').textContent = p.category_name || '';
    document.getElementById('pdpCrumbCat').textContent = p.category_name || '';
    document.getElementById('pdpName').textContent = I18N.localize(p, 'name');
    document.getElementById('pdpDesc').textContent = I18N.localize(p, 'description');
    document.getElementById('pdpStickyName').textContent = I18N.localize(p, 'name');
    document.getElementById('pdpStickyImg').src = photos()[0];
    document.getElementById('year').textContent = new Date().getFullYear();
    // the share button had no label at all — an unexplained empty circle
    document.getElementById('pdpShare').textContent = '🔗 ' + I18N.t('share');
    renderWish();
  }

  async function init() {
    p = baked();
    // '/' and not './' — this page lives at /p2/<id>/, where './' is THIS page,
    // so a missing payload sent the browser into an endless reload of itself
    if (!p) { location.replace('/'); return; }

    // everything the customer reads is drawn from the baked copy first
    I18N.apply();
    renderText();
    renderPrice(null);
    renderGallery();
    renderSizes();
    document.getElementById('pdpSticky').hidden = false;
    Track.view(p);

    document.getElementById('pdpAdd').addEventListener('click', addToCart);
    document.getElementById('pdpStickyAdd').addEventListener('click', addToCart);
    document.getElementById('pdpWish').addEventListener('click', () => {
      Wishlist.toggle(p.id); renderWish();
    });
    document.getElementById('pdpShare').addEventListener('click', share);
    document.querySelectorAll('.lang-switch button').forEach(b =>
      b.addEventListener('click', () => I18N.setLang(b.dataset.lang)));
    document.addEventListener('langchange', () => {
      I18N.apply(); renderText(); renderSizes(); renderPrice(store.promo);
    });
    renderCartCount();

    // now the two things the page could not know at build time
    try {
      const [st, promo] = await Promise.all([DB.getStore(), DB.getPromo()]);
      store = { ...st, promo };
      applyLayout(st?.layout);
      renderPrice(promo);
      renderWhatsApp(st);
      const phone = document.getElementById('footerPhone');
      if (phone) phone.textContent = st?.phone || '—';
    } catch { /* the page is already readable; settings are decoration */ }

    renderRelated();
  }

  async function share() {
    const url = location.href;
    const title = I18N.localize(p, 'name');
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* dismissed */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); alert(I18N.t('share_copied')); }
    catch { prompt(I18N.t('share'), url); }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => PDP.init());
