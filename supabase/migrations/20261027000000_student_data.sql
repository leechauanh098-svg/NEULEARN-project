create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_history (
  user_id uuid not null references auth.users (id) on delete cascade,
  resource_id text not null,
  study_seconds integer not null default 0 check (study_seconds >= 0),
  question_count integer not null default 0 check (question_count >= 0),
  last_accessed_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create index if not exists study_history_recent_by_user_idx
  on public.study_history (user_id, last_accessed_at desc);

alter table public.profiles enable row level security;
alter table public.study_history enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can read their own study history"
  on public.study_history for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own study history"
  on public.study_history for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own study history"
  on public.study_history for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.study_history to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      ''
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email, full_name, avatar_url)
select
  users.id,
  users.email,
  coalesce(
    nullif(users.raw_user_meta_data ->> 'full_name', ''),
    nullif(users.raw_user_meta_data ->> 'name', ''),
    ''
  ),
  nullif(users.raw_user_meta_data ->> 'avatar_url', '')
from auth.users as users
on conflict (id) do nothing;

create or replace function public.record_study_activity(
  p_resource_id text,
  p_study_seconds integer default 0,
  p_question_count integer default 0
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
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
end;
$$;

revoke all on function public.record_study_activity(text, integer, integer) from public;
revoke all on function public.record_study_activity(text, integer, integer) from anon;
grant execute on function public.record_study_activity(text, integer, integer) to authenticated;