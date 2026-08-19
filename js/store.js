/* Storefront: catalog, category filter + tiles, product modal, wishlist,
   recently viewed, global sale pricing (cart lives in cart.js) */
let state = { products: [], categories: [], filter: null, current: null, selectedSize: null,
              store: {}, query: '', sort: 'new', promo: { active: false, percent: 0 } };

/* ---- modal focus management ----
   The product modal and the size guide are not real pages: nothing about
   opening them moves the browser's focus, so keyboard and screen-reader users
   were left tabbing blindly behind the overlay. A small stack of "who opened
   this" elements lets nested modals (product → size guide) return focus to
   where it came from when each one closes. */
const focusStack = [];

function focusableIn(root) {
  return [...root.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter(el => !el.hidden && !el.disabled && el.offsetParent !== null);
}

function pushFocus(el) { focusStack.push(el || document.activeElement); }
function popFocus() {
  const el = focusStack.pop();
  if (el && el.isConnected) el.focus();
}

/* ---- full-screen photo gallery -------------------------------------------
   Tapping the main photo opens a swipeable full-screen viewer when the
   product has several photos. Slides are natural-size (same contain layout
   as the modal photo); a finger swipe, a mouse drag, the arrow buttons or
   the arrow keys all move between them. Pointer events unify touch and
   mouse so there is no separate drag code path. */
let gallery = { photos: [], index: 0 };
let galleryDrag = null;   // { startX, dx, pid } while a drag is in progress

function openGallery(photos, startIndex) {
  if (!photos || photos.length < 2) return;
  gallery = {
    photos,
    index: Math.max(0, Math.min(Number(startIndex) || 0, photos.length - 1)),
  };
  const track = document.getElementById('galleryTrack');
  track.innerHTML = '';
  photos.forEach(src => {
    const slide = document.createElement('div');
    slide.className = 'gallery-slide';
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.draggable = false;   // drag must not fight the pointer-based swipe
    slide.appendChild(img);
    track.appendChild(slide);
  });
  const overlay = document.getElementById('galleryModal');
  overlay.setAttribute('aria-label', I18N.t('gallery_open'));
  document.getElementById('galleryPrev').setAttribute('aria-label', I18N.t('gallery_prev'));
  document.getElementById('galleryNext').setAttribute('aria-label', I18N.t('gallery_next'));
  pushFocus(document.activeElement);
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setGalleryIndex(gallery.index, false);
  document.getElementById('galleryClose').focus();
}

function closeGallery() {
  const overlay = document.getElementById('galleryModal');
  overlay.classList.remove('open');
  gallery.photos = [];
  // the product modal may still be open underneath — only release the body
  // lock if nothing else claims it
  if (!document.getElementById('productModal').classList.contains('open')) {
    document.body.style.overflow = '';
  }
  popFocus();
}

function setGalleryIndex(i, animate = true) {
  const n = gallery.photos.length;
  if (!n) return;
  gallery.index = Math.max(0, Math.min(n - 1, i));
  const track = document.getElementById('galleryTrack');
  track.style.transition = animate ? '' : 'none';
  track.style.transform = `translateX(-${gallery.index * 100}%)`;
  document.getElementById('galleryCount').textContent = `${gallery.index + 1} / ${n}`;
  document.getElementById('galleryPrev').disabled = gallery.index === 0;
  document.getElementById('galleryNext').disabled = gallery.index === n - 1;
}

function galleryDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  galleryDrag = { startX: e.clientX, dx: 0, pid: e.pointerId };
  const track = document.getElementById('galleryTrack');
  track.style.transition = 'none';
  // some engines (and synthetic events) can reject capture for an unknown
  // pointer id — the drag still works without it, so treat it as optional
  try { track.setPointerCapture(e.pointerId); } catch { /* no capture */ }
}

