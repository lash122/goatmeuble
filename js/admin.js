/* Admin panel: auth, orders, products, categories, zones, stats */
const STATUSES = [
  ['new', 'Nouvelle', 'new'], ['confirmed', 'Confirmée', 'confirmed'],
  ['shipped', 'Expédiée', 'shipped'], ['delivered', 'Livrée', 'delivered'],
  ['cancelled', 'Annulée', 'cancelled'],
];
let A = { cats: [], products: [], orders: [], zones: [], store: {} };

document.addEventListener('DOMContentLoaded', initAdmin);

async function initAdmin() {
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
  document.getElementById('addProductBtn').addEventListener('click', () => editProduct(null));
  document.getElementById('addCatBtn').addEventListener('click', () => editCategory(null));
  document.getElementById('addZoneBtn').addEventListener('click', () => addZoneRow('', 600));
  document.getElementById('saveZonesBtn').addEventListener('click', saveZones);
  document.getElementById('saveShopBtn').addEventListener('click', saveShop);
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
}

async function refreshAll() {
  [A.cats, A.products, A.orders, A.zones, A.store] = await Promise.all([
    DB.getCategories(), DB.getProducts(false), DB.getOrders(), DB.getZones(), DB.getStore(),
  ]);
  renderOrders(); renderProducts(); renderCats(); renderZones(); renderShop(); renderStats();
  const newCount = A.orders.filter(o => o.status === 'new').length;
  const badge = document.getElementById('newOrdersBadge');
  badge.textContent = newCount;
  badge.style.display = newCount ? '' : 'none';
}

function switchTab(name) {
  document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
}

/* `esc` lives in i18n.js so the storefront can use it too. */

/* ================= ORDERS ================= */
function statusTag(s) {
  const st = STATUSES.find(x => x[0] === s);
  return `<span class="status-tag status-${st?.[2] || 'new'}">${st?.[1] || s}</span>`;
}

