#!/usr/bin/env python3
"""
Generates dist-vip/ — a copy of the TECH DZ shop, rebranded "Société de vente
privée" with the owner's VP logo image in the header, footer, favicon and
share card.

Same generator philosophy as build-techdz.py: one codebase, this file records
exactly what differs. Re-run after any change to the source:

    python3 build-vip.py

Nothing here touches the database. The shop reads the same Supabase project as
the other variants.
"""
import html
import json
import re
import shutil
import subprocess
from pathlib import Path

from shopdata import fetch_products, fmt_price, read_config

ROOT = Path(__file__).parent
OUT = ROOT / "dist-vip"

BRAND = "Société de vente privée"
LOGO_SRC = ROOT / "assets" / "logo-svp.jpg"
PAGES = ["index.html", "checkout.html", "admin.html", "track.html", "404.html"]
ASSETS = ["css", "js", "og-image.png"]

# Same trimmed font stack as TECH DZ (Inter + Cairo, no Playfair).
FONTS = ("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700"
         "&family=Cairo:wght@400;600;700&display=swap")

# The VP logo is a photo, not a vector — keep it as JPEG in the deploy.
LOGO_OUT = "logo.jpg"

# Dark slate, matching the theme's top bar — used for the phone's browser
# chrome and as the splash background when the shop is installed.
THEME_COLOR = "#0b1220"


def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()

    for page in PAGES:
        shutil.copy(ROOT / page, OUT / page)
    for asset in ASSETS:
        src = ROOT / asset
        (shutil.copytree if src.is_dir() else shutil.copy)(src, OUT / asset)

    # every theme ships with the build — the dashboard can switch the shop's
    # template at runtime (js/layouts.js), so all the theme sheets must exist

    shutil.copy(LOGO_SRC, OUT / LOGO_OUT)

    rebrand_pages()
    # categories right after the hero, products below them (the owner asked
    # for categories on top on this shop; TECH DZ keeps its products-first)
    reorder_home(['catTiles', 'shop', 'featured'])
    retitle_i18n()
    write_verification_tags()
    write_favicon()
    write_pwa()
    write_og_card()
    write_robots()
    copy_seo()
    write_product_pages()

    files = sorted(p.relative_to(OUT).as_posix() for p in OUT.rglob("*") if p.is_file())
    print(f"{OUT.name}/ — {len(files)} files")
    for f in files:
        print("  ", f)


