/* Storefront: catalog, category filter + tiles, product modal, wishlist,
   recently viewed, global sale pricing (cart lives in cart.js) */
let state = { products: [], categories: [], filter: null, current: null, selectedSize: null,
              store: {}, query: '', sort: 'new', promo: { active: false, percent: 0 } };

/* ---- wishlist & recently viewed (localStorage, no account needed) ---- */
const Wishlist = {
  get() { try { return JSON.parse(localStorage.getItem('wishlist')) || []; } catch { return []; } },
  has(id) { return this.get().includes(id); },
  toggle(id) {
    let ids = this.get();
    ids = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
    localStorage.setItem('wishlist', JSON.stringify(ids));
  },
};
const RecentlyViewed = {
  get() { try { return JSON.parse(localStorage.getItem('recently_viewed')) || []; } catch { return []; } },
  push(id) {
    let ids = this.get().filter(x => x !== id);
    ids.unshift(id);
    localStorage.setItem('recently_viewed', JSON.stringify(ids.slice(0, 8)));
  },
};

/* The price the customer pays: the shelf price with the global sale applied.
   place_order() computes the same thing server-side; this is display only. */
function effPrice(p) {
  const pct = state.promo?.active ? Math.min(Math.max(Number(state.promo.percent) || 0, 0), 90) : 0;
  return Math.round(Number(p.price) * (100 - pct)) / 100;
}

async function initStore() {
  if (DB.isDemo) document.getElementById('demoBanner').classList.add('show');
  document.getElementById('year').textContent = new Date().getFullYear();

  try {
    const [store, cats, prods, promo] = await Promise.all([
      DB.getStore(), DB.getCategories(), DB.getProducts(), DB.getPromo(),
    ]);
    state.categories = cats;
    state.products = prods;
    state.promo = promo || { active: false, percent: 0 };
    if (store?.phone) document.getElementById('footerPhone').textContent = store.phone;
    state.store = store || {};
    renderWhatsApp(state.store);
  } catch (e) {
    // without this the catalogue would just look empty, which reads as
    // "the shop has no products" rather than "something is broken"
    console.error('Could not load the catalogue:', e);
    document.getElementById('productGrid').innerHTML =
      `<p style="color:var(--muted)">${esc(I18N.t('err_load'))}</p>`;
    return;
  }

  renderPromoBanner();
  renderChips();
  renderTiles();
  renderFeatured();
  renderGrid();
  renderRecentlyViewed();
  renderCartCount();
  openFromUrl(false);   // ?p=12 from an ad or a shared link


  document.querySelectorAll('.lang-switch button').forEach(b =>
    b.addEventListener('click', () => { I18N.setLang(b.dataset.lang); }));
  document.addEventListener('langchange', () => {
    renderPromoBanner(); renderChips(); renderTiles(); renderFeatured();
    renderGrid(); renderRecentlyViewed(); renderWhatsApp(state.store);
  });

  const search = document.getElementById('searchBox');
  search.addEventListener('input', () => { state.query = search.value.trim().toLowerCase(); renderGrid(); });
  const sortSel = document.getElementById('sortBy');
  sortSel.addEventListener('change', () => { state.sort = sortSel.value; renderGrid(); });

  document.getElementById('mShare').addEventListener('click', shareCurrent);
  window.addEventListener('popstate', () => {
    if (!openFromUrl(false)) closeModal({ fromPop: true });
  });
  document.getElementById('modalClose').addEventListener('click', () => closeModal());
  document.getElementById('productModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('mAdd').addEventListener('click', () => {
    if (!state.current) return;
    const sizes = state.current.sizes || [];
    // no silent fallback to sizes[0]: guessing here means the wrong garment
    // gets delivered, and the customer never chose it
    if (sizes.length && !state.selectedSize) {
      document.getElementById('mSizeError').classList.add('show');
      return;
    }
    Cart.add(state.current, state.selectedSize || '');
    closeModal();
    toast();
  });
  document.getElementById('mWish').addEventListener('click', () => {
    if (!state.current) return;
    Wishlist.toggle(state.current.id);
    renderWishButton();
    renderGrid(); renderFeatured();
  });
  document.getElementById('sizeGuideBtn').addEventListener('click', () => {
    document.getElementById('sizeGuideModal').classList.add('open');
  });
  document.getElementById('sizeGuideClose').addEventListener('click', () => {
    document.getElementById('sizeGuideModal').classList.remove('open');
  });
  document.getElementById('sizeGuideModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
  });
}

/* Global sale strip under the top bar. Uses the owner's label when there is
   one (in the visitor's language), otherwise a plain "-X% site-wide". */
