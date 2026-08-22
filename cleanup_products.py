#!/usr/bin/env python3
"""Clean up duplicate products and fix images."""
import json, re, os
from urllib.request import urlopen, Request

API = "https://bdvnlqdublfikmadcnev.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkdm5scWR1YmxmaWttYWRjbmV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwOTMwMTQsImV4cCI6MjEwMjY2OTAxNH0.XqwovU4SdlPzX55Psp4NGEeDnYYL9wX5jFqdHYql43A"

req = Request(f"{API}/rest/v1/products?select=id,name_fr,photos,active&active=eq.true", headers={"apikey": KEY})
with urlopen(req) as r:
    products = json.loads(r.read())

old_products = [p for p in products if p.get("photos") and p["photos"] and p["photos"][0].startswith("http")]
new_products = [p for p in products if p.get("photos") and p["photos"] and not p["photos"][0].startswith("http")]

print(f"Old (external URLs): {len(old_products)}")
print(f"New (local images): {len(new_products)}")

# Build slug -> photos map
slug_map = {}
for f in sorted(os.listdir("assets/products")):
    m = re.match(r"^(.+?)_(\d+)\.\w+$", f)
    if m:
        slug = m.group(1)
        if slug not in slug_map:
            slug_map[slug] = []
        slug_map[slug].append(f"/assets/products/{f}")

deleted = 0
for old in old_products:
    name = old["name_fr"]
    is_dup = False
    for new in new_products:
        if name[:15].lower() in new["name_fr"].lower() or new["name_fr"][:15].lower() in name.lower():
            req = Request(f"{API}/rest/v1/products?id=eq.{old['id']}", method="DELETE", headers={"apikey": KEY})
            with urlopen(req):
                pass
            deleted += 1
            print(f"  Deleted duplicate: {name}")
            is_dup = True
            break
    if not is_dup:
        # Try to update with local images
        name_slug = re.sub(r"[^a-z0-9]", "_", name.lower())[:40]
        local_photos = []
        for slug, paths in slug_map.items():
            if slug[:25] == name_slug[:25]:
                local_photos = paths
                break
        if local_photos:
            data = json.dumps({"photos": local_photos}).encode()
            req = Request(f"{API}/rest/v1/products?id=eq.{old['id']}", data=data, method="PATCH",
                         headers={"apikey": KEY, "Content-Type": "application/json"})
            with urlopen(req):
                pass
            print(f"  Updated: {name} -> {len(local_photos)} local photos")
        else:
            req = Request(f"{API}/rest/v1/products?id=eq.{old['id']}", method="DELETE", headers={"apikey": KEY})
            with urlopen(req):
                pass
            deleted += 1
            print(f"  Deleted (no images): {name}")

# Count final
req = Request(f"{API}/rest/v1/products?select=id&active=eq.true", headers={"apikey": KEY})
with urlopen(req) as r:
    total = len(json.loads(r.read()))
print(f"\nDone: {deleted} deleted, {total} products remaining")