def rebrand_pages():
    """Swap in the VP logo image, the brand name and the tech-flavoured copy."""
    for page in PAGES:
        p = OUT / page
        s = p.read_text(encoding="utf-8")

        # theme overlay must come after style.css so it can override
        s = s.replace(
            '<link rel="stylesheet" href="css/style.css?v=25">',
            '<link rel="stylesheet" href="css/style.css?v=25">\n'
            '  <link rel="stylesheet" href="css/theme-tech.css?v=12" id="themeCss" data-native-theme>', 1)

        # Inter-only font request, like TECH DZ
        s = re.sub(r'https://fonts\.googleapis\.com/css2\?[^\"]+', FONTS, s)

        # browser chrome colour: the dark slate this theme actually uses
        s = s.replace('<meta name="theme-color" content="#0f1b33">',
                      f'<meta name="theme-color" content="{THEME_COLOR}">')

        # wordmarks become the logo image + store name (index / checkout / track)
        s = s.replace('<span class="logo">É<em>l</em>égance</span>',
                      f'<span class="brand-lockup">'
                      f'<img class="logo-img" src="{LOGO_OUT}" alt="{BRAND}">'
                      f'<span class="brand-name">SOCIÉTÉ<br><em>DE VENTE PRIVÉE</em></span>'
                      f'</span>')
        # admin top bar
        s = s.replace('<span class="brand-w">É<span>l</span>égance · Admin</span>',
                      f'<span class="brand-w"><img class="logo-img" src="{LOGO_OUT}" '
                      f'alt="{BRAND}"> · Admin</span>')
        # admin demo gate heading
        s = s.replace('<h1>É<span style="color:var(--gold)">l</span>égance</h1>',
                      f'<h1>{BRAND}</h1>')
        # index footer wordmark
        s = s.replace('<h4>É<em style="color:var(--gold)">l</em>égance</h4>',
                      f'<span class="brand-lockup footer-lockup">'
                      f'<img class="logo-img footer-logo" src="{LOGO_OUT}" alt="{BRAND}">'
                      f'<span class="brand-name">{BRAND}</span>'
                      f'</span>')

        # titles, meta, footer line and the shop description (tech copy)
        s = s.replace("Élégance — Boutique de costumes", f"{BRAND} — Informatique & high-tech")
        s = s.replace("Élégance", BRAND)
        s = s.replace(
            "Costumes et vêtements formels pour hommes. Livraison à domicile, paiement à la livraison.",
            "Smartphones, ordinateurs et accessoires. Livraison partout en Algérie, "
            "paiement à la livraison.")
        s = s.replace(
            "Livraison à domicile partout en Algérie. Paiement à la livraison.",
            "High-tech livré partout en Algérie. Paiement à la livraison.")
        s = s.replace(f"{BRAND} — Boutique en ligne", f"{BRAND} — Informatique & high-tech")

        # favicon: the tech SVG is replaced by the logo-derived PNG
        s = s.replace('href="favicon.svg" type="image/svg+xml"',
                      'href="favicon.png" type="image/png"')

        p.write_text(s, encoding="utf-8")

    # logo sizing — appended to the BASE stylesheet so it survives any
    # theme switch (layouts.js swaps theme-*.css, not style.css)
    base = OUT / "css" / "style.css"
    base.write_text(base.read_text(encoding="utf-8") + """

/* ————— Société de vente privée : logo image + store name ————— */
/* !important is intentional: theme-*.css loads after style.css and
   overrides .brand layout — without it the natural-size photo bleeds
   through when switching templates. */
.brand { align-items: center !important; }
.brand-lockup { display: flex !important; align-items: center; gap: 12px; }
.logo-img { display: block !important; height: 48px !important; width: auto !important;
  max-height: 48px !important; border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,.32); }
.brand-name { font-weight: 800; letter-spacing: .08em; line-height: 1.2;
  color: var(--ink); font-size: .95rem; white-space: nowrap; }
.brand-name em { font-style: normal; color: var(--gold); }
.admin-top .brand-w .logo-img { height: 36px !important; max-height: 36px !important; }
footer .footer-lockup { flex-direction: column; gap: 10px; }
footer .footer-logo { height: 72px !important; max-height: 72px !important; border-radius: 10px; }
footer .brand-name { font-size: 1.05rem; }
@media (max-width: 600px) {
  .logo-img { height: 40px !important; max-height: 40px !important; }
  .brand-lockup { gap: 10px; }
  .brand-name { font-size: .72rem; letter-spacing: .05em; }
  footer .footer-logo { height: 56px !important; max-height: 56px !important; }
  footer .brand-name { font-size: .95rem; }
}
""", encoding="utf-8")


# Same clothing-flavoured i18n swaps as TECH DZ — this is a copy of that shop.
I18N_SWAPS = {
    "fr": {
        "hero_title": "La tech au meilleur prix",
        "hero_sub": "Smartphones, PC portables et accessoires — livrés chez vous, paiement à la livraison.",
        "all_products": "Nos produits",
        "select_size": "Choisir une option",
        "size_required": "Choisissez d’abord une option",
        "search_ph": "Rechercher un produit…",
        "no_results": "Aucun produit ne correspond à votre recherche.",
        "wa_prefill": "Bonjour, j’ai une question sur un produit.",
    },
    "ar": {
        "hero_title": "أفضل الأسعار في عالم التقنية",
        "hero_sub": "هواتف ذكية، حواسيب محمولة وملحقات — توصيل إلى باب منزلك مع الدفع عند الاستلام.",
        "all_products": "منتجاتنا",
        "select_size": "اختر الخيار",
        "size_required": "اختر الخيار أولاً",
        "search_ph": "ابحث عن منتج…",
        "no_results": "لا يوجد منتج مطابق لبحثك.",
        "wa_prefill": "مرحباً، لدي سؤال عن أحد المنتجات.",
    },
    "en": {
        "hero_title": "Tech at the right price",
        "hero_sub": "Smartphones, laptops and accessories — delivered to your door, cash on delivery.",
        "all_products": "Our products",
        "select_size": "Choose an option",
        "size_required": "Please choose an option first",
        "search_ph": "Search products…",
        "no_results": "No products match your search.",
        "wa_prefill": "Hello, I have a question about a product.",
    },
}


