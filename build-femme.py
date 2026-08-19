#!/usr/bin/env python3
"""
Generates dist-femme/ — the same site, rebranded and restyled as
ÉLÉGANCE FEMME, a women's fashion shop.

The fourth template in the family: the navy-and-gold base (Élégance),
the blue tech theme (TECH DZ), the oxblood editorial theme (DAR ZARBIA),
and this one — a Parisian atelier: warm cream, dusty rose, Cormorant
serif, soft rounded corners. It exists to show how far one codebase
can stretch with a CSS overlay and a copy pass: the markup, the JS and
the database are identical to the other shops.

    python3 build-femme.py

Nothing here touches the database. The `sizes` column carries S/M/L just
as well for women's clothing as for men's — and unlike the tech and rug
shops, the size guide stays visible, because dresses genuinely come in
sizes.
"""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "dist-femme"

BRAND = "ÉLÉGANCE FEMME"
BRAND_HTML = 'ÉLÉGANCE<em> FEMME</em>'    # the accented half of the wordmark
PAGES = ["index.html", "checkout.html", "admin.html", "track.html", "404.html"]
ASSETS = ["css", "js"]

# Cormorant Garamond (high-contrast serif) for display, Montserrat for body,
# Cairo for Arabic. Replaces Playfair + Inter from the base build.
FONTS = ("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600"
         "&family=Montserrat:wght@400;600"
         "&family=Cairo:wght@400;600;700&display=swap")


THEME_LINK = '<link rel="stylesheet" href="css/theme-femme.css?v=14" id="themeCss" data-native-theme>'


def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()

    for page in PAGES:
        shutil.copy(ROOT / page, OUT / page)
    for asset in ASSETS:
        shutil.copytree(ROOT / asset, OUT / asset)

    # the other variants' themes ride along in css/; drop them so the
    # every theme ships with the build — the dashboard can switch the shop's
    # template at runtime (js/layouts.js), so all the theme sheets must exist

    rebrand_pages()
    # the circular collection rings are the signature — lead with them
    reorder_home(['catTiles', 'featured', 'shop'])
    retitle_i18n()
    write_favicon()
    write_og_card()
    # robots.txt carries the site's own domain, so it is generated once at
    # the root by build-sitemap.py and copied here rather than hardcoded
    # per variant — six copies of a domain is six chances to ship a stale one.
    shutil.copy(ROOT / "robots.txt", OUT / "robots.txt")
    copy_seo()

    files = sorted(p.relative_to(OUT).as_posix() for p in OUT.rglob("*") if p.is_file())
    print(f"{OUT.name}/ — {len(files)} files")
    for f in files:
        print("  ", f)


def rebrand_pages():
    for page in PAGES:
        p = OUT / page
        s = p.read_text(encoding="utf-8")

        # theme overlay must load after style.css so it can override
        # (the base pages carry a ?v= cache-buster on the stylesheet link)
        # Regex, not a literal: this used to match "css/style.css?v=25" exactly,
        # so bumping the stylesheet cache-buster silently stopped injecting the
        # theme overlay and the build fell back to the base look with no error.
        s = re.sub(
            r'(<link rel="stylesheet" href="/?css/style\.css\?v=\d+">)',
            lambda m: m.group(1) + '\n  ' + THEME_LINK, s, count=1)

        # swap the font request wholesale — the type is half the identity
        s = re.sub(r'https://fonts\.googleapis\.com/css2\?[^"]+', FONTS, s)

        # the hero arch gets a real photo (populated by store.js from the
        # catalogue) instead of the generic CTA buttons
        s = s.replace('<section class="hero">',
                      '<section class="hero">\n'
                      '      <img class="hero-look" id="heroLook" alt="" hidden>', 1)

        # the wordmark is hand-written markup on every page
        s = s.replace('<span class="logo">É<em>l</em>égance</span>',
                      f'<span class="logo">{BRAND_HTML}</span>')
        s = s.replace('<h1>É<span style="color:var(--gold)">l</span>égance</h1>',
                      '<h1>ÉLÉGANCE <span style="color:var(--gold)">FEMME</span></h1>')
        s = s.replace('<span class="brand-w">É<span>l</span>égance · Admin</span>',
                      '<span class="brand-w">ÉLÉGANCE<span> FEMME</span> · Admin</span>')
        s = s.replace('<h4>É<em style="color:var(--gold)">l</em>égance</h4>',
                      '<h4>ÉLÉGANCE<em style="color:var(--gold)"> FEMME</em></h4>')

        # titles, meta, footer line, and the clothing-specific description
        s = s.replace("Élégance — Boutique de costumes", f"{BRAND} — Vêtements & mode féminine")
        s = s.replace("Élégance", BRAND)
        s = s.replace(
            "Costumes et vêtements formels pour hommes. Livraison à domicile, paiement à la livraison.",
            "Robes, caftans et mode féminine. Livraison à domicile, paiement à la livraison.")
        s = s.replace(
            "Livraison à domicile partout en Algérie. Paiement à la livraison.",
            "Mode féminine livrée partout en Algérie. Paiement à la livraison.")
        s = s.replace(f"{BRAND} — Boutique en ligne", f"{BRAND} — Mode féminine")

        p.write_text(s, encoding="utf-8")


# Only the strings that describe *clothing*. Everything else — cart, checkout,
# tracking, errors — is already product-agnostic and is left alone.
# (French uses the typographic apostrophe ’ so the single-quoted JS strings
#  in i18n.js are never broken by the regex below.)
I18N_SWAPS = {
    "fr": {
        "hero_title": "L’élégance au féminin",
        "hero_sub": "Robes, caftans et ensembles — livrés chez vous, paiement à la livraison.",
        "all_products": "Nos créations",
        "select_size": "Choisir la taille",
        "size_required": "Choisissez d’abord votre taille",
        "search_ph": "Rechercher une pièce…",
        "no_results": "Aucune pièce ne correspond à votre recherche.",
        "wa_prefill": "Bonjour, j’ai une question sur un article.",
    },
    "ar": {
        "hero_title": "أناقة المرأة",
        "hero_sub": "فساتين، قفاطين وأطقم نسائية — توصيل إلى باب منزلك مع الدفع عند الاستلام.",
        "all_products": "تشكيلتنا",
        "select_size": "اختر المقاس",
        "size_required": "اختر مقاسك أولاً",
        "search_ph": "ابحثي عن قطعة…",
        "no_results": "لا توجد قطعة مطابقة لبحثك.",
        "wa_prefill": "مرحباً، لدي سؤال عن أحد الأصناف.",
    },
    "en": {
        "hero_title": "Elegance for her",
        "hero_sub": "Dresses, caftans and sets for women — delivered to your door, cash on delivery.",
        "all_products": "Our pieces",
        "select_size": "Choose your size",
        "size_required": "Please choose a size first",
        "search_ph": "Search pieces…",
        "no_results": "No pieces match your search.",
        "wa_prefill": "Hello, I have a question about an item.",
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
            block, n = re.subn(rf"({key}: )'(?:[^'\\]|\\.)*'",
                               lambda m: m.group(1) + "'" + value.replace("'", "\\'") + "'",
                               block, count=1)
            if n != 1:
                raise SystemExit(f"i18n key not found: {lang}.{key}")
        s = s[:start] + block + s[end:]
    p.write_text(s, encoding="utf-8")

    # demo-mode fallback name, only visible if the Supabase keys are cleared
    db = OUT / "js" / "supabase.js"
    t = db.read_text(encoding="utf-8")
    t = t.replace("store: { name: 'Élégance',", f"store: {{ name: '{BRAND}',")
    db.write_text(t, encoding="utf-8")

    # the admin labels the variants field in French only — women's clothing
    # genuinely has sizes, so unlike the tech and rug shops the label stays


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
        '<rect width="64" height="64" fill="#faf5f0"/>'
        '<circle cx="32" cy="32" r="22" fill="#b5636f"/>'
        '<text x="32" y="43" font-family="Georgia, serif" font-size="30" '
        'font-weight="bold" fill="#ffffff" text-anchor="middle">F</text>'
        '</svg>\n', encoding="utf-8")


def write_og_card():
    from PIL import Image, ImageDraw, ImageFont
    W, H = 1200, 630
    CREAM, INK, ROSE, MUTED = (250, 245, 240), (56, 40, 46), (181, 99, 111), (148, 132, 140)

    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    # a faint rose wash, stronger toward the top
    for i in range(H):
        t = i / H
        d.line([(0, i), (W, i)], fill=(
            int(250 - t * 6), int(245 - t * 5), int(240 - t * 6)))
    # hairlines, like a fashion-plate
    for x in (90, W - 90):
        d.line([(x, 120), (x, H - 120)], fill=(233, 221, 213), width=1)
    d.line([(90, 120), (W - 90, 120)], fill=(233, 221, 213), width=1)

    sans = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    f_title, f_sub, f_badge = (ImageFont.truetype(bold, 96),
                               ImageFont.truetype(sans, 30),
                               ImageFont.truetype(sans, 22))

    def centre(text, font, y, fill):
        d.text(((W - d.textbbox((0, 0), text, font=font)[2]) // 2, y), text, font=font, fill=fill)

    centre("ÉLÉGANCE", f_title, 190, INK)
    centre("FEMME", f_title, 292, ROSE)
    d.rectangle([(W // 2 - 32, 262), (W // 2 + 32, 263)], fill=ROSE)

    centre("Robes  ·  Caftans  ·  Mode féminine", f_sub, 400, MUTED)
    centre("فساتين وقفاطين نسائية · الدفع عند الاستلام", ImageFont.truetype(sans, 26), 448, MUTED)

    txt = "PAIEMENT À LA LIVRAISON"
    bw = d.textbbox((0, 0), txt, font=f_badge)[2]
    x0 = (W - bw) // 2 - 26
    d.rounded_rectangle([(x0, 500), (x0 + bw + 52, 552)], radius=26, outline=ROSE, width=2)
    d.text((x0 + 26, 516), txt, font=f_badge, fill=ROSE)

    img.save(OUT / "og-image.png", optimize=True)


def copy_seo():
    """The sitemap and cache headers are deployment files, not page assets —
    copy them so a variant folder can be deployed as-is."""
    shutil.copy(ROOT / "sitemap.xml", OUT / "sitemap.xml")
    shutil.copy(ROOT / "_headers", OUT / "_headers")
    shutil.copy(ROOT / "_redirects", OUT / "_redirects")


if __name__ == "__main__":
    build()