function galleryMove(e) {
  if (!galleryDrag || e.pointerId !== galleryDrag.pid) return;
  const dx = e.clientX - galleryDrag.startX;
  galleryDrag.dx = dx;
  const track = document.getElementById('galleryTrack');
  track.style.transform = `translateX(calc(-${gallery.index * 100}% + ${dx}px))`;
}

function galleryUp() {
  if (!galleryDrag) return;
  const dx = galleryDrag.dx;
  galleryDrag = null;
  const track = document.getElementById('galleryTrack');
  // past a fifth of the viewport, release to the next slide; otherwise snap
  // back — the transition is restored by setGalleryIndex(animate = true)
  if (Math.abs(dx) > track.clientWidth * 0.18) {
    setGalleryIndex(gallery.index + (dx < 0 ? 1 : -1));
  } else {
    setGalleryIndex(gallery.index);
  }
}

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

/* Paint the whole shopfront from the current state. Used for both the
   cached first paint and the live refresh, so they can never disagree. */
function applyCatalogue() {
  // the dashboard-saved template (layouts.js) must be in place before any
  // section renders, so the hero arch / sidebar / decor exist for the painters
  applyLayout(state.store?.layout);
  renderPromoBanner();
  renderChips();
  renderTiles();
  renderFeatured();
  renderGrid();
  renderRecentlyViewed();
  renderCartCount();
  renderHeroLook();
  renderWhatsApp(state.store);
  renderSocials(state.store);
  openFromUrl(false);   // ?p=12 from an ad or a shared link
}

/* Ghost cards shown while the catalogue fetch is in flight — only when there
   is no cached copy to paint. Mirrors the grid silhouette (photo, title,
   price) so the real cards replace them in place without a layout jump. */
function showSkeletons() {
  const grid = document.getElementById('productGrid');
  const cols = Math.max(1, Math.round(grid.clientWidth / 260));
  grid.innerHTML = '';
  for (let i = 0; i < cols * 2; i++) {
    const s = document.createElement('div');
    s.className = 'sk-card';
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<div class="sk sk-photo"></div><div class="sk sk-line w60"></div>' +
                  '<div class="sk sk-line w85"></div><div class="sk sk-line w40"></div>';
    grid.appendChild(s);
  }
}

/* The femme template's hero arch shows a product photo as its look instead
   of CTA buttons. Harmless on every other template: they have no #heroLook. */
function renderHeroLook() {
  const look = document.getElementById('heroLook');
  if (!look) return;
  const pick = state.products.find(p => p.featured) || state.products[0];
  if (!pick) return;
  const src = DB.photoOf(pick);
  if (/^https?:/i.test(src)) {
    look.src = src;
    look.alt = I18N.localize(pick, 'name');
    look.removeAttribute('hidden');
  }
}

