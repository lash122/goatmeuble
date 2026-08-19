/* Runtime layout switcher.
   The templates were born as static builds: each dist-* folder baked one
   theme (stylesheet, fonts, homepage section order, a hero arch or a tab
   bar) into its HTML. The dashboard now saves a `layout` choice in the shop
   settings, and this module applies it at runtime on every page load — no
   rebuild, no redeploy.

   Three templates, each a different *composition* of the same shared markup:
     - tech      — navy & electric blue, circuit-board welcome, products first
     - furniture — linen & walnut, wide landscape photos, categories first
     - sharp     — black & white masonry, no hero — the wall welcomes you
   A template is: a theme stylesheet (#themeCss), a font stack (#fontsCss),
   a homepage section order, optional markup (the tech hero decor), and a
   few shopfront strings (hero title, section names).

   `?layout=tech|furniture|sharp` on any URL forces a layout for previewing from the
   dashboard without saving. An unknown or missing layout falls back to the
   build's native look (the dist's own baked theme, if any). */

/* Cache-buster for the theme stylesheets this module loads. Bump whenever a
   css/theme-*.css file changes, so browsers don't serve a stale sheet. */
const THEME_CSS_VER = 31;

const LAYOUTS = {
  tech: {
    label: 'Tech',
    desc: 'Navy & bleu électrique — accueil design, produits en avant.',
    css: 'css/theme-tech.css',
    fonts: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700'
      + '&family=Cairo:wght@400;600;700&display=swap',
    order: ['catTiles', 'shop', 'featured'],
    i18n: {
      fr: {
        hero_title: 'La tech au meilleur prix',
        hero_sub: 'Smartphones, PC portables et accessoires — livrés chez vous, paiement à la livraison.',
        all_products: 'Nos produits',
        search_ph: 'Rechercher un produit…',
        no_results: 'Aucun produit ne correspond à votre recherche.',
        wa_prefill: 'Bonjour, j’ai une question sur un produit.',
      },
      ar: {
        hero_title: 'أفضل الأسعار في عالم التقنية',
        hero_sub: 'هواتف ذكية، حواسيب محمولة وملحقات — توصيل إلى باب منزلك مع الدفع عند الاستلام.',
        all_products: 'منتجاتنا',
        search_ph: 'ابحث عن منتج…',
        no_results: 'لا يوجد منتج مطابق لبحثك.',
        wa_prefill: 'مرحباً، لدي سؤال عن أحد المنتجات.',
      },
      en: {
        hero_title: 'Tech at the right price',
        hero_sub: 'Smartphones, laptops and accessories — delivered to your door, cash on delivery.',
        all_products: 'Our products',
        search_ph: 'Search products…',
        no_results: 'No products match your search.',
        wa_prefill: 'Hello, I have a question about a product.',
      },
    },
  },

  /* Furniture sells on the room, not the object: wide photos, fewer and
     larger cards, and categories first because people shop by room. */
  furniture: {
    label: 'Atelier',
    desc: 'Lin & noyer, accent terracotta — photos larges, catégories par pièce.',
    css: 'css/theme-furniture.css',
    fonts: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600'
      + '&family=Inter:wght@400;600;700'
      + '&family=Cairo:wght@400;600;700&display=swap',
    order: ['catTiles', 'featured', 'shop'],
    i18n: {
      fr: {
        hero_title: 'Des meubles qui durent',
        hero_sub: 'Salon, chambre, bureau — livrés et montés chez vous, paiement à la livraison.',
        all_products: 'Notre mobilier',
        search_ph: 'Rechercher un meuble…',
        no_results: 'Aucun meuble ne correspond à votre recherche.',
        wa_prefill: 'Bonjour, j’ai une question sur un meuble.',
      },
      ar: {
        hero_title: 'أثاث يدوم طويلاً',
        hero_sub: 'صالون، غرفة نوم، مكتب — التوصيل والتركيب في منزلك مع الدفع عند الاستلام.',
        all_products: 'أثاثنا',
        search_ph: 'ابحث عن قطعة أثاث…',
        no_results: 'لا توجد قطعة أثاث تطابق بحثك.',
        wa_prefill: 'مرحباً، لدي سؤال عن قطعة أثاث.',
      },
      en: {
        hero_title: 'Furniture built to last',
        hero_sub: 'Living room, bedroom, office — delivered and assembled at home, cash on delivery.',
        all_products: 'Our furniture',
        search_ph: 'Search furniture…',
        no_results: 'No furniture matches your search.',
        wa_prefill: 'Hello, I have a question about a piece of furniture.',
      },
    },
  },

  sharp: {
    label: 'Sharp',
    desc: 'Minimaliste noir & blanc — mur masonry, pas de héros.',
    css: 'css/theme-gallery.css',
    fonts: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600'
      + '&family=Inter:wght@400;600;700'
      + '&family=Cairo:wght@400;600;700&display=swap',
    order: ['catTiles', 'shop', 'featured'],
    i18n: {
      fr: {
        hero_title: 'La mode, comme une œuvre',
        hero_sub: 'Pièces sélectionnées une à une — livrées chez vous, paiement à la livraison.',
        all_products: 'La collection',
        search_ph: 'Rechercher dans la galerie…',
        no_results: 'Aucune pièce de la galerie ne correspond à votre recherche.',
        wa_prefill: 'Bonjour, j’ai une question sur une pièce.',
      },
      ar: {
        hero_title: 'الأزياء كعمل فني',
        hero_sub: 'قطع مختارة بعناية — توصيل إلى باب منزلك مع الدفع عند الاستلام.',
        all_products: 'المجموعة',
        search_ph: 'ابحث في المعرض…',
        no_results: 'لا توجد قطعة في المعرض تطابق بحثك.',
        wa_prefill: 'مرحباً، لدي سؤال عن إحدى القطع.',
      },
      en: {
        hero_title: 'Fashion, hung like art',
        hero_sub: 'Pieces selected one by one — delivered to your door, cash on delivery.',
        all_products: 'The collection',
        search_ph: 'Search the gallery…',
        no_results: 'No pieces in the gallery match your search.',
        wa_prefill: 'Hello, I have a question about a piece.',
      },
    },
  },
};

