-- Quiz AI theo tài liệu: lưu đề đã tạo để xem lại lịch sử, chỉ Flask (service role) đọc/ghi.

create table if not exists public.material_quizzes (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.lecture_materials (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  questions jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists material_quizzes_history_idx
  on public.material_quizzes (material_id, user_id, created_at desc);

alter table public.material_quizzes enable row level security;
revoke all on public.material_quizzes from anon, authenticated;
