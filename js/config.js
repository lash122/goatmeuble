/* ============================================================
   CONFIGURATION — the ONLY file you need to edit.
   1. Create a free account at https://supabase.com
   2. Create a project, then go to Settings > API
   3. Copy the "Project URL" and the "anon public" key below.
   4. Run the file supabase/schema.sql in SQL Editor.
   ============================================================ */
const SUPABASE_CONFIG = {
  url: 'https://bdvnlqdublfikmadcnev.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkdm5scWR1YmxmaWttYWRjbmV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwOTMwMTQsImV4cCI6MjEwMjY2OTAxNH0.XqwovU4SdlPzX55Psp4NGEeDnYYL9wX5jFqdHYql43A',
};

// Your public site URL, used for social previews and search links (og:url,
// canonical, sitemap). Leave empty to auto-detect from the visitor's address
// bar — fine for sharing, but pin it so Google always sees one domain.
//
// It MUST be window.SITE_URL, not `const SITE_URL`: a top-level const in a
// classic <script> creates a lexical binding that never becomes a property of
// window, and every reader here (index/checkout/track head snippets,
// absUrl() in js/store.js) looks it up as window.SITE_URL. Declared as a
// const it silently stayed undefined and the pages fell back to the origin.
window.SITE_URL = 'https://goat7.netlify.app';

/* Hero background image. Leave empty to auto-use the first featured product
   photo. Set a URL (absolute or root-relative like '/assets/hero.jpg') to
   use a specific image instead. */
window.HERO_IMAGE = '/assets/hero-goat.webp';

/* Ad pixels. The shop's traffic comes from Facebook, Instagram and TikTok,
   and an ad platform can only optimise for what it can measure — without
   these, every campaign is spending blind and there is no retargeting.

   Paste the IDs from Meta Events Manager and TikTok Events Manager. Leave a
   value empty and that pixel is never loaded at all: no third-party script,
   no cookie, nothing to disclose. See js/tracking.js for the events sent.

   Adding a pixel makes you responsible for saying so — publish a privacy
   policy before switching one on. */
window.ADS = {
  metaPixelId: '',      // Meta (Facebook/Instagram) — 15-16 digits
  tiktokPixelId: '',    // TikTok — starts with C, e.g. 'CXXXXXXXXXXXXXXXXXXX'
};

/* Domain verification. Meta wants to know the domain is yours before it lets
   you run conversion campaigns properly on it (and before you can control
   which events take priority for iOS users); TikTok and Google ask the same
   in the same way. Each platform gives you a token to publish in the page.

   The key IS the meta tag's name, so adding a fourth platform later means
   adding a line here and nothing else. Empty values emit no tag.

   These are injected into the HTML at build time by build-vip.py, NOT at
   runtime: the crawlers that check for them read the raw HTML and do not run
   JavaScript, so a tag added by a script would never be seen. Fill these in,
   re-run the build, deploy, then click Verify. */
window.SITE_VERIFICATION = {
  // Meta Business Manager → Brand safety and suitability → Domains
  'facebook-domain-verification': '',
  // TikTok Ads Manager → Assets → Events → Web events → Verify domain
  'tiktok-developers-site-verification': '',
  // Google Search Console → Add property → HTML tag (optional, same mechanism)
  'google-site-verification': '',
};

/* Size guide. A clothing feature: the panel measures chest and waist with a
   tape. Set false for a shop that sells anything else — a phone offered in
   "Orange / Bleu / Argent" uses the same chooser, and a size guide beside it
   makes the shop look like it was built for something different. */
window.SIZE_GUIDE = false;

// Demo mode shows sample products when the keys above are not set yet,
// so you can preview the site design before connecting Supabase.
const IS_DEMO =
  !SUPABASE_CONFIG.url.startsWith('https://') ||
  SUPABASE_CONFIG.anonKey.startsWith('PASTE_');
