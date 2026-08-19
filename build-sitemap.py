#!/usr/bin/env python3
"""
Regenerates sitemap.xml and the Sitemap: line of robots.txt.

Every product is a page — /p/<id>, the same URL the Share button, WhatsApp and
the ads point at, and the canonical js/store.js writes when a product opens.
Those pages exist only because the catalogue is in the database, so a static
sitemap listing the home page alone hides the entire shop from Google. This
reads the live catalogue and lists them.

    python3 build-sitemap.py

The domain and the database credentials both come from js/config.js, which
stays the one file to edit. The anon key is public by design (see the security
note in README.md) and only ever reads active products here.

Re-run after adding or removing products, and before deploying.
"""
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).parent
CONFIG = ROOT / "js" / "config.js"

# Static pages. admin.html and checkout.html are deliberately absent — they are
# Disallow-ed in robots.txt and carry X-Robots-Tag: noindex in _headers.
STATIC = [("/", "daily", "1.0"), ("/track.html", "monthly", "0.3")]


def read_config():
    """Pull SITE_URL and the Supabase credentials out of js/config.js.

    Parsed with regexes rather than executed: config.js is JavaScript, and the
    alternative is a JS runtime just to read three strings.
    """
    src = CONFIG.read_text(encoding="utf-8")

    def grab(pattern, what):
        m = re.search(pattern, src)
        if not m or not m.group(1):
            sys.exit(f"build-sitemap: could not find {what} in js/config.js")
        return m.group(1)

    site = grab(r"window\.SITE_URL\s*=\s*['\"]([^'\"]+)['\"]", "window.SITE_URL")
    url = grab(r"url:\s*['\"](https://[^'\"]+)['\"]", "the Supabase url")
    key = grab(r"anonKey:\s*['\"]([^'\"]+)['\"]", "the Supabase anonKey")
    return site.rstrip("/"), url.rstrip("/"), key


def fetch_products(api, key):
    """Active products only — a hidden product is a 404 as far as Google is
    concerned, and RLS would refuse to return it anyway."""
    req = urllib.request.Request(
        f"{api}/rest/v1/products?select=id&active=eq.true&order=id",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"build-sitemap: Supabase refused the request ({e.code}): {e.read().decode()[:200]}")
    except urllib.error.URLError as e:
        sys.exit(f"build-sitemap: could not reach Supabase ({e.reason})")


def write_sitemap(site, products):
    today = date.today().isoformat()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, freq, prio in STATIC:
        lines += ["  <url>",
                  f"    <loc>{escape(site + path)}</loc>",
                  f"    <lastmod>{today}</lastmod>",
                  f"    <changefreq>{freq}</changefreq>",
                  f"    <priority>{prio}</priority>",
                  "  </url>"]
    for p in products:
        loc = escape("{}/p/{}".format(site, p["id"]))
        lines += ["  <url>",
                  f"    <loc>{loc}</loc>",
                  f"    <lastmod>{today}</lastmod>",
                  "    <changefreq>weekly</changefreq>",
                  "    <priority>0.8</priority>",
                  "  </url>"]
    lines.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_robots(site):
    (ROOT / "robots.txt").write_text(
        "User-agent: *\nAllow: /\nDisallow: /admin.html\n"
        "Disallow: /checkout.html\n\n"
        f"Sitemap: {site}/sitemap.xml\n", encoding="utf-8")


if __name__ == "__main__":
    site, api, key = read_config()
    products = fetch_products(api, key)
    write_sitemap(site, products)
    write_robots(site)
    print(f"sitemap.xml — {len(STATIC)} pages + {len(products)} products at {site}")
    print("robots.txt  — Sitemap line pointed at the same domain")