function renderOrders() {
  const filter = document.getElementById('orderStatusFilter').value;
  const body = document.getElementById('ordersBody');
  body.innerHTML = '';
  A.orders.filter(o => !filter || o.status === filter).forEach(o => {
    const tr = document.createElement('tr');
    // qty arrives from the public order form: a non-number would make `+`
    // concatenate, dropping raw text straight into the HTML below
    const itemsCount = (o.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
    tr.innerHTML = `
      <td><b>#${o.id}</b><br><small style="color:var(--muted)">${new Date(o.created_at || Date.now()).toLocaleDateString('fr-FR')}</small></td>
      <td>${esc(o.customer_name)}<br><small style="color:var(--muted)">${esc(o.phone)}</small></td>
      <td>${esc(o.zone)}</td>
      <td><b>${I18N.fmtPrice(o.total)}</b></td>
      <td>${itemsCount} article(s)</td>
      <td>${statusTag(o.status)}</td>
      <td>
        <div class="row-actions">
          <button class="btn-mini" data-a="view">Voir</button>
          <select class="btn-mini" data-a="status" style="padding:5px 8px">
            ${STATUSES.map(s => `<option value="${s[0]}" ${s[0] === o.status ? 'selected' : ''}>${s[1]}</option>`).join('')}
          </select>
        </div>
      </td>`;
    tr.querySelector('[data-a="view"]').addEventListener('click', () => viewOrder(o));
    tr.querySelector('[data-a="status"]').addEventListener('change', e =>
      run(async () => {
        await DB.updateOrderStatus(o.id, e.target.value);
        await refreshAll();
      }));
    body.appendChild(tr);
  });
  if (!body.children.length) body.innerHTML = '<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:26px">Aucune commande</td></tr>';
}

function viewOrder(o) {
  const itemsHtml = (o.items || []).map(i => {
    const qty = Number(i.qty) || 0;
    return `<li>${esc(I18N.localize(i, 'name'))} — ${esc(i.size)} × ${qty} = ${I18N.fmtPrice(i.price * qty)}</li>`;
  }).join('');
  openEditor(`
    <h3 style="margin-bottom:14px">Commande #${o.id}</h3>
    <p><b>Client :</b> ${esc(o.customer_name)}</p>
    <p><b>Téléphone :</b> ${esc(o.phone)}</p>
    <p><b>Adresse :</b> ${esc(o.address)}</p>
    <p><b>Zone :</b> ${esc(o.zone)}</p>
    <p><b>Statut :</b> ${statusTag(o.status)}</p>
    <p style="margin-top:12px"><b>Articles :</b></p>
    <ul class="order-items">${itemsHtml}</ul>
    <div class="totals" style="margin-top:14px">
      <div class="row"><span>Sous-total</span><span>${I18N.fmtPrice(o.subtotal)}</span></div>
      <div class="row"><span>Livraison</span><span>${I18N.fmtPrice(o.delivery_fee)}</span></div>
      <div class="row grand"><span>Total (à payer à la livraison)</span><span>${I18N.fmtPrice(o.total)}</span></div>
    </div>
    <div class="cod-note" style="margin-top:10px">💵 Paiement à la livraison</div>
    <button class="a-btn ghost" style="margin-top:18px;width:100%" onclick="document.getElementById('editorClose').click()">Fermer</button>
  `);
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
      <td>${p.stock}</td>
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
      run(async () => { await DB.deleteProduct(p.id); await refreshAll(); });
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
      <td><b>${esc(c.name_fr)}</b></td><td>${esc(c.name_ar)}</td><td>${esc(c.name_en)}</td><td>${c.sort}</td>
      <td><div class="row-actions">
        <button class="btn-mini" data-a="edit">Modifier</button>
        <button class="btn-mini danger" data-a="del">Supprimer</button>
      </div></td>`;
    tr.querySelector('[data-a="edit"]').addEventListener('click', () => editCategory(c));
    tr.querySelector('[data-a="del"]').addEventListener('click', () => {
      if (!confirm(`Supprimer « ${c.name_fr} » ?`)) return;
      run(async () => { await DB.deleteCategory(c.id); await refreshAll(); });
    });
    body.appendChild(tr);
  });
  if (!body.children.length) body.innerHTML = '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:26px">Aucune catégorie</td></tr>';
}

function editCategory(c) {
  const d = c || { name_fr: '', name_ar: '', name_en: '', sort: (A.cats.length + 1) * 10 };
  openEditor(`
    <h3 style="margin-bottom:16px">${c ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h3>
    <div class="f-grid">
      <div><label>Nom (FR)</label><input id="c_fr" value="${esc(d.name_fr)}"></div>
      <div><label>الاسم (AR)</label><input id="c_ar" value="${esc(d.name_ar)}" dir="rtl"></div>
      <div><label>Name (EN)</label><input id="c_en" value="${esc(d.name_en)}"></div>
      <div><label>Ordre d'affichage</label><input id="c_sort" type="number" value="${d.sort}"></div>
      <button class="a-btn gold" id="c_save">💾 Enregistrer</button>
    </div>
  `);
  document.getElementById('c_save').addEventListener('click', async () => {
    const rec = {
      ...(c || {}),
      name_fr: document.getElementById('c_fr').value.trim(),
      name_ar: document.getElementById('c_ar').value.trim() || document.getElementById('c_fr').value.trim(),
      name_en: document.getElementById('c_en').value.trim() || document.getElementById('c_fr').value.trim(),
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
function renderZones() {
  const box = document.getElementById('zonesBox');
  box.innerHTML = '';
  A.zones.forEach(z => addZoneRow(z.name, z.fee));
}
function addZoneRow(name, fee) {
  const box = document.getElementById('zonesBox');
  const div = document.createElement('div');
  div.className = 'zone-edit';
  div.innerHTML = `
    <input class="z-name" placeholder="Wilaya / Zone" value="${esc(name)}">
    <input class="z-fee" type="number" min="0" style="max-width:110px" value="${fee}">
    <button class="btn-mini danger" title="Supprimer">×</button>`;
  div.querySelector('button').addEventListener('click', () => div.remove());
  box.appendChild(div);
}

async function saveZones() {
  const zones = [...document.querySelectorAll('.zone-edit')].map(d => ({
    name: d.querySelector('.z-name').value.trim(),
    fee: Number(d.querySelector('.z-fee').value) || 0,
  })).filter(z => z.name);
  await run(async () => {
    await DB.saveZones(zones);
    A.zones = zones;
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
}

async function saveShop() {
  const store = {
    name: document.getElementById('s_name').value.trim(),
    phone: document.getElementById('s_phone').value.trim(),
    email: document.getElementById('s_email').value.trim(),
  };
  if (!store.name) { alert('Le nom de la boutique est requis'); return; }
  await run(async () => {
    await DB.saveStore(store);
    A.store = store;
  }, 'Informations enregistrées ✓');
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
function openEditor(html) {
  document.getElementById('editorBody').innerHTML = html;
  document.getElementById('editorModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeEditor() {
  document.getElementById('editorModal').classList.remove('open');
  document.body.style.overflow = '';
}
