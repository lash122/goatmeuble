/* i18n: FR (default) / AR / EN with RTL support */

/* Escapes text before it goes into an innerHTML template.
   Shared by the storefront and the admin panel — order details in particular
   come from the public order form, so they are never to be trusted. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Algerian mobile numbers, normalised — the browser-side twin of dz_phone()
   in supabase/schema.sql, and it must stay in step with it.

   A cash-on-delivery order is worth nothing without a number the driver can
   ring: a wrong one costs the ad click that produced it AND a courier trip
   that delivers nothing. The old check accepted any 9-15 characters made of
   digits, spaces and dashes, so "123456789" sailed through.

   A real mobile is 0 then 5, 6 or 7 then eight digits. The same number gets
   typed as 0555 12 34 56, +213 555 123 456, 00213555123456 — so strip to
   digits, peel the international prefixes and the trunk 0, and check what is
   left. Returns the canonical 0XXXXXXXXX, or null when it is not a mobile. */
function dzPhone(input) {
  let d = String(input || '').replace(/\D/g, '');
  d = d.replace(/^00/, '').replace(/^213/, '').replace(/^0/, '');
  return /^[567]\d{8}$/.test(d) ? '0' + d : null;
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

/* WhatsApp order-confirmation message: order number, every line item, the
   total, and the tracking link. Used on the TRACKING page — after the shop
   has confirmed the order by phone — never at checkout time. The checkout
   keeps a plain contact line instead. */
function waOrderMessage(order) {
  if (!order) return '';
  const trackUrl = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}` +
    `track.html?id=${encodeURIComponent(order.id)}`;
  const lines = (order.items || []).map(it =>
    `• ${it.qty}× ${I18N.localize(it, 'name')}${it.size ? ` (${it.size})` : ''}` +
    ` — ${I18N.fmtPrice(Number(it.price) * it.qty)}`);
  return [
    `${I18N.t('wa_order_hello')} #${order.id}`,
    ...lines,
    `${I18N.t('total')}: ${I18N.fmtPrice(order.total)}`,
    `${I18N.t('track')}: ${trackUrl}`,
  ].join('\n');
}

/* Floating WhatsApp button, shown only once a number is saved in the admin.
   The call button rides along: same phone, one tap to talk — on COD markets
   half the buyers want a voice before they commit. */
function renderWhatsApp(store) {
  const href = waLink(store?.phone, I18N.t('wa_prefill'));
  // two ids exist across pages: waFab on most, waFloat on the product page
  ['waFab', 'waFloat'].forEach(id => {
    const fab = document.getElementById(id);
    if (!fab) return;
    fab.hidden = !href;
    if (href) {
      fab.href = href;
      fab.setAttribute('aria-label', I18N.t('wa_cta'));
      fab.title = I18N.t('wa_cta');
    }
  });
  const call = document.getElementById('callFab');
  if (call) {
    const tel = String(store?.phone || '').replace(/[^\d+]/g, '');
    call.hidden = !tel;
    if (tel) {
      call.href = `tel:${tel}`;
      call.title = store.phone;
    }
  }
}

