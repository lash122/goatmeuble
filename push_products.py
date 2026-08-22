#!/usr/bin/env python3
"""Push all scraped products to Supabase with local image paths."""
import json, re, os
from urllib.request import urlopen, Request

API = "https://bdvnlqdublfikmadcnev.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkdm5scWR1YmxmaWttYWRjbmV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwOTMwMTQsImV4cCI6MjEwMjY2OTAxNH0.XqwovU4SdlPzX55Psp4NGEeDnYYL9wX5jFqdHYql43A"

CAT_NAME_TO_ID = {
    "Poufs & Beanbags": 13, "Matelas": 14, "Surmatelas": 15,
    "Literie": 16, "Textiles de Bain": 17, "Oreillers & Coussins": 18,
}

def api_get(path):
    req = Request(f"{API}{path}", headers={"apikey": KEY})
    with urlopen(req) as r:
        return json.loads(r.read())

def api_patch(path, data):
    body = json.dumps(data).encode()
    req = Request(f"{API}{path}", data=body, method="PATCH",
                  headers={"apikey": KEY, "Content-Type": "application/json"})
    with urlopen(req) as r:
        return r.status

def api_post(path, data):
    body = json.dumps(data).encode()
    req = Request(f"{API}{path}", data=body, method="POST",
                  headers={"apikey": KEY, "Content-Type": "application/json"})
    with urlopen(req) as r:
        return json.loads(r.read())

# Build image map: slug -> [paths]
img_map = {}
for f in sorted(os.listdir("assets/products")):
    m = re.match(r"^(.+?)_(\d+)\.jpg$", f)
    if m:
        slug, num = m.group(1), int(m.group(2))
        if slug not in img_map:
            img_map[slug] = []
        img_map[slug].append(f"/assets/products/{f}")

print(f"Image files: {len(img_map)} products, {sum(len(v) for v in img_map.values())} photos")

# Get existing products
existing = {p["name_fr"]: p for p in api_get("/rest/v1/products?select=id,name_fr,photos,price,category_id,active")}
print(f"Existing in DB: {len(existing)}")

# Build product data from scraped SQL (parse the SQL file)
with open("supabase/seed-all-products.sql") as f:
    sql = f.read()

# Extract product blocks
blocks = re.findall(r"VALUES \('(.*?)', '(.*?)', '(.*?)',\s*'(.*?)',\s*(\d+),\s*(\d+|NULL),", sql, re.S)

inserted = 0
updated = 0
skipped = 0

for name_fr, name_en, name_ar, desc, price, old_price in blocks:
    name_fr = name_fr.replace("''", "'")
    
    # Find matching images
    name_slug = re.sub(r"[^a-z0-9]", "_", name_fr.lower())[:40]
    photos = []
    for slug, paths in img_map.items():
        if slug[:25] == name_slug[:25]:
            photos = paths
            break

    # Find category from SQL
    cat_match = re.search(rf"-- {re.escape(name_fr[:30])}.*?cat_(\w+)", sql, re.S)
    cat_id = CAT_NAME_TO_ID.get("Poufs & Beanbags", 13)  # default
    # Try to find from the block
    for cat_name, cid in CAT_NAME_TO_ID.items():
        if f"cat_{cat_name.split()[0].lower()}" in sql[sql.find(name_fr):sql.find(name_fr)+500]:
            cat_id = cid
            break

    if name_fr in existing:
        # Update photos if they're external URLs
        p = existing[name_fr]
        old_photos = p.get("photos", [])
        if old_photos and old_photos[0].startswith("http") and photos:
            api_patch(f"/rest/v1/products?id=eq.{p['id']}", {"photos": photos})
            updated += 1
            print(f"  ↻ Updated: {name_fr} ({len(photos)} local photos)")
        else:
            skipped += 1
    else:
        # Insert new
        old_price_val = int(old_price) if old_price and old_price != "NULL" else None
        product = {
            "name_fr": name_fr,
            "name_en": name_en.replace("''", "'"),
            "name_ar": name_ar.replace("''", "'"),
            "description_fr": desc.replace("''", "'"),
            "price": int(price),
            "compare_at_price": old_price_val,
            "photos": photos,
            "sizes": [],
            "category_id": cat_id,
            "featured": False,
            "active": True,
            "stock": 20,
        }
        api_post("/rest/v1/products", product)
        inserted += 1
        print(f"  + Inserted: {name_fr} ({len(photos)} photos)")

print(f"\nDone: {inserted} inserted, {updated} updated, {skipped} unchanged")
