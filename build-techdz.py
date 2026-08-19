#!/usr/bin/env python3
"""
Generates dist-techdz/ — the same site, rebranded and restyled as TECH DZ.

Deliberately a generator rather than a second copy of the source: bug fixes and
features stay in one codebase, and this file records exactly what differs
between the two shops. Re-run it after any change to the source.

    python3 build-techdz.py

Nothing here touches the database. The `sizes` column already accepts any
comma-separated list, so it carries 128GB/256GB or Noir/Argent just as well as
S/M/L — only the labels around it change.
"""
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "dist-techdz"

BRAND = "TECH DZ"
PAGES = ["index.html", "checkout.html", "admin.html", "track.html", "404.html"]
ASSETS = ["css", "js", "og-image.png"]

# The base pages request Playfair + Inter + Cairo, but TECH DZ sets its display
# font to Inter — so Playfair (and its weights) would download for nothing.
# Inter 500 is unused; 400/600/700 cover body, headings and buttons.
FONTS = ("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700"
         "&family=Cairo:wght@400;600;700&display=swap")


THEME_LINK = '<link rel="stylesheet" href="css/theme-tech.css?v=12" id="themeCss" data-native-theme>'


def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()

    for page in PAGES:
        shutil.copy(ROOT / page, OUT / page)
    for asset in ASSETS:
        src = ROOT / asset
        (shutil.copytree if src.is_dir() else shutil.copy)(src, OUT / asset)

    # the other variants' themes ride along in css/; drop them so the
    # every theme ships with the build — the dashboard can switch the shop's
    # template at runtime (js/layouts.js), so all the theme sheets must exist

    rebrand_pages()
    # the category browse leads, products below — matches the dashboard
    # tech template so the native look and the saved layout never disagree
    reorder_home(['catTiles', 'shop', 'featured'])
    retitle_i18n()
    write_favicon()
    write_og_card()
    write_robots()
    copy_seo()

    files = sorted(p.relative_to(OUT).as_posix() for p in OUT.rglob("*") if p.is_file())
    print(f"{OUT.name}/ — {len(files)} files")
    for f in files:
        print("  ", f)


def rebrand_pages():
    """Swap the wordmark, titles and social tags, and load the theme overlay."""
    for page in PAGES:
        p = OUT / page
        s = p.read_text(encoding="utf-8")

        # theme overlay must come after style.css so it can override
        # (the base pages carry a ?v= cache-buster on the stylesheet link)
        # Regex, not a literal: this used to match "css/style.css?v=25" exactly,
        # so bumping the stylesheet cache-buster silently stopped injecting the
        # theme overlay and the build fell back to the base look with no error.
        s = re.sub(
            r'(<link rel="stylesheet" href="/?css/style\.css\?v=\d+">)',
            lambda m: m.group(1) + '\n  ' + THEME_LINK, s, count=1)

        # swap the font request wholesale: TECH DZ is Inter-only, so Playfair
        # must not download at all
        s = re.sub(r'https://fonts\.googleapis\.com/css2\?[^"]+', FONTS, s)

        # the wordmark is hand-written markup on every page: É<em>l</em>égance
        s = s.replace('<span class="logo">É<em>l</em>égance</span>',
                      '<span class="logo">TECH<em> DZ</em></span>')
        s = s.replace('<h1>É<span style="color:var(--gold)">l</span>égance</h1>',
                      f'<h1>TECH <span style="color:var(--gold)">DZ</span></h1>')
        s = s.replace('<span class="brand-w">É<span>l</span>égance · Admin</span>',
                      '<span class="brand-w">TECH<span> DZ</span> · Admin</span>')
        s = s.replace('<h4>É<em style="color:var(--gold)">l</em>égance</h4>',
                      '<h4>TECH<em style="color:var(--gold)"> DZ</em></h4>')

        # titles, meta, footer line, and the clothing-specific description
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

        p.write_text(s, encoding="utf-8")


