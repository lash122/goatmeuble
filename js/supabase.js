/* Supabase data layer with a built-in demo mode.
   Exposes a single `DB` object with the same methods in both modes. */
const DB = (() => {
  const sb = IS_DEMO ? null : window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

  // ---------------- demo data ----------------
  const demo = {
    store: { name: 'Élégance', phone: '+213 555 000 000', email: '' },
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

  // ---------------- public API (same shape in both modes) ----------------
  return {
    isDemo: IS_DEMO,
    photoOf,

    async getStore() {
      if (IS_DEMO) return demo.store;
      const data = must(await sb.from('settings').select('value').eq('key', 'store').maybeSingle());
      return data?.value || demo.store;
    },

    async getZones() {
      if (IS_DEMO) return demo.zones;
      const data = must(await sb.from('settings').select('value').eq('key', 'zones').maybeSingle());
      return data?.value || demo.zones;
    },

    async saveZones(zones) {
      if (IS_DEMO) { demo.zones = zones; return; }
      must(await sb.from('settings').upsert({ key: 'zones', value: zones }));
    },

    async saveStore(store) {
      if (IS_DEMO) { Object.assign(demo.store, store); return; }
      must(await sb.from('settings').upsert({ key: 'store', value: store }));
    },

    async getCategories() {
      if (IS_DEMO) return demo.categories;
      return must(await sb.from('categories').select('*').order('sort')) || [];
    },

    async saveCategory(cat) {
      if (IS_DEMO) {
        if (cat.id) { const i = demo.categories.findIndex(c => c.id === cat.id); if (i >= 0) demo.categories[i] = cat; }
        else demo.categories.push({ ...cat, id: Date.now() });
        return;
      }
      must(await sb.from('categories').upsert(cat));
    },

    async deleteCategory(id) {
      if (IS_DEMO) { demo.categories = demo.categories.filter(c => c.id !== id); return; }
      must(await sb.from('categories').delete().eq('id', id));
    },

    async getProducts(activeOnly = true) {
      if (IS_DEMO) return activeOnly ? demo.products.filter(p => p.active) : demo.products;
      let q = sb.from('products').select('*').order('created_at', { ascending: false });
      if (activeOnly) q = q.eq('active', true);
      return must(await q) || [];
    },

    async saveProduct(p) {
      if (IS_DEMO) {
        if (p.id) { const i = demo.products.findIndex(x => x.id === p.id); if (i >= 0) demo.products[i] = p; }
        else demo.products.push({ ...p, id: Date.now() });
        return;
      }
      must(await sb.from('products').upsert(p));
    },

    async deleteProduct(id) {
      if (IS_DEMO) { demo.products = demo.products.filter(p => p.id !== id); return; }
      must(await sb.from('products').delete().eq('id', id));
    },

    /* Sends only what the customer actually chooses — who they are, where they
       live, and which product/size/quantity. Prices, delivery fee and totals
       are worked out by place_order() from the products and settings tables,
       because a number that travels through the browser cannot be trusted.
       Returns the authoritative { id, subtotal, delivery_fee, total }. */
    async placeOrder({ customer_name, phone, address, zone, items }) {
      const lines = items.map(i => ({
        product_id: i.product_id, qty: Number(i.qty) || 0, size: i.size,
      }));

      if (IS_DEMO) {
        const priced = lines.map(l => {
          const p = demo.products.find(x => x.id === l.product_id) || {};
          return { ...l, price: Number(p.price) || 0, name_fr: p.name_fr, name_ar: p.name_ar, name_en: p.name_en };
        });
        const subtotal = priced.reduce((s, l) => s + l.price * l.qty, 0);
        const fee = Number(demo.zones.find(z => z.name === zone)?.fee) || 0;
        const orders = demoLoadOrders();
        const order = {
          id: (orders.at(-1)?.id || 1000) + 1, created_at: new Date().toISOString(),
          customer_name, phone, address, zone,
          delivery_fee: fee, items: priced, subtotal, total: subtotal + fee, status: 'new',
        };
        orders.push(order);
        demoSaveOrders(orders);
        return { id: order.id, subtotal, delivery_fee: fee, total: subtotal + fee };
      }

      return must(await sb.rpc('place_order', {
        p_name: customer_name, p_phone: phone, p_address: address,
        p_zone: zone, p_items: lines,
      }));
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

    // ---- storage (product photos) ----
    async uploadPhoto(file) {
      const name = `${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      if (IS_DEMO) return URL.createObjectURL(file);
      must(await sb.storage.from('products').upload(name, file));
      return sb.storage.from('products').getPublicUrl(name).data.publicUrl;
    },
  };
})();
