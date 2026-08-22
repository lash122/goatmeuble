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
  let qty = 1;

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
    // the discount ribbon over the photo and the pill by the price say the
    // same thing; both stay hidden until a real discount exists
    const pct = old ? Math.round((1 - price / old) * 100) : 0;
    const badge = document.getElementById('pdpBadge');
    badge.hidden = !pct;
    if (pct) badge.textContent = `-${pct}%`;
    const save = document.getElementById('pdpSave');
    save.hidden = !pct;
    if (pct) save.textContent = `-${pct}%`;
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

  function renderQty() {
    document.getElementById('pdpQty').textContent = qty;
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
    Cart.add(p, selectedSize || '', qty);
    Track.addToCart(p);
    qty = 1;
    renderQty();
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
      // navigation, and each one has its own URL to be shared or indexed.
      // Root-absolute on purpose: this page can be served at /p/<id> OR
      // /p/<id>/, and a relative ../<id>/ resolves to /<id>/ (404) when the
      // trailing slash is missing.
      const a = document.createElement('a');
      a.className = 'card';
      a.href = `/p/${x.id}/`;
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

  /* ---- lightbox: the photo is the product on a furniture page, so give it
     a fullscreen stage. Arrows, Escape and a swipe all move through the set. */
  const lb = {
    el: null, img: null, count: null, index: 0,
    open(i) { this.index = i; this.render(); this.el.classList.add('open'); },
    close() { this.el.classList.remove('open'); },
    render() {
      const list = photos();
      this.img.src = list[this.index] || list[0];
      this.count.textContent = list.length > 1 ? `${this.index + 1} / ${list.length}` : '';
    },
    move(d) { const n = photos().length; this.index = (this.index + d + n) % n; this.render(); },
  };

  function initLightbox() {
    lb.el = document.getElementById('pdpLightbox');
    lb.img = document.getElementById('lbImg');
    lb.count = document.getElementById('lbCount');
    let x0 = null;
    document.getElementById('pdpPhoto').addEventListener('click', () => lb.open(photoIndex));
    lb.el.addEventListener('click', e => { if (e.target === lb.el) lb.close(); });
    document.getElementById('lbClose').addEventListener('click', () => lb.close());
    document.getElementById('lbPrev').addEventListener('click', () => lb.move(-1));
    document.getElementById('lbNext').addEventListener('click', () => lb.move(1));
    document.addEventListener('keydown', e => {
      if (!lb.el.classList.contains('open')) return;
      if (e.key === 'Escape') lb.close();
      if (e.key === 'ArrowLeft') lb.move(-1);
      if (e.key === 'ArrowRight') lb.move(1);
    });
    lb.el.addEventListener('pointerdown', e => { x0 = e.clientX; });
    lb.el.addEventListener('pointerup', e => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) lb.move(dx < 0 ? 1 : -1);
    });
  }

  /* Free-delivery teaser: the same threshold checkout enforces, surfaced
     while the customer is still deciding rather than at the till. */
  function renderFdTeaser(freeFrom) {
    const el = document.getElementById('pdpFdTeaser');
    if (!el || !(freeFrom > 0)) return;
    el.hidden = false;
    const inCart = Cart.get().reduce((s, i) => s + i.qty * Number(i.price), 0);
    const left = freeFrom - inCart;
    el.innerHTML = left > 0
      ? `<span>${esc(I18N.t('free_delivery_progress').replace('{x}', I18N.fmtPrice(left)))}</span>
         <div class="fd-track"><i style="width:${Math.min(100, Math.round((inCart / freeFrom) * 100))}%"></i></div>`
      : `<span>${esc(I18N.t('free_delivery_qualifies'))}</span>`;
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
    renderQty();
    document.getElementById('pdpSticky').hidden = false;
    Track.view(p);

    document.getElementById('pdpAdd').addEventListener('click', addToCart);
    document.getElementById('pdpStickyAdd').addEventListener('click', addToCart);
    initLightbox();
    document.querySelectorAll('.qty-picker button').forEach(b =>
      b.addEventListener('click', () => {
        qty = Math.min(99, Math.max(1, qty + Number(b.dataset.q)));
        renderQty();
      }));
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
      // product page keeps the furniture theme baked in the HTML
      // (applyLayout skipped to avoid flash-then-revert from cached JS)
      renderPrice(promo);
      renderWhatsApp(st);
      const phone = document.getElementById('footerPhone');
      if (phone) phone.textContent = st?.phone || '—';
    } catch { /* the page is already readable; settings are decoration */ }

    try { renderFdTeaser(await DB.getFreeDeliveryFrom()); } catch { /* decoration */ }

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
