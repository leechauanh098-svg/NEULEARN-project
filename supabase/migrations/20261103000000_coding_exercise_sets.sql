create table if not exists public.coding_exercise_sets (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  language text not null default 'java',
  version integer not null default 1,
  file_path text not null unique,
  file_name text not null,
  file_size bigint not null check (file_size > 0),
  exercise_count integer not null check (exercise_count > 0),
  payload jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  uploaded_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists coding_exercise_sets_course_idx
  on public.coding_exercise_sets (course_id, language, created_at desc);

create unique index if not exists coding_exercise_sets_one_published_idx
  on public.coding_exercise_sets (course_id, language)
  where status = 'published';

alter table public.coding_exercise_sets enable row level security;

create policy "Authenticated users can view published coding exercises"
  on public.coding_exercise_sets for select to authenticated
  using (status = 'published' or public.can_manage_learning_content());

create policy "Managers can create coding exercises"
  on public.coding_exercise_sets for insert to authenticated
  with check (
    public.can_manage_learning_content()
    and uploaded_by = (select auth.uid())
  );

create policy "Managers can update coding exercises"
  on public.coding_exercise_sets for update to authenticated
  using (public.can_manage_learning_content())
  with check (public.can_manage_learning_content());

create policy "Managers can delete coding exercises"
  on public.coding_exercise_sets for delete to authenticated
  using (public.can_manage_learning_content());

grant select, insert, update, delete on public.coding_exercise_sets to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coding-exercises',
  'coding-exercises',
  false,
  5242880,
  array['application/json', 'text/json']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Managers can upload coding exercise JSON"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'coding-exercises'
    and public.can_manage_learning_content()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Managers can read coding exercise JSON"
  on storage.objects for select to authenticated
  using (bucket_id = 'coding-exercises' and public.can_manage_learning_content());

create policy "Managers can delete coding exercise JSON"
  on storage.objects for delete to authenticated
  using (bucket_id = 'coding-exercises' and public.can_manage_learning_content());