def retitle_i18n():
    p = OUT / "js" / "i18n.js"
    s = p.read_text(encoding="utf-8")

    for lang, swaps in I18N_SWAPS.items():
        start = s.index(f"    {lang}: {{")
        end = s.index("\n    },", start)
        block = s[start:end]
        for key, value in swaps.items():
            new_block, n = re.subn(rf"({key}: )'(?:[^'\\]|\\.)*'",
                                   lambda m: m.group(1) + "'" + value.replace("'", "\\'") + "'",
                                   block, count=1)
            if n != 1:
                raise SystemExit(f"i18n key not found: {lang}.{key}")
            block = new_block
        s = s[:start] + block + s[end:]

    p.write_text(s, encoding="utf-8")

    db = OUT / "js" / "supabase.js"
    t = db.read_text(encoding="utf-8")
    t = t.replace("store: { name: 'Élégance',", f"store: {{ name: '{BRAND}',")
    db.write_text(t, encoding="utf-8")

    a = OUT / "js" / "admin.js"
    t = a.read_text(encoding="utf-8")
    t = t.replace("<label>Tailles (séparées par virgule)</label>",
                  "<label>Options / variantes (séparées par virgule)</label>")
    a.write_text(t, encoding="utf-8")


def reorder_home(order):
    p = OUT / "index.html"
    s = p.read_text(encoding="utf-8")
    blocks = {}
    s = re.sub(
        r'<section class="block container" id="(featured|catTiles|shop)"[^>]*>.*?</section>',
        lambda m: blocks.__setitem__(m.group(1), m.group(0)) or f"@@SEC-{m.group(1)}@@",
        s, flags=re.S)
    marks = re.findall(r"@@SEC-(?:featured|catTiles|shop)@@", s)
    if len(marks) != 3:
        raise SystemExit("reorder_home: homepage sections not found")
    first = s.index(marks[0])
    last = s.index(marks[-1]) + len(marks[-1])
    s = s[:first] + "".join(blocks[sid] for sid in order) + s[last:]
    p.write_text(s, encoding="utf-8")


def write_product_pages():
    """Pre-render p/<id>/index.html so a shared product link shows the product.

    js/store.js already rewrites the title, Open Graph tags and JSON-LD when a
    product opens — but it does it in JavaScript, and the crawlers that build
    link previews do not run JavaScript. Facebook, WhatsApp and X fetch the
    HTML and stop reading. Only Google renders scripts, and only in a later
    indexing pass. So every /p/<id> link shared anywhere used to preview as the
    same generic shop card: same photo, same title, whichever product it was.

    The fix is to put the tags in the file. Each product gets a real page whose
    head is the shop's head with the product's own title, description, photo,
    canonical and JSON-LD baked in. Visitors are unaffected — the body is the
    identical shop, and readProductId() in js/store.js picks the id out of the
    path and opens that product exactly as before.

    The `/p/* -> / 200` rule in _redirects stays as the fallback: a product
    added after the last build still works, it just previews generically until
    the next one. Static files win over redirect rules, so these pages take
    precedence wherever they exist.
    """
    site, api, key = read_config()
    products = fetch_products(
        api, key,
        "id,name_fr,description_fr,price,compare_at_price,photos,stock,sizes,category_id")
    if not products:
        return
    cats = {c["id"]: c["name_fr"] for c in fetch_categories(api, key)}

    shop = (OUT / "index.html").read_text(encoding="utf-8")
    fallback_img = f"{site}/og-image.png"
    fallback_desc = meta_content(shop, "description") or ""

    for p in products:
        page = product_page(shop, p, site, fallback_img, fallback_desc, cats)
        d = OUT / "p" / str(p["id"])
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(page, encoding="utf-8")

    print(f"   product pages: {len(products)} under p/<id>/")


