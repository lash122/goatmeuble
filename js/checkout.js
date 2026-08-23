/* Checkout: cart review + COD order form (single page), v1.1 promos */
let zones = [];
let store = {};
let promo = { active: false, percent: 0 };
let freeFrom = null;
let appliedCode = null;   // { code, percent } once validated, or null
let currentBaseSubtotal = 0;   // shelf-price subtotal before any discount
let cartNotes = [];   // user-facing notices from revalidateCartPrices()

async function initCheckout() {
  // checkout must show exactly what place_order() will charge, and the cart
  // revalidation needs live prices — never serve cached data here
  DB.setCacheEnabled(false);
  document.getElementById('year').textContent = new Date().getFullYear();
  try {
    [zones, store, promo, freeFrom] = await Promise.all([
      DB.getZones(), DB.getStore(), DB.getPromo(), DB.getFreeDeliveryFrom(),
    ]);
    renderWhatsApp(store);
    // checkout always keeps the furniture theme baked in the HTML
    // (applyLayout skipped to avoid flash-then-revert from cached JS)
  } catch (e) {
    console.error('Could not load shop settings:', e);
    document.getElementById('cartView').innerHTML =
      `<p style="text-align:center;color:var(--muted);padding:60px 0">${esc(I18N.t('err_load'))}</p>`;
    return;
  }

  document.querySelectorAll('.lang-switch button').forEach(b =>
    b.addEventListener('click', () => { I18N.setLang(b.dataset.lang); }));
  document.addEventListener('langchange', () => { render(); renderFaq(); renderCartNotice(); renderWhatsApp(store); });

  /* the preview must show what the driver will actually collect */
  await revalidateCartPrices();
  renderCartNotice();

  // promo code: applied on click; a re-render keeps it if still valid
  document.getElementById('promoBtn').addEventListener('click', applyPromoCode);
  document.getElementById('promoInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); applyPromoCode(); }
  });

  renderFaq();
  render();

  /* Fired after revalidateCartPrices(), so the value reported to the ad
     platforms is the corrected basket rather than whatever price was stored
     in localStorage when the item was added. */
  Track.beginCheckout(Cart.get());
}

/* The cart stores the shelf price from the moment the item was added; the
   preview shows that number, but place_order() charges the *current* database
   price. A price the owner changed (or a product they hid, or a size they
   dropped) while the basket sat in localStorage would otherwise make the
   preview disagree with what the delivery driver collects. Rebuild the basket
   from the live catalogue before the customer reads any number, and tell them
   when something had to change. */
async function revalidateCartPrices() {
  cartNotes = [];
  let live;
  try { live = await DB.getProducts(); } catch { return; }   // keep stored prices
  const byId = new Map(live.map(p => [String(p.id), p]));
  const items = Cart.get();
  let changed = false, removed = false;
  const kept = [];

  for (const it of items) {
    const p = byId.get(String(it.product_id));
    const gone = !p || !p.active ||
      (p.sizes && p.sizes.length && !p.sizes.includes(it.size));
    if (gone) { removed = true; continue; }
    if (Number(p.price) !== Number(it.price) ||
        it.name_fr !== p.name_fr || it.photo !== DB.photoOf(p)) {
      it.price = Number(p.price);
      it.name_fr = p.name_fr; it.name_ar = p.name_ar; it.name_en = p.name_en;
      it.photo = DB.photoOf(p);
      changed = true;
    }
    kept.push(it);
  }

  if (changed || removed) {
    Cart.save(kept);
    // keys, not strings: renderCartNotice() re-translates on language change
    if (changed) cartNotes.push('cart_updated');
    if (removed) cartNotes.push('cart_removed');
  }
}

function renderCartNotice() {
  const el = document.getElementById('cartNotice');
  if (!el) return;
  if (!cartNotes.length) { el.hidden = true; el.textContent = ''; return; }
  el.textContent = cartNotes.map(k => I18N.t(k)).join(' ');
  el.hidden = false;
}

/* The cart stores shelf prices; the global sale lowers them at display time.
   place_order() recomputes everything server-side — this is the preview. */
