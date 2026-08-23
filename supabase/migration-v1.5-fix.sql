-- ============================================================
-- MIGRATION v1.5 FIX — aligns review policies and baseline row
-- Run after migration-v1.5.sql if submissions fail with 42501.
-- Safe to run multiple times.
-- ============================================================

-- 1) rebuild every reviews policy exactly as v1.5 defines them
drop policy if exists "anyone may submit a review" on reviews;
drop policy if exists "approved reviews are public" on reviews;
drop policy if exists "owner sees all reviews" on reviews;
drop policy if exists "owner manages reviews" on reviews;
drop policy if exists "owner deletes reviews" on reviews;

create policy "anyone may submit a review" on reviews
  for insert to anon, authenticated
  with check (char_length(name) between 2 and 60 and char_length(body) <= 600);

create policy "approved reviews are public" on reviews
  for select using (approved);

create policy "owner sees all reviews" on reviews
  for select to authenticated using (public.is_owner());

create policy "owner manages reviews" on reviews
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "owner deletes reviews" on reviews
  for delete to authenticated using (public.is_owner());

-- 2) make sure the baseline row exists
insert into settings (key, value) values ('reviews_baseline', '{"count": 0, "avg": 0}')
on conflict (key) do update set value = excluded.value;

-- 3) expose it to the storefront alongside the other public keys
drop policy if exists "read public settings" on settings;
create policy "read public settings" on settings
  for select using (key in ('store', 'zones', 'promo', 'free_delivery_from', 'reviews_baseline'));

-- 4) refresh PostgREST so the API sees everything immediately
notify pgrst, 'reload schema';
