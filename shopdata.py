"""Shared helpers for the build scripts: read js/config.js, read the catalogue.

Both build-sitemap.py and the product-page generator in build-vip.py need the
same two things — the domain and keys the owner typed into js/config.js, and
the list of active products. Keeping one copy means the two can never disagree
about which products exist or which domain they live on.
"""
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
CONFIG = ROOT / "js" / "config.js"


def read_config():
    """Pull SITE_URL and the Supabase credentials out of js/config.js.

    Parsed with regexes rather than executed: config.js is JavaScript, and the
    alternative is a JS runtime just to read three strings.
    """
    src = CONFIG.read_text(encoding="utf-8")

    def grab(pattern, what):
        m = re.search(pattern, src)
        if not m or not m.group(1):
            sys.exit(f"build: could not find {what} in js/config.js")
        return m.group(1)

    site = grab(r"window\.SITE_URL\s*=\s*['\"]([^'\"]+)['\"]", "window.SITE_URL")
    url = grab(r"url:\s*['\"](https://[^'\"]+)['\"]", "the Supabase url")
    key = grab(r"anonKey:\s*['\"]([^'\"]+)['\"]", "the Supabase anonKey")
    return site.rstrip("/"), url.rstrip("/"), key


def fetch_products(api, key, columns="id"):
    """Active products only — a hidden product is a 404 as far as Google is
    concerned, and the row-level security would refuse to return it anyway."""
    req = urllib.request.Request(
        f"{api}/rest/v1/products?select={columns}&active=eq.true&order=id",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"build: Supabase refused the request ({e.code}): {e.read().decode()[:200]}")
    except urllib.error.URLError as e:
        sys.exit(f"build: could not reach Supabase ({e.reason})")


def fmt_price(value):
    """267000 -> '267 000 DA', matching I18N.fmtPrice() on the site."""
    return f"{round(float(value or 0)):,}".replace(",", " ") + " DA"