function effUnit(price) {
  const pct = promo?.active ? Math.min(Math.max(Number(promo.percent) || 0, 0), 90) : 0;
  return Math.round(Number(price) * (100 - pct)) / 100;
}

function render() {
  const items = Cart.get();
  const linesEl = document.getElementById('cartLines');

  if (!items.length) {
    appliedCode = null;
    linesEl.innerHTML = `
      <p style="text-align:center;color:var(--muted);padding:30px 0" data-i18n="cart_empty"></p>
      <div style="text-align:center"><a class="btn-outline" href="./" data-i18n="continue_shopping"></a></div>`;
    linesEl.querySelectorAll('[data-i18n]').forEach(el => el.textContent = I18N.t(el.dataset.i18n));
    ['subtotalVal', 'deliveryVal', 'totalVal'].forEach(id => document.getElementById(id).textContent = '—');
    document.getElementById('promoRow').hidden = true;
    document.getElementById('freeDeliveryBar').hidden = true;
    return;
  }

  // ---- cart lines ----
  linesEl.innerHTML = '';
  items.forEach(it => {
    const unit = effUnit(it.price);
    const row = document.createElement('div');
    row.className = 'cart-line';
    row.innerHTML = `
      <img src="${esc(it.photo)}" alt="">
      <div>
        <div class="name">${esc(I18N.localize(it, 'name'))}</div>
        <div class="meta">${I18N.t('qty')} · ${I18N.fmtPrice(unit)}</div>
        <div class="qty-row">
          <button class="qty-btn" data-act="minus">−</button>
          <span>${it.qty}</span>
          <button class="qty-btn" data-act="plus">+</button>
          <button class="remove-link" data-act="rm" data-i18n="remove"></button>
        </div>
      </div>
      <div class="price">${I18N.fmtPrice(unit * it.qty)}</div>`;
    row.querySelector('[data-act="minus"]').addEventListener('click', () => { Cart.setQty(it.key, it.qty - 1); revalidateCode().then(render); });
    row.querySelector('[data-act="plus"]').addEventListener('click', () => { Cart.setQty(it.key, it.qty + 1); revalidateCode().then(render); });
    row.querySelector('[data-act="rm"]').addEventListener('click', () => { Cart.remove(it.key); revalidateCode().then(render); });
    row.querySelector('[data-i18n="remove"]').textContent = I18N.t('remove');
    linesEl.appendChild(row);
  });

  // ---- order form ----
  currentBaseSubtotal = items.reduce((s, i) => s + effUnit(i.price) * i.qty, 0);
  buildForm(currentBaseSubtotal);
}

/* A saved code may stop qualifying once the basket shrinks below its minimum;
   drop it quietly rather than blocking the order. */
async function revalidateCode() {
  if (!appliedCode) return;
  try {
    await DB.checkPromo(appliedCode.code, currentBaseSubtotal);
  } catch {
    appliedCode = null;
  }
}

async function applyPromoCode() {
  const input = document.getElementById('promoInput');
  const errEl = document.getElementById('promoError');
  errEl.classList.remove('show');
  const code = input.value.trim();
  if (!code) { appliedCode = null; updateTotals(); return; }
  try {
    appliedCode = await DB.checkPromo(code, currentBaseSubtotal);
    updateTotals();
  } catch (e) {
    appliedCode = null;
    updateTotals();
    // the API never echoes the threshold back, so the min-order message asks
    // the customer to add a little more rather than quoting a wrong number
    errEl.textContent = String(e?.message || '').includes('PROMO_MIN_ORDER')
      ? I18N.t('promo_min').replace('{min}', '…')
      : I18N.t('promo_invalid');
    errEl.classList.add('show');
  }
}

