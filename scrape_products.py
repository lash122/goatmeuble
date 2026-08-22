#!/usr/bin/env python3
"""Scrape all products from relax-confort.com, download images, generate SQL."""
import re, json, os, sys
from urllib.request import urlopen, Request
from urllib.error import URLError
from html import unescape

BASE = "https://relax-confort.com"
HEADERS = {"User-Agent": "Mozilla/5.0"}
IMG_DIR = "assets/products"
os.makedirs(IMG_DIR, exist_ok=True)

# Category mapping from WooCommerce slugs to our DB names
CAT_MAP = {
    "collection-de-poufs-relax": ("Poufs & Beanbags", "Poufs & Beanbags", "بوفات وBeanbags"),
    "matelas": ("Matelas", "Mattresses", "مراتب"),
    "surmatelas": ("Surmatelas", "Mattress Toppers", "سوب مراتب"),
    "collection-literie": ("Literie", "Bedding", "ملاءات وفرش"),
    "textiles-de-bain": ("Textiles de Bain", "Bath Textiles", "مناشف الاستحمام"),
    "oreillers-et-coussins-premium": ("Oreillers & Coussins", "Pillows & Cushions", "وسائد"),
}

def fetch(url):
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=15) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  ✗ Failed to fetch {url}: {e}")
        return None

def download_img(url, name):
    """Download image, return local path."""
    if not url or not url.startswith("http"):
        return ""
    ext = ".jpg"
    if ".png" in url.lower():
        ext = ".png"
    elif ".webp" in url.lower():
        ext = ".webp"
    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name)[:60]
    local = f"{IMG_DIR}/{safe_name}{ext}"
    if os.path.exists(local):
        return local
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=15) as r:
            data = r.read()
        with open(local, "wb") as f:
            f.write(data)
        return local
    except Exception as e:
        print(f"  ✗ Failed to download {url}: {e}")
        return ""

def get_all_product_urls():
    """Get all product URLs from category pages."""
    urls = set()
    for cat_slug in CAT_MAP:
        html = fetch(f"{BASE}/product-category/{cat_slug}/")
        if html:
            found = re.findall(r'href="(https://relax-confort\.com/produit/[^"]*)"', html)
            urls.update(found)
    # Also check shop page
    html = fetch(f"{BASE}/shop/")
    if html:
        found = re.findall(r'href="(https://relax-confort\.com/produit/[^"]*)"', html)
        urls.update(found)
    return sorted(urls)

def scrape_product(url):
    """Scrape a single product page."""
    html = fetch(url)
    if not html:
        return None

    # Product name from h1 or og:title
    name = ""
    m = re.search(r'<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>(.*?)</h1>', html, re.S)
    if m:
        name = unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip()
    if not name:
        m = re.search(r'<meta property="og:title"\s+content="([^"]*)"', html)
        if m:
            name = unescape(m.group(1)).strip()
    if not name:
        return None

    # Price
    price = 0
    # Try current price
    m = re.search(r'<ins[^>]*>.*?<bdi>\s*(\d[\d\s.,]*)', html, re.S)
    if m:
        price = int(re.sub(r'\D', '', m.group(1)))
    else:
        # Try regular price
        m = re.search(r'<bdi>\s*(\d[\d\s.,]*)\s*(?:<span[^>]*>)?\.?\s*(?:د\.ج|&#x62f)', html, re.S)
        if m:
            price = int(re.sub(r'\D', '', m.group(1)))
    if not price:
        m = re.search(r'"price":(\d+)', html)
        if m:
            price = int(m.group(1))

    # Old price
    old_price = 0
    m = re.search(r'<del[^>]*>.*?<bdi>\s*(\d[\d\s.,]*)', html, re.S)
    if m:
        old_price = int(re.sub(r'\D', '', m.group(1)))

    # Description
    desc = ""
    m = re.search(r'<div[^>]*class="[^"]*woocommerce-Tabs-panel[^"]*description[^"]*"[^>]*>(.*?)</div>', html, re.S)
    if m:
        desc = unescape(re.sub(r'<[^>]+>', ' ', m.group(1))).strip()
    if not desc:
        m = re.search(r'<meta property="og:description"\s+content="([^"]*)"', html)
        if m:
            desc = unescape(m.group(1)).strip()

    # Photos - get all product images
    photos_raw = re.findall(r'data-src="(https://relax-confort\.com/wp-content/uploads/[^"]*\.(?:jpg|jpeg|png|webp))"', html)
    if not photos_raw:
        photos_raw = re.findall(r'src="(https://relax-confort\.com/wp-content/uploads/[^"]*\.(?:jpg|jpeg|png|webp))"', html)
    # Filter: prefer full-size, not thumbnails
    photos = []
    seen = set()
    for p in photos_raw:
        # Skip thumbnails and SVG placeholders
        if "300x300" in p or "150x150" in p or "base64" in p or "Relax-principal" in p:
            continue
        # Normalize to full size
        clean = re.sub(r'-\d+x\d+', '', p)
        if clean not in seen:
            seen.add(clean)
            photos.append(clean)
    photos = photos[:3]  # Max 3 photos per product

    # Categories
    cats = re.findall(r'product_cat-([a-z0-9-]+)', html)
    category = ""
    for c in cats:
        if c in CAT_MAP:
            category = CAT_MAP[c][0]
            break

    # Colors/sizes from variations
    sizes = []
    color_matches = re.findall(r'<span class="wd-swatch-text">\s*([^<]+?)\s*</span>', html)
    if color_matches:
        sizes = [unescape(c.strip()) for c in color_matches[:10]]

    # Featured (from WooCommerce schema)
    featured = '"featured":true' in html.lower()

    return {
        "name": name,
        "price": price,
        "old_price": old_price,
        "desc": desc[:500],
        "photos": photos,
        "category": category,
        "sizes": sizes,
        "featured": featured,
        "url": url,
    }

