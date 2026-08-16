/* Checkout: cart review + COD order form (single page) */
let zones = [];
let store = {};
let currentSubtotal = 0;

async function initCheckout() {
  document.getElementById('year').textContent = new Date().getFullYear();
  try {
    [zones, store] = await Promise.all([DB.getZones(), DB.getStore()]);
    renderWhatsApp(store);
  } catch (e) {
    console.error('Could not load delivery zones:', e);
    document.getElementById('cartView').innerHTML =
      `<p style="text-align:center;color:var(--muted);padding:60px 0">${esc(I18N.t('err_load'))}</p>`;
    return;
  }

  document.querySelectorAll('.lang-switch button').forEach(b =>
    b.addEventListener('click', () => { I18N.setLang(b.dataset.lang); }));
  document.addEventListener('langchange', () => { render(); renderWhatsApp(store); });

  render();
}

function render() {
  const items = Cart.get();
  const linesEl = document.getElementById('cartLines');

  if (!items.length) {
    linesEl.innerHTML = `
      <p style="text-align:center;color:var(--muted);padding:30px 0" data-i18n="cart_empty"></p>
      <div style="text-align:center"><a class="btn-outline" href="index.html" data-i18n="continue_shopping"></a></div>`;
    linesEl.querySelectorAll('[data-i18n]').forEach(el => el.textContent = I18N.t(el.dataset.i18n));
    document.getElementById('subtotalVal').textContent = '—';
    document.getElementById('deliveryVal').textContent = '—';
    document.getElementById('totalVal').textContent = '—';
    return;
  }

  // ---- cart lines ----
  linesEl.innerHTML = '';
  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'cart-line';
    row.innerHTML = `
      <img src="${esc(it.photo)}" alt="">
      <div>
        <div class="name">${esc(I18N.localize(it, 'name'))}</div>
        <div class="meta">${I18N.t('qty')} · ${I18N.fmtPrice(it.price)}</div>
        <div class="qty-row">
          <button class="qty-btn" data-act="minus">−</button>
          <span>${it.qty}</span>
          <button class="qty-btn" data-act="plus">+</button>
          <button class="remove-link" data-act="rm" data-i18n="remove"></button>
        </div>
      </div>
      <div class="price">${I18N.fmtPrice(it.price * it.qty)}</div>`;
    row.querySelector('[data-act="minus"]').addEventListener('click', () => { Cart.setQty(it.key, it.qty - 1); render(); });
    row.querySelector('[data-act="plus"]').addEventListener('click', () => { Cart.setQty(it.key, it.qty + 1); render(); });
    row.querySelector('[data-act="rm"]').addEventListener('click', () => { Cart.remove(it.key); render(); });
    row.querySelector('[data-i18n="remove"]').textContent = I18N.t('remove');
    linesEl.appendChild(row);
  });

  // ---- order form ----
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  buildForm(subtotal);
}

function buildForm(subtotal) {
  currentSubtotal = subtotal;
  const right = document.getElementById('cartLines').parentElement.querySelector('.panel:not(#cartLines)');
  let form = document.getElementById('orderForm');
  if (!form) {
    form = document.createElement('div');
    form.id = 'orderForm';
    form.innerHTML = `
      <div class="form-grid" style="margin-top:18px;border-top:1px solid var(--line);padding-top:18px">
        <div><label data-i18n="name"></label><input id="fName" type="text"></div>
        <div><label data-i18n="phone"></label><input id="fPhone" type="tel" placeholder="05 XX XX XX XX"></div>
        <div><label data-i18n="zone"></label><select id="fZone"></select></div>
        <div><label data-i18n="address"></label><textarea id="fAddress" rows="2"></textarea></div>
        <div class="error-msg" id="formError"></div>
        <button class="btn-gold" id="placeOrderBtn" style="width:100%" data-i18n="place_order"></button>
      </div>`;
    right.appendChild(form);
    form.querySelector('#placeOrderBtn').addEventListener('click', placeOrder);
    form.querySelector('#fZone').addEventListener('change', updateTotals);
  }

  // localize labels + placeholders
  form.querySelectorAll('[data-i18n]').forEach(el => el.textContent = I18N.t(el.dataset.i18n));
  form.querySelector('#fPhone').placeholder = '05 XX XX XX XX';
  form.querySelector('#fAddress').placeholder = I18N.t('address');

  // zones with fee
  const sel = form.querySelector('#fZone');
  const prev = sel.value;
  sel.innerHTML = '';
  zones.forEach(z => {
    const o = document.createElement('option');
    o.value = z.name;
    o.textContent = `${z.name} — ${I18N.fmtPrice(z.fee)}`;
    sel.appendChild(o);
  });
  if (prev) sel.value = prev;

  updateTotals();
}

