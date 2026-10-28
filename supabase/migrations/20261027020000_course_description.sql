alter table public.courses
  add column if not exists description text not null default '';

grant insert (name, category, description, created_by) on public.courses to authenticated;