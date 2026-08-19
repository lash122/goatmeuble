#!/usr/bin/env python3
"""
Generates dist-gallery/ — the same site, rebranded and restyled as
GALERIE DZ, a fashion gallery.

The fifth template in the family: navy-and-gold classic (Élégance),
blue tech (TECH DZ), oxblood editorial (DAR ZARBIA), Parisian atelier
(ÉLÉGANCE FEMME), and this one — a gallery. The homepage becomes a
true masonry of natural-aspect photos, the hero is removed, and the
product dialog becomes a lightbox. It is still the same website: the
markup, the JS and the database are identical to the other shops.

    python3 build-gallery.py

Nothing here touches the database. The `sizes` column carries S/M/L
as usual, and the size guide stays visible — fashion comes in sizes.
"""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "dist-gallery"

BRAND = "GALERIE DZ"
BRAND_HTML = 'GALERIE<em> DZ</em>'
PAGES = ["index.html", "checkout.html", "admin.html", "track.html", "404.html"]
ASSETS = ["css", "js"]

# Fraunces (a soft gallery serif) for display, Inter for body, Cairo for
# Arabic. Replaces Playfair + Inter from the base build.
FONTS = ("https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600"
         "&family=Inter:wght@400;600;700"
         "&family=Cairo:wght@400;600;700&display=swap")


THEME_LINK = '<link rel="stylesheet" href="css/theme-gallery.css?v=15" id="themeCss" data-native-theme>'


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
    # the category browse leads, the wall follows
    reorder_home(['catTiles', 'shop', 'featured'])
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

        # the wordmark is hand-written markup on every page
        s = s.replace('<span class="logo">É<em>l</em>égance</span>',
                      f'<span class="logo">{BRAND_HTML}</span>')
        s = s.replace('<h1>É<span style="color:var(--gold)">l</span>égance</h1>',
                      '<h1>GALERIE <span style="color:var(--gold)">DZ</span></h1>')
        s = s.replace('<span class="brand-w">É<span>l</span>égance · Admin</span>',
                      '<span class="brand-w">GALERIE<span> DZ</span> · Admin</span>')
        s = s.replace('<h4>É<em style="color:var(--gold)">l</em>égance</h4>',
                      '<h4>GALERIE<em style="color:var(--gold)"> DZ</em></h4>')

        # titles, meta, footer line, and the clothing-specific description
        s = s.replace("Élégance — Boutique de costumes", f"{BRAND} — Mode en galerie")
        s = s.replace("Élégance", BRAND)
        s = s.replace(
            "Costumes et vêtements formels pour hommes. Livraison à domicile, paiement à la livraison.",
            "Mode sélectionnée pièce par pièce. Livraison à domicile, paiement à la livraison.")
        s = s.replace(
            "Livraison à domicile partout en Algérie. Paiement à la livraison.",
            "Mode livrée partout en Algérie. Paiement à la livraison.")
        s = s.replace(f"{BRAND} — Boutique en ligne", f"{BRAND} — Mode en galerie")

        p.write_text(s, encoding="utf-8")


# Only the strings that describe *clothing*. Everything else — cart, checkout,
# tracking, errors — is already product-agnostic and is left alone.
# (French uses the typographic apostrophe ’ so the single-quoted JS strings
#  in i18n.js are never broken by the regex below.)
I18N_SWAPS = {
    "fr": {
        "hero_title": "La mode, comme une œuvre",
        "hero_sub": "Pièces sélectionnées une à une — livrées chez vous, paiement à la livraison.",
        "all_products": "La collection",
        "select_size": "Choisir la taille",
        "size_required": "Choisissez d’abord votre taille",
        "search_ph": "Rechercher dans la galerie…",
        "no_results": "Aucune pièce de la galerie ne correspond à votre recherche.",
        "wa_prefill": "Bonjour, j’ai une question sur une pièce.",
    },
    "ar": {
        "hero_title": "الأزياء كعمل فني",
        "hero_sub": "قطع مختارة بعناية — توصيل إلى باب منزلك مع الدفع عند الاستلام.",
        "all_products": "المجموعة",
        "select_size": "اختر المقاس",
        "size_required": "اختر مقاسك أولاً",
        "search_ph": "ابحث في المعرض…",
        "no_results": "لا توجد قطعة في المعرض تطابق بحثك.",
        "wa_prefill": "مرحباً، لدي سؤال عن إحدى القطع.",
    },
    "en": {
        "hero_title": "Fashion, hung like art",
        "hero_sub": "Pieces selected one by one — delivered to your door, cash on delivery.",
        "all_products": "The collection",
        "select_size": "Choose your size",
        "size_required": "Please choose a size first",
        "search_ph": "Search the gallery…",
        "no_results": "No pieces in the gallery match your search.",
        "wa_prefill": "Hello, I have a question about a piece.",
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
        '<rect width="64" height="64" fill="#141414"/>'
        '<rect x="14" y="14" width="36" height="36" fill="none" '
        'stroke="#ffffff" stroke-width="3"/>'
        '<circle cx="32" cy="32" r="6" fill="#6d28d9"/>'
        '</svg>\n', encoding="utf-8")


def write_og_card():
    from PIL import Image, ImageDraw, ImageFont
    W, H = 1200, 630
    WHITE, INK, VIOLET, MUTED = (250, 250, 250), (20, 20, 20), (109, 40, 217), (138, 138, 138)

    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)
    d.rectangle([(90, 100), (W - 90, H - 90)], outline=(229, 229, 229), width=2)
    d.rectangle([(104, 114), (W - 104, H - 104)], outline=(229, 229, 229), width=1)

    sans = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    f_title, f_sub, f_badge = (ImageFont.truetype(bold, 92),
                               ImageFont.truetype(sans, 30),
                               ImageFont.truetype(sans, 22))

    def centre(text, font, y, fill):
        d.text(((W - d.textbbox((0, 0), text, font=font)[2]) // 2, y), text, font=font, fill=fill)

    centre("GALERIE", f_title, 200, INK)
    centre("DZ", f_title, 300, VIOLET)
    d.rectangle([(W // 2 - 30, 274), (W // 2 + 30, 275)], fill=VIOLET)

    centre("MODE EN GALERIE  ·  PAIEMENT À LA LIVRAISON", f_sub, 402, MUTED)
    centre("أزياء مختارة بعناية · الدفع عند الاستلام", ImageFont.truetype(sans, 26), 448, MUTED)

    txt = "LIVRAISON PARTOUT EN ALGÉRIE"
    bw = d.textbbox((0, 0), txt, font=f_badge)[2]
    x0 = (W - bw) // 2 - 26
    d.rectangle([(x0, 498), (x0 + bw + 52, 550)], outline=INK, width=2)
    d.text((x0 + 26, 514), txt, font=f_badge, fill=INK)

    img.save(OUT / "og-image.png", optimize=True)


def copy_seo():
    """The sitemap and cache headers are deployment files, not page assets —
    copy them so a variant folder can be deployed as-is."""
    shutil.copy(ROOT / "sitemap.xml", OUT / "sitemap.xml")
    shutil.copy(ROOT / "_headers", OUT / "_headers")
    shutil.copy(ROOT / "_redirects", OUT / "_redirects")


if __name__ == "__main__":
    build()
