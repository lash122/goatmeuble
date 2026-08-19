#!/usr/bin/env python3
"""
Generates dist-rugs/ — the same site rebuilt as DAR ZARBIA, a rug shop styled
after handmadecarpets.com: light grey page, Jost throughout, oxblood accent,
uppercase lettered labels, square corners, borderless cards, contain-fit photos.

Same approach as build-techdz.py: a generator rather than a third copy of the
source, so fixes land once and this file is the readable record of what differs.
Re-run after any change to the source.

    python3 build-rugs.py

Change BRAND below to rename the shop.

Nothing here touches the database. The `sizes` column already accepts any
comma-separated list, so it carries 160x230 cm just as well as S/M/L — only the
labels around it change.
"""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "dist-rugs"

BRAND = "DAR ZARBIA"
BRAND_HTML = 'DAR<em> ZARBIA</em>'      # the accented half of the wordmark
PAGES = ["index.html", "checkout.html", "admin.html", "track.html", "404.html"]
ASSETS = ["css", "js"]

# Jost throughout, matching the reference design's geometric sans; Cairo stays
# for Arabic. Replaces Playfair + Inter from the base build.
FONTS = ("https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600"
         "&family=Cairo:wght@400;600;700&display=swap")


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
    # a carpet shopper browses by type — the tiles lead the page
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
        s = s.replace(
            '<link rel="stylesheet" href="css/style.css?v=25">',
            '<link rel="stylesheet" href="css/style.css?v=25">\n'
            '  <link rel="stylesheet" href="css/theme-rugs.css?v=14" id="themeCss" data-native-theme>', 1)

        # swap the font request wholesale — the type is half the identity
        s = re.sub(r'https://fonts\.googleapis\.com/css2\?[^"]+', FONTS, s)

        # the wordmark is hand-written markup on every page
        s = s.replace('<span class="logo">É<em>l</em>égance</span>',
                      f'<span class="logo">{BRAND_HTML}</span>')
        s = s.replace('<h1>É<span style="color:var(--gold)">l</span>égance</h1>',
                      '<h1>DAR <span style="color:var(--gold)">ZARBIA</span></h1>')
        s = s.replace('<span class="brand-w">É<span>l</span>égance · Admin</span>',
                      '<span class="brand-w">DAR<span> ZARBIA</span> · Admin</span>')
        s = s.replace('<h4>É<em style="color:var(--gold)">l</em>égance</h4>',
                      '<h4>DAR<em style="color:var(--gold)"> ZARBIA</em></h4>')

        s = s.replace("Élégance — Boutique de costumes", f"{BRAND} — Tapis & tapisseries")
        s = s.replace("Élégance", BRAND)
        s = s.replace(
            "Costumes et vêtements formels pour hommes. Livraison à domicile, paiement à la livraison.",
            "Tapis berbères, kilims et tapis modernes. Livraison partout en Algérie, "
            "paiement à la livraison.")
        s = s.replace(
            "Livraison à domicile partout en Algérie. Paiement à la livraison.",
            "Tapis livrés partout en Algérie. Paiement à la livraison.")
        s = s.replace(f"{BRAND} — Boutique en ligne", f"{BRAND} — Tapis & tapisseries")

        p.write_text(s, encoding="utf-8")


