/* Customer order tracking. Reads through track_order(), which requires both
   the order number and the phone that placed it — the orders table itself
   stays unreadable to visitors. */

const TRACK_STEPS = ['new', 'confirmed', 'shipped', 'delivered'];
let lastResult = null;

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

  try { renderWhatsApp(await DB.getStore()); } catch { /* button simply stays hidden */ }

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
    li.textContent = `${I18N.localize(i, 'name')}${i.size ? ' — ' + i.size : ''} × ${qty}`
      + ` = ${I18N.fmtPrice(i.price * qty)}`;
    items.appendChild(li);
  });
  box.appendChild(items);

  const totals = document.createElement('div');
  totals.className = 'totals';
  totals.style.marginTop = '14px';
  totals.innerHTML = `
    <div class="row"><span>${esc(I18N.t('subtotal'))}</span><span>${I18N.fmtPrice(o.subtotal)}</span></div>
    <div class="row"><span>${esc(I18N.t('delivery'))} — ${esc(o.zone)}</span><span>${I18N.fmtPrice(o.delivery_fee)}</span></div>
    <div class="row grand"><span>${esc(I18N.t('total'))}</span><span>${I18N.fmtPrice(o.total)}</span></div>`;
  box.appendChild(totals);

  const cod = document.createElement('div');
  cod.className = 'cod-note';
  cod.style.marginTop = '12px';
  cod.textContent = '💵 ' + I18N.t('cod_only');
  box.appendChild(cod);
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
