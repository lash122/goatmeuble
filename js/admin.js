/* Admin panel: auth, orders, products, categories, zones, stats */
const STATUSES = [
  ['new', 'Nouvelle', 'new'], ['confirmed', 'Confirmée', 'confirmed'],
  ['shipped', 'Expédiée', 'shipped'], ['delivered', 'Livrée', 'delivered'],
  ['cancelled', 'Annulée', 'cancelled'],
];
let A = { cats: [], products: [], orders: [], zones: [], store: {},
          promo: {}, freeFrom: null, codes: [] };
let orderQuery = '';      // orders search box
let orderSort = 'date_desc';
let chosenLayout = '';    // Apparence tab — pending template choice
let layoutDirty = false;  // true once the owner picks a card on this screen

/* The templates the dashboard can apply (keys match layouts.js). */
const LAYOUT_CHOICES = [
  { key: 'tech', label: 'Tech', desc: 'Navy & bleu électrique — accueil design, produits en avant.', mini: 'tech' },
  { key: 'furniture', label: 'Atelier', desc: 'Lin & noyer, accent terracotta — photos larges, catégories par pièce. Pour le mobilier.', mini: 'furniture' },
  { key: 'sharp', label: 'Sharp', desc: 'Minimaliste noir & blanc — mur masonry, sans héros.', mini: 'sharp' },
];

document.addEventListener('DOMContentLoaded', initAdmin);

async function initAdmin() {
  // the owner must always see what is actually saved — never cached data
  DB.setCacheEnabled(false);
  if (DB.isDemo) {
    // Deliberately does NOT open straight into the panel. If the site is ever
    // deployed with js/config.js still unfilled, an admin page that greets
    // visitors with the management screen looks like a real one left unlocked.
    document.getElementById('demoHint').classList.add('show');
    document.getElementById('loginBtn').addEventListener('click', openShell);
    document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') openShell(); });
  } else {
    document.getElementById('loginBtn').addEventListener('click', doLogin);
    document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    if (await DB.getSession()) openShell();
  }
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await DB.signOut(); location.reload();
  });
  document.querySelectorAll('.admin-tabs button').forEach(b =>
    b.addEventListener('click', () => switchTab(b.dataset.tab)));
  document.getElementById('orderStatusFilter').addEventListener('change', renderOrders);
  document.getElementById('orderSearch').addEventListener('input', e => { orderQuery = e.target.value; renderOrders(); });
  document.getElementById('orderSort').addEventListener('change', e => { orderSort = e.target.value; renderOrders(); });
  document.getElementById('orderExportBtn').addEventListener('click', exportOrdersCsv);
  document.getElementById('addProductBtn').addEventListener('click', () => editProduct(null));
  document.getElementById('addCatBtn').addEventListener('click', () => editCategory(null));
  document.getElementById('addZoneBtn').addEventListener('click', () => addZoneRow({ desk: 450, home: 650 }));
  document.getElementById('zoneSearch').addEventListener('input', e => {
    zoneQuery = e.target.value; renderZones();
  });
  document.getElementById('saveZonesBtn').addEventListener('click', saveZones);
  document.getElementById('saveShopBtn').addEventListener('click', saveShop);
  document.getElementById('saveLayoutBtn').addEventListener('click', () => saveLayout(false));
  // back to the build's own look — clears the saved layout entirely
  document.getElementById('resetLayoutBtn').addEventListener('click', () => {
    chosenLayout = '';
    layoutDirty = true;
    saveLayout(true);
  });
  document.getElementById('savePromoBtn').addEventListener('click', savePromo);
  document.getElementById('saveFreeBtn').addEventListener('click', saveFreeDelivery);
  document.getElementById('addCodeBtn').addEventListener('click', () => editCode(null));
  document.getElementById('editorClose').addEventListener('click', closeEditor);
  document.getElementById('editorModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeEditor();
  });
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  err.classList.remove('show');
  try {
    await DB.signIn(email, pass);
    openShell();
  } catch {
    err.classList.add('show');
  }
}

/* Wraps every write so a rejected row or a dropped connection is visible.
   Silence here is worse than an ugly alert: the panel would refresh and the
   owner's edit would simply be gone. */
async function run(fn, okMsg) {
  try {
    await fn();
    if (okMsg) alert(okMsg);
  } catch (e) {
    console.error(e);
    alert('Erreur : ' + (e?.message || e));
  }
}

async function openShell() {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('adminShell').classList.add('open');
  if (DB.isDemo) document.getElementById('demoTag').textContent = '(mode démo)';
  await run(refreshAll);
  startOrderWatch();   // needs A.orders, so it runs after the first load
}

async function refreshAll() {
  [A.cats, A.products, A.orders, A.zones, A.store, A.promo, A.codes] = await Promise.all([
    DB.getCategories(), DB.getProducts(false), DB.getOrders(), DB.getZones(), DB.getStore(),
    DB.getPromo(), DB.getPromoCodes(),
  ]);
  A.freeFrom = await DB.getFreeDeliveryFrom();
  renderOrders(); renderProducts(); renderCats(); renderZones(); renderShop();
  renderLayouts(); renderPromotions(); renderCodes(); renderStats();
  setNewBadge(A.orders.filter(o => o.status === 'new').length);
}

function setNewBadge(n) {
  const badge = document.getElementById('newOrdersBadge');
  badge.textContent = n;
  badge.style.display = n ? '' : 'none';
}

