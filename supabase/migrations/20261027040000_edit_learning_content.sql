create policy "Course creators and admins can update courses"
  on public.courses for update to authenticated
  using (
    public.can_manage_learning_content()
    and (created_by = (select auth.uid()) or public.is_learning_admin())
  )
  with check (
    public.can_manage_learning_content()
    and (created_by = (select auth.uid()) or public.is_learning_admin())
  );

create policy "Uploaders and admins can update lecture materials"
  on public.lecture_materials for update to authenticated
  using (
    public.can_manage_learning_content()
    and (uploaded_by = (select auth.uid()) or public.is_learning_admin())
  )
  with check (
    public.can_manage_learning_content()
    and (uploaded_by = (select auth.uid()) or public.is_learning_admin())
  );

grant update (name, category, description) on public.courses to authenticated;
grant update (title, chapter, description, slide_count) on public.lecture_materials to authenticated;