def fetch_categories(api, key):
    import json as _json
    import urllib.request
    req = urllib.request.Request(
        f"{api}/rest/v1/categories?select=id,name_fr",
        headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return _json.load(r)


def meta_content(src, name):
    m = re.search(rf'<meta name="{name}" content="([^"]*)"', src)
    return m.group(1) if m else None


def product_page(shop, p, site, fallback_img, fallback_desc, cats):
    """One product's page: the shop's HTML with its own head and its own
    product already drawn into the body."""
    name = (p.get("name_fr") or "").strip()
    price = fmt_price(p.get("price"))
    title = f"{name} — {price} — {BRAND}"
    desc = " ".join((p.get("description_fr") or "").split())[:155] or fallback_desc
    url = f"{site}/p/{p['id']}"

    # a photo-less product falls back to the site card: the storefront's
    # placeholder is a data: URI, which Facebook and WhatsApp refuse as og:image
    photos = [u for u in (p.get("photos") or []) if str(u).startswith("https://")]
    image = photos[0] if photos else fallback_img

    e = html.escape          # every value below lands inside an HTML attribute
    s = shop

    s = re.sub(r"<title>.*?</title>", f"<title>{e(title)}</title>", s, count=1, flags=re.S)
    s = set_meta(s, "name", "description", desc)
    s = set_meta(s, "property", "og:title", title)
    s = set_meta(s, "property", "og:description", desc)
    s = set_meta(s, "property", "og:image", image)
    s = set_meta(s, "property", "og:image:alt", name)
    s = set_meta(s, "property", "og:url", url)
    s = set_meta(s, "property", "og:type", "product")
    s = set_meta(s, "name", "twitter:title", title)
    s = set_meta(s, "name", "twitter:description", desc)
    s = set_meta(s, "name", "twitter:image", image)
    s = re.sub(r'<link rel="canonical" href="[^"]*">',
               f'<link rel="canonical" href="{e(url)}">', s, count=1)

    ld = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": name,
        "image": photos or [fallback_img],
        "description": desc or None,
        "sku": str(p["id"]),
        "offers": {
            "@type": "Offer",
            "url": url,
            "price": str(round(float(p.get("price") or 0))),
            "priceCurrency": "DZD",
            "availability": ("https://schema.org/InStock" if (p.get("stock") or 0) > 0
                             else "https://schema.org/OutOfStock"),
        },
    }
    ld = {k: v for k, v in ld.items() if v is not None}
    # escaping < stops a product name containing "</script>" breaking out
    payload = json.dumps(ld, ensure_ascii=False).replace("<", "\\u003c")
    s = s.replace("</head>",
                  f'  <script type="application/ld+json">{payload}</script>\n</head>', 1)

    s = prefill_modal(s, p, cats, name, price)
    return rebase_to_root(s)