function buildForm(subtotal) {
  const right = document.getElementById('cartLines').parentElement.querySelector('.panel:not(#cartLines)');
  let form = document.getElementById('orderForm');
  if (!form) {
    form = document.createElement('div');
    form.id = 'orderForm';
    form.innerHTML = `
      <div class="form-grid" style="margin-top:18px;border-top:1px solid var(--line);padding-top:18px">
        <div><label data-i18n="name"></label><input id="fName" type="text"></div>
        <div><label data-i18n="phone"></label><input id="fPhone" type="tel" placeholder="05 XX XX XX XX"></div>
        <div>
          <label data-i18n="deliv_type"></label>
          <div class="deliv-choice" id="fDeliv">
            <label class="deliv-opt">
              <input type="radio" name="deliv" value="home" checked>
              <span><b data-i18n="deliv_home"></b><small data-i18n="deliv_home_hint"></small></span>
            </label>
            <label class="deliv-opt">
              <input type="radio" name="deliv" value="desk">
              <span><b data-i18n="deliv_desk"></b><small data-i18n="deliv_desk_hint"></small></span>
            </label>
          </div>
        </div>
        <div><label id="fAddressLabel" data-i18n="address"></label><textarea id="fAddress" rows="2"></textarea></div>
        <div><label data-i18n="zone"></label><select id="fZone"></select></div>
        <div class="error-msg" id="formError"></div>
        <button class="btn-gold" id="placeOrderBtn" style="width:100%" data-i18n="place_order"></button>
        <small class="confirm-note">📞 <span data-i18n="confirm_call"></span></small>
      </div>`;
    right.appendChild(form);
    form.querySelector('#placeOrderBtn').addEventListener('click', placeOrder);
    form.querySelector('#fZone').addEventListener('change', updateTotals);
    // the wilaya list shows the price for the chosen method, so switching
    // method has to redraw it, not just recompute the total
    form.querySelectorAll('input[name="deliv"]').forEach(r =>
      r.addEventListener('change', () => { renderZoneOptions(); updateTotals(); }));
    // abandoned-cart capture: once we know WHO they are, keep a server-side
    // copy so a lost customer is a phone call, not a memory
    form.querySelector('#fPhone').addEventListener('input', saveLeadDebounced);
    form.querySelector('#fName').addEventListener('input', saveLeadDebounced);
  }

  // localize labels + placeholders
  form.querySelectorAll('[data-i18n]').forEach(el => el.textContent = I18N.t(el.dataset.i18n));
  form.querySelector('#fPhone').placeholder = '05 XX XX XX XX';
  form.querySelector('#fAddress').placeholder = I18N.t('address');
  document.getElementById('promoBtn').textContent = I18N.t('promo_apply');
  document.getElementById('promoInput').placeholder = I18N.t('promo_code');

  renderZoneOptions();
  updateTotals();
}

/* 'home' (à domicile) or 'desk' (stopdesk, collected from the courier's
   agency). Every wilaya carries both prices; this picks which one is quoted,
   and place_order() applies the same choice server-side. */
function deliveryType() {
  return document.querySelector('input[name="deliv"]:checked')?.value === 'desk'
    ? 'desk' : 'home';
}

function zoneFee(z, type = deliveryType()) {
  // `fee` is the pre-v1.3 single price — kept so a shop whose database has not
  // been upgraded yet still shows a delivery cost instead of zero
  const v = type === 'desk' ? z?.desk : z?.home;
  return Number(v ?? z?.home ?? z?.fee) || 0;
}

/* 58 wilayas, each labelled with the price for the method currently chosen —
   the customer should not have to switch method to find out what it saves. */
function renderZoneOptions() {
  const sel = document.getElementById('fZone');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '';
  zones.forEach(z => {
    const o = document.createElement('option');
    o.value = z.name;
    o.textContent = `${z.code ? z.code + ' · ' : ''}${z.name} — ${I18N.fmtPrice(zoneFee(z))}`;
    sel.appendChild(o);
  });
  if (prev) sel.value = prev;
}

/* Module level, and bound once when the form is built: render() re-runs on
   every quantity change and every language switch, so a listener attached
   here would be added again each time. */