# Only the strings that describe *clothing*. Cart, checkout, tracking and the
# error messages are already product-agnostic and are left alone.
I18N_SWAPS = {
    "fr": {
        "hero_title": "Le tapis qui fait la pièce",
        "hero_sub": "Tapis berbères, kilims et tapis modernes — livrés chez vous, paiement à la livraison.",
        "all_products": "Notre collection",
        "select_size": "Choisir les dimensions",
        "size_required": "Choisissez d’abord les dimensions",
        "search_ph": "Rechercher un tapis…",
        "no_results": "Aucun tapis ne correspond à votre recherche.",
        "wa_prefill": "Bonjour, j’ai une question sur un tapis.",
    },
    "ar": {
        "hero_title": "الزربية التي تُكمل بيتك",
        "hero_sub": "زرابي أمازيغية، كليم وزرابي عصرية — توصيل إلى باب منزلك مع الدفع عند الاستلام.",
        "all_products": "مجموعتنا",
        "select_size": "اختر المقاس",
        "size_required": "اختر المقاس أولاً",
        "search_ph": "ابحث عن زربية…",
        "no_results": "لا توجد زربية مطابقة لبحثك.",
        "wa_prefill": "مرحباً، لدي سؤال عن إحدى الزرابي.",
    },
    "en": {
        "hero_title": "The rug that makes the room",
        "hero_sub": "Berber rugs, kilims and modern carpets — delivered to your door, cash on delivery.",
        "all_products": "Our collection",
        "select_size": "Choose the size",
        "size_required": "Please choose a size first",
        "search_ph": "Search rugs…",
        "no_results": "No rugs match your search.",
        "wa_prefill": "Hello, I have a question about a rug.",
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

    # the admin labels the variants field in French only
    a = OUT / "js" / "admin.js"
    t = a.read_text(encoding="utf-8")
    t = t.replace("<label>Tailles (séparées par virgule)</label>",
                  "<label>Dimensions (ex : 160x230 cm, 200x300 cm)</label>")
    a.write_text(t, encoding="utf-8")


def copy_seo():
    """The sitemap and cache headers are deployment files, not page assets —
    copy them so a variant folder can be deployed as-is."""
    shutil.copy(ROOT / "sitemap.xml", OUT / "sitemap.xml")
    shutil.copy(ROOT / "_headers", OUT / "_headers")
    shutil.copy(ROOT / "_redirects", OUT / "_redirects")


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
    """Kilim diamond in oxblood on the page grey."""
    (OUT / "favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        '<rect width="64" height="64" fill="#efefef"/>'
        '<path d="M32 10 L52 32 L32 54 L12 32 Z" fill="none" stroke="#480001" stroke-width="3"/>'
        '<path d="M32 22 L42 32 L32 42 L22 32 Z" fill="#480001"/>'
        '</svg>\n', encoding="utf-8")


def write_og_card():
    from PIL import Image, ImageDraw, ImageFont
    W, H = 1200, 630
    GREY, INK, OXBLOOD, MUTED = (239, 239, 239), (28, 28, 28), (72, 0, 1), (123, 122, 122)

    img = Image.new("RGB", (W, H), GREY)
    d = ImageDraw.Draw(img)
    d.rectangle([(0, 0), (W, 8)], fill=OXBLOOD)
    d.rectangle([(0, H - 8), (W, H)], fill=OXBLOOD)
    for cy in (150, 480):                      # faint hairline diamonds
        for cx in range(120, W, 190):
            d.polygon([(cx, cy - 26), (cx + 26, cy), (cx, cy + 26), (cx - 26, cy)],
                      outline=(215, 215, 215), width=1)

    sans = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    f_title, f_sub, f_badge = (ImageFont.truetype(bold, 74),
                               ImageFont.truetype(sans, 27),
                               ImageFont.truetype(sans, 21))

    def centre(text, font, y, fill):
        d.text(((W - d.textbbox((0, 0), text, font=font)[2]) // 2, y), text, font=font, fill=fill)

    # the wordmark, letter-spaced by hand — PIL has no tracking control
    spaced = " ".join("DAR ZARBIA")
    centre(spaced, f_title, 250, INK)
    d.rectangle([(W // 2 - 22, 356), (W // 2 + 22, 357)], fill=OXBLOOD)

    centre("TAPIS BERBERES  ·  KILIMS  ·  TAPIS MODERNES", f_sub, 392, MUTED)
    centre("زرابي أمازيغية · الدفع عند الاستلام", ImageFont.truetype(sans, 26), 438, MUTED)

    txt = "PAIEMENT A LA LIVRAISON"
    bw = d.textbbox((0, 0), txt, font=f_badge)[2]
    x0 = (W - bw) // 2 - 24
    d.rectangle([(x0, 496), (x0 + bw + 48, 546)], outline=OXBLOOD, width=1)
    d.text((x0 + 24, 510), txt, font=f_badge, fill=OXBLOOD)

    img.save(OUT / "og-image.png", optimize=True)


if __name__ == "__main__":
    build()