function renderPromoBanner() {
  const el = document.getElementById('promoBanner');
  if (!state.promo?.active || !(Number(state.promo.percent) > 0)) { el.hidden = true; return; }
  const label = I18N.localize(state.promo, 'label');
  el.textContent = label || I18N.t('promo_off').replace('{p}', state.promo.percent);
  el.hidden = false;
}

function renderChips() {
  const row = document.getElementById('categoryChips');
  const chips = [{ id: null, label: I18N.t('all') },
    ...state.categories.map(c => ({ id: c.id, label: I18N.localize(c, 'name') }))];
  // the wishlist lives next to the categories: one tap to see saved hearts
  const wlCount = Wishlist.get().length;
  chips.push({ id: 'wishlist', label: `♥ ${I18N.t('wishlist')}${wlCount ? ` (${wlCount})` : ''}` });
  row.innerHTML = '';
  chips.forEach(ch => {
    const b = document.createElement('button');
    b.className = 'chip' + (String(state.filter) === String(ch.id) ? ' active' : '');
    b.textContent = ch.label;
    b.addEventListener('click', () => { state.filter = ch.id; renderChips(); renderGrid(); });
    row.appendChild(b);
  });
}

function catName(catId) {
  const c = state.categories.find(c => c.id === catId);
  return c ? I18N.localize(c, 'name') : '';
}

/* Category showcase tiles. Categories without a photo keep their elegant
   navy placeholder so the row never breaks when the owner skips images. */
function renderTiles() {
  const section = document.getElementById('catTiles');
  const row = document.getElementById('tileRow');
  row.innerHTML = '';
  state.categories.forEach(c => {
    const count = state.products.filter(p => p.category_id === c.id).length;
    const tile = document.createElement('button');
    tile.className = 'cat-tile';
    tile.innerHTML = `
      <div class="tile-photo"><img src="${esc(c.image || DB.placeholderFor(c.id))}" alt="" loading="lazy"></div>
      <span class="tile-name">${esc(I18N.localize(c, 'name'))}</span>
      <span class="tile-count">${count}</span>`;
    tile.addEventListener('click', () => {
      state.filter = c.id;
      renderChips(); renderGrid();
      document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
    });
    row.appendChild(tile);
  });
  section.hidden = !state.categories.length;
}

function wishHeart(p) {
  const on = Wishlist.has(p.id);
  return `<button class="heart${on ? ' on' : ''}" type="button"
    aria-label="${esc(I18N.t(on ? 'wl_remove' : 'wl_add'))}"
    title="${esc(I18N.t(on ? 'wl_remove' : 'wl_add'))}">♥</button>`;
}