def main():
    print("🔍 Finding all products...")
    urls = get_all_product_urls()
    print(f"Found {len(urls)} product URLs")

    products = []
    for i, url in enumerate(urls):
        slug = url.rstrip("/").split("/")[-1]
        print(f"\n[{i+1}/{len(urls)}] Scraping {slug}...")
        p = scrape_product(url)
        if p:
            # Download images
            local_photos = []
            for j, photo_url in enumerate(p["photos"]):
                local = download_img(photo_url, f"{slug}_{j+1}")
                if local:
                    local_photos.append(f"/{local}")
            p["photos"] = local_photos
            products.append(p)
            print(f"  ✓ {p['name']} — {p['price']} DA, {len(local_photos)} photos")
        else:
            print(f"  ✗ Could not scrape")

    # Generate SQL
    print(f"\n📝 Generating SQL for {len(products)} products...")
    lines = []
    lines.append("-- ============================================================")
    lines.append(f"-- {len(products)} Relax Confort products — paste into Supabase SQL Editor")
    lines.append("-- ============================================================")
    lines.append("")
    lines.append("DO $$")
    lines.append("DECLARE")
    lines.append("  cat_poufs bigint; cat_matelas bigint; cat_surmatelas bigint;")
    lines.append("  cat_literie bigint; cat_bain bigint; cat_oreillers bigint;")
    lines.append("BEGIN")
    lines.append("  SELECT id INTO cat_poufs FROM categories WHERE name_fr = 'Poufs & Beanbags' LIMIT 1;")
    lines.append("  SELECT id INTO cat_matelas FROM categories WHERE name_fr = 'Matelas' LIMIT 1;")
    lines.append("  SELECT id INTO cat_surmatelas FROM categories WHERE name_fr = 'Surmatelas' LIMIT 1;")
    lines.append("  SELECT id INTO cat_literie FROM categories WHERE name_fr = 'Literie' LIMIT 1;")
    lines.append("  SELECT id INTO cat_bain FROM categories WHERE name_fr = 'Textiles de Bain' LIMIT 1;")
    lines.append("  SELECT id INTO cat_oreillers FROM categories WHERE name_fr = 'Oreillers & Coussins' LIMIT 1;")
    lines.append("")

    for p in products:
        safe_name = p["name"].replace("'", "''")
        safe_desc = p["desc"].replace("'", "''") if p["desc"] else ""
        cat_var = {
            "Poufs & Beanbags": "cat_poufs",
            "Matelas": "cat_matelas",
            "Surmatelas": "cat_surmatelas",
            "Literie": "cat_literie",
            "Textiles de Bain": "cat_bain",
            "Oreillers & Coussins": "cat_oreillers",
        }.get(p["category"], "cat_poufs")

        photos_arr = "ARRAY[" + ",".join(f"'{ph}'" for ph in p["photos"]) + "]" if p["photos"] else "ARRAY[]::text[]"
        sizes_arr = "ARRAY[" + ",".join(f"'{s}'" for s in p["sizes"]) + "]" if p["sizes"] else "ARRAY[]::text[]"
        old_price_sql = str(p["old_price"]) if p["old_price"] else "NULL"
        featured_sql = "true" if p["featured"] else "false"

        lines.append(f"  -- {safe_name}")
        lines.append(f"  IF NOT EXISTS (SELECT 1 FROM products WHERE name_fr = '{safe_name}') THEN")
        lines.append(f"    INSERT INTO products (name_fr, name_en, name_ar, description_fr, price, compare_at_price, photos, sizes, category_id, featured, active, stock)")
        lines.append(f"    VALUES ('{safe_name}', '{safe_name}', '{safe_name}',")
        lines.append(f"      '{safe_desc}',")
        lines.append(f"      {p['price']}, {old_price_sql},")
        lines.append(f"      {photos_arr},")
        lines.append(f"      {sizes_arr},")
        lines.append(f"      {cat_var}, {featured_sql}, true, 20);")
        lines.append(f"  END IF;")
        lines.append("")

    lines.append("END $$;")
    lines.append("")
    lines.append(f"SELECT count(*) as total FROM products WHERE active = true;")

    with open("supabase/seed-all-products.sql", "w") as f:
        f.write("\n".join(lines))

    print(f"\n✅ Done! {len(products)} products scraped, images saved to {IMG_DIR}/")
    print(f"   SQL saved to supabase/seed-all-products.sql")

if __name__ == "__main__":
    main()
