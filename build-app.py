#!/usr/bin/env python3
"""
Generates dist-app/ — the same site, rebuilt as BOUTIK DZ, a mobile
shopping-app style shop.

The sixth template, and the first that changes the MARKUP, not just
the skin: the build script injects a fixed bottom tab bar (Boutique ·
Panier · Suivi · Contact) into the storefront pages, so on a phone the
site navigates like an app. The CSS turns the product grid into a
horizontal feed of rows. Everything else — cart, checkout, tracking,
admin, wishlist, gallery — is the same website.

    python3 build-app.py

Nothing here touches the database. The `sizes` column carries S/M/L
as usual, and the size guide stays visible.
"""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "dist-app"

BRAND = "BOUTIK DZ"
BRAND_HTML = 'BOUTIK<em> DZ</em>'
PAGES = ["index.html", "checkout.html", "admin.html", "track.html", "404.html"]
ASSETS = ["css", "js"]

# Poppins (rounded, friendly — the app voice) for everything, Cairo for
# Arabic. Replaces Playfair + Inter from the base build.
FONTS = ("https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700"
         "&family=Cairo:wght@400;600;700&display=swap")

# The bottom tab bar, injected before </body> on the customer pages.
# Labels use data-i18n so I18N.apply() translates them like every other
# string; the active tab is marked per page.
def tabbar(active_href):
    tabs = [
        ("index.html", "🛍️", "nav_shop"),
        ("checkout.html", "🛒", "cart"),
        ("track.html", "📦", "track"),
        ("index.html#contact", "📞", "nav_contact"),
    ]
    links = []
    for href, ico, key in tabs:
        active = ' class="tab-active"' if href == active_href else ''
        links.append(
            f'      <a href="{href}"{active}><span class="tab-ico">{ico}</span>'
            f'<span data-i18n="{key}"></span></a>')
    return ('\n  <!-- app navigation bar (injected by build-app.py); the shop is\n'
            '       the same website, navigated like a mobile app -->\n'
            '  <nav class="app-tabbar" aria-label="Navigation">\n'
            + "\n".join(links) + "\n  </nav>\n")


THEME_LINK = '<link rel="stylesheet" href="/css/theme-app.css?v=16" id="themeCss" data-native-theme>'


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
    # the category browse leads, the feed follows
    reorder_home(['catTiles', 'shop', 'featured'])
    inject_tabbar()
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
                      '<h1>BOUTIK <span style="color:var(--gold)">DZ</span></h1>')
        s = s.replace('<span class="brand-w">É<span>l</span>égance · Admin</span>',
                      '<span class="brand-w">BOUTIK<span> DZ</span> · Admin</span>')
        s = s.replace('<h4>É<em style="color:var(--gold)">l</em>égance</h4>',
                      '<h4>BOUTIK<em style="color:var(--gold)"> DZ</em></h4>')

        # titles, meta, footer line, and the clothing-specific description
        s = s.replace("Élégance — Boutique de costumes", f"{BRAND} — Vêtements & mode")
        s = s.replace("Élégance", BRAND)
        s = s.replace(
            "Costumes et vêtements formels pour hommes. Livraison à domicile, paiement à la livraison.",
            "Vêtements et mode pour toute la famille. Livraison à domicile, paiement à la livraison.")
        s = s.replace(
            "Livraison à domicile partout en Algérie. Paiement à la livraison.",
            "Livraison partout en Algérie. Paiement à la livraison.")
        s = s.replace(f"{BRAND} — Boutique en ligne", f"{BRAND} — Boutique en ligne")

        p.write_text(s, encoding="utf-8")


def inject_tabbar():
    """The app navigation bar on the customer pages — this is what makes the
    template a different *kind* of site, not a different colour."""
    for page, active in (("index.html", "index.html"),
                         ("checkout.html", "checkout.html"),
                         ("track.html", "track.html")):
        p = OUT / page
        s = p.read_text(encoding="utf-8")
        if "app-tabbar" in s:
            continue  # idempotent
        s = s.replace("</body>", tabbar(active) + "</body>")
        p.write_text(s, encoding="utf-8")