/* ================= NEW-ORDER WATCH =================

   Cash on delivery is a phone business: an order is worth what it is worth
   only if someone rings the customer back while they still remember placing
   it. Until now the only way to learn an order existed was to reload this
   page and look, so the dashboard is where the alert goes.

   Every 30 seconds it asks the database two numbers — how many orders are
   waiting, and the highest id among them (DB.pollNewOrders). A higher id than
   last time means something arrived, and only then is the full list refetched.

   The alert is three things at once, because any one of them can be missed:
   a chime, a desktop notification, and a count in the browser tab's title —
   the last one is what the owner actually sees when the panel is sitting
   behind ten other tabs. */
const ORDER_POLL_MS = 30000;
const BASE_TITLE = document.title;
let watchTimer = null;
let unseenCount = 0;
let audioCtx = null;
// survives a reload, so re-opening the panel does not re-announce old orders
let lastSeenOrderId = Number(localStorage.getItem('admin_last_order_id')) || 0;

function startOrderWatch() {
  if (watchTimer) return;

  /* Seed from what refreshAll() just loaded. Orders that came in while the
     owner was logged out are already counted by the badge — announcing them
     one by one on login would be noise, not news. */
  const maxId = A.orders.reduce((m, o) => Math.max(m, Number(o.id) || 0), 0);
  lastSeenOrderId = Math.max(lastSeenOrderId, maxId);
  localStorage.setItem('admin_last_order_id', String(lastSeenOrderId));

  document.getElementById('alertsBtn').addEventListener('click', enableAlerts);
  updateAlertsButton();
  setWatchLine('Surveillance active — vérification toutes les 30 secondes.');

  watchTimer = setInterval(checkNewOrders, ORDER_POLL_MS);
  // coming back to the tab is an acknowledgement; drop the title counter
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) clearUnseen();
  });
}

async function checkNewOrders() {
  let poll;
  // a dropped connection or a paused free-tier project must not kill the
  // timer — skip this round and try again in thirty seconds
  try { poll = await DB.pollNewOrders(); } catch { return; }

  setNewBadge(poll.count);
  if (poll.latestId <= lastSeenOrderId) return;

  lastSeenOrderId = poll.latestId;
  localStorage.setItem('admin_last_order_id', String(lastSeenOrderId));
  unseenCount++;
  announceOrder(poll.latestId, poll.count);

  // now, and only now, is it worth refetching the orders themselves
  try {
    A.orders = await DB.getOrders();
    renderOrders();
    renderStats();
  } catch { /* the alert already fired; the table catches up next round */ }
}

function announceOrder(id, waiting) {
  chime();
  updateTitle();
  setWatchLine(`Nouvelle commande #${id} reçue à ${new Date().toLocaleTimeString('fr-FR')} — ${waiting} en attente.`);

  if (window.Notification && Notification.permission === 'granted') {
    try {
      const n = new Notification('Nouvelle commande', {
        body: `Commande #${id} — ${waiting} en attente de confirmation`,
        tag: 'new-order', renotify: true,
      });
      n.onclick = () => { window.focus(); switchTab('orders'); clearUnseen(); n.close(); };
    } catch { /* some browsers refuse constructed notifications; the rest still works */ }
  }
}

/* A two-note chime built with WebAudio rather than an audio file: no asset to
   ship, no request to fail, and nothing to go missing from a build folder. */
function chime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1320, t + 0.13);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.42);
  } catch { /* audio blocked — the badge, title and notification still fire */ }
}

function updateTitle() {
  document.title = unseenCount ? `(${unseenCount}) ${BASE_TITLE}` : BASE_TITLE;
}

function clearUnseen() { unseenCount = 0; updateTitle(); }

function setWatchLine(text) {
  const el = document.getElementById('orderWatch');
  if (el) el.textContent = text;
}

/* Permission can only be requested from a real click, which is why this is a
   button rather than something the page asks for on load. The same click
   unlocks the AudioContext, so the test chime doubles as the audio unlock. */
async function enableAlerts() {
  if (!window.Notification) {
    setWatchLine('Ce navigateur ne gère pas les notifications — le son et le compteur restent actifs.');
    chime();
    return;
  }
  try { await Notification.requestPermission(); } catch { /* older callback-only API */ }
  chime();
  updateAlertsButton();
}

function updateAlertsButton() {
  const btn = document.getElementById('alertsBtn');
  if (!btn) return;
  const state = window.Notification ? Notification.permission : 'unsupported';
  if (state === 'granted') {
    btn.textContent = '🔔 Alertes activées';
    btn.disabled = true;
  } else if (state === 'denied') {
    btn.textContent = '🔕 Alertes bloquées';
    btn.disabled = true;
    btn.title = 'Autorisez les notifications pour ce site dans les réglages du navigateur.';
  } else {
    btn.textContent = '🔔 Activer les alertes';
  }
}

function switchTab(name) {
  document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
  // opening the orders tab is the owner acknowledging the alert
  if (name === 'orders') clearUnseen();
}

/* `esc` lives in i18n.js so the storefront can use it too. */

/* ================= ORDERS ================= */
function statusTag(s) {
  const st = STATUSES.find(x => x[0] === s);
  return `<span class="status-tag status-${st?.[2] || 'new'}">${st?.[1] || s}</span>`;
}

/* The orders the table currently shows: status filter + search + sort.
   The CSV export uses the same list, so the download always matches the
   screen. */
function filteredOrders() {
  const filter = document.getElementById('orderStatusFilter').value;
  const q = orderQuery.trim().toLowerCase();
  let list = A.orders.filter(o => {
    if (filter && o.status !== filter) return false;
    if (!q) return true;
    return [String(o.id), o.customer_name, o.phone, o.zone]
      .some(v => String(v || '').toLowerCase().includes(q));
  });
  if (orderSort === 'date_asc') list = [...list].reverse();
  else if (orderSort === 'total_desc')
    list = [...list].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
  else if (orderSort === 'total_asc')
    list = [...list].sort((a, b) => (Number(a.total) || 0) - (Number(b.total) || 0));
  return list;
}

