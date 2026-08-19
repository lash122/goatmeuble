# Élégance — Men's Clothing Store (COD only)

An elegant, trilingual (**FR / AR / EN**) clothing store website with:
- Customer storefront (categories, product pages, cart)
- **Cash on delivery only** checkout with per-zone delivery fees
- Owner admin panel: products, categories, orders, delivery zones, promotions, simple stats
- No build tools, no server — deploy anywhere for free

## ⭐ v1.2 — already installed? ONE required step
Paste `supabase/schema.sql` into **SQL Editor → Run** again. It corrects when
free delivery kicks in: the threshold is now measured **after** the promo-code
discount, which is what the checkout page has always shown the customer. Until
you re-run it, a basket that only crosses the threshold *before* the code is
applied is quoted a delivery fee it is not charged.

Nothing else about the database changes, and your products and orders are
untouched.

## v1.1 — already installed? ONE required step
Paste the updated `supabase/schema.sql` into **SQL Editor → Run** again (safe to
re-run; your products and orders are untouched). It adds promotions (global
sale, promo codes, free-delivery threshold) and category showcase photos.
Until you do, the shop keeps working exactly as before — promo codes are
simply ignored.

### New in v1.1
- **Promotions tab** (admin): store-wide -% sale with banner, promo codes
  (e.g. `BIENVENUE10`), free delivery over an amount — all enforced
  server-side at order time
- **Category showcase** — photo tiles on the homepage, image upload per
  category in the admin
- **Wishlist** (♥ on every product), **recently viewed**, **related
  products** in the product window
- **Size guide** and a **delivery/payment/exchange FAQ** at checkout

---

## 🇬🇧 Setup (English)

### 1. Try it right now (demo mode)
Open `index.html` in a browser — the site runs with sample products until you connect Supabase.