function updateTotals() {
  const form = document.getElementById('orderForm');
  if (!form) return;
  const zone = zones.find(z => z.name === form.querySelector('#fZone').value) || zones[0];
  const sub = currentBaseSubtotal;

  // stopdesk means collecting from the agency, so the street address stops
  // being required — say so rather than leaving a field that looks mandatory
  const desk = deliveryType() === 'desk';
  const addrLabel = document.getElementById('fAddressLabel');
  if (addrLabel) addrLabel.textContent = I18N.t(desk ? 'address_desk_optional' : 'address');

  // promo code discount
  const discount = appliedCode ? Math.round(sub * appliedCode.percent) / 100 : 0;
  const promoRow = document.getElementById('promoRow');
  if (appliedCode) {
    promoRow.hidden = false;
    document.getElementById('promoLabel').textContent =
      I18N.t('promo_applied').replace('{code}', appliedCode.code).replace('{p}', appliedCode.percent);
    document.getElementById('promoVal').textContent = `− ${I18N.fmtPrice(discount)}`;
  } else {
    promoRow.hidden = true;
  }

  // free delivery above the owner's threshold, after discounts
  const qualifies = freeFrom > 0 && (sub - discount) >= freeFrom;
  const fee = qualifies ? 0 : zoneFee(zone);
  document.getElementById('deliveryVal').textContent = qualifies ? I18N.t('delivery_free') : I18N.fmtPrice(fee);

  // progress nudge toward the threshold
  const bar = document.getElementById('freeDeliveryBar');
  if (freeFrom > 0) {
    bar.hidden = false;
    const afterDiscount = sub - discount;
    const pctLeft = Math.max(0, Math.min(100, Math.round((afterDiscount / freeFrom) * 100)));
    const msg = qualifies
      ? I18N.t('free_delivery_qualifies')
      : I18N.t('free_delivery_progress').replace('{x}', I18N.fmtPrice(freeFrom - afterDiscount));
    bar.innerHTML = `<div class="fd-msg">${esc(msg)}</div><div class="fd-track"><i style="width:${qualifies ? 100 : pctLeft}%"></i></div>`;
  } else {
    bar.hidden = true;
  }

  document.getElementById('subtotalVal').textContent = I18N.fmtPrice(sub);
  document.getElementById('totalVal').textContent = I18N.fmtPrice(sub - discount + fee);
  form.dataset.zone = zone?.name || '';
}

/* Delivery / payment / exchange accordion — plain <details>, no JS needed. */
function renderFaq() {
  const box = document.getElementById('faqList');
  box.innerHTML = '';
  [1, 2, 3].forEach(n => {
    const d = document.createElement('details');
    d.className = 'faq-item';
    d.innerHTML = `
      <summary>${esc(I18N.t(`faq_q${n}`))}</summary>
      <p>${esc(I18N.t(`faq_a${n}`))}</p>`;
    box.appendChild(d);
  });
}

async function placeOrder() {
  const err = document.getElementById('formError');
  err.classList.remove('show');
  const name = document.getElementById('fName').value.trim();
  const phone = document.getElementById('fPhone').value.trim();
  const address = document.getElementById('fAddress').value.trim();
  const form = document.getElementById('orderForm');
  const zone = form.dataset.zone;
  const deliv = deliveryType();

  // stopdesk is collected from the courier's agency: the wilaya decides which
  // agency, so a street address adds nothing and must not block the order
  if (!name || !phone || !zone || (deliv === 'home' && !address)) {
    err.textContent = I18N.t('required'); err.classList.add('show'); return;
  }
  // a number the driver cannot ring costs the ad click AND the courier trip,
  // so this is the Algerian mobile format, not "looks vaguely like a phone"
  const dz = dzPhone(phone);
  if (!dz) {
    err.textContent = I18N.t('invalid_phone_dz'); err.classList.add('show'); return;
  }

  const btn = document.getElementById('placeOrderBtn');
  btn.disabled = true; btn.style.opacity = 0.6;

  try {
    // captured before Cart.clear(), because the conversion event needs the
    // lines that were actually ordered
    const ordered = Cart.get();
    const res = await DB.placeOrder({
      customer_name: name, phone: dz, address, zone, items: ordered,
      promo_code: appliedCode?.code || '', delivery_type: deliv,
    });
    Track.purchase(res, ordered);
    Cart.clear();
    document.getElementById('cartView').style.display = 'none';
    document.getElementById('faq').style.display = 'none';
    document.getElementById('successView').style.display = '';
    document.getElementById('orderRef').textContent = `#${res.id}`;
    // the total shown here is the one the database computed, which is also the
    // one the delivery driver will collect — it can differ from the cart if a
    // price changed while the basket sat in localStorage
    document.getElementById('finalTotal').textContent = I18N.fmtPrice(res.total);
    renderSuccessContact();
    const track = document.getElementById('trackLink');
    track.href = `track.html?id=${encodeURIComponent(res.id)}`;
    track.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    err.textContent = orderErrorMessage(e);
    err.classList.add('show');
    btn.disabled = false; btn.style.opacity = 1;
  }
}

