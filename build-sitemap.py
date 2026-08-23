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
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

from shopdata import fetch_products, read_config

ROOT = Path(__file__).parent

# Static pages. admin.html and checkout.html are deliberately absent — they are
# Disallow-ed in robots.txt and carry X-Robots-Tag: noindex in _headers.
STATIC = [("/", "daily", "1.0"), ("/boutique.html", "daily", "0.9"),
          ("/track.html", "monthly", "0.3")]




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
    """Deliberately no `Disallow: /admin.html`.

    Naming the owner's login in a file every scanner reads is an invitation,
    and it backfires twice over: Disallow stops a crawler fetching the page,
    so it never sees the `X-Robots-Tag: noindex` in _headers, and the URL can
    still surface in results on inbound links alone. The header is the thing
    that actually removes those pages from the index — let Google fetch them
    and be told to drop them.
    """
    (ROOT / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n\n"
        f"Sitemap: {site}/sitemap.xml\n", encoding="utf-8")


if __name__ == "__main__":
    site, api, key = read_config()
    products = fetch_products(api, key)
    if site:
        write_sitemap(site, products)
        write_robots(site)
        print(f"sitemap.xml — {len(STATIC)} pages + {len(products)} products at {site}")
        print("robots.txt  — Sitemap line pointed at the same domain")
    else:
        print("Skipping sitemap/robots: window.SITE_URL is empty in js/config.js")
        print("Set it in config.js and re-run to generate sitemap.xml.")