function renderOrders() {
  const list = filteredOrders();
  const body = document.getElementById('ordersBody');
  body.innerHTML = '';
  document.getElementById('orderCount').textContent =
    `${list.length} commande${list.length > 1 ? 's' : ''} affichée${list.length > 1 ? 's' : ''}` +
    (list.length !== A.orders.length ? ` sur ${A.orders.length}` : '');
  // the next step of new → confirmed → shipped → delivered; cancelled is a
  // dead end with nothing to advance to
  const nextStatus = s => {
    if (s === 'cancelled') return null;
    const i = STATUSES.findIndex(x => x[0] === s);
    return i >= 0 && i < 3 ? STATUSES[i + 1] : null;
  };
  list.forEach(o => {
    const tr = document.createElement('tr');
    // qty arrives from the public order form: a non-number would make `+`
    // concatenate, dropping raw text straight into the HTML below
    const itemsCount = (o.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
    tr.innerHTML = `
      <td><b>#${o.id}</b><br><small style="color:var(--muted)">${new Date(o.created_at || Date.now()).toLocaleDateString('fr-FR')}</small></td>
      <td>${esc(o.customer_name)}<br><small style="color:var(--muted)">${esc(o.phone)}</small></td>
      <td>${esc(o.zone)}<br><small style="color:var(--muted)">${o.delivery_type === 'desk' ? '🏢 Stop desk' : '🏠 À domicile'}</small></td>
      <td><b>${I18N.fmtPrice(o.total)}</b></td>
      <td>${itemsCount} article(s)</td>
      <td>${statusTag(o.status)}</td>
      <td>
        <div class="row-actions">
          <button class="btn-mini" data-a="view">Voir</button>
          ${nextStatus(o.status) ? `<button class="btn-mini adv" data-a="advance" title="${nextStatus(o.status)[1]}">→ ${nextStatus(o.status)[1]}</button>` : ''}
          <select class="btn-mini" data-a="status" style="padding:5px 8px">
            ${STATUSES.map(s => `<option value="${s[0]}" ${s[0] === o.status ? 'selected' : ''}>${s[1]}</option>`).join('')}
          </select>
          <button class="btn-mini danger" data-a="del" title="Supprimer définitivement">🗑</button>
        </div>
      </td>`;
    tr.querySelector('[data-a="view"]').addEventListener('click', () => viewOrder(o));
    const advBtn = tr.querySelector('[data-a="advance"]');
    if (advBtn) advBtn.addEventListener('click', () =>
      run(async () => {
        await DB.updateOrderStatus(o.id, nextStatus(o.status)[0]);
        await refreshAll();
      }, `Statut : ${nextStatus(o.status)[1]}`));
    tr.querySelector('[data-a="status"]').addEventListener('change', e =>
      run(async () => {
        await DB.updateOrderStatus(o.id, e.target.value);
        await refreshAll();
      }));
    tr.querySelector('[data-a="del"]').addEventListener('click', () => deleteOrder(o));
    body.appendChild(tr);
  });
  if (!body.children.length) body.innerHTML = '<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:26px">Aucune commande</td></tr>';
}

async function deleteOrder(o) {
  if (!confirm(`Supprimer définitivement la commande #${o.id} (${o.customer_name}) ?\nCette action est irréversible.`)) return;
  await run(async () => {
    await DB.deleteOrder(o.id);
    await refreshAll();
  }, 'Commande supprimée');
}

/* Export the current view (filter + search + sort) to an Excel-friendly CSV.
   The UTF-8 BOM makes Excel read the Arabic names correctly. */
function exportOrdersCsv() {
  const rows = filteredOrders();
  if (!rows.length) { alert('Aucune commande à exporter'); return; }
  const csvEsc = v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  // this file is what gets handed to the courier, so it carries the two things
  // they actually need: which service, and the parcel number once assigned
  const header = ['ID', 'Date', 'Client', 'Téléphone', 'Zone', 'Livraison', 'Adresse',
    'Articles', 'Sous-total (DA)', 'Remise (DA)', 'Frais livraison (DA)', 'Total (DA)',
    'Statut', 'Transporteur', 'N° colis'];
  const lines = [header.join(',')];
  rows.forEach(o => {
    const items = (o.items || []).map(i =>
      `${i.name_fr || i.name_en || i.name_ar || ''}${i.size ? ' [' + i.size + ']' : ''} ×${Number(i.qty) || 1}`
    ).join('; ');
    const status = (STATUSES.find(s => s[0] === o.status) || [])[1] || o.status;
    lines.push([
      o.id,
      new Date(o.created_at || Date.now()).toLocaleDateString('fr-FR'),
      o.customer_name, o.phone, o.zone,
      o.delivery_type === 'desk' ? 'Stop desk' : 'À domicile',
      o.address, items,
      o.subtotal, o.discount || 0, o.delivery_fee || 0, o.total, status,
      o.carrier || '', o.tracking_number || '',
    ].map(csvEsc).join(','));
  });
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `commandes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function viewOrder(o) {
  const itemsHtml = (o.items || []).map(i => {
    const qty = Number(i.qty) || 0;
    const img = i.photo
      ? `<img src="${esc(i.photo)}" alt="" loading="lazy">`
      : '<img alt="" hidden>';
    return `<li class="order-item">${img}<div class="order-item-info"><b>${esc(I18N.localize(i, 'name'))}</b>` +
      `<span>${esc(i.size || '')}${i.size ? ' · ' : ''}× ${qty}</span></div>` +
      `<span class="order-item-price">${I18N.fmtPrice(i.price * qty)}</span></li>`;
  }).join('');
  const desk = o.delivery_type === 'desk';
  // progress strip: where this order sits between the four live statuses
  const at = STATUSES.findIndex(s => s[0] === o.status);
  const timeline = o.status === 'cancelled' ? '' :
    `<div class="status-timeline">${STATUSES.slice(0, 4).map((s, i) =>
      `<span class="st ${i < at ? 'done' : i === at ? 'current' : ''}">${i < at ? '✓ ' : ''}${s[1]}</span>`)
      .join('<i>›</i>')}</div>`;
  openEditor(
    `<h3 style="margin-bottom:14px">Commande #${o.id}</h3>
    ${timeline}
    <p><b>Client :</b> ${esc(o.customer_name)}</p>
    <p><b>Téléphone :</b> ${esc(o.phone)}</p>
    <p><b>Adresse :</b> ${esc(o.address) || '<span style="color:var(--muted)">— (stop desk)</span>'}</p>
    <p><b>Zone :</b> ${esc(o.zone)} — ${desk ? '🏢 Stop desk' : '🏠 À domicile'}</p>
    <p><b>Statut :</b> ${statusTag(o.status)}</p>
    <p style="margin-top:12px"><b>Articles :</b></p>
    <ul class="order-items">${itemsHtml}</ul>
    <div class="totals" style="margin-top:14px">
      <div class="row"><span>Sous-total</span><span>${I18N.fmtPrice(o.subtotal)}</span></div>
      ${Number(o.discount) > 0 ? `<div class="row"><span>Remise${o.promo_code ? ` (${esc(o.promo_code)})` : ''}</span><span>− ${I18N.fmtPrice(o.discount)}</span></div>` : ''}
      <div class="row"><span>Livraison</span><span>${Number(o.delivery_fee) === 0 ? 'Offerte' : I18N.fmtPrice(o.delivery_fee)}</span></div>
      <div class="row grand"><span>Total (à payer à la livraison)</span><span>${I18N.fmtPrice(o.total)}</span></div>
    </div>
    <div class="cod-note" style="margin-top:10px">💵 Paiement à la livraison</div>

    <!-- The courier's own parcel number. Saved here it appears on the
         customer's tracking page, which is where "où est ma commande ?"
         otherwise turns into a phone call to the shop. -->
    <div class="f-grid" style="margin-top:18px;border-top:1px solid var(--line);padding-top:14px">
      <b style="font-size:0.95rem">Expédition</b>
      <div class="f-grid two">
        <div>
          <label>Transporteur</label>
          <input id="o_carrier" list="carrierList" placeholder="Yalidine, ZR Express…" value="${esc(o.carrier || '')}">
          <datalist id="carrierList">
            <option value="Yalidine"></option><option value="ZR Express"></option>
            <option value="Noest"></option><option value="Maystro"></option>
            <option value="EMS Anderson"></option>
          </datalist>
        </div>
        <div>
          <label>N° de colis</label>
          <input id="o_tracking" placeholder="Numéro du bordereau" value="${esc(o.tracking_number || '')}">
        </div>
      </div>
      <button class="a-btn gold" id="o_saveShipping">💾 Enregistrer l'expédition</button>
    </div>

    <button class="a-btn ghost" style="margin-top:18px;width:100%" id="o_close">Fermer</button>
  `, () => {
    document.getElementById('o_close').addEventListener('click', closeEditor);
    document.getElementById('o_saveShipping').addEventListener('click', () => {
      const carrier = document.getElementById('o_carrier').value;
      const tracking = document.getElementById('o_tracking').value;
      run(async () => {
        await DB.saveOrderShipping(o.id, carrier, tracking);
        // patch the row in place: refreshAll() here would close the panel the
        // owner is still looking at
        o.carrier = carrier.trim();
        o.tracking_number = tracking.trim();
        renderOrders();
      }, 'Expédition enregistrée ✓');
    });
  });
}

/* ================= PRODUCTS ================= */
function renderProducts() {
  const body = document.getElementById('productsBody');
  body.innerHTML = '';
  A.products.forEach(p => {
    const cat = A.cats.find(c => c.id === p.category_id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><img class="thumb" src="${DB.photoOf(p)}" alt=""></td>
      <td><b>${esc(p.name_fr)}</b><br><small style="color:var(--muted)">${esc(p.name_ar)}</small></td>
      <td>${I18N.fmtPrice(p.price)}</td>
      <td class="${p.stock <= 0 ? 'stock-out' : p.stock <= 2 ? 'stock-low' : ''}">${p.stock}${p.stock <= 2 ? ' ⚠' : ''}</td>
      <td>${esc(cat?.name_fr || '—')}</td>
      <td>${p.active ? '✅ active' : '⏸ masqué'}${p.featured ? ' · ⭐' : ''}</td>
      <td>
        <div class="row-actions">
          <button class="btn-mini" data-a="edit">Modifier</button>
          <button class="btn-mini danger" data-a="del">Supprimer</button>
        </div>
      </td>`;
    tr.querySelector('[data-a="edit"]').addEventListener('click', () => editProduct(p));
    tr.querySelector('[data-a="del"]').addEventListener('click', () => {
      if (!confirm(`Supprimer « ${p.name_fr} » ?`)) return;
      // pass the photos so their files leave Storage with the row
      run(async () => { await DB.deleteProduct(p.id, p.photos); await refreshAll(); });
    });
    body.appendChild(tr);
  });
  if (!body.children.length) body.innerHTML = '<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:26px">Aucun produit</td></tr>';
}

