-- Booked Literary Desk: run once in Supabase SQL Editor.
-- The table is publicly readable; only the refresh function writes to it.

create table if not exists public.booked_literary_desk (
  id bigint generated always as identity primary key,
  url text not null unique,
  title text not null,
  source text not null,
  region text not null,
  kind text not null,
  excerpt text,
  image_url text,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now()
);

create index if not exists booked_literary_desk_published_at_idx
on public.booked_literary_desk (published_at desc);

alter table public.booked_literary_desk enable row level security;
revoke all on public.booked_literary_desk from anon, authenticated;
grant select on public.booked_literary_desk to anon, authenticated;

drop policy if exists "Everyone can read the literary desk" on public.booked_literary_desk;
create policy "Everyone can read the literary desk"
on public.booked_literary_desk for select
to anon, authenticated
using (true);