function productCard(p) {
  const name = I18N.localize(p, 'name');
  const price = effPrice(p);
  // the "old" price is the shelf price while a sale runs; without a sale it
  // stays the owner's compare-at price, exactly as before v1.1
  const old = state.promo?.active && Number(state.promo.percent) > 0
    ? Number(p.price)
    : (p.compare_at_price && Number(p.compare_at_price) > price ? Number(p.compare_at_price) : null);
  const onSale = old && old > price;
  const soldOut = p.stock <= 0;
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="photo"><img src="${esc(DB.photoOf(p))}" alt="${esc(name)}" loading="lazy">${wishHeart(p)}</div>
    <div class="info">
      <span class="cat">${esc(catName(p.category_id))}</span>
      <h3>${esc(name)}</h3>
      <div class="price-row">
        <span class="price">${I18N.fmtPrice(price)}</span>
        ${onSale ? `<span class="price-old">${I18N.fmtPrice(old)}</span><span class="badge-sale">-${Math.round((1 - price / old) * 100)}%</span>` : ''}
        ${soldOut ? `<span class="badge-oos" data-i18n="out_of_stock"></span>` : ''}
        ${!soldOut && p.stock <= 3 ? `<span class="badge-low">${esc(I18N.t('low_stock').replace('{n}', p.stock))}</span>` : ''}
      </div>
    </div>`;
  card.querySelector('.photo').addEventListener('click', e => {
    if (e.target.closest('.heart')) return;
    openModal(p);
  });
  card.querySelector('.heart').addEventListener('click', () => {
    Wishlist.toggle(p.id); renderChips(); renderGrid(); renderFeatured();
  });
  return card;
}

/* The ⭐ toggle in the admin panel drives this row. Hidden entirely when
   nothing is featured, so the homepage never shows an empty heading. */
function renderFeatured() {
  const section = document.getElementById('featured');
  const grid = document.getElementById('featuredGrid');
  const list = state.products.filter(p => p.featured);
  section.hidden = !list.length;
  grid.innerHTML = '';
  list.forEach(p => grid.appendChild(productCard(p)));
  card_badge_i18n();
}

/* Search matches the name and description in whichever language is showing,
   so a customer typing Arabic finds Arabic products. */
function matchesQuery(p) {
  if (!state.query) return true;
  const hay = [I18N.localize(p, 'name'), I18N.localize(p, 'description'),
               catName(p.category_id)].join(' ').toLowerCase();
  return hay.includes(state.query);
}

function sortList(list) {
  const by = state.sort;
  if (by === 'price_asc') return [...list].sort((a, b) => effPrice(a) - effPrice(b));
  if (by === 'price_desc') return [...list].sort((a, b) => effPrice(b) - effPrice(a));
  return list;   // 'new' — getProducts() already returns newest first
}

function renderGrid() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';
  let list = state.products;
  if (state.filter === 'wishlist') list = list.filter(p => Wishlist.has(p.id));
  else list = list.filter(p => state.filter === null || p.category_id === state.filter);
  list = sortList(list.filter(matchesQuery));

  if (!list.length) {
    grid.innerHTML = `<p style="color:var(--muted)">${esc(
      state.filter === 'wishlist' ? I18N.t('wishlist_empty')
      : I18N.t(state.query ? 'no_results' : 'all'))}</p>`;
    return;
  }
  list.forEach(p => grid.appendChild(productCard(p)));
  // re-apply i18n for injected badges
  card_badge_i18n();
}
function card_badge_i18n() {
  document.querySelectorAll('[data-i18n="out_of_stock"]').forEach(el => el.textContent = I18N.t('out_of_stock'));
}

/* Recently viewed strip: photo + name + live price, reopens the modal. */
function renderRecentlyViewed() {
  const section = document.getElementById('recentlyViewed');
  const strip = document.getElementById('rvStrip');
  const items = RecentlyViewed.get()
    .map(id => state.products.find(p => p.id === id))
    .filter(Boolean);
  section.hidden = items.length < 2;   // one item tells the visitor nothing
  strip.innerHTML = '';
  items.forEach(p => {
    const el = document.createElement('button');
    el.className = 'rv-item';
    el.innerHTML = `
      <img src="${esc(DB.photoOf(p))}" alt="" loading="lazy">
      <span class="rv-name">${esc(I18N.localize(p, 'name'))}</span>
      <span class="rv-price">${I18N.fmtPrice(effPrice(p))}</span>`;
    el.addEventListener('click', () => openModal(p));
    strip.appendChild(el);
  });
}

/* Thumbnail strip under the main photo. The admin panel has always accepted
   several photos per product and stored them all; only the first was ever
   displayed. Hidden for single-photo products so nothing changes for them. */
function renderThumbs(p, mainPhoto) {
  const strip = document.getElementById('mThumbs');
  const photos = p.photos || [];
  strip.innerHTML = '';
  strip.hidden = photos.length < 2;
  if (strip.hidden) return;

  const name = I18N.localize(p, 'name');
  photos.forEach((src, i) => {
    const btn = document.createElement('button');
    btn.className = 'm-thumb' + (i === 0 ? ' active' : '');
    btn.setAttribute('aria-label', `${name} — ${i + 1}/${photos.length}`);
    const img = document.createElement('img');
    img.src = src;               // set as a property, so no HTML escaping to get wrong
    img.alt = '';
    img.loading = 'lazy';
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      mainPhoto.src = src;
      strip.querySelectorAll('.m-thumb').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
    });
    strip.appendChild(btn);
  });
}

/* "Vous aimerez aussi" — same category, still in stock, not the product open. */
function renderRelated(p) {
  const block = document.getElementById('mRelatedBlock');
  const row = document.getElementById('mRelated');
  const list = state.products
    .filter(x => x.id !== p.id && x.category_id === p.category_id && x.stock > 0)
    .slice(0, 4);
  block.hidden = !list.length;
  row.innerHTML = '';
  list.forEach(x => {
    const b = document.createElement('button');
    b.className = 'rel-item';
    b.innerHTML = `
      <img src="${esc(DB.photoOf(x))}" alt="" loading="lazy">
      <span class="rv-name">${esc(I18N.localize(x, 'name'))}</span>
      <span class="rv-price">${I18N.fmtPrice(effPrice(x))}</span>`;
    b.addEventListener('click', () => openModal(x));   // swaps the modal in place
    row.appendChild(b);
  });
}

function renderWishButton() {
  const btn = document.getElementById('mWish');
  if (!state.current) return;
  const on = Wishlist.has(state.current.id);
  btn.textContent = on ? `♥ ${I18N.t('wl_remove')}` : `♡ ${I18N.t('wl_add')}`;
  btn.classList.toggle('on', on);
}

/* ================= DEEP LINKS =================
   A product is modal state, not a page, so without this every item lives at
   the same URL — an ad or a WhatsApp share can only ever point at the shop
   front. Reading the id from the URL costs nothing at build time, so products
   created long after deployment get working links with no rebuild.

   Two shapes are accepted: ?p=12 works on any static host, and /p/12 is the
   pretty form a Netlify edge function can rewrite. */
function readProductId() {
  const q = new URLSearchParams(location.search).get('p');
  if (q) return q.replace(/\D/g, '');
  const m = location.pathname.match(/\/p\/(\d+)\/?$/);
  return m ? m[1] : null;
}

function productUrl(id) {
  return `${location.origin}${location.pathname.replace(/\/p\/\d+\/?$/, '/')}?p=${encodeURIComponent(id)}`;
}

/* Landing straight on ?p=12 must not push a second entry, or Back would
   bounce between two copies of the same page instead of leaving. */
function openFromUrl(push) {
  const id = readProductId();
  if (!id) return false;
  const p = state.products.find(x => String(x.id) === String(id));
  if (!p) return false;          // deleted or deactivated — just show the shop
  openModal(p, { push });
  return true;
}

async function shareCurrent() {
  if (!state.current) return;
  const url = productUrl(state.current.id);
  const title = I18N.localize(state.current, 'name');
  // the native sheet is the useful path on the phones customers actually use
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; } catch { return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(I18N.t('share_copied'));
  } catch {
    prompt(I18N.t('share'), url);   // last resort: let them copy it by hand
  }
}

function openModal(p, opts = {}) {
  state.current = p;
  state.selectedSize = null;
  if (opts.push !== false) {
    history.pushState({ pid: p.id }, '', productUrl(p.id));
  }
  RecentlyViewed.push(p.id);
  renderRecentlyViewed();
  const mainPhoto = document.getElementById('mPhoto');
  mainPhoto.src = DB.photoOf(p);
  mainPhoto.alt = I18N.localize(p, 'name');
  renderThumbs(p, mainPhoto);
  document.getElementById('mCat').textContent = catName(p.category_id);
  document.getElementById('mName').textContent = I18N.localize(p, 'name');
  const price = effPrice(p);
  document.getElementById('mPrice').textContent = I18N.fmtPrice(price);
  const oldEl = document.getElementById('mOld');
  const old = state.promo?.active && Number(state.promo.percent) > 0
    ? Number(p.price)
    : (p.compare_at_price && Number(p.compare_at_price) > price ? Number(p.compare_at_price) : null);
  oldEl.textContent = old ? I18N.fmtPrice(old) : '';
  document.getElementById('mDesc').textContent = I18N.localize(p, 'description');
  const sizesEl = document.getElementById('mSizes');
  const sizeErr = document.getElementById('mSizeError');
  sizeErr.classList.remove('show');
  sizesEl.innerHTML = '';
  (p.sizes || []).forEach(s => {
    const b = document.createElement('button');
    b.className = 'size-btn';
    b.textContent = s;
    b.addEventListener('click', () => {
      state.selectedSize = s;
      sizeErr.classList.remove('show');
      sizesEl.querySelectorAll('.size-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
    });
    sizesEl.appendChild(b);
  });
  // a product with no sizes at all (an accessory, say) needs no chooser
  document.getElementById('mSizeBlock').hidden = !(p.sizes || []).length;
  const addBtn = document.getElementById('mAdd');
  addBtn.disabled = p.stock <= 0;
  addBtn.style.opacity = p.stock <= 0 ? 0.5 : 1;
  renderWishButton();
  document.getElementById('mShare').textContent = `🔗 ${I18N.t('share')}`;
  renderRelated(p);
  document.getElementById('productModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(opts = {}) {
  document.getElementById('productModal').classList.remove('open');
  document.body.style.overflow = '';
  state.current = null;
  if (opts.fromPop) return;          // the URL already moved; don't touch it

  // Opened from the grid → step back so the Back button behaves as expected.
  // Landed here from an ad → there is nothing to go back to, so just clean
  // the URL in place rather than throwing the visitor off the site.
  if (history.state?.pid) history.back();
  else if (readProductId()) history.replaceState({}, '', productUrl('').replace(/\?p=$/, ''));
}

function toast(msg) {
  msg = msg || I18N.t('add_to_cart') + ' ✓';
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;bottom:28px;inset-inline-start:50%;transform:translateX(-50%);background:var(--navy);color:#fff;padding:12px 26px;border-radius:999px;z-index:200;opacity:0;transition:opacity .3s;font-size:.95rem';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = 1;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.style.opacity = 0, 1800);
}

document.addEventListener('DOMContentLoaded', () => { I18N.apply(); initStore(); });