/* Strings a layout may replace — snapshot the build's own values once so
   switching back to "no layout" restores them exactly. */
const LAYOUT_KEYS = ['hero_title', 'hero_sub', 'all_products', 'search_ph', 'no_results', 'wa_prefill'];

let nativeCss = null;      // theme stylesheet this build baked in (if any)
let nativeFonts = null;    // font stack this build loads
let nativeOrder = null;    // homepage section order baked into the HTML
let baseI18n = null;       // shopfront strings before any layout applied
let applied = null;        // last layout actually applied

function captureNative() {
  const theme = document.getElementById('themeCss');
  nativeCss = theme ? theme.getAttribute('href') : null;
  const fonts = document.getElementById('fontsCss');
  nativeFonts = fonts ? fonts.getAttribute('href') : null;
  const main = document.querySelector('main');
  nativeOrder = main
    ? [...main.querySelectorAll('#featured, #catTiles, #shop')].map(el => el.id)
    : null;
  baseI18n = I18N.snapshot(LAYOUT_KEYS);
}

/* Move the three homepage blocks into the template's order. appendChild
   relocates the existing nodes, so nothing is re-created and the JS that
   addresses them by id keeps working. */
function reorderSections(order) {
  const main = document.querySelector('main');
  if (!main || !order || !order.length) return;
  const rv = document.getElementById('recentlyViewed');
  order.forEach(id => {
    const el = document.getElementById(id);
    if (el) main.appendChild(el);
  });
  if (rv) main.appendChild(rv);   // "recently viewed" always stays last
}

/* Clear the previous layout's extras so nothing orphaned survives the
   switch. The tech decor is removed when the tech template isn't active;
   the app tab bar (only ever baked into dist-app) is dropped by any other
   template. "No layout" is the exception: it restores the build's own
   look, so baked extras stay and only runtime injections go. */
function removeExtras(target) {
  // the hero arch is the luxe/femme look — no current template uses it, so
  // any layout switch drops it (baked or injected); only "no layout" on a
  // femme build keeps its baked arch
  const look = document.getElementById('heroLook');
  if (look && (target === 'default' ? look.dataset.injected : true)) look.remove();
  const tab = document.querySelector('.app-tabbar');
  if (tab && (target === 'default' ? tab.dataset.injected : true)) tab.remove();
  const decor = document.querySelector('.tech-decor');
  if (decor && (target === 'default' ? decor.dataset.injected : target !== 'tech')) decor.remove();
  const chips = document.querySelector('.td-chips');
  if (chips && (target === 'default' ? chips.dataset.injected : target !== 'tech')) chips.remove();
}

