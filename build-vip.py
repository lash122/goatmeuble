#!/usr/bin/env python3
"""
Generates dist-vip/ — the GOAT meubles shop, ready for Netlify.

The source pages are already GOAT-branded, so this build only assembles the
deploy folder and generates what cannot be committed: PWA icons and the
1200x630 share card from the logo, per-product pages from the database,
and the sitemap/robots/edge-function plumbing.

Re-run after any change to the source:

    python3 build-vip.py

Nothing here writes to the database. The shop reads the same Supabase
project as the other variants.
"""
import html
import json
import re
import shutil
from pathlib import Path

from shopdata import fetch_products, fmt_price, read_config

ROOT = Path(__file__).parent
OUT = ROOT / "dist-vip"

BRAND = "GOAT meubles"
LOGO_SRC = ROOT / "assets" / "logo-goat.jpg"
# product.html is a TEMPLATE, not a page: it is branded like the rest, then
# consumed by write_product_pages() and deleted from the output.
PAGES = ["index.html", "boutique.html", "checkout.html", "admin.html",
         "track.html", "404.html", "product.html"]
# assets/ travels whole: logo-goat.jpg, hero-goat.jpg and the category/product
# photos the hand-rebranded pages reference by absolute path. Forgetting this
# folder is what broke the logo on every git-connected deploy before.
ASSETS = ["css", "js", "assets"]
FILES = ["favicon.svg"]

THEME_COLOR = "#3b2f24"


def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()

    for page in PAGES:
        shutil.copy(ROOT / page, OUT / page)
    for asset in ASSETS:
        src = ROOT / asset
        (shutil.copytree if src.is_dir() else shutil.copy)(src, OUT / asset)
    for f in FILES:
        shutil.copy(ROOT / f, OUT / f)

    write_verification_tags()
    write_pwa()
    write_og_card()
    write_robots()
    copy_seo()
    # after copy_seo(): _headers is copied from the source there, so
    # substituting before it would be overwritten by the placeholder copy
    write_supabase_origin()
    write_product_pages()

    files = sorted(p.relative_to(OUT).as_posix() for p in OUT.rglob("*") if p.is_file())
    print(f"{OUT.name}/ — {len(files)} files")


def write_product_pages():
    """Write a real page per product at p/<id>/index.html.

    Two problems, one file. The crawlers that build link previews — Facebook,
    WhatsApp, X — fetch the HTML and never run scripts, so a shop that titles
    itself in JavaScript previews every product as the same generic card. And
    a page assembled from four database calls is blank for a second or two on
    the mobile data an ad click actually arrives over, which is exactly when
    someone decides whether to stay.

    So the head is written here, and so is the product: name, price, photos,
    options and description travel in the page as JSON, and js/product.js reads
    them from there. Nothing loads the catalogue. Only the shop settings and a
    few related products are fetched afterwards, and neither blocks what the
    customer came to read.

    The `/p/* -> / 200` rule in _redirects stays as the fallback for a product
    added since the last build: it lands on the shop, which still opens that
    product in its modal. Static files win over redirect rules, so a real page
    takes precedence wherever one exists.
    """
    tpl_path = OUT / "product.html"
    if not tpl_path.exists():
        raise SystemExit("build-vip: product.html missing — it must be in PAGES")

    site, api, key = read_config()
    products = fetch_products(
        api, key,
        "id,name_fr,name_ar,name_en,description_fr,description_ar,description_en,"
        "price,compare_at_price,photos,stock,sizes,category_id")
    if not products:
        tpl_path.unlink()
        return
    cats = {c["id"]: c["name_fr"] for c in fetch_categories(api, key)}

    tpl = tpl_path.read_text(encoding="utf-8")
    fallback_img = f"{site}/og-image.png"
    fallback_desc = meta_content((OUT / "index.html").read_text(encoding="utf-8"),
                                 "description") or ""

    for row in products:
        prod = dict(row)
        prod["category_name"] = cats.get(prod.get("category_id"), "")
        page = product_page(tpl, prod, site, fallback_img, fallback_desc)
        # the payload the page draws itself from; \u003c so a name containing
        # "</script>" cannot break out of the JSON island
        payload = json.dumps(prod, ensure_ascii=False).replace("<", "\\u003c")
        page = page.replace(
            "</body>",
            f'  <script type="application/json" id="pdpData">{payload}</script>\n</body>', 1)
        d = OUT / "p" / str(prod["id"])
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(page, encoding="utf-8")

    # The shell the edge function fills at request time: the same branded
    # template, asset paths already rebased for /p/<id>, but with nobody's
    # product in it. Keeping it as a real file means the edge function does not
    # carry a copy of the markup — the page it serves and the page the build
    # writes come from one source that cannot drift apart.
    (OUT / "product-shell.html").write_text(rebase_to_root(tpl), encoding="utf-8")

    # a template is not a page anyone should land on
    tpl_path.unlink()
    print(f"   product pages: {len(products)} under p/<id>/  (+ product-shell.html)")


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