const I18N = (() => {
  const translations = {
    fr: {
      nav_home: 'Accueil', nav_shop: 'Boutique', nav_meubles: 'Nos Meubles', nav_categories: 'Pièces', nav_collections: 'Collections', nav_contact: 'Contact',
      hero_title: 'Am\u00e9nagez votre int\u00e9rieur', hero_sub: 'Tables, salons, canap\u00e9s et meubles — livr\u00e9s chez vous, paiement \u00e0 la livraison.',
      shop_now: 'Commander', featured: 'S\u00e9lection', all_products: 'Nos articles',
      all: 'Tout', add_to_cart: 'Ajouter au panier', added_to_cart: 'Ajouté au panier ✓', select_size: 'Choisir une taille',
      confirm_call: 'Nous vous appelons pour confirmer votre commande avant l\u2019expédition',
      wilayas_58: 'Livraison dans les 58 wilayas',
      carriers_strip: 'Livraison rapide via',
      exchange_7: 'Échange sous 7 jours',
      no_signup: 'Commandez sans créer de compte',
      final_price: 'Le prix affiché est le prix final — aucun frais caché',
      delivery_time: 'Livraison en 2 à 5 jours ouvrables',
      fb_follow: 'Suivez-nous sur Facebook',
      bn_search: 'Recherche', bn_cart: 'Panier',
      err_duplicate: 'Vous avez déjà commandé ce panier récemment — vérifiez vos commandes ou appelez-nous.',
      err_too_many_today: 'Trop de commandes depuis ce numéro aujourd\u2019hui. Contactez-nous si nécessaire.',
      reviews_title: 'Avis clients', review_write: 'Donner mon avis',
      review_name: 'Votre nom', review_text: 'Votre avis', review_send: 'Envoyer l\u2019avis',
      review_thanks: 'Merci ! Votre avis sera publié après validation.', review_none: 'Aucun avis pour le moment. Soyez le premier !',

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
      share: 'Partager', share_copied: 'Lien copié ✓',
      wa_cta: 'Écrivez-nous sur WhatsApp', wa_prefill: 'Bonjour, j’ai une question sur un article.',
      wa_order_hello: 'Bonjour, je viens de passer la commande',
      success_contact: 'Une question ? Contactez-nous :',
      tech_delivery: 'Livraison 24-72h', tech_chip_cod: 'Paiement à la livraison',
      tech_exchange: 'Échange sous 7 jours',
      badge_new: 'Nouveau', badge_bestseller: 'Bestseller',
      sort_by: 'Trier', sort_new: 'Nouveautés', sort_price_asc: 'Prix croissant',
      sort_price_desc: 'Prix décroissant', search_ph: 'Rechercher un article…',
      no_results: 'Aucun article ne correspond à votre recherche.',
      low_stock: 'Plus que {n} en stock',
      track: 'Suivre ma commande', track_intro: 'Entrez votre numéro de commande et le téléphone utilisé lors de l’achat.',
      track_id: 'N° de commande', track_btn: 'Rechercher',
      track_not_found: 'Commande introuvable. Vérifiez le numéro et le téléphone.',
      track_placed: 'Commande passée le',
      st_new: 'Reçue', st_confirmed: 'Confirmée', st_shipped: 'En livraison',
      st_delivered: 'Livrée', st_cancelled: 'Annulée', st_returned: 'Retournée',
      err_generic: 'La commande n\u2019a pas pu \u00eatre enregistr\u00e9e. R\u00e9essayez.',
      err_stock: 'Stock insuffisant pour un article de votre panier.',
      err_unavailable: 'Un article de votre panier n\u2019est plus disponible.',
      err_too_many: 'Trop de commandes depuis ce num\u00e9ro. R\u00e9essayez plus tard.',
      err_load: 'Chargement impossible. V\u00e9rifiez votre connexion.',
      browse_categories: 'Parcourir par catégorie',
      promo_off: '-{p}% sur tout le site',
      promo_code: 'Code promo', promo_apply: 'Appliquer', promo_remove: 'Retirer',
      promo_applied: 'Code {code} : -{p}%',
      promo_invalid: 'Code promo invalide ou expiré.',
      promo_min: 'Ce code demande un minimum d’achat de {min}.',
      discount: 'Remise',
      free_delivery: 'Livraison offerte', free_delivery_qualifies: '🎉 Livraison offerte !',
      free_delivery_progress: 'Plus que {x} pour la livraison offerte 🚚',
      delivery_free: 'Offerte',
      // v1.3 — Algerian delivery: stopdesk vs à domicile, and the parcel
      deliv_type: 'Mode de livraison',
      deliv_home: 'À domicile', deliv_home_hint: 'Le livreur vient à votre adresse',
      deliv_desk: 'Stop desk', deliv_desk_hint: 'Vous récupérez au bureau du transporteur — moins cher',
      address_desk_optional: 'Adresse (facultatif pour le stop desk)',
      invalid_phone_dz: 'Numéro algérien invalide — ex. 0555 12 34 56',
      carrier: 'Transporteur', tracking_number: 'N° de colis',
      tracking_hint: 'Suivez votre colis avec ce numéro chez le transporteur.',
      wishlist: 'Favoris', wishlist_empty: 'Vos favoris sont vides — cliquez sur le ♥ d’un article.',
      wl_add: 'Ajouter aux favoris', wl_remove: 'Retirer des favoris',
      related: 'Vous aimerez aussi',
      recently_viewed: 'Vus récemment',
      size_guide: 'Guide des tailles', size_guide_chest: 'Poitrine (cm)',
      size_guide_waist: 'Taille (cm)', size_guide_hint: 'Entre deux tailles ? Prenez la plus grande.',
      size_guide_note: 'Mesures du corps, prises à l’aide d’un mètre ruban.',
      faq_title: 'Livraison, paiement & échanges',
      faq_q1: 'Quels sont les délais de livraison ?', faq_a1: '24 à 72 heures selon votre wilaya. Nous vous appelons pour confirmer avant l’envoi.',
      faq_q2: 'Comment payer ?', faq_a2: 'À la livraison, en espèces, au moment où vous recevez votre commande. Aucun paiement en ligne.',
      faq_q3: 'Puis-je échanger un article ?', faq_a3: 'Oui, sous 7 jours, article non porté et dans son emballage. Contactez-nous par téléphone ou WhatsApp.',
      cart_updated: 'Certains prix ont été mis à jour depuis que vous avez ajouté ces articles.',
      cart_removed: 'Un article n’est plus disponible et a été retiré de votre panier.',
      view_product: 'Ouvrir {name}',
      scroll_hint: 'Défiler',
      gallery_open: 'Voir les photos', gallery_prev: 'Photo précédente', gallery_next: 'Photo suivante',
      stale_notice: 'Connexion impossible — affichage des produits enregistrés.',
      currency: 'DA', lang_name: 'Fran\u00e7ais',
    },
    ar: {
      nav_home: 'الرئيسية', nav_shop: 'المتجر', nav_meubles: 'أثاثنا', nav_categories: 'الأقسام', nav_collections: 'المجموعات', nav_contact: 'اتصل بنا',
      hero_title: 'أثث ديكور منزلك', hero_sub: 'طاولات، صالونات، أرائك وأثاث — توصيل إلى باب منزلك مع الدفع عند الاستلام.',
      shop_now: 'اطلب الآن', featured: 'مختارات', all_products: 'منتجاتنا',
      all: 'الكل', add_to_cart: 'أضف إلى السلة', added_to_cart: 'تمت الإضافة إلى السلة ✓', select_size: 'اختر المقاس',
      confirm_call: 'نتصل بك لتأكيد طلبك قبل الشحن',
      wilayas_58: 'التوصيل إلى 58 ولاية',
      carriers_strip: 'توصيل سريع عبر',
      exchange_7: 'استبدال خلال 7 أيام',
      no_signup: 'اطلب بدون إنشاء حساب',
      final_price: 'السعر المعروض هو السعر النهائي — بدون رسوم خفية',
      delivery_time: 'التوصيل خلال 2 إلى 5 أيام عمل',
      fb_follow: 'تابعنا على فيسبوك',
      bn_search: 'بحث', bn_cart: 'السلة',
      err_duplicate: 'لقد طلبت هذه السلة مؤخرًا — تحقق من طلباتك أو اتصل بنا.',
      err_too_many_today: 'طلبات كثيرة من هذا الرقم اليوم. اتصل بنا إذا لزم الأمر.',
      reviews_title: 'آراء العملاء', review_write: 'أضف رأيك',
      review_name: 'اسمك', review_text: 'رأيك', review_send: 'إرسال التقييم',
      review_thanks: 'شكرًا! سيتم نشر رأيك بعد المراجعة.', review_none: 'لا توجد آراء بعد. كن أول من يقيّم!',

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
      share: 'مشاركة', share_copied: 'تم نسخ الرابط ✓',
      wa_cta: 'راسلنا عبر واتساب', wa_prefill: 'مرحباً، لدي سؤال عن أحد المنتجات.',
      wa_order_hello: 'مرحباً، لقد قمت للتو بتأكيد الطلب',
      success_contact: 'لديك سؤال؟ اتصل بنا:',
      tech_delivery: 'توصيل 24-72 ساعة', tech_chip_cod: 'الدفع عند الاستلام',
      tech_exchange: 'استبدال خلال 7 أيام',
      badge_new: 'جديد', badge_bestseller: 'الأكثر مبيعاً',
      sort_by: 'ترتيب', sort_new: 'الأحدث', sort_price_asc: 'السعر: من الأقل',
      sort_price_desc: 'السعر: من الأعلى', search_ph: 'ابحث عن منتج…',
      no_results: 'لا يوجد منتج مطابق لبحثك.',
      low_stock: 'بقي {n} فقط',
      track: 'تتبّع طلبي', track_intro: 'أدخل رقم الطلب ورقم الهاتف المستعمل عند الشراء.',
      track_id: 'رقم الطلب', track_btn: 'بحث',
      track_not_found: 'لم يتم العثور على الطلب. تحقق من الرقم والهاتف.',
      track_placed: 'تاريخ الطلب',
      st_new: 'مستلم', st_confirmed: 'مؤكد', st_shipped: 'قيد التوصيل',
      st_delivered: 'تم التسليم', st_cancelled: 'ملغى', st_returned: 'مُرجَعة',
      err_generic: 'تعذّر تسجيل الطلب. يرجى المحاولة مرة أخرى.',
      err_stock: 'الكمية غير كافية لأحد المنتجات في سلتك.',
      err_unavailable: 'أحد منتجات سلتك لم يعد متوفراً.',
      err_too_many: 'طلبات كثيرة من هذا الرقم. حاول لاحقاً.',
      err_load: 'تعذّر التحميل. تحقق من اتصالك.',
      browse_categories: 'تصفح حسب الفئة',
      promo_off: 'خصم {p}% على كل المتجر',
      promo_code: 'رمز الخصم', promo_apply: 'تطبيق', promo_remove: 'إزالة',
      promo_applied: 'رمز {code} : -{p}%',
      promo_invalid: 'رمز الخصم غير صالح أو منتهي.',
      promo_min: 'هذا الرمز يتطلب شراءً بحد أدنى {min}.',
      discount: 'الخصم',
      free_delivery: 'توصيل مجاني', free_delivery_qualifies: '🎉 توصيل مجاني!',
      free_delivery_progress: 'أضف {x} أخرى للحصول على توصيل مجاني 🚚',
      delivery_free: 'مجاناً',
      deliv_type: 'طريقة التوصيل',
      deliv_home: 'إلى المنزل', deliv_home_hint: 'يأتي عامل التوصيل إلى عنوانك',
      deliv_desk: 'مكتب التوصيل', deliv_desk_hint: 'تستلم الطرد من مكتب الناقل — أرخص',
      address_desk_optional: 'العنوان (اختياري لمكتب التوصيل)',
      invalid_phone_dz: 'رقم جزائري غير صحيح — مثال 0555 12 34 56',
      carrier: 'شركة التوصيل', tracking_number: 'رقم الطرد',
      tracking_hint: 'تابع طردك بهذا الرقم لدى شركة التوصيل.',
      wishlist: 'المفضلة', wishlist_empty: 'قائمة المفضلة فارغة — اضغط على ♥ في أي منتج.',
      wl_add: 'أضف إلى المفضلة', wl_remove: 'إزالة من المفضلة',
      related: 'قد يعجبك أيضاً',
      recently_viewed: 'شاهدت مؤخراً',
      size_guide: 'دليل المقاسات', size_guide_chest: 'الصدر (سم)',
      size_guide_waist: 'الخصر (سم)', size_guide_hint: 'بين مقاسين؟ اختر الأكبر.',
      size_guide_note: 'قياسات الجسم بشريط القياس.',
      faq_title: 'التوصيل والدفع والاستبدال',
      faq_q1: 'ما هي مدة التوصيل؟', faq_a1: 'من 24 إلى 72 ساعة حسب الولاية. نتصل بك للتأكيد قبل الإرسال.',
      faq_q2: 'كيف يتم الدفع؟', faq_a2: 'نقداً عند الاستلام عند وصول طلبك. لا يوجد دفع إلكتروني.',
      faq_q3: 'هل يمكنني استبدال منتج؟', faq_a3: 'نعم، خلال 7 أيام، في عبويته الأصلية. اتصل بنا أو راسلنا على واتساب.',
      cart_updated: 'تم تحديث بعض الأسعار منذ إضافة هذه المنتجات إلى السلة.',
      cart_removed: 'أحد المنتجات لم يعد متوفراً وتمت إزالته من السلة.',
      view_product: 'عرض {name}',
      scroll_hint: 'مرر للأسفل',
      gallery_open: 'عرض الصور', gallery_prev: 'الصورة السابقة', gallery_next: 'الصورة التالية',
      stale_notice: 'تعذّر الاتصال — يتم عرض المنتجات المحفوظة.',
      currency: 'دج', lang_name: 'العربية',
    },
    en: {
      nav_home: 'Home', nav_shop: 'Shop', nav_meubles: 'Our Furniture', nav_categories: 'Rooms', nav_collections: 'Collections', nav_contact: 'Contact',
      hero_title: 'Design your living space', hero_sub: 'Tables, sofas, couches and furniture — delivered to your door, cash on delivery.',
      shop_now: 'Order now', featured: 'Featured', all_products: 'Our collection',
      all: 'All', add_to_cart: 'Add to cart', added_to_cart: 'Added to cart ✓', select_size: 'Choose a size',
      confirm_call: 'We call you to confirm your order before shipping',
      wilayas_58: 'Delivery across all 58 wilayas',
      carriers_strip: 'Fast delivery via',
      exchange_7: '7-day exchange',
      no_signup: 'Order without creating an account',
      final_price: 'The price shown is the final price — no hidden fees',
      delivery_time: 'Delivery in 2 to 5 business days',
      fb_follow: 'Follow us on Facebook',
      bn_search: 'Search', bn_cart: 'Cart',
      err_duplicate: 'You already ordered this basket recently — check your orders or call us.',
      err_too_many_today: 'Too many orders from this number today. Call us if needed.',
      reviews_title: 'Customer reviews', review_write: 'Write a review',
      review_name: 'Your name', review_text: 'Your review', review_send: 'Submit review',
      review_thanks: 'Thanks! Your review will appear once approved.', review_none: 'No reviews yet. Be the first!',

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
      share: 'Share', share_copied: 'Link copied ✓',
      wa_cta: 'Message us on WhatsApp', wa_prefill: 'Hello, I have a question about an item.',
      wa_order_hello: 'Hello, I just placed order',
      success_contact: 'Any questions? Contact us:',
      tech_delivery: 'Delivery 24-72h', tech_chip_cod: 'Cash on delivery',
      tech_exchange: '7-day exchange',
      badge_new: 'New', badge_bestseller: 'Bestseller',
      sort_by: 'Sort', sort_new: 'Newest', sort_price_asc: 'Price: low to high',
      sort_price_desc: 'Price: high to low', search_ph: 'Search products…',
      no_results: 'No products match your search.',
      low_stock: 'Only {n} left',
      track: 'Track my order', track_intro: 'Enter your order number and the phone you used to order.',
      track_id: 'Order no.', track_btn: 'Search',
      track_not_found: 'Order not found. Check the number and phone.',
      track_placed: 'Ordered on',
      st_new: 'Received', st_confirmed: 'Confirmed', st_shipped: 'Out for delivery',
      st_delivered: 'Delivered', st_cancelled: 'Cancelled', st_returned: 'Returned',
      err_generic: 'The order could not be saved. Please try again.',
      err_stock: 'Not enough stock for an item in your cart.',
      err_unavailable: 'An item in your cart is no longer available.',
      err_too_many: 'Too many orders from this number. Try again later.',
      err_load: 'Could not load. Please check your connection.',
      browse_categories: 'Browse by category',
      promo_off: '-{p}% off everything',
      promo_code: 'Promo code', promo_apply: 'Apply', promo_remove: 'Remove',
      promo_applied: 'Code {code}: -{p}%',
      promo_invalid: 'Invalid or expired promo code.',
      promo_min: 'This code requires a minimum purchase of {min}.',
      discount: 'Discount',
      free_delivery: 'Free delivery', free_delivery_qualifies: '🎉 Free delivery!',
      free_delivery_progress: 'Only {x} away from free delivery 🚚',
      delivery_free: 'Free',
      deliv_type: 'Delivery method',
      deliv_home: 'To my address', deliv_home_hint: 'The courier comes to you',
      deliv_desk: 'Stop desk', deliv_desk_hint: 'Collect from the courier office — cheaper',
      address_desk_optional: 'Address (optional for stop desk)',
      invalid_phone_dz: 'Not a valid Algerian number — e.g. 0555 12 34 56',
      carrier: 'Carrier', tracking_number: 'Parcel no.',
      tracking_hint: 'Track your parcel with this number at the carrier.',
      wishlist: 'Wishlist', wishlist_empty: 'Your wishlist is empty — tap the ♥ on any item.',
      wl_add: 'Add to wishlist', wl_remove: 'Remove from wishlist',
      related: 'You may also like',
      recently_viewed: 'Recently viewed',
      size_guide: 'Size guide', size_guide_chest: 'Chest (cm)',
      size_guide_waist: 'Waist (cm)', size_guide_hint: 'Between sizes? Go one up.',
      size_guide_note: 'Body measurements, taken with a tape measure.',
      faq_title: 'Delivery, payment & exchanges',
      faq_q1: 'How long does delivery take?', faq_a1: '24 to 72 hours depending on your wilaya. We call you to confirm before shipping.',
      faq_q2: 'How do I pay?', faq_a2: 'Cash on delivery, when you receive your order. No online payment.',
      faq_q3: 'Can I exchange an item?', faq_a3: 'Yes, within 7 days, in its original packaging. Contact us by phone or WhatsApp.',
      cart_updated: 'Some prices were updated since you added these items to your cart.',
      cart_removed: 'An item is no longer available and was removed from your cart.',
      view_product: 'Open {name}',
      scroll_hint: 'Scroll',
      gallery_open: 'View photos', gallery_prev: 'Previous photo', gallery_next: 'Next photo',
      stale_notice: 'Connection failed — showing saved products.',
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
      const active = b.dataset.lang === lang;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    document.dispatchEvent(new CustomEvent('langchange'));
  }

  return { t, fmtPrice, localize, getLang, setLang, apply };
})();