### 2. Create the database (10 minutes, free)
1. Go to [supabase.com](https://supabase.com) → sign up (no credit card).
2. **New project** → choose a name and a database password.
3. In the dashboard open **SQL Editor → New query**, paste the whole content of `supabase/schema.sql`, click **Run**.
4. Create your owner login: **Authentication → Users → Add user**
   - Email: your email · Password: a strong password · check *Auto Confirm User*.
   - **The first account created becomes the owner.** Do this step before
     sharing the site, and do it only once.
5. **Close the door:** Authentication → **Sign In / Providers → Email** → turn
   **off** *Allow new users to sign up*. Skip this and strangers can still
   create accounts on your project.
6. Get your keys: **Settings → API**
   - Copy **Project URL** and **anon public** key.

> To check step 4 worked, run `select * from owners;` in the SQL Editor —
> it should return exactly one row.

### 3. Connect the site
Edit `js/config.js` and paste the URL + anon key:
```js
const SUPABASE_CONFIG = {
  url: 'https://xxxx.supabase.co',
  anonKey: 'eyJhbGci...',
};
```
That's it. The demo banner disappears and your real (empty) store loads.
Log in at `admin.html` with the owner account created in step 2.4.

### 4. Put the store online (free)
- **Netlify**: drag & drop the project folder at [app.netlify.com/drop](https://app.netlify.com/drop).
- Or **GitHub Pages** / **Vercel** — any static host works.

### Daily use
| What | Where |
|---|---|
| Add/edit products, upload photos | admin.html → Produits |
| See orders, mark delivered | admin.html → Commandes |
| Delivery zones & fees | admin.html → Zones de livraison |
| Shop name, phone, WhatsApp | admin.html → Boutique |
| Customers track their order | track.html (order no. + phone) |
| Sales, best sellers | admin.html → Statistiques |

---

## 🇫🇷 Installation (Français)

### 1. Essayer tout de suite (mode démo)
Ouvrez `index.html` dans un navigateur — le site fonctionne avec des produits d'exemple tant que Supabase n'est pas connecté.

### 2. Créer la base de données (10 minutes, gratuit)
1. Allez sur [supabase.com](https://supabase.com) → inscrivez-vous (sans carte bancaire).
2. **New project** → choisissez un nom et un mot de passe de base.
3. Dans le tableau de bord, ouvrez **SQL Editor → New query**, collez tout le contenu de `supabase/schema.sql`, cliquez **Run**.
4. Créez votre compte propriétaire : **Authentication → Users → Add user**
   - Email : votre email · Mot de passe : un mot de passe fort · cochez *Auto Confirm User*.
   - **Le premier compte créé devient le propriétaire.** Faites-le avant de
     partager le site, et une seule fois.
5. **Fermez la porte :** Authentication → **Sign In / Providers → Email** →
   désactivez *Allow new users to sign up*. Sans cela, des inconnus peuvent
   encore créer des comptes sur votre projet.
6. Récupérez vos clés : **Settings → API** → copiez **Project URL** et la clé **anon public**.

### 3. Connecter le site
Modifiez `js/config.js` et collez l'URL + la clé anon :
```js
const SUPABASE_CONFIG = {
  url: 'https://xxxx.supabase.co',
  anonKey: 'eyJhbGci...',
};
```
C'est tout. Connectez-vous sur `admin.html` avec le compte créé à l'étape 2.4.

### 4. Mettre la boutique en ligne (gratuit)
- **Netlify** : glissez-déposez le dossier du projet sur [app.netlify.com/drop](https://app.netlify.com/drop).
- Ou **GitHub Pages** / **Vercel** — tout hébergeur statique fonctionne.

---

## Files
```
index.html        Storefront (search, sort, categories)
track.html        Customer order tracking
checkout.html     Cart + cash-on-delivery order form
admin.html        Owner panel (login required)
404.html          Trilingual "page not found" (no JS, no database)
css/style.css     Elegant theme, LTR + RTL (Arabic)
css/admin.css     Admin styles
css/theme-*.css   Template skins the dashboard can switch between at runtime
js/config.js      ← the file you edit (Supabase keys + SITE_URL)
js/i18n.js        FR/AR/EN translations
js/supabase.js    Database layer (+ demo mode, image compression, Storage)
js/cart.js        localStorage basket, shared by every page
js/layouts.js     Runtime template switcher (the dashboard's Templates tab)
js/tracking.js    Meta + TikTok ad pixels (inert until IDs are set)
js/store.js       Storefront logic, product deep links, per-product SEO
js/checkout.js    Order placement (COD only)
js/track.js       Order tracking lookup
js/admin.js       Admin panel logic
supabase/schema.sql  Tables, security rules, default zones — paste into Supabase SQL Editor
```

### Deployment files
```
_headers          Cache policy + security headers (CSP, frame/sniff/referrer)
_redirects        /index.html → /, and the pretty /p/<id> product links
robots.txt        Crawler rules — generated, don't hand-edit the Sitemap line
sitemap.xml       Generated, one entry per product
build-sitemap.py  Regenerates both of the above from the live catalogue
```

### Brand variants
One codebase, several shops. Each generator writes a self-contained `dist-*/`
folder you can deploy on its own; the file itself records exactly what differs
from the source. They all read the same Supabase project.

```bash
python3 build-vip.py       # dist-vip/     — Société de vente privée (VP logo)
python3 build-techdz.py    # dist-techdz/  — TECH DZ
python3 build-rugs.py      # dist-rugs/    — DAR ZARBIA, dark rug gallery
python3 build-femme.py     # dist-femme/
python3 build-gallery.py   # dist-gallery/
python3 build-app.py       # dist-app/
```

Run `build-sitemap.py` **before** a variant build: the generators copy the
root's `robots.txt`, `sitemap.xml`, `_headers` and `_redirects` into the
output, so a stale sitemap propagates into every folder.

## Notes
- **Payment:** cash on delivery only — there is no online payment anywhere in the code.
- **Currency:** DZD (displayed as `DA` / `دج` depending on language).
- **Stock** goes down automatically when an order is placed, and comes back if
  you cancel the order.

### Where the security actually lives
The site is static, so every browser talks to the database directly and the
anon key is public by design. Anyone can call the API without ever loading your
pages — so **nothing in `js/` protects your data**. All the real rules are in
`supabase/schema.sql`:

- visitors can read the catalogue (hidden products stay hidden) and the
  delivery zones, and nothing else;
- orders can only be created through the `place_order()` function, which
  recomputes prices, delivery fee and totals from the database and ignores
  whatever numbers the browser sent — so the amount your driver collects
  cannot be tampered with;
- only the account listed in the `owners` table can change products, orders or
  settings. Being logged in is not enough.

If you edit `schema.sql`, keep those three properties.

`_headers` covers the other half: the database decides who may *read* the
customer's name, phone and address; the Content-Security-Policy there decides
what may run on the page that *collects* them. It is an allow-list — the
Supabase project, Google Fonts, and the pinned supabase-js on jsDelivr. Add a
new external script, font or image host to the site and you must add it there
too, or the browser will refuse to load it.

### Search & sharing (SEO)
- **One config value.** Open Graph tags and the canonical need an absolute
  domain. Set it once in `js/config.js`:
  ```js
  window.SITE_URL = 'https://vptech.dzstor.shop';
  ```
  It must be `window.SITE_URL`, not `const SITE_URL` — a top-level `const` in a
  plain `<script>` never becomes a property of `window`, so the pages that read
  it would silently see nothing. Leave the string empty and the site
  auto-detects the domain from the address bar (fine for sharing; pin it for
  Google).
- **Per-product pages.** Every product lives at `/?p=<id>` — the link the
  Share button, WhatsApp and ads point at. Opening a product rewrites the
  title, description, Open Graph, Twitter card, canonical and JSON-LD to that
  product (name, photo, price), so a shared link shows the product, not the
  generic shop card. WhatsApp, Facebook, X and Google all render the page's
  JavaScript when they fetch a link, so ads and shares pick up the product
  card without any server.
- **Sitemap.** Don't edit `sitemap.xml` or `robots.txt` by hand — run
  ```bash
  python3 build-sitemap.py
  ```
  It reads the domain and the Supabase keys out of `js/config.js`, fetches the
  active products, and writes both files with one `/p/<id>` entry per product.
  Re-run it after adding or removing products, then redeploy.
### Ads (Meta & TikTok pixels)
The shop's traffic comes from paid social, and an ad platform can only
optimise for what it can measure. Paste the two IDs into `js/config.js`:
```js
window.ADS = {
  metaPixelId: '',      // Meta Events Manager → Data sources → your pixel
  tiktokPixelId: '',    // TikTok Events Manager → your pixel, starts with C
};
```
Leave a value empty and that pixel is never loaded — no third-party script,
no advertising cookie. With an ID set, `js/tracking.js` sends the standard
events, so they map onto the Purchase / AddToCart optimisation goals in Ads
Manager with no custom conversion to configure:

| Moment | Meta | TikTok |
|---|---|---|
| Any page | `PageView` | `page` |
| Product window opened | `ViewContent` | `ViewContent` |
| Added to cart | `AddToCart` | `AddToCart` |
| Checkout reached | `InitiateCheckout` | `InitiateCheckout` |
| Order placed | `Purchase` | `CompletePayment` |

Values are in **DZD**, and the purchase value is the total `place_order()`
computed — the amount the driver collects.

Two things to keep in mind:
- **Cash on delivery.** `Purchase` fires when the order is *placed*, which is
  the only moment the browser sees. Orders refused at the door still count, so
  the pixel will report slightly more revenue than the till. Optimising on
  orders placed is the normal COD trade-off — just don't read the pixel's
  revenue as takings.
- **Adding a pixel means saying so.** Publish a privacy policy before you
  switch one on; Meta and TikTok ad review ask for it, and so does the law in
  most of the places your ads will be shown.

If you add another tracker later, add its hosts to the
`Content-Security-Policy` in `_headers` too — otherwise the browser blocks it
and it looks exactly like a pixel that was never installed.

### Installable on a phone
`manifest.json` and the `icon-*.png` files are generated by the build script
from the brand logo, so the shop can be added to a home screen and reopens
without the browser chrome. Customers who come back that way cost nothing;
the ad click that first brought them did.

- Test cards at
  [developers.facebook.com/tools/debug](https://developers.facebook.com/tools/debug/).

### Upgrading the Supabase library
The three HTML pages load one exact version of `supabase-js`, with an
`integrity` hash — if the file on the CDN ever changes, the browser refuses it
rather than running someone else's code on your checkout page. That also means
**changing the version without changing the hash breaks the site.** To upgrade:

```bash
curl -sL https://cdn.jsdelivr.net/npm/@supabase/supabase-js@NEW.VER.SION/dist/umd/supabase.js | openssl dgst -sha384 -binary | openssl base64 -A
```

Put `sha384-` in front of the output, then update both the `src` and the
`integrity` in `index.html`, `checkout.html` and `admin.html`.
