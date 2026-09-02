-- Booked private read-status feature.
-- Run this once in Supabase: SQL Editor -> New query -> Run.

create table if not exists public.booked_member_reads (
  book_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

alter table public.booked_member_reads enable row level security;
revoke all on public.booked_member_reads from anon;
grant select, insert, delete on public.booked_member_reads to authenticated;

drop policy if exists "Members can read their own reading status" on public.booked_member_reads;
create policy "Members can read their own reading status"
on public.booked_member_reads for select
to authenticated
using (public.booked_is_member() and (select auth.uid()) = user_id);

drop policy if exists "Members can mark books as read for themselves" on public.booked_member_reads;
create policy "Members can mark books as read for themselves"
on public.booked_member_reads for insert
to authenticated
with check (public.booked_is_member() and (select auth.uid()) = user_id);

drop policy if exists "Members can remove their own reading status" on public.booked_member_reads;
create policy "Members can remove their own reading status"
on public.booked_member_reads for delete
to authenticated
using (public.booked_is_member() and (select auth.uid()) = user_id);
