-- Booked one-time repair: run this in Supabase SQL Editor.
-- It restores member deletion rights and adds the anonymous public-comments feed.

grant select, insert, update, delete on public.booked_ratings to authenticated;
grant select, insert, update, delete on public.booked_comments to authenticated;

drop policy if exists "Members can delete their own ratings" on public.booked_ratings;
create policy "Members can delete their own ratings"
on public.booked_ratings for delete
to authenticated
using (public.booked_is_member() and (select auth.uid()) = user_id);

drop policy if exists "Members can delete their own comments" on public.booked_comments;
create policy "Members can delete their own comments"
on public.booked_comments for delete
to authenticated
using (public.booked_is_member() and (select auth.uid()) = user_id);

create or replace function public.booked_public_comments(requested_book_id text)
returns table (
  id bigint,
  book_id text,
  comment text,
  updated_at timestamptz,
  like_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    booked_comments.id,
    booked_comments.book_id,
    booked_comments.comment,
    booked_comments.updated_at,
    count(booked_comment_likes.comment_id)::bigint as like_count
  from public.booked_comments
  left join public.booked_comment_likes
    on booked_comment_likes.comment_id = booked_comments.id
  where booked_comments.book_id = requested_book_id
    and booked_comments.visibility = 'public'
    and length(trim(booked_comments.comment)) > 0
  group by booked_comments.id, booked_comments.book_id, booked_comments.comment, booked_comments.updated_at
  order by booked_comments.updated_at desc;
$$;

revoke all on function public.booked_public_comments(text) from public;
grant execute on function public.booked_public_comments(text) to anon, authenticated;
