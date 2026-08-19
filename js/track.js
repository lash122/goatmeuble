/* Customer order tracking. Reads through track_order(), which requires both
   the order number and the phone that placed it — the orders table itself
   stays unreadable to visitors. */

const TRACK_STEPS = ['new', 'confirmed', 'shipped', 'delivered'];
let lastResult = null;
let shopPhone = null;   // the shop's WhatsApp number, for the confirmation button

async function initTrack() {
  document.getElementById('year').textContent = new Date().getFullYear();
  renderCartCount();

  document.querySelectorAll('.lang-switch button').forEach(b =>
    b.addEventListener('click', () => { I18N.setLang(b.dataset.lang); }));
  // re-render in the new language rather than making them search again
  document.addEventListener('langchange', () => { if (lastResult) renderResult(lastResult); });

  document.getElementById('tBtn').addEventListener('click', lookup);
  document.getElementById('tPhone').addEventListener('keydown', e => { if (e.key === 'Enter') lookup(); });
  document.getElementById('tId').addEventListener('keydown', e => { if (e.key === 'Enter') lookup(); });

  try {
    const st = await DB.getStore();
    shopPhone = st?.phone || null;
    renderWhatsApp(st);
    // the dashboard-saved template themes the tracking page too
    applyLayout(st?.layout);
  } catch { /* button simply stays hidden */ }

  // deep link from the order-confirmed screen: track.html?id=42
  const id = new URLSearchParams(location.search).get('id');
  if (id) document.getElementById('tId').value = id.replace(/\D/g, '');
}

async function lookup() {
  const err = document.getElementById('tError');
  const box = document.getElementById('tResult');
  const btn = document.getElementById('tBtn');
  err.classList.remove('show');

  const id = document.getElementById('tId').value.replace(/\D/g, '');
  const phone = document.getElementById('tPhone').value.trim();
  if (!id || !phone) {
    err.textContent = I18N.t('required'); err.classList.add('show'); return;
  }

  btn.disabled = true; btn.style.opacity = 0.6;
  try {
    lastResult = await DB.trackOrder(id, phone);
    renderResult(lastResult);
  } catch (e) {
    box.hidden = true;
    lastResult = null;
    // every failure is reported the same way on purpose: distinguishing
    // "wrong phone" from "no such order" would confirm which order numbers exist
    err.textContent = I18N.t('track_not_found');
    err.classList.add('show');
    if (!String(e?.message || '').includes('NOT_FOUND')) console.error(e);
  } finally {
    btn.disabled = false; btn.style.opacity = 1;
  }
}

function renderResult(o) {
  const box = document.getElementById('tResult');
  box.hidden = false;
  box.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'track-head';
  head.innerHTML = `<b>#${esc(o.id)}</b>
    <span>${esc(I18N.t('track_placed'))} ${new Date(o.created_at).toLocaleDateString(
      I18N.getLang() === 'ar' ? 'ar-DZ' : I18N.getLang() === 'fr' ? 'fr-FR' : 'en-US')}</span>`;
  box.appendChild(head);

  box.appendChild(o.status === 'cancelled' ? cancelledBanner() : statusTrail(o.status));

  const items = document.createElement('ul');
  items.className = 'order-items';
  (o.items || []).forEach(i => {
    const qty = Number(i.qty) || 0;
    const li = document.createElement('li');
    li.className = 'order-item';
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    if (i.photo) img.src = i.photo;
    li.appendChild(img);
    const info = document.createElement('div');
    info.className = 'order-item-info';
    const name = document.createElement('b');
    name.textContent = I18N.localize(i, 'name');
    const meta = document.createElement('span');
    meta.textContent = [i.size, `× ${qty}`].filter(Boolean).join(' · ');
    info.append(name, meta);
    li.appendChild(info);
    const price = document.createElement('span');
    price.className = 'order-item-price';
    price.textContent = I18N.fmtPrice(i.price * qty);
    li.appendChild(price);
    items.appendChild(li);
  });
  box.appendChild(items);

  const totals = document.createElement('div');
  totals.className = 'totals';
  totals.style.marginTop = '14px';
  const method = I18N.t(o.delivery_type === 'desk' ? 'deliv_desk' : 'deliv_home');
  totals.innerHTML = `
    <div class="row"><span>${esc(I18N.t('subtotal'))}</span><span>${I18N.fmtPrice(o.subtotal)}</span></div>
    <div class="row"><span>${esc(I18N.t('delivery'))} — ${esc(o.zone)} · ${esc(method)}</span><span>${I18N.fmtPrice(o.delivery_fee)}</span></div>
    <div class="row grand"><span>${esc(I18N.t('total'))}</span><span>${I18N.fmtPrice(o.total)}</span></div>`;
  box.appendChild(totals);

  /* The courier's parcel number, once the shop has handed the parcel over.
     Until then there is nothing to show — and showing an empty "N° de colis"
     invites exactly the phone call it is meant to prevent. */
  if (o.tracking_number) {
    const parcel = document.createElement('div');
    parcel.className = 'parcel-box';
    parcel.innerHTML = `
      <div class="row"><span>${esc(I18N.t('carrier'))}</span><b>${esc(o.carrier || '—')}</b></div>
      <div class="row"><span>${esc(I18N.t('tracking_number'))}</span><b class="parcel-no">${esc(o.tracking_number)}</b></div>
      <small>${esc(I18N.t('tracking_hint'))}</small>`;
    box.appendChild(parcel);
  }

  const cod = document.createElement('div');
  cod.className = 'cod-note';
  cod.style.marginTop = '12px';
  cod.textContent = '💵 ' + I18N.t('cod_only');
  box.appendChild(cod);

  // the WhatsApp confirmation lives HERE, after the order is real — the
  // customer looks the order up post-conversation and sends the shop a
  // prefilled message with the summary and this page's tracking link
  const href = waLink(shopPhone, waOrderMessage(o));
  if (href) {
    const wa = document.createElement('a');
    wa.className = 'wa-confirm';
    wa.href = href;
    wa.target = '_blank';
    wa.rel = 'noopener noreferrer';
    wa.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38a9.86 9.86 0 0 0 4.74 1.2c5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2m0 18.05c-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.15.82.84-3.07-.2-.32a8.16 8.16 0 0 1-1.25-4.35c0-4.5 3.66-8.16 8.16-8.16s8.16 3.66 8.16 8.16-3.66 8.16-8.16 8.16"/></svg>';
    wa.appendChild(document.createTextNode(I18N.t('wa_cta')));
    box.appendChild(wa);
  }
}

/* new → confirmed → shipped → delivered, with everything up to the current
   step marked done so progress is readable at a glance. */
function statusTrail(status) {
  const at = TRACK_STEPS.indexOf(status);
  const trail = document.createElement('ol');
  trail.className = 'track-trail';
  TRACK_STEPS.forEach((step, i) => {
    const li = document.createElement('li');
    li.className = i < at ? 'done' : i === at ? 'current' : '';
    li.innerHTML = `<span class="dot"></span><span>${esc(I18N.t('st_' + step))}</span>`;
    trail.appendChild(li);
  });
  return trail;
}

function cancelledBanner() {
  const div = document.createElement('div');
  div.className = 'track-cancelled';
  div.textContent = I18N.t('st_cancelled');
  return div;
}

document.addEventListener('DOMContentLoaded', () => { I18N.apply(); initTrack(); });