async function initStore() {
  if (DB.isDemo) document.getElementById('demoBanner').classList.add('show');
  document.getElementById('year').textContent = new Date().getFullYear();

  // First paint from the cached catalogue: a returning visitor sees the shop
  // immediately instead of waiting on a Supabase round-trip. The live fetch
  // below replaces it a moment later. `cached` also drives the offline notice.
  const cached = DB.getCachedCatalogue();
  if (cached) {
    state.categories = cached.categories;
    state.products = cached.products;
    state.promo = cached.promo || { active: false, percent: 0 };
    state.store = cached.store || {};
    if (cached.store?.phone) document.getElementById('footerPhone').textContent = cached.store.phone;
    applyCatalogue();
  } else {
    // first visit, nothing cached — paint ghost cards so the wait reads as
    // loading instead of an empty shop
    showSkeletons();
  }

  try {
    const [store, cats, prods, promo] = await Promise.all([
      DB.getStore(), DB.getCategories(), DB.getProducts(), DB.getPromo(),
    ]);
    state.categories = cats;
    state.products = prods;
    state.promo = promo || { active: false, percent: 0 };
    if (store?.phone) document.getElementById('footerPhone').textContent = store.phone;
    state.store = store || {};
    applyCatalogue();
  } catch (e) {
    // without this the catalogue would just look empty, which reads as
    // "the shop has no products" rather than "something is broken"
    if (!cached) {
      console.error('Could not load the catalogue:', e);
      document.getElementById('productGrid').innerHTML =
        `<p style="color:var(--muted)">${esc(I18N.t('err_load'))}</p>`;
      return;
    }
    // the cached copy is already on screen — say why it is showing
    document.getElementById('staleBanner').classList.add('show');
  }

  document.querySelectorAll('.lang-switch button').forEach(b =>
    b.addEventListener('click', () => { I18N.setLang(b.dataset.lang); }));
  document.addEventListener('langchange', () => {
    renderPromoBanner(); renderChips(); renderTiles();
    renderFeatured(); renderGrid(); renderRecentlyViewed(); renderWhatsApp(state.store);
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

  /* Escape closes the topmost modal; Tab is trapped inside whichever modal is
     open so keyboard focus cannot wander behind the overlay. The gallery is
     the topmost of the three, so it closes first. */
  document.addEventListener('keydown', e => {
    const prod = document.getElementById('productModal');
    const guide = document.getElementById('sizeGuideModal');
    const gal = document.getElementById('galleryModal');
    const inGal = gal.classList.contains('open');
    const inProd = prod.classList.contains('open');
    const inGuide = guide.classList.contains('open');
    if (e.key === 'Escape') {
      if (inGal) closeGallery();
      else if (inGuide) closeSizeGuide();
      else if (inProd) closeModal();
      return;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && inGal) {
      e.preventDefault();
      setGalleryIndex(gallery.index + (e.key === 'ArrowRight' ? 1 : -1));
      return;
    }
    if (e.key === 'Tab' && (inProd || inGuide || inGal)) {
      const root = inGal ? gal : inProd ? prod : guide;
      const f = focusableIn(root);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      const inside = root.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault(); first.focus();
      }
    }
  });
  /* Shared by the modal button and the mobile sticky bar — one add path,
     one size-required rule. */
  const addCurrent = () => {
    if (!state.current) return;
    const sizes = state.current.sizes || [];
    // no silent fallback to sizes[0]: guessing here means the wrong garment
    // gets delivered, and the customer never chose it
    if (sizes.length && !state.selectedSize) {
      document.getElementById('mSizeError').classList.add('show');
      // on a phone the size row can sit behind the sticky bar — bring it
      // into view so the customer can actually pick one
      document.getElementById('mSizeBlock').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    Cart.add(state.current, state.selectedSize || '');
    closeModal();
    toast();
  };
  document.getElementById('mAdd').addEventListener('click', addCurrent);
  document.getElementById('stickyAdd').addEventListener('click', addCurrent);
  document.getElementById('mWish').addEventListener('click', () => {
    if (!state.current) return;
    Wishlist.toggle(state.current.id);
    renderWishButton();
    renderGrid(); renderFeatured();
  });
  document.getElementById('sizeGuideBtn').addEventListener('click', () => {
    // push the button itself: mouse users often don't have focus on it, and
    // returning focus there when the guide closes is what keyboard users expect
    pushFocus(document.getElementById('sizeGuideBtn'));
    document.getElementById('sizeGuideModal').classList.add('open');
    document.getElementById('sizeGuideClose').focus();
  });
  document.getElementById('sizeGuideClose').addEventListener('click', closeSizeGuide);
  document.getElementById('sizeGuideModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSizeGuide();
  });

  /* ---- gallery wiring: open from the main photo, swipe on the track ---- */
  const mPhotoBox = document.querySelector('.m-photo');
  mPhotoBox.addEventListener('click', () => {
    const photos = state.current?.photos || [];
    if (photos.length > 1) openGallery(photos, state.photoIndex || 0);
  });
  mPhotoBox.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && (state.current?.photos || []).length > 1) {
      e.preventDefault();
      openGallery(state.current.photos, state.photoIndex || 0);
    }
  });
  document.getElementById('galleryClose').addEventListener('click', closeGallery);
  document.getElementById('galleryPrev').addEventListener('click', () => setGalleryIndex(gallery.index - 1));
  document.getElementById('galleryNext').addEventListener('click', () => setGalleryIndex(gallery.index + 1));
  const gTrack = document.getElementById('galleryTrack');
  gTrack.addEventListener('pointerdown', galleryDown);
  gTrack.addEventListener('pointermove', galleryMove);
  gTrack.addEventListener('pointerup', galleryUp);
  gTrack.addEventListener('pointercancel', galleryUp);
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
  eagerFirstRow(row);
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
  const photos = p.photos || [];
  // fashion sells on the second look: a product with several photos reveals
  // the next one on hover, so the grid feels alive without opening the modal
  const rollover = photos[1]
    ? `<img class="ph-second" src="${esc(photos[1])}" alt="" loading="lazy">` : '';
  // merchandising ribbons on the photo: Nouveau (added within two weeks) and
  // Bestseller (the ⭐ flag the owner sets in the admin)
  const isNew = !!p.created_at && Date.now() - new Date(p.created_at).getTime() < 14 * 864e5;
  const badges = [];
  if (isNew) badges.push(`<span class="badge-pill badge-new">${esc(I18N.t('badge_new'))}</span>`);
  if (p.featured) badges.push(`<span class="badge-pill badge-top">${esc(I18N.t('badge_bestseller'))}</span>`);
  const badgesHtml = badges.length ? `<div class="badges">${badges.join('')}</div>` : '';
  const card = document.createElement('div');
  card.className = 'card';
  // the heart is a sibling of the photo button, not a child: an interactive
  // element inside a role="button" would confuse screen readers, and it keeps
  // the whole card keyboard-operable (tab to it, Enter/Space to open)
  card.innerHTML = `
    ${wishHeart(p)}
    <div class="photo" role="button" tabindex="0"
         aria-label="${esc(I18N.t('view_product').replace('{name}', name))}">
      <img class="ph-main" src="${esc(DB.photoOf(p))}" alt="${esc(name)}" loading="lazy">
      ${rollover}
      ${badgesHtml}
    </div>
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
  const photo = card.querySelector('.photo');
  photo.addEventListener('click', () => openModal(p, { trigger: photo }));
  photo.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(p, { trigger: photo }); }
  });
  card.querySelector('.heart').addEventListener('click', () => {
    Wishlist.toggle(p.id); renderChips(); renderGrid(); renderFeatured();
  });
  return card;
}

/* Social links from the shop settings: a row of icon links in the footer.
   Each one renders only when the owner saved a URL, and bare names get a
   protocol so a link is never broken by a missing https://. */
const SOCIALS = [
  { key: 'facebook', label: 'Facebook', base: 'https://facebook.com/', path: 'M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2.1-.1-2.1 0-3.6 1.3-3.6 3.7V11H8v3h2.7v7h2.8z' },
  { key: 'instagram', label: 'Instagram', base: 'https://instagram.com/', path: 'M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2m0 1.8c-3.1 0-3.5 0-4.8.1-1.1.1-1.5.2-1.9.3-.5.2-.8.4-1.1.7-.3.3-.5.6-.7 1.1-.1.4-.2.8-.3 1.9-.1 1.2-.1 1.6-.1 4.8s0 3.5.1 4.8c.1 1.1.2 1.5.3 1.9.2.5.4.8.7 1.1.3.3.6.5 1.1.7.4.1.8.2 1.9.3 1.2.1 1.6.1 4.8.1s3.5 0 4.8-.1c1.1-.1 1.5-.2 1.9-.3.5-.2.8-.4 1.1-.7.3-.3.5-.6.7-1.1.1-.4.2-.8.3-1.9.1-1.2.1-1.6.1-4.8.1s0-3.5-.1-4.8c-.1-1.1-.2-1.5-.3-1.9-.2-.5-.4-.8-.7-1.1-.3-.3-.6-.5-1.1-.7-.4-.1-.8-.2-1.9-.3-1.2-.1-1.6-.1-4.8-.1m0 3.1a5 5 0 1 1 0 9.9 5 5 0 0 1 0-9.9m0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4m5.1-3.1a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4' },
  { key: 'tiktok', label: 'TikTok', base: 'https://tiktok.com/', path: 'M16.6 3c.4 2 1.7 3.4 3.9 3.6v2.6c-1.4 0-2.8-.4-3.9-1.2v6.3c0 4.1-2.6 6.7-6.4 6.7-3.2 0-5.7-2.4-5.7-5.6 0-3.4 2.8-5.8 6.3-5.6v2.8c-1.9-.2-3.5 1-3.5 2.9 0 1.7 1.2 2.9 2.8 2.9 1.7 0 2.9-1.1 2.9-3V3h2.6z' },
];

/* Accepts whatever the owner typed: a full URL, "facebook.com/page", a
   bare username "elegance", or an @-handle "@elegance" — all become a
   working link. */
function socialHref(s, raw) {
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('@')) return s.base + encodeURIComponent(raw.slice(1));
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(raw)) return 'https://' + raw;
  return s.base + encodeURIComponent(raw);
}

function renderSocials(store) {
  const box = document.getElementById('socialLinks');
  if (!box) return;
  box.innerHTML = '';
  SOCIALS.forEach(s => {
    const raw = String(store?.[s.key] || '').trim();
    if (!raw) return;
    const a = document.createElement('a');
    a.href = socialHref(s, raw);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', s.label);
    a.title = s.label;
    a.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${s.path}"/></svg>`;
    box.appendChild(a);
  });
  box.hidden = !box.children.length;
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
  eagerFirstRow(grid);
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
  eagerFirstRow(grid);
}
function card_badge_i18n() {
  document.querySelectorAll('[data-i18n="out_of_stock"]').forEach(el => el.textContent = I18N.t('out_of_stock'));
}

