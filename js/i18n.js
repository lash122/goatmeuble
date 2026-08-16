/* i18n: FR (default) / AR / EN with RTL support */

/* Escapes text before it goes into an innerHTML template.
   Shared by the storefront and the admin panel — order details in particular
   come from the public order form, so they are never to be trusted. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Builds a wa.me link from whatever the owner typed in the admin panel.
   Algerian numbers get entered as 0555..., 05 55..., +213 555... — WhatsApp
   needs bare international digits, so normalise rather than make the owner
   learn the format. */
function waLink(phone, text) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '213' + d.slice(1);      // local → Algeria
  else if (!d.startsWith('213') && d.length <= 9) d = '213' + d;
  if (d.length < 11) return '';                        // too short to be real
  return `https://wa.me/${d}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

/* Floating WhatsApp button, shown only once a number is saved in the admin. */
function renderWhatsApp(store) {
  const fab = document.getElementById('waFab');
  if (!fab) return;
  const href = waLink(store?.phone, I18N.t('wa_prefill'));
  fab.hidden = !href;
  if (href) {
    fab.href = href;
    fab.setAttribute('aria-label', I18N.t('wa_cta'));
    fab.title = I18N.t('wa_cta');
  }
}

const I18N = (() => {
  const translations = {
    fr: {
      nav_home: 'Accueil', nav_shop: 'Boutique', nav_contact: 'Contact',
      hero_title: 'L\u2019\u00e9l\u00e9gance sur mesure', hero_sub: 'Costumes, chemises et tailleurs pour hommes — livr\u00e9s chez vous, paiement \u00e0 la livraison.',
      shop_now: 'Commander', featured: 'S\u00e9lection', all_products: 'Nos articles',
      all: 'Tout', add_to_cart: 'Ajouter au panier', select_size: 'Choisir une taille',
      cart: 'Panier', cart_empty: 'Votre panier est vide', checkout: 'Commander',
      subtotal: 'Sous-total', delivery: 'Livraison', total: 'Total',
      cod_only: 'Paiement \u00e0 la livraison uniquement', qty: 'Qt\u00e9',
      remove: 'Retirer', continue_shopping: 'Continuer mes achats',
      name: 'Nom complet', phone: 'T\u00e9l\u00e9phone', address: 'Adresse compl\u00e8te',
      zone: 'Wilaya / Zone', place_order: 'Confirmer la commande',
      order_success: 'Commande confirm\u00e9e !', order_success_sub: 'Nous vous appellerons pour confirmer la livraison. Paiement en esp\u00e8ces \u00e0 la livraison.',
      order_number: 'N\u00b0 de commande', required: 'Veuillez remplir tous les champs',
      invalid_phone: 'Num\u00e9ro de t\u00e9l\u00e9phone invalide', demo_notice: 'Mode d\u00e9mo \u2014 connectez Supabase pour de vrais produits',
      contact: 'Contactez-nous', out_of_stock: 'Rupture de stock',
      size_required: 'Choisissez d’abord une taille',
      wa_cta: 'Écrivez-nous sur WhatsApp', wa_prefill: 'Bonjour, j’ai une question sur un article.',
      success_contact: 'Une question ? Contactez-nous :',
      sort_by: 'Trier', sort_new: 'Nouveautés', sort_price_asc: 'Prix croissant',
      sort_price_desc: 'Prix décroissant', search_ph: 'Rechercher un article…',
      no_results: 'Aucun article ne correspond à votre recherche.',
      low_stock: 'Plus que {n} en stock',
      track: 'Suivre ma commande', track_intro: 'Entrez votre numéro de commande et le téléphone utilisé lors de l’achat.',
      track_id: 'N° de commande', track_btn: 'Rechercher',
      track_not_found: 'Commande introuvable. Vérifiez le numéro et le téléphone.',
      track_placed: 'Commande passée le',
      st_new: 'Reçue', st_confirmed: 'Confirmée', st_shipped: 'En livraison',
      st_delivered: 'Livrée', st_cancelled: 'Annulée',
      err_generic: 'La commande n\u2019a pas pu \u00eatre enregistr\u00e9e. R\u00e9essayez.',
      err_stock: 'Stock insuffisant pour un article de votre panier.',
      err_unavailable: 'Un article de votre panier n\u2019est plus disponible.',
      err_too_many: 'Trop de commandes depuis ce num\u00e9ro. R\u00e9essayez plus tard.',
      err_load: 'Chargement impossible. V\u00e9rifiez votre connexion.',
      currency: 'DA', lang_name: 'Fran\u00e7ais',
    },
    ar: {
      nav_home: 'الرئيسية', nav_shop: 'المتجر', nav_contact: 'اتصل بنا',
      hero_title: 'أناقة على قدر مقاسك', hero_sub: 'بدلات، قمصان وملابس رسمية للرجال — توصيل إلى باب منزلك مع الدفع عند الاستلام.',
      shop_now: 'اطلب الآن', featured: 'مختارات', all_products: 'منتجاتنا',
      all: 'الكل', add_to_cart: 'أضف إلى السلة', select_size: 'اختر المقاس',
      cart: 'السلة', cart_empty: 'سلتك فارغة', checkout: 'إتمام الطلب',
      subtotal: 'المجموع الفرعي', delivery: 'التوصيل', total: 'الإجمالي',
      cod_only: 'الدفع عند الاستلام فقط', qty: 'الكمية',
      remove: 'إزالة', continue_shopping: 'متابعة التسوق',
      name: 'الاسم الكامل', phone: 'رقم الهاتف', address: 'العنوان الكامل',
      zone: 'الولاية / المنطقة', place_order: 'تأكيد الطلب',
      order_success: 'تم تأكيد طلبك!', order_success_sub: 'سنتصل بك لتأكيد التوصيل. الدفع نقداً عند الاستلام.',
      order_number: 'رقم الطلب', required: 'يرجى ملء جميع الحقول',
      invalid_phone: 'رقم الهاتف غير صالح', demo_notice: 'وضع تجريبي — اربط Supabase لعرض منتجات حقيقية',
      contact: 'اتصل بنا', out_of_stock: 'نفذت الكمية',
      size_required: 'اختر المقاس أولاً',
      wa_cta: 'راسلنا عبر واتساب', wa_prefill: 'مرحباً، لدي سؤال عن أحد المنتجات.',
      success_contact: 'لديك سؤال؟ اتصل بنا:',
      sort_by: 'ترتيب', sort_new: 'الأحدث', sort_price_asc: 'السعر: من الأقل',
      sort_price_desc: 'السعر: من الأعلى', search_ph: 'ابحث عن منتج…',
      no_results: 'لا يوجد منتج مطابق لبحثك.',
      low_stock: 'بقي {n} فقط',
      track: 'تتبّع طلبي', track_intro: 'أدخل رقم الطلب ورقم الهاتف المستعمل عند الشراء.',
      track_id: 'رقم الطلب', track_btn: 'بحث',
      track_not_found: 'لم يتم العثور على الطلب. تحقق من الرقم والهاتف.',
      track_placed: 'تاريخ الطلب',
      st_new: 'مستلم', st_confirmed: 'مؤكد', st_shipped: 'قيد التوصيل',
      st_delivered: 'تم التسليم', st_cancelled: 'ملغى',
      err_generic: 'تعذّر تسجيل الطلب. يرجى المحاولة مرة أخرى.',
      err_stock: 'الكمية غير كافية لأحد المنتجات في سلتك.',
      err_unavailable: 'أحد منتجات سلتك لم يعد متوفراً.',
      err_too_many: 'طلبات كثيرة من هذا الرقم. حاول لاحقاً.',
      err_load: 'تعذّر التحميل. تحقق من اتصالك.',
      currency: 'دج', lang_name: 'العربية',
    },
    en: {
      nav_home: 'Home', nav_shop: 'Shop', nav_contact: 'Contact',
      hero_title: 'Tailored elegance', hero_sub: 'Suits, shirts and formal wear for men — delivered to your door, cash on delivery.',
      shop_now: 'Order now', featured: 'Featured', all_products: 'Our collection',
      all: 'All', add_to_cart: 'Add to cart', select_size: 'Choose a size',
      cart: 'Cart', cart_empty: 'Your cart is empty', checkout: 'Checkout',
      subtotal: 'Subtotal', delivery: 'Delivery', total: 'Total',
      cod_only: 'Cash on delivery only', qty: 'Qty',
      remove: 'Remove', continue_shopping: 'Continue shopping',
      name: 'Full name', phone: 'Phone', address: 'Full address',
      zone: 'Wilaya / Zone', place_order: 'Confirm order',
      order_success: 'Order confirmed!', order_success_sub: 'We will call you to confirm delivery. Payment in cash upon delivery.',
      order_number: 'Order no.', required: 'Please fill in all fields',
      invalid_phone: 'Invalid phone number', demo_notice: 'Demo mode — connect Supabase for real products',
      contact: 'Contact us', out_of_stock: 'Out of stock',
      size_required: 'Please choose a size first',
      wa_cta: 'Message us on WhatsApp', wa_prefill: 'Hello, I have a question about an item.',
      success_contact: 'Any questions? Contact us:',
      sort_by: 'Sort', sort_new: 'Newest', sort_price_asc: 'Price: low to high',
      sort_price_desc: 'Price: high to low', search_ph: 'Search products…',
      no_results: 'No products match your search.',
      low_stock: 'Only {n} left',
      track: 'Track my order', track_intro: 'Enter your order number and the phone you used to order.',
      track_id: 'Order no.', track_btn: 'Search',
      track_not_found: 'Order not found. Check the number and phone.',
      track_placed: 'Ordered on',
      st_new: 'Received', st_confirmed: 'Confirmed', st_shipped: 'Out for delivery',
      st_delivered: 'Delivered', st_cancelled: 'Cancelled',
      err_generic: 'The order could not be saved. Please try again.',
      err_stock: 'Not enough stock for an item in your cart.',
      err_unavailable: 'An item in your cart is no longer available.',
      err_too_many: 'Too many orders from this number. Try again later.',
      err_load: 'Could not load. Please check your connection.',
      currency: 'DA', lang_name: 'English',
    },
  };

  function getLang() {
    const saved = localStorage.getItem('lang');
    return saved && translations[saved] ? saved : 'fr';
  }

  function setLang(lang) {
    if (!translations[lang]) lang = 'fr';
    localStorage.setItem('lang', lang);
    apply();
  }

  function t(key) {
    return translations[getLang()][key] ?? translations.fr[key] ?? key;
  }

  function fmtPrice(n) {
    const lang = getLang();
    const num = Number(n).toLocaleString(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US');
    return `${num} ${t('currency')}`;
  }

  function localize(obj, field) {
    const lang = getLang();
    return obj?.[`${field}_${lang}`] || obj?.[`${field}_fr`] || obj?.[`${field}_en`] || obj?.[`${field}_ar`] || '';
  }

  function apply() {
    const lang = getLang();
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('.lang-switch button').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === lang);
    });
    document.dispatchEvent(new CustomEvent('langchange'));
  }

  return { t, fmtPrice, localize, getLang, setLang, apply };
})();
