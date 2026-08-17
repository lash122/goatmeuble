#!/usr/bin/env python3
"""
Generates dist-rugs/ — the same site rebuilt as DAR ZARBIA, a rug gallery:
near-black page, borderless photography, editorial left-aligned headings.

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
PAGES = ["index.html", "checkout.html", "admin.html", "track.html"]
ASSETS = ["css", "js"]

# Marcellus + Lora replace Playfair + Inter; Cairo stays for Arabic.
FONTS = ("https://fonts.googleapis.com/css2?family=Marcellus"
         "&family=Lora:wght@400;500;600"
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
    # deployed folder holds only what this shop actually loads
    for stale in (OUT / "css").glob("theme-*.css"):
        if stale.name != "theme-rugs.css":
            stale.unlink()

    rebrand_pages()
    retitle_i18n()
    write_favicon()
    write_og_card()
    (OUT / "robots.txt").write_text(
        "User-agent: *\nAllow: /\nDisallow: /admin.html\n", encoding="utf-8")

    files = sorted(p.relative_to(OUT).as_posix() for p in OUT.rglob("*") if p.is_file())
    print(f"{OUT.name}/ — {len(files)} files")
    for f in files:
        print("  ", f)


def rebrand_pages():
    for page in PAGES:
        p = OUT / page
        s = p.read_text(encoding="utf-8")

        # theme overlay must load after style.css so it can override
        s = s.replace(
            '<link rel="stylesheet" href="css/style.css">',
            '<link rel="stylesheet" href="css/style.css">\n'
            '  <link rel="stylesheet" href="css/theme-rugs.css">', 1)

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


def write_favicon():
    """Kilim diamond in saffron on near-black — the gallery palette."""
    (OUT / "favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        '<rect width="64" height="64" fill="#0d0c0b"/>'
        '<path d="M32 10 L52 32 L32 54 L12 32 Z" fill="none" stroke="#d9a441" stroke-width="3"/>'
        '<path d="M32 22 L42 32 L32 42 L22 32 Z" fill="#d9a441"/>'
        '</svg>\n', encoding="utf-8")


def write_og_card():
    from PIL import Image, ImageDraw, ImageFont
    W, H = 1200, 630
    BLACK, BONE, SAFFRON, MUTED = (13, 12, 11), (236, 231, 221), (217, 164, 65), (141, 133, 122)

    img = Image.new("RGB", (W, H), BLACK)
    d = ImageDraw.Draw(img)

    # a single column of faint diamonds down the right — gallery, not bazaar
    for cy in range(70, H, 120):
        d.polygon([(1040, cy - 34), (1074, cy), (1040, cy + 34), (1006, cy)],
                  outline=(36, 33, 29), width=2)

    serif = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
    bold = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
    # DejaVu Serif carries no Arabic glyphs — that line needs the sans face or
    # it renders as a row of tofu boxes.
    arabic = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    f_title = ImageFont.truetype(bold, 86)
    f_sub = ImageFont.truetype(serif, 30)
    f_ar = ImageFont.truetype(arabic, 28)
    f_badge = ImageFont.truetype(serif, 22)

    X = 96
    d.rectangle([(X, 214), (X + 64, 217)], fill=SAFFRON)
    d.text((X, 256), "DAR ", font=f_title, fill=BONE)
    d.text((X + d.textbbox((0, 0), "DAR ", font=f_title)[2], 256), "ZARBIA",
           font=f_title, fill=SAFFRON)
    d.text((X, 372), "Tapis berbères · Kilims · Tapis modernes", font=f_sub, fill=MUTED)
    d.text((X, 418), "زرابي أمازيغية · الدفع عند الاستلام", font=f_ar, fill=MUTED)

    txt = "PAIEMENT À LA LIVRAISON"
    bw = d.textbbox((0, 0), txt, font=f_badge)[2]
    d.rectangle([(X, 486), (X + bw + 44, 486 + 50)], outline=SAFFRON, width=1)
    d.text((X + 22, 500), txt, font=f_badge, fill=SAFFRON)

    img.save(OUT / "og-image.png", optimize=True)


if __name__ == "__main__":
    build()
