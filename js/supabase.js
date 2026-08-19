/* Supabase data layer with a built-in demo mode.
   Exposes a single `DB` object with the same methods in both modes. */
const DB = (() => {
  const sb = IS_DEMO ? null : window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

  // ---------------- demo data ----------------
  const demo = {
    store: { name: 'Élégance', phone: '+213 555 000 000', email: '', facebook: '', instagram: '', tiktok: '' },
    zones: [
      { name: 'Alger', fee: 600 }, { name: 'Oran', fee: 800 },
      { name: 'Constantine', fee: 800 }, { name: 'Blida', fee: 600 },
      { name: 'Sétif', fee: 800 }, { name: 'Annaba', fee: 800 },
      { name: 'Tizi Ouzou', fee: 700 }, { name: 'Autre wilaya', fee: 1000 },
    ],
    categories: [
      { id: 1, name_fr: 'Costumes', name_ar: 'بدلات', name_en: 'Suits', sort: 1 },
      { id: 2, name_fr: 'Chemises', name_ar: 'قمصان', name_en: 'Shirts', sort: 2 },
      { id: 3, name_fr: 'Pantalons', name_ar: 'سراويل', name_en: 'Trousers', sort: 3 },
      { id: 4, name_fr: 'Vestes', name_ar: 'سترات', name_en: 'Jackets', sort: 4 },
    ],
    products: [
      { id: 1, name_fr: 'Costume bleu nuit', name_ar: 'بدلة كحلي', name_en: 'Midnight blue suit',
        description_fr: 'Laine mélangée, coupe slim, 2 pièces.', description_ar: 'صوف ممزوج، قصّة ضيقة، قطعتان.', description_en: 'Blended wool, slim fit, 2 pieces.',
        price: 28500, compare_at_price: 32000, photos: [], sizes: ['S','M','L','XL'], category_id: 1, stock: 8, featured: true, active: true },
      { id: 2, name_fr: 'Costume anthracite', name_ar: 'بدلة فحمية', name_en: 'Charcoal suit',
        description_fr: 'Classique intemporel, coupe droite.', description_ar: 'كلاسيكية أنيقة، قصّة مستقيمة.', description_en: 'Timeless classic, regular fit.',
        price: 26000, compare_at_price: null, photos: [], sizes: ['M','L','XL','XXL'], category_id: 1, stock: 5, featured: true, active: true },
      { id: 3, name_fr: 'Chemise blanche classique', name_ar: 'قميص أبيض كلاسيكي', name_en: 'Classic white shirt',
        description_fr: 'Coton popeline, col français.', description_ar: 'قطن بوبلين، ياقة فرنسية.', description_en: 'Poplin cotton, French collar.',
        price: 4500, compare_at_price: null, photos: [], sizes: ['S','M','L','XL'], category_id: 2, stock: 20, featured: true, active: true },
      { id: 4, name_fr: 'Chemise bleu ciel', name_ar: 'قميص أزرق سماوي', name_en: 'Sky blue shirt',
        description_fr: 'Coton stretch, col italien.', description_ar: 'قطن مرن، ياقة إيطالية.', description_en: 'Stretch cotton, Italian collar.',
        price: 4800, compare_at_price: 5500, photos: [], sizes: ['M','L'], category_id: 2, stock: 12, featured: false, active: true },
      { id: 5, name_fr: 'Pantalon de costume noir', name_ar: 'بنطال أسود', name_en: 'Black suit trousers',
        description_fr: 'Laine mélangée, plis marqués.', description_ar: 'صوف ممزوج، كسرات.', description_en: 'Blended wool, pleated.',
        price: 9500, compare_at_price: null, photos: [], sizes: ['S','M','L','XL'], category_id: 3, stock: 15, featured: false, active: true },
      { id: 6, name_fr: 'Veste blazer marine', name_ar: 'سترة بليزر كحلي', name_en: 'Navy blazer',
        description_fr: 'Blazer décontracté-élégant.', description_ar: 'بليزر أنيق وعصري.', description_en: 'Smart-casual blazer.',
        price: 15500, compare_at_price: 17000, photos: [], sizes: ['M','L','XL'], category_id: 4, stock: 7, featured: true, active: true },
    ],
  };
  // demo orders persist in localStorage so the whole flow can be tested offline
  function demoLoadOrders() {
    try { return JSON.parse(localStorage.getItem('demo_orders')) || []; } catch { return []; }
  }
  function demoSaveOrders(orders) { localStorage.setItem('demo_orders', JSON.stringify(orders)); }

  // v1.1 demo promo state — mirrors the settings/table shapes used in
  // production. Kept in localStorage so the banner survives page changes
  // while previewing offline, like the real settings table would.
  function demoLoadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function demoSaveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  const demoPromoDefault = { active: false, percent: 0, label_fr: '', label_ar: '', label_en: '' };
  let demoCodes = [{ id: 1, code: 'BIENVENUE10', percent: 10, min_order: 0, active: true }];

  /* Phone cameras produce 4-12 MP files; serving one raw is the heaviest
     thing on the storefront (a 4 MB JPEG for a 300px thumbnail costs real
     money and time on the 3G/4G networks this shop's customers use). Every
     upload is re-encoded before it reaches Storage: downscaled to a sane
     maximum dimension and compressed as JPEG on a white backdrop (so a
     transparent PNG doesn't come back with a black background). Products
     keep enough pixels for the desktop modal; category tiles only ever
     render small, so they get a tighter cap. */
  function compressImage(file, maxDim) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(b => {
            URL.revokeObjectURL(url);
            b ? resolve(b) : reject(new Error('Image compression failed'));
          }, 'image/jpeg', 0.82);
        } catch (err) { URL.revokeObjectURL(url); reject(err); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read the image')); };
      img.src = url;
    });
  }

  // placeholers use a data-URI gradient so demo products are not blank
  function placeholderPhoto(seed) {
    const c1 = 25 + (seed % 5) * 8, c2 = 40 + (seed % 7) * 9;
    return `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgb(${c1},${c1 + 10},${c2})"/><stop offset="1" stop-color="rgb(${c2 - 15},${c1},${c1 + 5})"/></linearGradient></defs><rect width="600" height="750" fill="url(#g)"/><text x="300" y="390" font-family="Georgia" font-size="120" fill="rgba(212,175,55,0.65)" text-anchor="middle">&#9824;</text></svg>`)}`;
  }
  function photoOf(p, i = 0) {
    return p.photos && p.photos[i] ? p.photos[i] : placeholderPhoto(p.id + i);
  }

  // Every Supabase call returns { data, error } instead of rejecting, so an
  // unnoticed error silently becomes an empty page or a lost edit. Route them
  // all through here and let the caller decide what the user sees.
  function must({ data, error }) {
    if (error) throw error;
    return data;
  }

  /* ---- Storage cleanup ----------------------------------------------------
     Deleting a product removes the row, but the JPEGs it pointed at live in a
     Storage bucket that knows nothing about it — left alone they accumulate
     forever on a free-tier quota, invisible from the admin panel.

     A stored photo is a public URL; the bucket needs the object name back out
     of it. Anything that is not one of our own Storage URLs (a placeholder
     data: URI, a blob: preview, a photo pasted from elsewhere) has no object
     to remove and is skipped. */
  function storageNameOf(url, bucket) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const s = String(url || '');
    const i = s.indexOf(marker);
    if (i < 0) return null;
    return decodeURIComponent(s.slice(i + marker.length).split('?')[0]);
  }

  /* Best effort, and always after the row is gone: the delete the owner asked
     for has already succeeded, so a bucket that refuses is a warning in the
     console, not a failed delete they would retry. */
  async function removeStored(bucket, urls) {
    const names = (Array.isArray(urls) ? urls : [urls])
      .map(u => storageNameOf(u, bucket)).filter(Boolean);
    if (!names.length) return;
    const { error } = await sb.storage.from(bucket).remove(names);
    if (error) console.warn(`Could not remove ${bucket} photos:`, error.message);
  }

  /* ---- catalogue cache (storefront only) ----------------------------------
     A short-TTL copy of the public catalogue in localStorage. A returning
     visitor gets the shopfront instantly, and the live fetch refreshes the
     copy in the background; if Supabase is unreachable (or a free-tier
     project has paused) the stale copy still renders, labelled as such.
     The checkout — which must show exactly what place_order() will charge —
     and the owner's admin panel call setCacheEnabled(false) and always read
     live data. */
  const CACHE_KEY = 'shop_catalogue_v1';
  const CACHE_TTL = 10 * 60 * 1000;   // 10 minutes
  let cacheEnabled = true;

  function cacheRead() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
  }
  function cacheSave(entry) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch { /* full or blocked */ }
  }
  function cacheMerge(patch) {
    const entry = cacheRead() || {};
    entry.ts = Date.now();
    Object.assign(entry, patch);
    cacheSave(entry);
  }

  // ---------------- public API (same shape in both modes) ----------------
  return {
    isDemo: IS_DEMO,
    photoOf,
    // elegant navy placeholder, used for categories with no tile photo yet
    placeholderFor: (seed) => placeholderPhoto(Number(seed) || 1),

    async getStore() {
      if (IS_DEMO) return demo.store;
      const data = must(await sb.from('settings').select('value').eq('key', 'store').maybeSingle());
      const value = data?.value || demo.store;
      if (cacheEnabled) cacheMerge({ store: value });
      return value;
    },

    async getZones() {
      if (IS_DEMO) return demo.zones;
      const data = must(await sb.from('settings').select('value').eq('key', 'zones').maybeSingle());
      const value = data?.value || demo.zones;
      if (cacheEnabled) cacheMerge({ zones: value });
      return value;
    },

    async saveZones(zones) {
      if (IS_DEMO) { demo.zones = zones; return; }
      must(await sb.from('settings').upsert({ key: 'zones', value: zones }));
    },

    async saveStore(store) {
      if (IS_DEMO) { Object.assign(demo.store, store); return; }
      must(await sb.from('settings').upsert({ key: 'store', value: store }));
    },

    // ---- v1.1 promotions ----
    async getPromo() {
      if (IS_DEMO) return demoLoadJSON('demo_promo', demoPromoDefault);
      const data = must(await sb.from('settings').select('value').eq('key', 'promo').maybeSingle());
      const value = data?.value || demoPromoDefault;
      if (cacheEnabled) cacheMerge({ promo: value });
      return value;
    },

    async savePromo(promo) {
      if (IS_DEMO) { demoSaveJSON('demo_promo', promo); return; }
      must(await sb.from('settings').upsert({ key: 'promo', value: promo }));
    },

    async getFreeDeliveryFrom() {
      if (IS_DEMO) return demoLoadJSON('demo_free_from', null);
      const data = must(await sb.from('settings').select('value').eq('key', 'free_delivery_from').maybeSingle());
      const v = data?.value;
      const value = typeof v === 'number' ? v : null;
      if (cacheEnabled) cacheMerge({ freeFrom: value });
      return value;
    },

    async saveFreeDeliveryFrom(n) {
      if (IS_DEMO) { demoSaveJSON('demo_free_from', n ?? null); return; }
      must(await sb.from('settings').upsert({ key: 'free_delivery_from', value: n ?? null }));
    },

    /* Preview of a promo code for the checkout page; place_order() remains
       the authority on what is actually charged. */
    async checkPromo(code, subtotal) {
      if (IS_DEMO) {
        const c = demoCodes.find(c => c.active && c.code.toUpperCase() === code.trim().toUpperCase());
        if (!c) throw new Error('INVALID_PROMO');
        if (subtotal < c.min_order) throw new Error('PROMO_MIN_ORDER');
        return { code: c.code, percent: c.percent, min_order: c.min_order };
      }
      return must(await sb.rpc('check_promo', { p_code: code, p_sub: subtotal }));
    },

    async getPromoCodes() {
      if (IS_DEMO) return demoCodes;
      return must(await sb.from('promo_codes').select('*').order('created_at', { ascending: false })) || [];
    },

    async savePromoCode(c) {
      if (IS_DEMO) {
        if (c.id) { const i = demoCodes.findIndex(x => x.id === c.id); if (i >= 0) demoCodes[i] = c; }
        else demoCodes.push({ ...c, id: Date.now() });
        return;
      }
      must(await sb.from('promo_codes').upsert(c));
    },

    async deletePromoCode(id) {
      if (IS_DEMO) { demoCodes = demoCodes.filter(c => c.id !== id); return; }
      must(await sb.from('promo_codes').delete().eq('id', id));
    },

    async getCategories() {
      if (IS_DEMO) return demo.categories;
      const data = must(await sb.from('categories').select('*').order('sort')) || [];
      if (cacheEnabled) cacheMerge({ categories: data });
      return data;
    },

    async saveCategory(cat) {
      if (IS_DEMO) {
        if (cat.id) { const i = demo.categories.findIndex(c => c.id === cat.id); if (i >= 0) demo.categories[i] = cat; }
        else demo.categories.push({ ...cat, id: Date.now() });
        return;
      }
      must(await sb.from('categories').upsert(cat));
    },

    // `image` is the category's showcase tile, passed by the admin panel so the
    // file can go with the row instead of lingering in the bucket
    async deleteCategory(id, image = '') {
      if (IS_DEMO) { demo.categories = demo.categories.filter(c => c.id !== id); return; }
      must(await sb.from('categories').delete().eq('id', id));
      await removeStored('categories', image);
    },

    async getProducts(activeOnly = true) {
      if (IS_DEMO) return activeOnly ? demo.products.filter(p => p.active) : demo.products;
      let q = sb.from('products').select('*').order('created_at', { ascending: false });
      if (activeOnly) q = q.eq('active', true);
      const data = must(await q) || [];
      // only the storefront shape (active products) is cached
      if (cacheEnabled && activeOnly) cacheMerge({ products: data });
      return data;
    },

    async saveProduct(p) {
      if (IS_DEMO) {
        if (p.id) { const i = demo.products.findIndex(x => x.id === p.id); if (i >= 0) demo.products[i] = p; }
        else demo.products.push({ ...p, id: Date.now() });
        return;
      }
      must(await sb.from('products').upsert(p));
    },

    // `photos` is the product's photo array, passed by the admin panel so the
    // uploaded files go with the row instead of lingering in the bucket
    async deleteProduct(id, photos = []) {
      if (IS_DEMO) { demo.products = demo.products.filter(p => p.id !== id); return; }
      must(await sb.from('products').delete().eq('id', id));
      await removeStored('products', photos);
    },

    /* Sends only what the customer actually chooses — who they are, where they
       live, which product/size/quantity, and the promo code they typed. Prices,
       delivery fee and totals are worked out by place_order() from the products
       and settings tables, because a number that travels through the browser
       cannot be trusted. Returns the authoritative
       { id, subtotal, discount, promo_code, delivery_fee, total }. */
    async placeOrder({ customer_name, phone, address, zone, items, promo_code }) {
      const lines = items.map(i => ({
        product_id: i.product_id, qty: Number(i.qty) || 0, size: i.size,
      }));

      if (IS_DEMO) {
        // mirrors place_order() in schema.sql so the offline preview behaves
        // exactly like the live shop: global sale → code → free delivery
        const promoCfg = demoLoadJSON('demo_promo', demoPromoDefault);
        const freeFrom = demoLoadJSON('demo_free_from', null);
        const pct = promoCfg.active ? Math.min(Math.max(promoCfg.percent, 0), 90) : 0;
        const priced = lines.map(l => {
          const p = demo.products.find(x => x.id === l.product_id) || {};
          const base = Number(p.price) || 0;
          return { ...l, price: Math.round(base * (100 - pct)) / 100, base_price: base,
                   name_fr: p.name_fr, name_ar: p.name_ar, name_en: p.name_en };
        });
        let subtotal = priced.reduce((s, l) => s + l.price * l.qty, 0);
        let discount = 0, appliedCode = '';
        const code = String(promo_code || '').trim().toUpperCase();
        if (code) {
          const c = demoCodes.find(c => c.active && c.code.toUpperCase() === code);
          if (!c) throw new Error('INVALID_PROMO');
          if (subtotal < c.min_order) throw new Error('PROMO_MIN_ORDER');
          discount = Math.round(subtotal * c.percent) / 100;
          appliedCode = c.code;
        }
        let fee = Number(demo.zones.find(z => z.name === zone)?.fee) || 0;
        // threshold measured after the promo code, exactly as place_order() does
        if (freeFrom > 0 && (subtotal - discount) >= freeFrom) fee = 0;
        const orders = demoLoadOrders();
        const order = {
          id: (orders.at(-1)?.id || 1000) + 1, created_at: new Date().toISOString(),
          customer_name, phone, address, zone,
          delivery_fee: fee, items: priced, subtotal, discount,
          promo_code: appliedCode, total: subtotal - discount + fee, status: 'new',
        };
        orders.push(order);
        demoSaveOrders(orders);
        return { id: order.id, subtotal, discount, promo_code: appliedCode,
                 delivery_fee: fee, total: order.total };
      }

      try {
        return must(await sb.rpc('place_order', {
          p_name: customer_name, p_phone: phone, p_address: address,
          p_zone: zone, p_items: lines, p_promo_code: promo_code || '',
        }));
      } catch (e) {
        // PGRST202: no function with that signature — the v1.1 schema has not
        // been pasted into SQL Editor yet. Fall back to the v1.0 call so the
        // shop keeps taking orders; the promo code is simply ignored.
        if (e?.code === 'PGRST202' || /does not exist/i.test(e?.message || '')) {
          return must(await sb.rpc('place_order', {
            p_name: customer_name, p_phone: phone, p_address: address,
            p_zone: zone, p_items: lines,
          }));
        }
        throw e;
      }
    },

    /* Customer-facing order lookup. Needs the order number *and* the phone
       that placed it — see track_order() in schema.sql. */
    async trackOrder(id, phone) {
      if (IS_DEMO) {
        const last8 = s => String(s || '').replace(/\D/g, '').slice(-8);
        const o = demoLoadOrders().find(
          o => String(o.id) === String(id) && last8(o.phone) === last8(phone));
        if (!o) throw new Error('NOT_FOUND');
        return o;
      }
      return must(await sb.rpc('track_order', { p_id: Number(id), p_phone: phone }));
    },

    async getOrders() {
      if (IS_DEMO) return demoLoadOrders().reverse();
      return must(await sb.from('orders').select('*').order('created_at', { ascending: false })) || [];
    },

    async updateOrderStatus(id, status) {
      if (IS_DEMO) {
        const demoOrders = demoLoadOrders();
        const o = demoOrders.find(o => o.id === id);
        if (o) o.status = status;
        demoSaveOrders(demoOrders);
        return;
      }
      must(await sb.from('orders').update({ status }).eq('id', id));
    },

    // the owner can clean up old/test orders from the admin panel
    async deleteOrder(id) {
      if (IS_DEMO) {
        demoSaveOrders(demoLoadOrders().filter(o => String(o.id) !== String(id)));
        return;
      }
      must(await sb.from('orders').delete().eq('id', id));
    },

    /* Storefront first paint: the whole cached entry, synchronously, when it
       is fresh enough to trust. The live fetch still runs and replaces it. */
    getCachedCatalogue() {
      if (!cacheEnabled) return null;
      const entry = cacheRead();
      if (!entry || !entry.products || !entry.categories) return null;
      if (Date.now() - entry.ts > CACHE_TTL) return null;
      return entry;
    },

    /* Live-only mode for the checkout and the admin panel. */
    setCacheEnabled(on) { cacheEnabled = !!on; },

    // ---- auth (admin only; no-ops in demo, always "logged in") ----
    async getSession() {
      if (IS_DEMO) return true;
      const { data } = await sb.auth.getSession();
      return !!data.session;
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() { if (!IS_DEMO) await sb.auth.signOut(); },

    // ---- storage (product photos, category tiles) ----
    async uploadPhoto(file) {
      const name = `${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}.jpg`;
      const blob = await compressImage(file, 1200);
      if (IS_DEMO) return URL.createObjectURL(blob);
      // a File, not a bare Blob, so Supabase stores the right content-type
      const upload = new File([blob], name, { type: 'image/jpeg' });
      must(await sb.storage.from('products').upload(name, upload));
      return sb.storage.from('products').getPublicUrl(name).data.publicUrl;
    },

    async uploadCategoryPhoto(file) {
      const name = `${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}.jpg`;
      const blob = await compressImage(file, 800);
      if (IS_DEMO) return URL.createObjectURL(blob);
      const upload = new File([blob], name, { type: 'image/jpeg' });
      must(await sb.storage.from('categories').upload(name, upload));
      return sb.storage.from('categories').getPublicUrl(name).data.publicUrl;
    },

  };
})();