# Only the strings that describe *clothing*. Everything else — cart, checkout,
# tracking, errors — is already product-agnostic and is left alone.
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
    """Rewrite only the clothing-flavoured strings, per language block."""
    p = OUT / "js" / "i18n.js"
    s = p.read_text(encoding="utf-8")

    # split on the language block headers so a key is replaced in the right one
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

    # demo-mode fallback store name — only surfaces if the Supabase keys are
    # ever cleared, but it shouldn't say Élégance in a TECH DZ build
    db = OUT / "js" / "supabase.js"
    t = db.read_text(encoding="utf-8")
    t = t.replace("store: { name: 'Élégance',", f"store: {{ name: '{BRAND}',")
    db.write_text(t, encoding="utf-8")

    # the admin panel labels the variants field in French only

    a = OUT / "js" / "admin.js"
    t = a.read_text(encoding="utf-8")
    t = t.replace("<label>Tailles (séparées par virgule)</label>",
                  "<label>Options / variantes (séparées par virgule)</label>")
    a.write_text(t, encoding="utf-8")

    h = OUT / "admin.html"
    t = h.read_text(encoding="utf-8")
    t = t.replace("placeholder=\"0555 12 34 56\"", "placeholder=\"0555 12 34 56\"")
    h.write_text(t, encoding="utf-8")


def reorder_home(order):
    """Lead the homepage with a different section — each template composes its
    own front page from the same blocks. The JS addresses every block by id,
    so the order is purely cosmetic."""
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


def write_favicon():
    (OUT / "favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        '<rect width="64" height="64" rx="12" fill="#0b1220"/>'
        '<rect x="12" y="18" width="40" height="24" rx="3" fill="none" '
        'stroke="#2563eb" stroke-width="4"/>'
        '<rect x="20" y="46" width="24" height="4" rx="2" fill="#2563eb"/>'
        '</svg>\n', encoding="utf-8")


def write_og_card():
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

    sans = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    reg = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    f_title, f_sub, f_badge = (ImageFont.truetype(sans, 104),
                               ImageFont.truetype(reg, 34),
                               ImageFont.truetype(reg, 27))

    def centre(text, font, y, fill):
        d.text(((W - d.textbbox((0, 0), text, font=font)[2]) // 2, y), text, font=font, fill=fill)

    tw = d.textbbox((0, 0), "TECH DZ", font=f_title)[2]
    x = (W - tw) // 2
    d.text((x, 210), "TECH ", font=f_title, fill=WHITE)
    d.text((x + d.textbbox((0, 0), "TECH ", font=f_title)[2], 210), "DZ", font=f_title, fill=BLUE)

    d.rectangle([(W // 2 - 50, 175), (W // 2 + 50, 178)], fill=BLUE)
    centre("Smartphones · PC portables · Accessoires", f_sub, 350, WHITE)
    centre("توصيل إلى باب منزلك · الدفع عند الاستلام", f_sub, 402, MUTED)

    txt = "PAIEMENT À LA LIVRAISON"
    bw = d.textbbox((0, 0), txt, font=f_badge)[2]
    x0, y0 = (W - bw) // 2 - 28, 480
    d.rounded_rectangle([(x0, y0), (x0 + bw + 56, y0 + 60)], radius=30, outline=BLUE, width=2)
    d.text((x0 + 28, y0 + 16), txt, font=f_badge, fill=BLUE)

    img.save(OUT / "og-image.png", optimize=True)


def write_robots():
    # robots.txt carries the site's own domain, so it is generated once at
    # the root by build-sitemap.py and copied here rather than hardcoded
    # per variant — six copies of a domain is six chances to ship a stale one.
    shutil.copy(ROOT / "robots.txt", OUT / "robots.txt")


def copy_seo():
    """The sitemap and cache headers are deployment files, not page assets —
    copy them so a variant folder can be deployed as-is."""
    shutil.copy(ROOT / "sitemap.xml", OUT / "sitemap.xml")
    shutil.copy(ROOT / "_headers", OUT / "_headers")
    shutil.copy(ROOT / "_redirects", OUT / "_redirects")


if __name__ == "__main__":
    build()
