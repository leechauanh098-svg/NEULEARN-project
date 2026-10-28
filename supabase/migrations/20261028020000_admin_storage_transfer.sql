create or replace function public.transfer_learning_storage_ownership(
  p_from_user uuid,
  p_to_user uuid,
  p_folder_user uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  transferred_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if p_from_user = p_to_user then
    raise exception 'Source and destination users must be different';
  end if;

  update storage.objects
  set owner_id = p_to_user::text
  where bucket_id = 'lecture-materials'
    and name like p_folder_user::text || '/%'
    and (owner_id = p_from_user::text or owner_id is null);

  get diagnostics transferred_count = row_count;
  return transferred_count;
end;
$$;

revoke all on function public.transfer_learning_storage_ownership(uuid, uuid, uuid) from public;
revoke all on function public.transfer_learning_storage_ownership(uuid, uuid, uuid) from anon;
revoke all on function public.transfer_learning_storage_ownership(uuid, uuid, uuid) from authenticated;
grant execute on function public.transfer_learning_storage_ownership(uuid, uuid, uuid) to service_role;
