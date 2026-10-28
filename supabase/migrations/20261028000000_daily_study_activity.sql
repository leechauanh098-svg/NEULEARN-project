create table if not exists public.study_activity_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,
  resource_id text not null,
  study_seconds integer not null default 0 check (study_seconds >= 0),
  was_accessed boolean not null default false,
  primary key (user_id, activity_date, resource_id)
);

create index if not exists study_activity_daily_by_user_date_idx
  on public.study_activity_daily (user_id, activity_date desc);

alter table public.study_activity_daily enable row level security;

create policy "Users can read their own daily study activity"
  on public.study_activity_daily for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own daily study activity"
  on public.study_activity_daily for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own daily study activity"
  on public.study_activity_daily for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.study_activity_daily to authenticated;

drop function if exists public.record_study_activity(text, integer, integer);

create or replace function public.record_study_activity(
  p_resource_id text,
  p_study_seconds integer default 0,
  p_question_count integer default 0,
  p_accessed boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_activity_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_resource_id is null or btrim(p_resource_id) = '' then
    raise exception 'Resource ID is required';
  end if;

  if p_study_seconds < 0 or p_question_count < 0 then
    raise exception 'Activity values cannot be negative';
  end if;

  insert into public.study_history as history (
    user_id,
    resource_id,
    study_seconds,
    question_count,
    last_accessed_at
  )
  values (
    current_user_id,
    p_resource_id,
    p_study_seconds,
    p_question_count,
    now()
  )
  on conflict (user_id, resource_id) do update
    set study_seconds = history.study_seconds + excluded.study_seconds,
        question_count = history.question_count + excluded.question_count,
        last_accessed_at = now();

  insert into public.study_activity_daily as daily (
    user_id,
    activity_date,
    resource_id,
    study_seconds,
    was_accessed
  )
  values (
    current_user_id,
    current_activity_date,
    p_resource_id,
    p_study_seconds,
    p_accessed
  )
  on conflict (user_id, activity_date, resource_id) do update
    set study_seconds = daily.study_seconds + excluded.study_seconds,
        was_accessed = daily.was_accessed or excluded.was_accessed;
end;
$$;

revoke all on function public.record_study_activity(text, integer, integer, boolean) from public;
revoke all on function public.record_study_activity(text, integer, integer, boolean) from anon;
grant execute on function public.record_study_activity(text, integer, integer, boolean) to authenticated;
