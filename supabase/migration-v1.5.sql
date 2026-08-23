-- ============================================================
-- MIGRATION v1.5 — paste into Supabase SQL Editor and Run
-- Adds: customer reviews table (+security), review_summary() RPC,
--       adjustable star baseline row.
-- Safe to run twice.
--
-- NOTE: the two new order protections (daily cap, duplicate-basket guard)
-- live inside the place_order() function body. To activate them too, run
-- the FULL updated supabase/schema.sql instead of this file.
-- ============================================================

-- ============================================================
-- v1.5 — CUSTOMER REVIEWS
--
-- Social proof is the strongest converter a COD shop can add: the buyer
-- cannot touch the product, so other buyers' words carry the sale.
--
-- Flow: anyone may submit (insert), nothing is public until the owner
-- approves it. This keeps prank and competitor reviews off the page without
-- making honest customers wait for an account they will never create.
-- ============================================================

create table if not exists reviews (
  id bigint generated always as identity primary key,
  product_id bigint not null references products(id) on delete cascade,
  name text not null,
  rating int not null check (rating between 1 and 5),
  body text not null default '',
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reviews_product_idx on reviews(product_id) where approved;
create index if not exists reviews_pending_idx on reviews(created_at) where not approved;

alter table reviews enable row level security;

drop policy if exists "anyone may submit a review" on reviews;
drop policy if exists "approved reviews are public" on reviews;
drop policy if exists "owner sees all reviews" on reviews;
drop policy if exists "owner manages reviews" on reviews;

-- submission needs no account; length limits keep the abuse surface small.
-- Approval still gates what becomes public, so spam costs the owner one click.
create policy "anyone may submit a review" on reviews
  for insert to anon, authenticated
  with check (char_length(name) between 2 and 60 and char_length(body) <= 600);

create policy "approved reviews are public" on reviews
  for select using (approved);

create policy "owner sees all reviews" on reviews
  for select to authenticated using (public.is_owner());

create policy "owner manages reviews" on reviews
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists "owner deletes reviews" on reviews;
create policy "owner deletes reviews" on reviews
  for delete to authenticated using (public.is_owner());

-- One aggregate row per product for cards and product pages: average and
-- count over APPROVED reviews only. Security definer so it can read the table
-- without opening it up; takes a slice of ids or all products when null.
create or replace function public.review_summary(p_ids bigint[] default null)
returns table (product_id bigint, avg_rating numeric, review_count bigint)
language sql stable security definer set search_path = public as $$
  select r.product_id, round(avg(r.rating)::numeric, 1), count(*)
  from reviews r
  where r.approved
    and (p_ids is null or r.product_id = any (p_ids))
  group by r.product_id;
$$;

revoke all on function public.review_summary(bigint[]) from public;
grant execute on function public.review_summary(bigint[]) to anon, authenticated;