/* Cash on delivery asks the customer to trust a stranger with their address,
   so give them a way to reach the shop — a plain contact line, not the order
   confirmation: that belongs on the tracking page, after the shop has
   confirmed the order by phone. */
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
/* ---- abandoned-cart lead capture ----------------------------------------
   Fires (debounced) whenever name + phone look real. One lead per phone per
   session: a repeat event for the same basket is skipped, an updated basket
   overwrites by inserting fresh — the admin screen shows the newest anyway. */
let lastLeadSent = { phone: '', sig: '' };
let leadTimer = null;

function saveLeadDebounced() {
  clearTimeout(leadTimer);
  leadTimer = setTimeout(saveLead, 2500);
}

function saveLead() {
  const name = document.getElementById('fName')?.value.trim() || '';
  const rawPhone = document.getElementById('fPhone')?.value.trim() || '';
  const digits = rawPhone.replace(/\D/g, '').replace(/^(213|00213)/, '');
  const phone = digits.startsWith('0') ? digits : '0' + digits;
  // a lead without a usable number cannot be called back — skip quietly
  if (!/^0[567]\d{8}$/.test(phone) || name.length < 2) return;
  const items = Cart.get().map(i => ({ product_id: i.product_id, size: i.size, qty: i.qty }));
  const total = Number(document.getElementById('totalVal')?.textContent.replace(/\D/g, '')) || 0;
  const sig = phone + '|' + JSON.stringify(items);
  if (phone === lastLeadSent.phone && sig === lastLeadSent.sig) return;
  lastLeadSent = { phone, sig };
  const zoneSel = document.getElementById('fZone');
  DB.saveCheckoutLead({
    phone, name,
    zone: zoneSel?.selectedOptions?.[0]?.textContent?.trim() || '',
    items, total,
  }).catch(() => { /* leads are opportunistic; never nag the customer */ });
}

function orderErrorMessage(e) {
  const code = String(e?.message || '');
  if (code.includes('OUT_OF_STOCK')) return I18N.t('err_stock');
  if (code.includes('PRODUCT_UNAVAILABLE')) return I18N.t('err_unavailable');
  // the daily message first: 'TOO_MANY_ORDERS' is a prefix of it
  if (code.includes('TOO_MANY_ORDERS_TODAY')) return I18N.t('err_too_many_today');
  if (code.includes('TOO_MANY_ORDERS')) return I18N.t('err_too_many');
  if (code.includes('DUPLICATE_ORDER')) return I18N.t('err_duplicate');
  if (code.includes('INVALID_SIZE')) return I18N.t('size_required');
  if (code.includes('INVALID_PHONE')) return I18N.t('invalid_phone_dz');
  if (code.includes('INVALID_PROMO') || code.includes('PROMO_MIN_ORDER')) return I18N.t('promo_invalid');
  if (code.includes('MISSING_FIELDS') || code.includes('UNKNOWN_ZONE')) return I18N.t('required');
  console.error('place_order failed:', e);
  return I18N.t('err_generic');
}

document.addEventListener('DOMContentLoaded', () => { I18N.apply(); initCheckout(); });