/* The tech welcome: a circuit-board drawing behind the hero headline and a
   row of trust chips under the CTA. Faint on purpose — the grid and glow
   already do the heavy lifting, this fills the stage without noise. */
function injectTechDecor() {
  const hero = document.querySelector('main > .hero');
  if (!hero || document.querySelector('.tech-decor')) return;
  const overlay = document.createElement('div');
  overlay.className = 'tech-decor';
  overlay.dataset.injected = '1';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <svg class="td-circuit" viewBox="0 0 600 300" preserveAspectRatio="none">
      <path d="M0 240 H140 L170 210 H300 L330 240 H600" stroke="#3b82f6" stroke-width="1.5" fill="none"/>
      <path d="M0 60 H220 L250 90 H420 L450 60 H600" stroke="#60a5fa" stroke-width="1" fill="none"/>
      <path d="M60 300 V220 L90 190 H520 L550 220 V300" stroke="#2563eb" stroke-width="1.5" fill="none"/>
      <circle cx="170" cy="210" r="4" fill="#60a5fa"/>
      <circle cx="330" cy="240" r="3" fill="#3b82f6"/>
      <circle cx="250" cy="90" r="4" fill="#60a5fa"/>
      <circle cx="450" cy="60" r="3" fill="#3b82f6"/>
      <circle cx="90" cy="190" r="3.5" fill="#60a5fa"/>
      <circle cx="550" cy="220" r="3.5" fill="#3b82f6"/>
    </svg>`;
  hero.appendChild(overlay);
  const chips = document.createElement('div');
  chips.className = 'td-chips';
  chips.dataset.injected = '1';
  chips.innerHTML = `
    <span class="td-chip"><i>⚡</i><span data-i18n="tech_delivery"></span></span>
    <span class="td-chip"><i>💵</i><span data-i18n="tech_chip_cod"></span></span>
    <span class="td-chip"><i>🔄</i><span data-i18n="tech_exchange"></span></span>`;
  hero.appendChild(chips);
}

/* Where the shop itself lives, which is not always the current directory: a
   pre-rendered product page sits at /p/<id>/, so resolving 'css/theme-x.css'
   against it would ask for /p/24/css/theme-x.css and silently get nothing —
   the page renders unthemed. Strip the product segment exactly as
   productPath() in js/store.js does, so a shop installed in a subfolder still
   resolves correctly. */
function shopRoot() {
  // /index.html comes off first: strip it the other way round and
  // /p/24/index.html leaves "/p/24/" behind as the supposed shop root.
  return location.pathname
    .replace(/\/index\.html$/, '/')
    .replace(/\/p\/\d+\/?$/, '/');
}

/* Apply a layout. name comes from the shop settings (store.layout); an
   explicit ?layout= URL wins for dashboard previews. Idempotent per layout:
   repeat calls (every catalogue paint) do nothing once applied. */
function applyLayout(name) {
  const forced = new URLSearchParams(location.search).get('layout');
  const key = LAYOUTS[forced] ? forced : (LAYOUTS[name] ? name : 'default');
  if (applied === key) return;
  applied = key;
  const L = LAYOUTS[key] || null;

  // font stack — back to the build's own when no layout is chosen
  const fonts = document.getElementById('fontsCss');
  if (fonts) fonts.href = L ? L.fonts : nativeFonts;

  // theme stylesheet: swap #themeCss, or restore the build's own theme
  let theme = document.getElementById('themeCss');
  if (L && L.css) {
    if (!theme) {
      theme = document.createElement('link');
      theme.rel = 'stylesheet';
      theme.id = 'themeCss';
      document.head.appendChild(theme);
    }
    theme.href = `${shopRoot()}${L.css}?v=${THEME_CSS_VER}`;
  } else if (theme) {
    // no layout: the build's own look — restore its baked theme (if any),
    // or drop a runtime-created link
    if (theme.dataset.nativeTheme !== undefined) theme.href = nativeCss;
    else theme.remove();
  }

  // homepage composition: the template's section order (or the build's own)
  reorderSections(L ? L.order : nativeOrder);

  // structural extras: only the tech template carries the hero decor
  removeExtras(key);
  if (key === 'tech') injectTechDecor();

  // shopfront strings for the template, then re-render the page
  I18N.override(L ? L.i18n : baseI18n);
  I18N.apply();

  document.documentElement.dataset.layout = key;
}

captureNative();