/* The first visible row of photos is the LCP candidate: every card image is
   lazy by default, which would delay the very picture the user sees first.
   Promote the first row (as many as the grid shows across) to eager + high
   priority after each render. */
function eagerFirstRow(grid) {
  if (!grid) return;
  const cols = Math.max(1, Math.round(grid.clientWidth / 260));
  [...grid.querySelectorAll('img')].slice(0, cols).forEach(img => {
    img.loading = 'eager';
    img.fetchPriority = 'high';
  });
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
      state.photoIndex = i;   // the gallery opens on the photo being viewed
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

/* Where a product lives, relative to wherever the shop is served from.
   history.pushState() only accepts a same-origin URL, so browsing uses this
   and the shareable link below is a separate thing — handing pushState the
   pinned SITE_URL while previewing on localhost throws a SecurityError. */
function productPath(id) {
  const base = location.pathname.replace(/\/p\/\d+\/?$/, '/').replace(/\/index\.html$/, '/');
  return `${base}p/${encodeURIComponent(id)}`;
}

/* The absolute link that goes into a share sheet, an ad, or the canonical.
   Pinned to SITE_URL when it is set, so Google and WhatsApp see one domain
   even when the host still answers on its default *.netlify.app name too —
   which is the whole reason SITE_URL exists. */
function productUrl(id) {
  return (window.SITE_URL || location.origin).replace(/\/+$/, '') + productPath(id);
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

/* ---- SEO: every product gets its own shareable card ------------------------
   A product lives at ?p=<id> — the same URL an ad or a WhatsApp share points
   at. The static page only carries shop-wide tags, so a shared link used to
   show the generic shop card no matter which product. When a product opens
   (or a visitor lands straight on ?p=12), the title, description, Open
   Graph, Twitter card, canonical and JSON-LD all switch to that product;
   closing restores the shop defaults. WhatsApp, Facebook, X and Google all
   render the page's JavaScript when they fetch a link, so ads and shares pick
   up the product card with no server involved. */
function seoAbs(u) {
  if (/^https?:/i.test(u)) return u;
  return (window.SITE_URL || location.origin).replace(/\/+$/, '') + (u.charAt(0) === '/' ? u : '/' + u);
}

function seoSet(prop, content) {
  // og: tags use property=, twitter: tags use name= — update whichever exists
  let el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(prop.startsWith('twitter:') ? 'name' : 'property', prop);
    document.head.appendChild(el);
  }
  el.content = content;
}

/* remember the static shop-wide tags so closing a product restores them
   (captured after the head snippet has absolutized og:url/og:image) */
let seoDefaults = null;
function captureSeoDefaults() {
  if (seoDefaults) return;
  const q = s => document.querySelector(s)?.content || '';
  const c = document.querySelector('link[rel="canonical"]');
  seoDefaults = {
    title: document.title,
    description: q('meta[name="description"]'),
    ogTitle: q('meta[property="og:title"]'),
    ogDescription: q('meta[property="og:description"]'),
    ogImage: q('meta[property="og:image"]'),
    ogImageAlt: q('meta[property="og:image:alt"]'),
    ogUrl: q('meta[property="og:url"]'),
    canonical: c ? c.href : location.origin + '/',
  };
}

function resetSeo() {
  captureSeoDefaults();
  document.title = seoDefaults.title;
  seoSet('description', seoDefaults.description);
  seoSet('og:title', seoDefaults.ogTitle);
  seoSet('og:description', seoDefaults.ogDescription);
  seoSet('og:image', seoDefaults.ogImage);
  seoSet('og:image:alt', seoDefaults.ogImageAlt);
  seoSet('og:url', seoDefaults.ogUrl);
  seoSet('twitter:title', seoDefaults.ogTitle);
  seoSet('twitter:description', seoDefaults.ogDescription);
  seoSet('twitter:image', seoDefaults.ogImage);
  const c = document.querySelector('link[rel="canonical"]');
  if (c) c.href = seoDefaults.canonical;
  const ld = document.getElementById('seoJsonLd');
  if (ld) ld.remove();
}

function setProductSeo(p) {
  captureSeoDefaults();
  const name = I18N.localize(p, 'name');
  const storeName = state.store?.name || seoDefaults.ogTitle.split('—')[0].trim() || 'Élégance';
  const title = `${name} — ${I18N.fmtPrice(effPrice(p))} — ${storeName}`;
  const desc = (I18N.localize(p, 'description') || '').replace(/\s+/g, ' ').trim().slice(0, 155);
  const url = seoAbs(productUrl(p.id));
  // a photo-less product falls back to the site's og card — the placeholder
  // is a data: URI, which Facebook and WhatsApp would refuse as og:image
  const raw = DB.photoOf(p);
  const img = /^https?:/i.test(raw) ? raw : seoDefaults.ogImage;
  document.title = title;
  seoSet('description', desc);
  seoSet('og:title', title);
  seoSet('og:description', desc);
  seoSet('og:image', img);
  seoSet('og:image:alt', name);
  seoSet('og:url', url);
  seoSet('twitter:title', title);
  seoSet('twitter:description', desc);
  seoSet('twitter:image', img);
  const c = document.querySelector('link[rel="canonical"]');
  if (c) c.href = url;
  // JSON-LD gets only real photos — a placeholder data: URI is not a valid
  // image URL, and omitting the field is better than pointing at one
  const images = (p.photos || []).map(s => seoAbs(s)).filter(s => /^https?:/i.test(s));
  let ld = document.getElementById('seoJsonLd');
  if (!ld) {
    ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.id = 'seoJsonLd';
    document.head.appendChild(ld);
  }
  // escaping < keeps a product name containing "</script>" from breaking out
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: desc || undefined,
    ...(images.length ? { image: images } : {}),
    brand: { '@type': 'Brand', name: storeName },
    offers: {
      '@type': 'Offer',
      price: String(Number(p.price) || 0),
      priceCurrency: 'DZD',
      availability: Number(p.stock) > 0
        ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url,
    },
  }).replace(/</g, '\\u003c');
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
  state.photoIndex = 0;
  pushFocus(opts.trigger);
  if (opts.push !== false) {
    history.pushState({ pid: p.id }, '', productPath(p.id));
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
  // the mobile sticky bar mirrors the modal: photo, price, live buy button
  const sticky = document.getElementById('stickyCart');
  sticky.classList.add('show');
  const sPhoto = document.getElementById('stickyPhoto');
  sPhoto.src = DB.photoOf(p);
  sPhoto.alt = I18N.localize(p, 'name');
  document.getElementById('stickyName').textContent = I18N.localize(p, 'name');
  document.getElementById('stickyPrice').textContent = I18N.fmtPrice(effPrice(p));
  const stickyAdd = document.getElementById('stickyAdd');
  stickyAdd.disabled = p.stock <= 0;
  stickyAdd.style.opacity = p.stock <= 0 ? 0.5 : 1;
  renderWishButton();
  document.getElementById('mShare').textContent = `🔗 ${I18N.t('share')}`;
  renderRelated(p);
  // the photo becomes a tappable, keyboard-operable "button" only when there
  // is a gallery to open — a single-photo product gets no dead controls
  const photos = p.photos || [];
  const zoomable = photos.length > 1;
  const box = document.querySelector('.m-photo');
  box.classList.toggle('zoomable', zoomable);
  if (zoomable) {
    box.setAttribute('role', 'button');
    box.setAttribute('tabindex', '0');
    box.setAttribute('aria-label', I18N.t('gallery_open'));
  } else {
    box.removeAttribute('role');
    box.removeAttribute('tabindex');
    box.removeAttribute('aria-label');
  }
  document.getElementById('productModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // keyboard users land on the close button, never behind the overlay
  document.getElementById('modalClose').focus();
  setProductSeo(p);   // title, og/twitter tags, canonical + JSON-LD for this product
}
function closeSizeGuide() {
  document.getElementById('sizeGuideModal').classList.remove('open');
  popFocus();
}
function closeModal(opts = {}) {
  // Back while the gallery is open (over the product modal) closes both: the
  // gallery never owns a history entry, so it must not survive its parent
  const gal = document.getElementById('galleryModal');
  if (gal.classList.contains('open')) {
    gal.classList.remove('open');
    gallery.photos = [];
    popFocus();
  }
  document.getElementById('productModal').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('stickyCart').classList.remove('show');
  state.current = null;
  resetSeo();   // back to the shop-wide title, tags and canonical
  popFocus();
  if (opts.fromPop) return;          // the URL already moved; don't touch it

  // Opened from the grid → step back so the Back button behaves as expected.
  // Landed here from an ad → there is nothing to go back to, so just clean
  // the URL in place rather than throwing the visitor off the site.
  if (history.state?.pid) history.back();
  else if (readProductId()) {
    const clean = location.pathname.replace(/\/p\/\d+\/?$/, '/').replace(/\/index\.html$/, '/');
    history.replaceState({}, '', clean);
  }
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
  // clear the sticky add-to-cart bar so the toast isn't hidden behind it
  const sticky = document.getElementById('stickyCart');
  if (sticky && sticky.classList.contains('show')) el.style.bottom = '92px';
  el.textContent = msg;
  el.style.opacity = 1;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.style.opacity = 0, 1800);
}

document.addEventListener('DOMContentLoaded', () => { I18N.apply(); initStore(); });
