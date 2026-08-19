/* Cart (localStorage) — shared by storefront and checkout */
const Cart = {
  get() { try { return JSON.parse(localStorage.getItem('cart')) || []; } catch { return []; } },
  save(items) { localStorage.setItem('cart', JSON.stringify(items)); renderCartCount(); },
  count() { return this.get().reduce((s, i) => s + i.qty, 0); },
  add(product, size) {
    const items = this.get();
    const key = `${product.id}-${size}`;
    const found = items.find(i => i.key === key);
    if (found) found.qty++;
    else items.push({
      key, product_id: product.id, name_fr: product.name_fr, name_ar: product.name_ar, name_en: product.name_en,
      size, price: Number(product.price), qty: 1, photo: DB.photoOf(product),
    });
    this.save(items);
  },
  setQty(key, qty) {
    let items = this.get();
    const it = items.find(i => i.key === key);
    if (!it) return;
    it.qty = qty;
    if (it.qty <= 0) items = items.filter(i => i.key !== key);
    this.save(items);
  },
  remove(key) { this.save(this.get().filter(i => i.key !== key)); },
  clear() { this.save([]); },
};

/* Saved hearts. Lives here rather than in store.js because the storefront and
   the product page both need it, and cart.js is the localStorage module every
   page already loads. */
const Wishlist = {
  get() { try { return JSON.parse(localStorage.getItem('wishlist')) || []; } catch { return []; } },
  has(id) { return this.get().includes(id); },
  toggle(id) {
    let ids = this.get();
    ids = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
    localStorage.setItem('wishlist', JSON.stringify(ids));
  },
};

function renderCartCount() {
  const el = document.getElementById('cartCount');
  if (el) el.textContent = Cart.count();
}