def product_page(shop, p, site, fallback_img, fallback_desc):
    """One product's page: the shop's HTML with its own head and payload.

    `prefill` is off for the dedicated template, which draws itself from the
    JSON payload instead of from the shop's modal markup.
    """
    name = (p.get("name_fr") or "").strip()
    price = fmt_price(p.get("price"))
    title = f"{name} — {price} — {BRAND}"
    desc = " ".join((p.get("description_fr") or "").split())[:155] or fallback_desc
    url = f"{site}/p/{p['id']}/"

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

    return rebase_to_root(s)


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


def write_supabase_origin():
    """Point the CSP and the preconnect hints at whatever js/config.js says.

    These used to name the project by hand in six places. When the shop was
    moved to a different Supabase project, config.js changed and they did not
    — and a Content-Security-Policy that allow-lists the wrong host does not
    warn anybody: the browser simply refuses every API call and every product
    photo, and the live shop renders empty while working perfectly in local
    preview, where no _headers file is served.

    So the source carries a placeholder and the origin is substituted here,
    from the single file the owner actually edits.
    """
    _, api, _ = read_config()
    origin = api.rstrip("/")
    host = origin.split("://", 1)[1]

    for path in list(OUT.glob("*.html")) + [OUT / "_headers"]:
        if not path.exists():
            continue
        s = path.read_text(encoding="utf-8")
        if "__SUPABASE_ORIGIN__" not in s:
            continue
        # wss://__SUPABASE_ORIGIN__ must not become wss://https://…
        s = s.replace("wss://__SUPABASE_ORIGIN__", f"wss://{host}")
        s = s.replace("__SUPABASE_ORIGIN__", origin)
        path.write_text(s, encoding="utf-8")

    print(f"   supabase origin: {origin}")


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


def write_pwa():
    """Home-screen icons and the web app manifest.

    Customers reach this shop from an ad once; an icon on their home screen is
    how they come back without paying for the click twice. The logo is a near
    square, so the three sizes are straight downscales of it.

    start_url is './' — the same bare-directory URL the pages link to, so an
    installed shop and a shared link open the identical address.
    """
    from PIL import Image

    logo = Image.open(LOGO_SRC).convert("RGB")
    for size in (180, 192, 512):
        logo.resize((size, size), Image.LANCZOS).save(
            OUT / f"icon-{size}.png", optimize=True)

    (OUT / "manifest.json").write_text(json.dumps({
        "name": BRAND,
        "short_name": "GOAT",
        "description": "Meubles, matelas et confort — livraison partout en "
                       "Algérie, paiement à la livraison.",
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
    """1200×630 share card: the GOAT logo plaque on a warm dark background."""
    from PIL import Image, ImageDraw, ImageFont
    W, H = 1200, 630
    WHITE, MUTED = (247, 243, 237), (196, 181, 158)

    img = Image.new("RGB", (W, H), (59, 47, 38))
    d = ImageDraw.Draw(img)
    for i in range(H):                       # vertical warm gradient
        t = i / H
        d.line([(0, i), (W, i)], fill=(int(59 - t * 14), int(47 - t * 12), int(36 - t * 9)))

    # the logo plaque, centred, sized to leave room for the wordmark below
    logo = Image.open(LOGO_SRC).convert("RGB")
    logo.thumbnail((400, 400), Image.LANCZOS)
    lw, lh = logo.size
    img.paste(logo, ((W - lw) // 2, 60))

    sans = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    reg = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

    def centre(text, font, y, fill):
        d.text(((W - d.textbbox((0, 0), text, font=font)[2]) // 2, y), text, font=font, fill=fill)

    try:
        f_sub = ImageFont.truetype(reg, 34)
        centre(BRAND, ImageFont.truetype(sans, 46), 500, WHITE)
        centre("Meubles · Matelas · Confort", f_sub, 565, MUTED)
    except OSError:
        # a stripped build image without DejaVu still ships a valid card —
        # just the logo plaque, no lettering
        pass

    img.save(OUT / "og-image.png", optimize=True)


def write_robots():
    # robots.txt carries the site's own domain, so it is generated once at
    # the root by build-sitemap.py and copied here rather than hardcoded
    # per variant — six copies of a domain is six chances to ship a stale one.
    shutil.copy(ROOT / "robots.txt", OUT / "robots.txt")


def copy_seo():
    shutil.copy(ROOT / "sitemap.xml", OUT / "sitemap.xml")
    shutil.copy(ROOT / "_headers", OUT / "_headers")
    # The edge function travels with the deploy, so a drag-and-drop upload of
    # dist-vip gets it too — not just a git-connected build.
    shutil.copytree(ROOT / "netlify", OUT / "netlify", dirs_exist_ok=True)
    # Deliberately NOT the root netlify.toml: that one tells Netlify to run the
    # build and publish dist-vip, which is nonsense when dist-vip IS the site
    # root. Hand-drop deploys get a file that only points at the functions.
    (OUT / "netlify.toml").write_text(
        "# Deployed build — the site is already built; do not build it again.\n"
        "[[edge_functions]]\n"
        '  path = "/p/*"\n'
        '  function = "product"\n', encoding="utf-8")
    shutil.copy(ROOT / "_redirects", OUT / "_redirects")


if __name__ == "__main__":
    build()
