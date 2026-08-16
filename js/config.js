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

// Demo mode shows sample products when the keys above are not set yet,
// so you can preview the site design before connecting Supabase.
const IS_DEMO =
  !SUPABASE_CONFIG.url.startsWith('https://') ||
  SUPABASE_CONFIG.anonKey.startsWith('PASTE_');