/* Module level, and bound once when the form is built: render() re-runs on
   every quantity change and every language switch, so a listener attached
   here would be added again each time. */
function updateTotals() {
  const form = document.getElementById('orderForm');
  if (!form) return;
  const zone = zones.find(z => z.name === form.querySelector('#fZone').value) || zones[0];
  const fee = Number(zone?.fee) || 0;
  document.getElementById('subtotalVal').textContent = I18N.fmtPrice(currentSubtotal);
  document.getElementById('deliveryVal').textContent = I18N.fmtPrice(fee);
  document.getElementById('totalVal').textContent = I18N.fmtPrice(currentSubtotal + fee);
  form.dataset.fee = String(fee);
  form.dataset.zone = zone?.name || '';
}

async function placeOrder() {
  const err = document.getElementById('formError');
  err.classList.remove('show');
  const name = document.getElementById('fName').value.trim();
  const phone = document.getElementById('fPhone').value.trim();
  const address = document.getElementById('fAddress').value.trim();
  const form = document.getElementById('orderForm');
  const zone = form.dataset.zone, fee = Number(form.dataset.fee);

  if (!name || !phone || !address || !zone) {
    err.textContent = I18N.t('required'); err.classList.add('show'); return;
  }
  if (!/^[0-9+\s-]{9,15}$/.test(phone)) {
    err.textContent = I18N.t('invalid_phone'); err.classList.add('show'); return;
  }

  const btn = document.getElementById('placeOrderBtn');
  btn.disabled = true; btn.style.opacity = 0.6;

  try {
    const res = await DB.placeOrder({
      customer_name: name, phone, address, zone, items: Cart.get(),
    });
    Cart.clear();
    document.getElementById('cartView').style.display = 'none';
    document.getElementById('successView').style.display = '';
    document.getElementById('orderRef').textContent = `#${res.id}`;
    // the total shown here is the one the database computed, which is also the
    // one the delivery driver will collect — it can differ from the cart if a
    // price changed while the basket sat in localStorage
    document.getElementById('finalTotal').textContent = I18N.fmtPrice(res.total);
    renderSuccessContact();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    err.textContent = orderErrorMessage(e);
    err.classList.add('show');
    btn.disabled = false; btn.style.opacity = 1;
  }
}

/* Cash on delivery asks the customer to trust a stranger with their address,
   so give them a way to reach the shop the moment the order lands. */
function renderSuccessContact() {
  const box = document.getElementById('successContact');
  const phone = store?.phone;
  if (!phone) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '';

  const label = document.createElement('div');
  label.textContent = `${I18N.t('success_contact')} ${phone}`;
  box.appendChild(label);

  const href = waLink(phone, `${I18N.t('order_number')} ${document.getElementById('orderRef').textContent}`);
  if (!href) return;
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38a9.86 9.86 0 0 0 4.74 1.2c5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2m0 18.05c-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.15.82.84-3.07-.2-.32a8.16 8.16 0 0 1-1.25-4.35c0-4.5 3.66-8.16 8.16-8.16s8.16 3.66 8.16 8.16-3.66 8.16-8.16 8.16"/></svg>';
  a.appendChild(document.createTextNode(I18N.t('wa_cta')));
  box.appendChild(a);
}

/* place_order() raises short codes rather than sentences, so the customer
   gets a translated message instead of a Postgres error. */
function orderErrorMessage(e) {
  const code = String(e?.message || '');
  if (code.includes('OUT_OF_STOCK')) return I18N.t('err_stock');
  if (code.includes('PRODUCT_UNAVAILABLE')) return I18N.t('err_unavailable');
  if (code.includes('TOO_MANY_ORDERS')) return I18N.t('err_too_many');
  if (code.includes('INVALID_SIZE')) return I18N.t('size_required');
  if (code.includes('INVALID_PHONE')) return I18N.t('invalid_phone');
  if (code.includes('MISSING_FIELDS') || code.includes('UNKNOWN_ZONE')) return I18N.t('required');
  console.error('place_order failed:', e);
  return I18N.t('err_generic');
}

document.addEventListener('DOMContentLoaded', () => { I18N.apply(); initCheckout(); });