def prefill_modal(s, p, cats, name, price):
    """Draw the product into the modal markup so it is on screen at first paint.

    Without this the page is blank until four Supabase calls come back — about
    150ms on a desk, but a second or two on the mobile data an ad click
    actually arrives over, which is exactly the moment someone decides whether
    to stay. The tags being static fixed the link preview; this fixes the wait.

    Nothing is frozen: js/store.js still fetches the catalogue and calls
    openModal(), which rewrites every one of these elements. A price edited in
    the dashboard since the last build shows the old figure for that first
    moment and then corrects itself — the same bargain getCachedCatalogue()
    already makes for returning visitors, extended to first-time ones. And no
    matter what is drawn here, place_order() recomputes the real total from the
    database, so the number on screen can never become the number charged.
    """
    e = html.escape
    photos = [u for u in (p.get("photos") or []) if str(u).startswith("https://")]
    old = p.get("compare_at_price")
    old_txt = fmt_price(old) if old and float(old) > float(p.get("price") or 0) else ""
    sizes = p.get("sizes") or []

    if photos:
        s = s.replace('<img id="mPhoto" alt="">',
                      f'<img id="mPhoto" src="{e(photos[0])}" alt="{e(name)}">', 1)

    s = fill(s, "mCat", cats.get(p.get("category_id"), ""))
    s = fill(s, "mName", name)
    s = fill(s, "mPrice", price)
    s = fill(s, "mOld", old_txt)
    s = fill(s, "mDesc", " ".join((p.get("description_fr") or "").split()))

    # the chooser's buttons carry no listeners — openModal() replaces them
    # wholesale a moment later. They are here to occupy the right space.
    if sizes:
        btns = "".join(f'<button class="size-btn">{e(str(x))}</button>' for x in sizes)
        s = s.replace('<div class="sizes" id="mSizes" style="margin-top:8px"></div>',
                      f'<div class="sizes" id="mSizes" style="margin-top:8px">{btns}</div>', 1)
    else:
        s = s.replace('<div id="mSizeBlock">', '<div id="mSizeBlock" hidden>', 1)

    # open the modal, and lock the page behind it as openModal() would
    s = s.replace('<div class="modal-overlay" id="productModal"',
                  '<div class="modal-overlay open" id="productModal"', 1)
    return s.replace("<body>", '<body style="overflow:hidden">', 1)


def fill(s, element_id, text):
    """Put text inside the (empty) element with this id."""
    return re.sub(rf'(<[^<>]*\bid="{element_id}"[^<>]*>)</',
                  lambda m: m.group(1) + html.escape(text or "") + "</", s, count=1)


def rebase_to_root(s):
    """Make every relative asset path absolute from the site root.

    These pages live two directories down at /p/<id>/, so a relative
    "css/style.css" would resolve to /p/24/css/style.css and 404. Nothing here
    is served from that folder — only the HTML lives there.
    """
    def fix(m):
        attr, value = m.group(1), m.group(2)
        if value.startswith(("http://", "https://", "//", "#", "/", "data:", "mailto:", "tel:")):
            return m.group(0)
        if value == "./":
            return f'{attr}="/"'
        return f'{attr}="/{value}"'

    return re.sub(r'\b(href|src)="([^"]*)"', fix, s)


def set_meta(src, attr, name, value):
    """Replace a meta tag's content, or add the tag if the page lacks it."""
    esc = html.escape(value or "")
    pattern = rf'<meta {attr}="{re.escape(name)}" content="[^"]*"'
    if re.search(pattern, src):
        return re.sub(pattern, f'<meta {attr}="{name}" content="{esc}"', src, count=1)
    return src.replace("</head>", f'  <meta {attr}="{name}" content="{esc}">\n</head>', 1)


def write_verification_tags():
    """Publish the domain-verification tokens from js/config.js into the HTML.

    Meta, TikTok and Google each verify a domain by looking for a meta tag in
    the page they fetch. Their crawlers read the raw HTML and do not run
    JavaScript, so the tag has to be in the file — injecting it from a script
    at runtime looks correct in a browser and fails every check.

    Only the public pages get them: verification is about the domain, and
    admin.html is noindex anyway. Empty tokens emit nothing, which is the
    state the repository ships in.
    """
    tokens = read_verification_tokens()
    if not tokens:
        return

    tags = "".join(
        f'  <meta name="{name}" content="{value}">\n'
        for name, value in tokens.items())

    anchor = '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    for page in ("index.html", "checkout.html", "track.html", "404.html"):
        p = OUT / page
        s = p.read_text(encoding="utf-8")
        if anchor not in s:
            raise SystemExit(f"build-vip: no viewport tag to anchor to in {page}")
        p.write_text(s.replace(anchor, anchor + tags, 1), encoding="utf-8")

    print(f"   domain verification: {', '.join(tokens)}")


def read_verification_tokens():
    """Parse window.SITE_VERIFICATION out of js/config.js.

    Regex rather than a JS runtime, same as build-sitemap.py: config.js is
    JavaScript, and the alternative is a dependency for reading three strings.
    """
    src = (ROOT / "js" / "config.js").read_text(encoding="utf-8")
    block = re.search(r"window\.SITE_VERIFICATION\s*=\s*\{(.*?)\}", src, re.S)
    if not block:
        return {}
    found = re.findall(r"'([\w-]+)'\s*:\s*'([^']*)'", block.group(1))
    return {name: value for name, value in found if value.strip()}


def write_favicon():
    """Derive a 64×64 favicon from the logo photo."""
    from PIL import Image
    img = Image.open(LOGO_SRC).convert("RGB").resize((64, 64), Image.LANCZOS)
    img.save(OUT / "favicon.png", optimize=True)


def write_pwa():
    """Home-screen icons and the web app manifest.

    Customers reach this shop from an ad once; an icon on their home screen is
    how they come back without paying for the click twice. The logo is a
    1024px square, so the three sizes are straight downscales of it.

    start_url is './' — the same bare-directory URL the pages link to, so an
    installed shop and a shared link open the identical address.
    """
    import json
    from PIL import Image

    logo = Image.open(LOGO_SRC).convert("RGB")
    for size in (180, 192, 512):
        logo.resize((size, size), Image.LANCZOS).save(
            OUT / f"icon-{size}.png", optimize=True)

    (OUT / "manifest.json").write_text(json.dumps({
        "name": BRAND,
        "short_name": "VP Tech",
        "description": "Smartphones, ordinateurs et accessoires — "
                       "livraison partout en Algérie, paiement à la livraison.",
        "start_url": "./",
        "scope": "./",
        "display": "standalone",
        "background_color": THEME_COLOR,
        "theme_color": THEME_COLOR,
        "lang": "fr",
        "dir": "ltr",
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png",
             "purpose": "maskable"},
        ],
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_og_card():
    """1200×630 share card: the VP logo plaque on a dark tech background."""
    from PIL import Image, ImageDraw, ImageFont
    W, H = 1200, 630
    BLUE, WHITE, MUTED = (37, 99, 235), (241, 245, 249), (148, 163, 184)

    img = Image.new("RGB", (W, H), (11, 18, 32))
    d = ImageDraw.Draw(img)
    for i in range(H):                       # vertical slate gradient
        t = i / H
        d.line([(0, i), (W, i)], fill=(int(11 + t * 8), int(18 + t * 10), int(32 + t * 16)))
    for x in range(0, W, 44):                # faint technical grid
        d.line([(x, 0), (x, H)], fill=(24, 33, 54))
    for y in range(0, H, 44):
        d.line([(0, y), (W, y)], fill=(24, 33, 54))

    # the logo plaque, centred, with a soft glow ring behind it
    logo = Image.open(LOGO_SRC).convert("RGB")
    logo.thumbnail((400, 400), Image.LANCZOS)
    lw, lh = logo.size
    img.paste(logo, ((W - lw) // 2, 78))

    sans = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    reg = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    f_sub, f_badge = ImageFont.truetype(reg, 34), ImageFont.truetype(reg, 27)

    def centre(text, font, y, fill):
        d.text(((W - d.textbbox((0, 0), text, font=font)[2]) // 2, y), text, font=font, fill=fill)

    centre("Société de vente privée", ImageFont.truetype(sans, 46), 520, WHITE)
    centre("Smartphones · PC portables · Accessoires", f_sub, 575, MUTED)

    img.save(OUT / "og-image.png", optimize=True)


def write_robots():
    # robots.txt carries the site's own domain, so it is generated once at
    # the root by build-sitemap.py and copied here rather than hardcoded
    # per variant — six copies of a domain is six chances to ship a stale one.
    shutil.copy(ROOT / "robots.txt", OUT / "robots.txt")


def copy_seo():
    shutil.copy(ROOT / "sitemap.xml", OUT / "sitemap.xml")
    shutil.copy(ROOT / "_headers", OUT / "_headers")
    shutil.copy(ROOT / "_redirects", OUT / "_redirects")


if __name__ == "__main__":
    build()
