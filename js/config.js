/* ============================================================
   CONFIGURATION — the ONLY file you need to edit.
   1. Create a free account at https://supabase.com
   2. Create a project, then go to Settings > API
   3. Copy the "Project URL" and the "anon public" key below.
   4. Run the file supabase/schema.sql in SQL Editor.
   ============================================================ */
const SUPABASE_CONFIG = {
  url: 'https://ssnplihsehgjiydlfimo.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzbnBsaWhzZWhnaml5ZGxmaW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMjQ2MTEsImV4cCI6MjEwMTkwMDYxMX0.dmfMjrHTjJ_kZuNLsYvS3brSTgwFYe1OXjS7y3S90o0',
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
window.SITE_URL = 'https://vptech.dzstor.shop';

// Demo mode shows sample products when the keys above are not set yet,
// so you can preview the site design before connecting Supabase.
const IS_DEMO =
  !SUPABASE_CONFIG.url.startsWith('https://') ||
  SUPABASE_CONFIG.anonKey.startsWith('PASTE_');
