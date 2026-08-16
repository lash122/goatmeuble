/* Storefront: catalog, category filter, product modal (cart lives in cart.js) */
let state = { products: [], categories: [], filter: null, current: null, selectedSize: null, store: {} };

async function initStore() {
  if (DB.isDemo) document.getElementById('demoBanner').classList.add('show');
  document.getElementById('year').textContent = new Date().getFullYear();

  try {
    const [store, cats, prods] = await Promise.all([DB.getStore(), DB.getCategories(), DB.getProducts()]);
    state.categories = cats;
    state.products = prods;
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

  renderChips();
  renderFeatured();
  renderGrid();
  renderCartCount();

  document.querySelectorAll('.lang-switch button').forEach(b =>
    b.addEventListener('click', () => { I18N.setLang(b.dataset.lang); }));
  document.addEventListener('langchange', () => { renderChips(); renderFeatured(); renderGrid(); renderWhatsApp(state.store); });

  document.getElementById('modalClose').addEventListener('click', closeModal);
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
}

function renderChips() {
  const row = document.getElementById('categoryChips');
  const chips = [{ id: null, label: I18N.t('all') },
    ...state.categories.map(c => ({ id: c.id, label: I18N.localize(c, 'name') }))];
  row.innerHTML = '';
  chips.forEach(ch => {
    const b = document.createElement('button');
    b.className = 'chip' + (state.filter === ch.id ? ' active' : '');
    b.textContent = ch.label;
    b.addEventListener('click', () => { state.filter = ch.id; renderChips(); renderGrid(); });
    row.appendChild(b);
  });
}

function catName(catId) {
  const c = state.categories.find(c => c.id === catId);
  return c ? I18N.localize(c, 'name') : '';
}

function productCard(p) {
  const name = I18N.localize(p, 'name');
  const onSale = p.compare_at_price && Number(p.compare_at_price) > Number(p.price);
  const soldOut = p.stock <= 0;
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="photo"><img src="${esc(DB.photoOf(p))}" alt="${esc(name)}" loading="lazy"></div>
    <div class="info">
      <span class="cat">${esc(catName(p.category_id))}</span>
      <h3>${esc(name)}</h3>
      <div class="price-row">
        <span class="price">${I18N.fmtPrice(p.price)}</span>
        ${onSale ? `<span class="price-old">${I18N.fmtPrice(p.compare_at_price)}</span><span class="badge-sale">-${Math.round((1 - p.price / p.compare_at_price) * 100)}%</span>` : ''}
        ${soldOut ? `<span class="badge-oos" data-i18n="out_of_stock"></span>` : ''}
      </div>
    </div>`;
  card.querySelector('.photo').addEventListener('click', () => openModal(p));
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

function renderGrid() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';
  const list = state.products.filter(p => state.filter === null || p.category_id === state.filter);
  if (!list.length) { grid.innerHTML = '<p style="color:var(--muted)">—</p>'; return; }
  list.forEach(p => grid.appendChild(productCard(p)));
  // re-apply i18n for injected badges
  card_badge_i18n();
}
function card_badge_i18n() {
  document.querySelectorAll('[data-i18n="out_of_stock"]').forEach(el => el.textContent = I18N.t('out_of_stock'));
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

function openModal(p) {
  state.current = p;
  state.selectedSize = null;
  const mainPhoto = document.getElementById('mPhoto');
  mainPhoto.src = DB.photoOf(p);
  mainPhoto.alt = I18N.localize(p, 'name');
  renderThumbs(p, mainPhoto);
  document.getElementById('mCat').textContent = catName(p.category_id);
  document.getElementById('mName').textContent = I18N.localize(p, 'name');
  document.getElementById('mPrice').textContent = I18N.fmtPrice(p.price);
  const old = document.getElementById('mOld');
  old.textContent = p.compare_at_price ? I18N.fmtPrice(p.compare_at_price) : '';
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
  document.getElementById('productModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('productModal').classList.remove('open');
  document.body.style.overflow = '';
  state.current = null;
}

function toast() {
  const msg = I18N.t('add_to_cart') + ' ✓';
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
