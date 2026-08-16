# Élégance — Men's Clothing Store (COD only)

An elegant, trilingual (**FR / AR / EN**) clothing store website with:
- Customer storefront (categories, product pages, cart)
- **Cash on delivery only** checkout with per-zone delivery fees
- Owner admin panel: products, categories, orders, delivery zones, simple stats
- No build tools, no server — deploy anywhere for free

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
index.html        Storefront
checkout.html     Cart + cash-on-delivery order form
admin.html        Owner panel (login required)
css/style.css     Elegant theme, LTR + RTL (Arabic)
css/admin.css     Admin styles
js/config.js      ← the only file you edit (Supabase keys)
js/i18n.js        FR/AR/EN translations
js/supabase.js    Database layer (+ demo mode)
js/store.js       Storefront logic, cart
js/checkout.js    Order placement (COD only)
js/admin.js       Admin panel logic
supabase/schema.sql  Tables, security rules, default zones — paste into Supabase SQL Editor
```

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

### After deploying: fix the social preview
`index.html` carries Open Graph tags so the link shows a proper card when
shared on WhatsApp or Facebook. Their scrapers need **absolute** URLs, so once
you know your address, edit these two lines in `index.html`:

```html
<meta property="og:image" content="https://YOUR-SITE.netlify.app/og-image.png">
<meta property="og:url"   content="https://YOUR-SITE.netlify.app/">
```

Test the result at [developers.facebook.com/tools/debug](https://developers.facebook.com/tools/debug/).

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
