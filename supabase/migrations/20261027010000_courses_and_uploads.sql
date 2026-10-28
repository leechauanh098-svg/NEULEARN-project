alter table public.profiles
  add column if not exists role text not null default 'student';

do $$
begin
  alter table public.profiles
    add constraint profiles_role_check check (role in ('student', 'lecturer', 'admin'));
exception
  when duplicate_object then null;
end;
$$;

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  description text not null default '',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.lecture_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  chapter text not null,
  description text not null default '',
  teacher_name text not null default '',
  file_path text not null unique,
  file_name text not null,
  file_size bigint not null check (file_size > 0),
  slide_count integer not null check (slide_count > 0),
  uploaded_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists lecture_materials_course_idx
  on public.lecture_materials (course_id, created_at desc);

alter table public.courses enable row level security;
alter table public.lecture_materials enable row level security;

create or replace function public.can_manage_learning_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('lecturer', 'admin')
  );
$$;

revoke all on function public.can_manage_learning_content() from public;
revoke all on function public.can_manage_learning_content() from anon;
grant execute on function public.can_manage_learning_content() to authenticated;

create policy "Authenticated users can view courses"
  on public.courses for select to authenticated
  using (true);

create policy "Lecturers can create courses"
  on public.courses for insert to authenticated
  with check (
    public.can_manage_learning_content()
    and created_by = (select auth.uid())
  );

create policy "Authenticated users can view lecture materials"
  on public.lecture_materials for select to authenticated
  using (true);

create policy "Lecturers can upload lecture materials"
  on public.lecture_materials for insert to authenticated
  with check (
    public.can_manage_learning_content()
    and uploaded_by = (select auth.uid())
  );

grant select on public.courses to authenticated;
grant insert (name, category, description, created_by) on public.courses to authenticated;
grant select on public.lecture_materials to authenticated;
grant insert (
  course_id,
  title,
  chapter,
  description,
  teacher_name,
  file_path,
  file_name,
  file_size,
  slide_count,
  uploaded_by
) on public.lecture_materials to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lecture-materials',
  'lecture-materials',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Authenticated users can read lecture PDFs"
  on storage.objects for select to authenticated
  using (bucket_id = 'lecture-materials');

create policy "Lecturers can upload lecture PDFs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lecture-materials'
    and public.can_manage_learning_content()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );