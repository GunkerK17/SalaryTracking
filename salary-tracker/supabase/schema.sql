create table if not exists public.salary_items (
  id text primary key,
  entry_date date not null,
  wage_usd numeric(12, 2) not null default 0,
  tip_usd numeric(12, 2) not null default 0,
  total_usd numeric(12, 2) not null default 0,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.salary_items enable row level security;

drop policy if exists "salary_items_select_anon" on public.salary_items;
drop policy if exists "salary_items_insert_anon" on public.salary_items;
drop policy if exists "salary_items_update_anon" on public.salary_items;
drop policy if exists "salary_items_delete_anon" on public.salary_items;

create policy "salary_items_select_anon"
on public.salary_items
for select
to anon
using (true);

create policy "salary_items_insert_anon"
on public.salary_items
for insert
to anon
with check (true);

create policy "salary_items_update_anon"
on public.salary_items
for update
to anon
using (true)
with check (true);

create policy "salary_items_delete_anon"
on public.salary_items
for delete
to anon
using (true);

grant usage on schema public to anon;
grant select, insert, update, delete on table public.salary_items to anon;