# Only the strings that describe *clothing*. Everything else — cart, checkout,
# tracking, errors — is already product-agnostic and is left alone.
I18N_SWAPS = {
    "fr": {
        "hero_title": "La mode, en un clic",
        "hero_sub": "Votre boutique de vêtements en ligne — livrée chez vous, paiement à la livraison.",
        "all_products": "Nos produits",
        "select_size": "Choisir la taille",
        "size_required": "Choisissez d’abord votre taille",
        "search_ph": "Rechercher un article…",
        "no_results": "Aucun article ne correspond à votre recherche.",
        "wa_prefill": "Bonjour, j’ai une question sur un article.",
    },
    "ar": {
        "hero_title": "الأناقة بنقرة واحدة",
        "hero_sub": "متجرك الإلكتروني للملابس — توصيل إلى باب منزلك مع الدفع عند الاستلام.",
        "all_products": "منتجاتنا",
        "select_size": "اختر المقاس",
        "size_required": "اختر مقاسك أولاً",
        "search_ph": "ابحث عن منتج…",
        "no_results": "لا يوجد منتج يطابق بحثك.",
        "wa_prefill": "مرحباً، لدي سؤال عن أحد المنتجات.",
    },
    "en": {
        "hero_title": "Fashion, one tap away",
        "hero_sub": "Your online clothing shop — delivered to your door, cash on delivery.",
        "all_products": "Our products",
        "select_size": "Choose your size",
        "size_required": "Please choose a size first",
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
        '<rect width="64" height="64" rx="14" fill="#f05a28"/>'
        '<text x="32" y="45" font-family="Arial, sans-serif" font-size="36" '
        'font-weight="bold" fill="#ffffff" text-anchor="middle">B</text>'
        '</svg>\n', encoding="utf-8")


def write_og_card():
    from PIL import Image, ImageDraw, ImageFont
    W, H = 1200, 630
    CORAL, INK, WHITE, MUTED = (240, 90, 40), (29, 29, 31), (255, 255, 255), (138, 143, 152)

    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([(60, 60), (W - 60, H - 60)], radius=36, fill=CORAL)
    d.rounded_rectangle([(96, 96), (W - 96, H - 96)], radius=28,
                        outline=WHITE, width=3)

    sans = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    f_title, f_sub, f_badge = (ImageFont.truetype(bold, 100),
                               ImageFont.truetype(sans, 30),
                               ImageFont.truetype(sans, 22))

    def centre(text, font, y, fill):
        d.text(((W - d.textbbox((0, 0), text, font=font)[2]) // 2, y), text, font=font, fill=fill)

    centre("BOUTIK", f_title, 190, WHITE)
    centre("DZ", f_title, 300, INK)
    d.rectangle([(W // 2 - 34, 272), (W // 2 + 34, 273)], fill=WHITE)

    centre("Vêtements & mode · Livraison partout en Algérie", f_sub, 400, WHITE)
    centre("ملابس وموضة · الدفع عند الاستلام", ImageFont.truetype(sans, 26), 448, WHITE)

    txt = "PAIEMENT À LA LIVRAISON"
    bw = d.textbbox((0, 0), txt, font=f_badge)[2]
    x0 = (W - bw) // 2 - 26
    d.rounded_rectangle([(x0, 496), (x0 + bw + 52, 550)], radius=27, fill=WHITE)
    d.text((x0 + 26, 512), txt, font=f_badge, fill=CORAL)

    img.save(OUT / "og-image.png", optimize=True)


def copy_seo():
    """The sitemap and cache headers are deployment files, not page assets —
    copy them so a variant folder can be deployed as-is."""
    shutil.copy(ROOT / "sitemap.xml", OUT / "sitemap.xml")
    shutil.copy(ROOT / "_headers", OUT / "_headers")
    shutil.copy(ROOT / "_redirects", OUT / "_redirects")


if __name__ == "__main__":
    build()
