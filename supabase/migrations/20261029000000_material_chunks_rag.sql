-- Chat AI hỏi đáp theo tài liệu: lưu text từng trang (chunk) + full-text search.

alter table public.lecture_materials
  add column if not exists index_status text not null default 'pending',
  add column if not exists index_error text not null default '';

do $$
begin
  alter table public.lecture_materials
    add constraint lecture_materials_index_status_check
    check (index_status in ('pending', 'ready', 'failed'));
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.material_chunks (
  id bigint generated always as identity primary key,
  material_id uuid not null references public.lecture_materials (id) on delete cascade,
  page_number integer not null check (page_number > 0),
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  search_vector tsvector generated always as (to_tsvector('simple', content)) stored,
  created_at timestamptz not null default now()
);

create index if not exists material_chunks_material_idx
  on public.material_chunks (material_id, page_number, chunk_index);
create index if not exists material_chunks_search_idx
  on public.material_chunks using gin (search_vector);

-- Chỉ Flask (service role) đọc/ghi bảng này; người dùng không truy cập trực tiếp.
alter table public.material_chunks enable row level security;
revoke all on public.material_chunks from anon, authenticated;

-- Tìm các đoạn liên quan nhất trong MỘT tài liệu. Từ khóa nối bằng OR để câu hỏi tự nhiên vẫn khớp.
create or replace function public.search_material_chunks(
  p_material_id uuid,
  p_query text,
  p_limit integer default 6
)
returns table (id bigint, page_number integer, chunk_index integer, content text, rank real)
language sql
stable
set search_path = ''
as $$
  with q as (
    select to_tsquery(
      'simple',
      nullif(
        (
          select string_agg(distinct w, ' | ')
          from regexp_split_to_table(
            regexp_replace(lower(coalesce(p_query, '')), '[^[:alnum:]]+', ' ', 'g'),
            '\s+'
          ) as w
          where length(w) > 1
        ),
        ''
      )
    ) as tsq
  )
  select c.id, c.page_number, c.chunk_index, c.content,
         ts_rank(c.search_vector, q.tsq) as rank
  from public.material_chunks c, q
  where c.material_id = p_material_id
    and q.tsq is not null
    and c.search_vector @@ q.tsq
  order by rank desc, c.page_number, c.chunk_index
  limit least(greatest(p_limit, 1), 20);
$$;

revoke all on function public.search_material_chunks(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.search_material_chunks(uuid, text, integer) to service_role;