function editProduct(p) {
  const isNew = !p;
  const d = p || { name_fr: '', name_ar: '', name_en: '', description_fr: '', description_ar: '', description_en: '', price: '', compare_at_price: '', photos: [], sizes: ['S','M','L','XL'], category_id: '', stock: 10, featured: false, active: true };
  let photos = [...(d.photos || [])];

  openEditor(`
    <h3 style="margin-bottom:16px">${isNew ? 'Nouveau produit' : 'Modifier — ' + esc(d.name_fr)}</h3>
    <div class="f-grid">
      <div class="f-grid two">
        <div><label>Nom (FR)</label><input id="p_fr" value="${esc(d.name_fr)}"></div>
        <div><label>الاسم (AR)</label><input id="p_ar" value="${esc(d.name_ar)}" dir="rtl"></div>
      </div>
      <div class="f-grid two">
        <div><label>Name (EN)</label><input id="p_en" value="${esc(d.name_en)}"></div>
        <div><label>Catégorie</label><select id="p_cat">
          <option value="">—</option>
          ${A.cats.map(c => `<option value="${c.id}" ${c.id === d.category_id ? 'selected' : ''}>${esc(c.name_fr)}</option>`).join('')}
        </select></div>
      </div>
      <div class="f-grid two">
        <div><label>Prix (DA)</label><input id="p_price" type="number" min="0" value="${d.price}"></div>
        <div><label>Ancien prix (optionnel)</label><input id="p_old" type="number" min="0" value="${d.compare_at_price || ''}"></div>
      </div>
      <div class="f-grid two">
        <div><label>Stock</label><input id="p_stock" type="number" min="0" value="${d.stock}"></div>
        <div><label>Tailles (séparées par virgule)</label><input id="p_sizes" value="${esc((d.sizes || []).join(','))}"></div>
      </div>
      <div><label>Description (FR)</label><textarea id="p_dfr" rows="2">${esc(d.description_fr)}</textarea></div>
      <div><label>الوصف (AR)</label><textarea id="p_dar" rows="2" dir="rtl">${esc(d.description_ar)}</textarea></div>
      <div><label>Description (EN)</label><textarea id="p_den" rows="2">${esc(d.description_en)}</textarea></div>
      <div><label>Photos</label><div class="photo-up" id="p_photos"></div>
        <input type="file" id="p_file" accept="image/*" multiple hidden></div>
      <div class="checks">
        <label><input type="checkbox" id="p_active" ${d.active ? 'checked' : ''}> Actif (visible)</label>
        <label><input type="checkbox" id="p_feat" ${d.featured ? 'checked' : ''}> ⭐ Mis en avant</label>
      </div>
      <button class="a-btn gold" id="p_save" style="margin-top:6px">💾 Enregistrer</button>
    </div>
  `);

  const photosEl = document.getElementById('p_photos');
  function renderPhotos() {
    photosEl.innerHTML = '';
    photos.forEach((src, i) => {
      const div = document.createElement('div');
      div.className = 'ph';
      div.innerHTML = `<img src="${src}"><button title="Supprimer">×</button>`;
      div.querySelector('button').addEventListener('click', () => { photos.splice(i, 1); renderPhotos(); });
      photosEl.appendChild(div);
    });
    const add = document.createElement('button');
    add.className = 'add-photo'; add.textContent = '+';
    add.addEventListener('click', () => document.getElementById('p_file').click());
    photosEl.appendChild(add);
  }
  renderPhotos();
  document.getElementById('p_file').addEventListener('change', async e => {
    for (const f of e.target.files) {
      try { photos.push(await DB.uploadPhoto(f)); } catch (err) { alert('Upload: ' + err.message); }
    }
    renderPhotos();
  });

  document.getElementById('p_save').addEventListener('click', async () => {
    const rec = {
      ...(p || {}),
      name_fr: val('p_fr'), name_ar: val('p_ar') || val('p_fr'), name_en: val('p_en') || val('p_fr'),
      description_fr: val('p_dfr'), description_ar: val('p_dar'), description_en: val('p_den'),
      price: Number(val('p_price')) || 0,
      compare_at_price: val('p_old') ? Number(val('p_old')) : null,
      stock: Number(val('p_stock')) || 0,
      sizes: val('p_sizes').split(',').map(s => s.trim()).filter(Boolean),
      category_id: val('p_cat') ? Number(val('p_cat')) : null,
      photos, featured: document.getElementById('p_feat').checked,
      active: document.getElementById('p_active').checked,
    };
    if (!rec.name_fr) { alert('Nom requis'); return; }
    run(async () => {
      await DB.saveProduct(rec);
      closeEditor();
      await refreshAll();
    });
  });
  function val(id) { return document.getElementById(id).value.trim(); }
}

