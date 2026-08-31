-- Booked member features for Supabase.
-- Run this in the Supabase SQL editor, then fill assets/js/data.js -> members.

create table if not exists public.booked_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.booked_profiles add column if not exists first_name text not null default '';
alter table public.booked_profiles add column if not exists last_name text not null default '';

create table if not exists public.booked_allowed_members (
  email text primary key,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.booked_ratings (
  book_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

create table if not exists public.booked_comments (
  id bigint generated always as identity primary key,
  book_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  visibility text not null check (visibility in ('public', 'private')),
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, user_id, visibility)
);

create table if not exists public.booked_comment_likes (
  comment_id bigint not null references public.booked_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create or replace function public.booked_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists booked_profiles_touch_updated_at on public.booked_profiles;
create trigger booked_profiles_touch_updated_at
before update on public.booked_profiles
for each row execute function public.booked_touch_updated_at();

drop trigger if exists booked_ratings_touch_updated_at on public.booked_ratings;
create trigger booked_ratings_touch_updated_at
before update on public.booked_ratings
for each row execute function public.booked_touch_updated_at();

drop trigger if exists booked_comments_touch_updated_at on public.booked_comments;
create trigger booked_comments_touch_updated_at
before update on public.booked_comments
for each row execute function public.booked_touch_updated_at();

alter table public.booked_profiles enable row level security;
alter table public.booked_allowed_members enable row level security;
alter table public.booked_ratings enable row level security;
alter table public.booked_comments enable row level security;
alter table public.booked_comment_likes enable row level security;

revoke all on public.booked_profiles from anon;
revoke all on public.booked_allowed_members from anon, authenticated;
revoke all on public.booked_ratings from anon;
revoke all on public.booked_comments from anon;
revoke all on public.booked_comment_likes from anon;

grant select, insert, update on public.booked_profiles to authenticated;
grant select, insert, update on public.booked_ratings to authenticated;
grant select, insert, update on public.booked_comments to authenticated;
grant select, insert, delete on public.booked_comment_likes to authenticated;
grant usage, select on sequence public.booked_comments_id_seq to authenticated;

create or replace function public.booked_is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select auth.uid()) is not null
    and (
      not exists (select 1 from public.booked_allowed_members)
      or exists (
        select 1
        from public.booked_allowed_members
        where lower(booked_allowed_members.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
      )
    );
$$;

revoke all on function public.booked_is_member() from public;
grant execute on function public.booked_is_member() to authenticated;

drop policy if exists "Members can read their own profile" on public.booked_profiles;
create policy "Members can read their own profile"
on public.booked_profiles for select
to authenticated
using (public.booked_is_member() and (select auth.uid()) = user_id);

drop policy if exists "Members can create their own profile" on public.booked_profiles;
create policy "Members can create their own profile"
on public.booked_profiles for insert
to authenticated
with check (public.booked_is_member() and (select auth.uid()) = user_id);

drop policy if exists "Members can update their own profile" on public.booked_profiles;
create policy "Members can update their own profile"
on public.booked_profiles for update
to authenticated
using (public.booked_is_member() and (select auth.uid()) = user_id)
with check (public.booked_is_member() and (select auth.uid()) = user_id);

drop policy if exists "Members can read their own ratings" on public.booked_ratings;
create policy "Members can read their own ratings"
on public.booked_ratings for select
to authenticated
using (public.booked_is_member() and (select auth.uid()) = user_id);

drop policy if exists "Members can create their own ratings" on public.booked_ratings;
create policy "Members can create their own ratings"
on public.booked_ratings for insert
to authenticated
with check (public.booked_is_member() and (select auth.uid()) = user_id);

drop policy if exists "Members can update their own ratings" on public.booked_ratings;
create policy "Members can update their own ratings"
on public.booked_ratings for update
to authenticated
using (public.booked_is_member() and (select auth.uid()) = user_id)
with check (public.booked_is_member() and (select auth.uid()) = user_id);

drop policy if exists "Members can read public comments and their own private comments" on public.booked_comments;
create policy "Members can read public comments and their own private comments"
on public.booked_comments for select
to authenticated
using (public.booked_is_member() and (visibility = 'public' or (select auth.uid()) = user_id));

drop policy if exists "Members can create their own comments" on public.booked_comments;
create policy "Members can create their own comments"
on public.booked_comments for insert
to authenticated
with check (public.booked_is_member() and (select auth.uid()) = user_id);

drop policy if exists "Members can update their own comments" on public.booked_comments;
create policy "Members can update their own comments"
on public.booked_comments for update
to authenticated
using (public.booked_is_member() and (select auth.uid()) = user_id)
with check (public.booked_is_member() and (select auth.uid()) = user_id);

drop policy if exists "Members can read likes on public comments" on public.booked_comment_likes;
create policy "Members can read likes on public comments"
on public.booked_comment_likes for select
to authenticated
using (
  public.booked_is_member()
  and exists (
    select 1
    from public.booked_comments
    where booked_comments.id = booked_comment_likes.comment_id
      and booked_comments.visibility = 'public'
  )
);

drop policy if exists "Members can like public comments as themselves" on public.booked_comment_likes;
create policy "Members can like public comments as themselves"
on public.booked_comment_likes for insert
to authenticated
with check (
  public.booked_is_member()
  and (select auth.uid()) = user_id
  and exists (
    select 1
    from public.booked_comments
    where booked_comments.id = booked_comment_likes.comment_id
      and booked_comments.visibility = 'public'
  )
);

drop policy if exists "Members can unlike as themselves" on public.booked_comment_likes;
create policy "Members can unlike as themselves"
on public.booked_comment_likes for delete
to authenticated
using (public.booked_is_member() and (select auth.uid()) = user_id);

create or replace function public.booked_public_scores()
returns table (
  book_id text,
  average_rating numeric,
  rating_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    booked_ratings.book_id,
    round(avg(booked_ratings.rating)::numeric, 2) as average_rating,
    count(*)::bigint as rating_count
  from public.booked_ratings
  group by booked_ratings.book_id;
$$;

revoke all on function public.booked_public_scores() from public;
grant execute on function public.booked_public_scores() to anon, authenticated;
