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
import re
import shutil
import subprocess
from pathlib import Path

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