/* ================= CATEGORIES ================= */
function renderCats() {
  const body = document.getElementById('catsBody');
  body.innerHTML = '';
  A.cats.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.image ? `<img class="thumb" src="${esc(c.image)}" alt="" style="width:44px;height:44px;border-radius:8px">` : ''}</td>
      <td><b>${esc(c.name_fr)}</b></td><td>${esc(c.name_ar)}</td><td>${esc(c.name_en)}</td><td>${c.sort}</td>
      <td><div class="row-actions">
        <button class="btn-mini" data-a="edit">Modifier</button>
        <button class="btn-mini danger" data-a="del">Supprimer</button>
      </div></td>`;
    tr.querySelector('[data-a="edit"]').addEventListener('click', () => editCategory(c));
    tr.querySelector('[data-a="del"]').addEventListener('click', () => {
      if (!confirm(`Supprimer « ${c.name_fr} » ?`)) return;
      run(async () => { await DB.deleteCategory(c.id, c.image); await refreshAll(); });
    });
    body.appendChild(tr);
  });
  if (!body.children.length) body.innerHTML = '<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:26px">Aucune catégorie</td></tr>';
}

function editCategory(c) {
  const d = c || { name_fr: '', name_ar: '', name_en: '', image: '', sort: (A.cats.length + 1) * 10 };
  let image = d.image || '';
  openEditor(`
    <h3 style="margin-bottom:16px">${c ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h3>
    <div class="f-grid">
      <div><label>Nom (FR)</label><input id="c_fr" value="${esc(d.name_fr)}"></div>
      <div><label>الاسم (AR)</label><input id="c_ar" value="${esc(d.name_ar)}" dir="rtl"></div>
      <div><label>Name (EN)</label><input id="c_en" value="${esc(d.name_en)}"></div>
      <div><label>Photo de la catégorie (grande vignette de la page d'accueil)</label>
        <div class="photo-up" id="c_photos"></div>
        <input type="file" id="c_file" accept="image/*" hidden></div>
      <div><label>Ordre d'affichage</label><input id="c_sort" type="number" value="${d.sort}"></div>
      <button class="a-btn gold" id="c_save">💾 Enregistrer</button>
    </div>
  `);

  const photosEl = document.getElementById('c_photos');
  function renderCatPhoto() {
    photosEl.innerHTML = '';
    if (image) {
      const div = document.createElement('div');
      div.className = 'ph';
      div.innerHTML = `<img src="${esc(image)}"><button title="Supprimer">×</button>`;
      div.querySelector('button').addEventListener('click', () => { image = ''; renderCatPhoto(); });
      photosEl.appendChild(div);
    }
    const add = document.createElement('button');
    add.className = 'add-photo'; add.textContent = '+';
    add.addEventListener('click', () => document.getElementById('c_file').click());
    photosEl.appendChild(add);
  }
  renderCatPhoto();
  document.getElementById('c_file').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try { image = await DB.uploadCategoryPhoto(f); renderCatPhoto(); }
    catch (err) { alert('Upload : ' + err.message); }
  });

  document.getElementById('c_save').addEventListener('click', async () => {
    const rec = {
      ...(c || {}),
      name_fr: document.getElementById('c_fr').value.trim(),
      name_ar: document.getElementById('c_ar').value.trim() || document.getElementById('c_fr').value.trim(),
      name_en: document.getElementById('c_en').value.trim() || document.getElementById('c_fr').value.trim(),
      image,
      sort: Number(document.getElementById('c_sort').value) || 0,
    };
    if (!rec.name_fr) { alert('Nom requis'); return; }
    run(async () => {
      await DB.saveCategory(rec);
      closeEditor();
      await refreshAll();
    });
  });
}

/* ================= ZONES ================= */
/* ================= DELIVERY ZONES =================
   58 wilayas, each with two prices: stopdesk (the customer collects from the
   courier's agency) and à domicile. Stopdesk is markedly cheaper and a large
   share of Algerian customers only order at that price, so both have to be
   set — a wilaya priced at 0 for stopdesk offers it free, not "not offered".

   58 rows is a lot to scroll, hence the filter box. */
let zoneQuery = '';

function renderZones() {
  const box = document.getElementById('zonesBox');
  box.innerHTML = '';
  const q = zoneQuery.trim().toLowerCase();
  const shown = A.zones.filter(z =>
    !q || String(z.name).toLowerCase().includes(q) || String(z.code || '') === q);

  shown.forEach(z => addZoneRow(z));
  document.getElementById('zoneCount').textContent =
    q ? `${shown.length} / ${A.zones.length} wilayas` : `${A.zones.length} wilayas`;
}

function addZoneRow(z = {}) {
  const box = document.getElementById('zonesBox');
  const div = document.createElement('div');
  div.className = 'zone-edit';
  div.dataset.code = z.code ?? '';
  // `fee` is the pre-v1.3 single price; show it as the home price rather than
  // silently resetting a shop that has not re-run schema.sql to zero
  const home = z.home ?? z.fee ?? 0;
  const desk = z.desk ?? z.fee ?? 0;
  div.innerHTML = `
    <span class="z-code">${z.code ? String(z.code).padStart(2, '0') : '—'}</span>
    <input class="z-name" placeholder="Wilaya" value="${esc(z.name || '')}">
    <label class="z-lab">Stop desk<input class="z-desk" type="number" min="0" value="${Number(desk)}"></label>
    <label class="z-lab">À domicile<input class="z-home" type="number" min="0" value="${Number(home)}"></label>
    <button class="btn-mini danger" title="Supprimer">×</button>`;
  div.querySelector('button').addEventListener('click', () => div.remove());
  box.appendChild(div);
}

async function saveZones() {
  /* Only the rows on screen are in the DOM, so saving while the filter is
     active would silently delete every wilaya not matching it. Merge the
     edited rows back over the full list instead. */
  const edited = new Map();
  document.querySelectorAll('.zone-edit').forEach(d => {
    const name = d.querySelector('.z-name').value.trim();
    if (!name) return;
    edited.set(name.toLowerCase(), {
      code: d.dataset.code ? Number(d.dataset.code) : undefined,
      name,
      desk: Number(d.querySelector('.z-desk').value) || 0,
      home: Number(d.querySelector('.z-home').value) || 0,
    });
  });

  const zones = A.zones
    .map(z => edited.get(String(z.name).toLowerCase()) || z)
    // a row deleted while unfiltered really is a deletion
    .filter(z => !zoneQuery.trim() ? edited.has(String(z.name).toLowerCase()) : true);

  // wilayas typed in by hand that were not in the list before
  edited.forEach((z, key) => {
    if (!zones.some(x => String(x.name).toLowerCase() === key)) zones.push(z);
  });

  await run(async () => {
    await DB.saveZones(zones);
    A.zones = zones;
    renderZones();
  }, 'Zones enregistrées ✓');
}

/* ================= SHOP INFO =================
   The data layer has always had saveStore(), but nothing ever called it, so
   the phone stayed empty and the footer rendered a dash. */
function renderShop() {
  const st = A.store || {};
  document.getElementById('s_name').value = st.name || '';
  document.getElementById('s_phone').value = st.phone || '';
  document.getElementById('s_email').value = st.email || '';
  document.getElementById('s_facebook').value = st.facebook || '';
  document.getElementById('s_instagram').value = st.instagram || '';
  document.getElementById('s_tiktok').value = st.tiktok || '';
}

async function saveShop() {
  const store = {
    name: document.getElementById('s_name').value.trim(),
    phone: document.getElementById('s_phone').value.trim(),
    email: document.getElementById('s_email').value.trim(),
    // social links are optional; they appear as icon links in the site footer
    facebook: document.getElementById('s_facebook').value.trim(),
    instagram: document.getElementById('s_instagram').value.trim(),
    tiktok: document.getElementById('s_tiktok').value.trim(),
    // the template choice from the Apparence tab must survive a save here
    layout: A.store?.layout || null,
  };
  if (!store.name) { alert('Le nom de la boutique est requis'); return; }
  await run(async () => {
    await DB.saveStore(store);
    A.store = store;
  }, 'Informations enregistrées ✓');
}

/* ================= APPEARANCE =================
   The dashboard picks one of the three templates; the choice travels with
   the shop settings and the storefront applies it at runtime (layouts.js).
   The Aperçu link forces ?layout=<key> without saving — safe to try freely. */
function renderLayouts() {
  const grid = document.getElementById('layoutGrid');
  if (!grid) return;
  // a card picked on this screen wins over the saved value; otherwise the
  // picker reflects what is actually saved
  if (!layoutDirty) {
    const current = A.store?.layout || '';
    chosenLayout = LAYOUT_CHOICES.some(l => l.key === current) ? current : '';
  }
  grid.innerHTML = '';
  const minis = {
    tech: '<i class="m-grid"></i><i class="m-chip"></i>',
    furniture: '<i class="m-band"></i><i class="m-wide a"></i><i class="m-wide b"></i>',
    sharp: '<i class="m-top"></i><i class="m-tile a"></i><i class="m-tile b"></i><i class="m-tile c"></i><i class="m-dot"></i>',
  };
  LAYOUT_CHOICES.forEach(l => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'layout-card' + (l.key === chosenLayout ? ' selected' : '');
    card.setAttribute('aria-pressed', String(l.key === chosenLayout));
    card.innerHTML = `
      <span class="mini ${l.mini}">${minis[l.mini]}</span>
      <b>${esc(l.label)}</b>
      <small>${esc(l.desc)}</small>`;
    card.addEventListener('click', () => { chosenLayout = l.key; layoutDirty = true; renderLayouts(); });
    grid.appendChild(card);
  });
  // './' rather than 'index.html' — the shop's public URL is the bare
  // directory, and the preview should open the address customers actually see
  document.getElementById('previewLayoutLink').href = chosenLayout
    ? `./?layout=${chosenLayout}` : './';
}

async function saveLayout(skipConfirm) {
  if (!chosenLayout && !skipConfirm) {
    if (!confirm('Aucun thème sélectionné — la boutique gardera son apparence actuelle. Continuer ?')) return;
  }
  await run(async () => {
    const store = { ...(A.store || {}), layout: chosenLayout || null };
    await DB.saveStore(store);
    A.store = store;
    layoutDirty = false;
    renderLayouts();
  }, chosenLayout
    ? 'Thème enregistré ✓ — la boutique l’affiche maintenant'
    : 'Apparence d’origine restaurée ✓');
}

/* ================= PROMOTIONS (v1.1) ================= */
function renderPromotions() {
  const p = A.promo || {};
  document.getElementById('pr_active').checked = !!p.active;
  document.getElementById('pr_percent').value = p.percent || '';
  document.getElementById('pr_label_fr').value = p.label_fr || '';
  document.getElementById('pr_label_ar').value = p.label_ar || '';
  document.getElementById('pr_label_en').value = p.label_en || '';
  document.getElementById('pr_free_from').value = A.freeFrom || 0;
}

async function savePromo() {
  const percent = Number(document.getElementById('pr_percent').value) || 0;
  if (percent < 1 || percent > 90) { alert('Réduction entre 1 et 90 %'); return; }
  const promo = {
    active: document.getElementById('pr_active').checked,
    percent,
    label_fr: document.getElementById('pr_label_fr').value.trim(),
    label_ar: document.getElementById('pr_label_ar').value.trim(),
    label_en: document.getElementById('pr_label_en').value.trim(),
  };
  await run(async () => {
    await DB.savePromo(promo);
    A.promo = promo;
  }, 'Soldes enregistrées ✓');
}

async function saveFreeDelivery() {
  const n = Math.max(0, Number(document.getElementById('pr_free_from').value) || 0);
  await run(async () => {
    await DB.saveFreeDeliveryFrom(n || null);
    A.freeFrom = n || null;
  }, 'Livraison gratuite enregistrée ✓');
}

function renderCodes() {
  const body = document.getElementById('codesBody');
  body.innerHTML = '';
  (A.codes || []).forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${esc(c.code)}</b></td>
      <td>-${c.percent}%</td>
      <td>${c.min_order ? I18N.fmtPrice(c.min_order) : '—'}</td>
      <td>${c.active ? '✅ actif' : '⏸ inactif'}</td>
      <td><div class="row-actions">
        <button class="btn-mini" data-a="edit">Modifier</button>
        <button class="btn-mini danger" data-a="del">Supprimer</button>
      </div></td>`;
    tr.querySelector('[data-a="edit"]').addEventListener('click', () => editCode(c));
    tr.querySelector('[data-a="del"]').addEventListener('click', () => {
      if (!confirm(`Supprimer le code « ${c.code} » ?`)) return;
      run(async () => { await DB.deletePromoCode(c.id); await refreshAll(); });
    });
    body.appendChild(tr);
  });
  if (!body.children.length) body.innerHTML = '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:20px">Aucun code</td></tr>';
}

