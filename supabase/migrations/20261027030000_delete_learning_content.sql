create or replace function public.is_learning_admin()
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
      and role = 'admin'
  );
$$;

revoke all on function public.is_learning_admin() from public;
revoke all on function public.is_learning_admin() from anon;
grant execute on function public.is_learning_admin() to authenticated;

alter table public.lecture_materials
  drop constraint if exists lecture_materials_course_id_fkey;

alter table public.lecture_materials
  add constraint lecture_materials_course_id_fkey
  foreign key (course_id) references public.courses (id) on delete restrict;

create policy "Uploaders and admins can delete lecture materials"
  on public.lecture_materials for delete to authenticated
  using (
    public.can_manage_learning_content()
    and (uploaded_by = (select auth.uid()) or public.is_learning_admin())
  );

create policy "Course creators and admins can delete empty courses"
  on public.courses for delete to authenticated
  using (
    public.can_manage_learning_content()
    and (created_by = (select auth.uid()) or public.is_learning_admin())
    and not exists (
      select 1
      from public.lecture_materials
      where course_id = courses.id
    )
  );

grant delete on public.lecture_materials to authenticated;
grant delete on public.courses to authenticated;

create policy "Uploaders and admins can delete lecture PDFs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'lecture-materials'
    and public.can_manage_learning_content()
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_learning_admin()
    )
  );