function editCode(c) {
  const d = c || { code: '', percent: 10, min_order: 0, active: true };
  openEditor(`
    <h3 style="margin-bottom:16px">${c ? 'Modifier — ' + esc(d.code) : 'Nouveau code promo'}</h3>
    <div class="f-grid">
      <div><label>Code (le client le tape tel quel)</label>
        <input id="cd_code" value="${esc(d.code)}" style="text-transform:uppercase" placeholder="BIENVENUE10"></div>
      <div class="f-grid two">
        <div><label>Réduction (%)</label><input id="cd_percent" type="number" min="1" max="90" value="${d.percent}"></div>
        <div><label>Minimum de commande (DA, 0 = aucun)</label><input id="cd_min" type="number" min="0" value="${d.min_order}"></div>
      </div>
      <div class="checks">
        <label><input type="checkbox" id="cd_active" ${d.active ? 'checked' : ''}> Actif</label>
      </div>
      <button class="a-btn gold" id="cd_save">💾 Enregistrer</button>
    </div>
  `);
  document.getElementById('cd_save').addEventListener('click', () => {
    const rec = {
      ...(c || {}),
      code: document.getElementById('cd_code').value.trim().toUpperCase(),
      percent: Number(document.getElementById('cd_percent').value) || 0,
      min_order: Number(document.getElementById('cd_min').value) || 0,
      active: document.getElementById('cd_active').checked,
    };
    if (!rec.code) { alert('Code requis'); return; }
    if (rec.percent < 1 || rec.percent > 90) { alert('Réduction entre 1 et 90 %'); return; }
    run(async () => {
      await DB.savePromoCode(rec);
      closeEditor();
      await refreshAll();
    });
  });
}

/* ================= STATS ================= */
function renderStats() {
  const orders = A.orders;
  const delivered = orders.filter(o => o.status === 'delivered');
  const revenue = delivered.reduce((s, o) => s + Number(o.total), 0);
  const pending = orders.filter(o => ['new', 'confirmed', 'shipped'].includes(o.status)).length;

  document.getElementById('statCards').innerHTML = `
    <div class="stat-card gold"><div class="v">${I18N.fmtPrice(revenue)}</div><div class="k">Revenu livré</div></div>
    <div class="stat-card"><div class="v">${orders.length}</div><div class="k">Commandes totales</div></div>
    <div class="stat-card"><div class="v">${delivered.length}</div><div class="k">Livrées</div></div>
    <div class="stat-card"><div class="v">${pending}</div><div class="k">En cours</div></div>
    <div class="stat-card"><div class="v">${orders.filter(o => o.status === 'cancelled').length}</div><div class="k">Annulées</div></div>`;

  // top products
  const counts = {};
  orders.forEach(o => (o.items || []).forEach(i => {
    const k = i.name_fr || `#${i.product_id}`;
    counts[k] = counts[k] || { qty: 0, rev: 0 };
    counts[k].qty += Number(i.qty) || 0;
    counts[k].rev += (Number(i.qty) || 0) * Number(i.price);
  }));
  const top = Object.entries(counts).sort((a, b) => b[1].qty - a[1].qty).slice(0, 8);
  const maxQty = top[0]?.[1].qty || 1;
  document.getElementById('topProducts').innerHTML = top.length
    ? top.map(([name, v]) => `
      <div class="bar-row">
        <span>${esc(name)}</span>
        <div class="bar"><i style="width:${(v.qty / maxQty) * 100}%"></i></div>
        <span style="text-align:end">${v.qty}</span>
      </div>`).join('')
    : '<p style="color:var(--muted)">Pas encore de ventes</p>';

  // zone stats
  const zoneCounts = {};
  orders.forEach(o => zoneCounts[o.zone] = (zoneCounts[o.zone] || 0) + 1);
  const zoneEntries = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]);
  const maxZone = zoneEntries[0]?.[1] || 1;
  document.getElementById('zoneStats').innerHTML = zoneEntries.length
    ? zoneEntries.map(([z, n]) => `
      <div class="bar-row">
        <span>${esc(z)}</span>
        <div class="bar"><i style="width:${(n / maxZone) * 100}%"></i></div>
        <span style="text-align:end">${n}</span>
      </div>`).join('')
    : '<p style="color:var(--muted)">Pas encore de commandes</p>';
}

/* ================= editor modal helpers ================= */
/* `onMount` runs once the markup is in the DOM, so panels can wire up their
   own buttons instead of reaching for inline onclick handlers. */
function openEditor(html, onMount) {
  document.getElementById('editorBody').innerHTML = html;
  document.getElementById('editorModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  if (onMount) onMount();
}
function closeEditor() {
  document.getElementById('editorModal').classList.remove('open');
  document.body.style.overflow = '';
}
