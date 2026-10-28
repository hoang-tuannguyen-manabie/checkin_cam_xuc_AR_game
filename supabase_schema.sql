-- ==============================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU & DASHBOARD SUPABASE - CHECK-IN CẢM XÚC
-- Dự án: Manabie AI Lab - Game AR Phân Loại Cảm Xúc
--
-- HƯỚNG DẪN CÀI ĐẶT TRÊN SUPABASE:
-- 1. Đăng nhập vào trang quản trị: https://supabase.com/dashboard
-- 2. Chọn dự án của bạn (VD: merpkronknmboxeexhmc)
-- 3. Vào mục SQL Editor (biểu tượng icon code '>_' ở thanh bên trái)
-- 4. Bấm "+ New Query", dán toàn bộ nội dung file này vào và bấm "Run" (hoặc Ctrl + Enter).
-- ==============================================================================

-- 1. TẠO BẢNG CHÍNH LƯU TRỮ TỪNG LƯỢT CHECK-IN (CORE TABLE)
create table if not exists public.checkin_cam_xuc_records (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  class_name text not null,
  player_name text not null default '',
  character_id text not null,
  character_name text not null,
  score integer not null default 0,
  correct_count integer not null default 0,
  target_count integer not null default 20,
  wrong_count integer not null default 0,
  sad_count integer not null default 0,
  happy_count integer not null default 0,
  angry_count integer not null default 0,
  best_streak integer not null default 0,
  duration_sec integer not null default 30,
  is_win boolean not null default false,
  mode text not null default 'ar',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Cập nhật giá trị mặc định target_count thành 20 (2 vòng x 10 cảm xúc) nếu đã tạo bảng trước đó
alter table public.checkin_cam_xuc_records alter column target_count set default 20;

-- Bổ sung các cột nếu bảng đã tồn tại từ phiên bản cũ
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='checkin_cam_xuc_records' and column_name='mode') then
    alter table public.checkin_cam_xuc_records add column mode text not null default 'ar';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='checkin_cam_xuc_records' and column_name='target_count') then
    alter table public.checkin_cam_xuc_records add column target_count integer not null default 20;
  end if;
end $$;

-- 2. BẬT BẢO MẬT HÀNG (ROW LEVEL SECURITY - RLS)
alter table public.checkin_cam_xuc_records enable row level security;

-- Xóa các policy cũ để tránh trùng lặp
drop policy if exists "Cho phép thêm bản ghi check-in" on public.checkin_cam_xuc_records;
drop policy if exists "Cho phép đọc bảng xếp hạng" on public.checkin_cam_xuc_records;
drop policy if exists "Cho phép đọc dữ liệu check-in" on public.checkin_cam_xuc_records;

-- Policy 1: Cho phép mọi người chơi thêm kết quả sau khi chơi xong
create policy "Cho phép thêm bản ghi check-in"
  on public.checkin_cam_xuc_records
  for insert
  to anon, authenticated
  with check (true);

-- Policy 2: Cho phép đọc dữ liệu để hiển thị bảng xếp hạng & Dashboard
create policy "Cho phép đọc dữ liệu check-in"
  on public.checkin_cam_xuc_records
  for select
  to anon, authenticated
  using (true);

-- 3. TẠO INDEXES TỐI ƯU HIỆU NĂNG TRUY VẤN
create index if not exists idx_checkin_score on public.checkin_cam_xuc_records (score desc, correct_count desc);
create index if not exists idx_checkin_group on public.checkin_cam_xuc_records (group_name, class_name);
create index if not exists idx_checkin_created_at on public.checkin_cam_xuc_records (created_at desc);

-- 4. BẬT REALTIME CHO BẢNG KẾT QUẢ (Để Dashboard cập nhật tức thì khi có nhóm vừa hoàn thành)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'checkin_cam_xuc_records'
  ) then
    alter publication supabase_realtime add table public.checkin_cam_xuc_records;
  end if;
end $$;


-- ==============================================================================
-- 5. CÁC VIEW PHỤC VỤ DASHBOARD BÁO CÁO & THỐNG KÊ (ANALYTICS VIEWS)
-- ==============================================================================

-- VIEW 1: TỔNG QUAN TOÀN BỘ SỰ KIỆN (KPI SUMMARY CARDS)
-- Dùng để vẽ các thẻ số liệu lớn đầu trang Dashboard: Tổng lượt chơi, Nhóm, % Thắng, Điểm kỷ lục, Phân bố cảm xúc
create or replace view public.v_checkin_dashboard_summary as
select
  count(*)::integer as total_plays,
  count(distinct group_name)::integer as total_groups,
  count(distinct class_name)::integer as total_classes,
  count(distinct player_name)::integer as total_players,
  coalesce(max(score), 0)::integer as highest_score,
  coalesce(round(avg(score)), 0)::integer as avg_score,
  count(*) filter (where is_win = true)::integer as total_wins,
  case 
    when count(*) > 0 then round((count(*) filter (where is_win = true)::numeric / count(*)::numeric) * 100, 1)
    else 0 
  end as win_rate_percent,
  coalesce(sum(sad_count + happy_count + angry_count), 0)::integer as total_emotions_sorted,
  coalesce(sum(happy_count), 0)::integer as total_happy,
  coalesce(sum(sad_count), 0)::integer as total_sad,
  coalesce(sum(angry_count), 0)::integer as total_angry,
  case 
    when sum(correct_count + wrong_count) > 0 then 
      round((sum(correct_count)::numeric / sum(correct_count + wrong_count)::numeric) * 100, 1)
    else 100
  end as avg_accuracy_percent
from public.checkin_cam_xuc_records;


-- VIEW 2: BẢNG XẾP HẠNG CÁC NHÓM / ĐỘI (LEADERBOARD)
-- Tự động xếp hạng theo Điểm cao nhất -> Số cảm xúc đúng nhiều nhất -> Thời gian nhanh nhất
create or replace view public.v_checkin_leaderboard as
select
  dense_rank() over (
    order by max(score) desc, max(correct_count) desc, min(duration_sec) asc
  ) as rank,
  group_name,
  class_name,
  max(player_name) as rep_player,
  max(character_name) as character_name,
  max(score) as best_score,
  max(correct_count) as best_correct,
  max(best_streak) as max_streak,
  min(duration_sec) as best_time_sec,
  count(*)::integer as total_attempts,
  count(*) filter (where is_win = true)::integer as win_count,
  max(created_at) as last_played_at
from public.checkin_cam_xuc_records
group by group_name, class_name
order by rank asc;


-- VIEW 3: THỐNG KÊ CHI TIẾT THEO TỪNG LỚP HỌC (CLASS BREAKDOWN)
create or replace view public.v_checkin_class_stats as
select
  class_name,
  count(*)::integer as total_plays,
  count(distinct group_name)::integer as total_groups,
  coalesce(max(score), 0)::integer as top_score,
  coalesce(round(avg(score)), 0)::integer as avg_score,
  coalesce(sum(happy_count), 0)::integer as class_happy,
  coalesce(sum(sad_count), 0)::integer as class_sad,
  coalesce(sum(angry_count), 0)::integer as class_angry,
  case 
    when sum(happy_count + sad_count + angry_count) > 0 then
      round((sum(happy_count)::numeric / sum(happy_count + sad_count + angry_count)::numeric) * 100, 1)
    else 0
  end as happy_percent
from public.checkin_cam_xuc_records
group by class_name
order by top_score desc, avg_score desc;


-- VIEW 4: TỶ LỆ NĂNG LƯỢNG CẢM XÚC HỌC SINH (EMOTION PIE / BAR CHART)
-- Dùng để vẽ biểu đồ tròn/cột phân loại cảm xúc học sinh trong buổi workshop
create or replace view public.v_checkin_emotion_distribution as
with totals as (
  select
    coalesce(sum(happy_count), 0)::numeric as happy,
    coalesce(sum(sad_count), 0)::numeric as sad,
    coalesce(sum(angry_count), 0)::numeric as angry,
    coalesce(sum(happy_count + sad_count + angry_count), 0)::numeric as total
  from public.checkin_cam_xuc_records
)
select
  'Vui Vẻ (Happy)' as emotion,
  happy::integer as count,
  case when total > 0 then round((happy / total) * 100, 1) else 0 end as percent,
  '#FBBF24' as hex_color
from totals
union all
select
  'Buồn Bã (Sad)' as emotion,
  sad::integer as count,
  case when total > 0 then round((sad / total) * 100, 1) else 0 end as percent,
  '#38BDF8' as hex_color
from totals
union all
select
  'Tức Giận (Angry)' as emotion,
  angry::integer as count,
  case when total > 0 then round((angry / total) * 100, 1) else 0 end as percent,
  '#EF4444' as hex_color
from totals;


-- VIEW 5: HOẠT ĐỘNG THỜI GIAN THỰC GẦN ĐÂY (LIVE ACTIVITY STREAM)
create or replace view public.v_checkin_recent_activities as
select
  id,
  group_name,
  class_name,
  player_name,
  character_name,
  score,
  correct_count,
  target_count,
  wrong_count,
  best_streak,
  duration_sec,
  is_win,
  mode,
  case 
    when correct_count + wrong_count > 0 then 
      round((correct_count::numeric / (correct_count + wrong_count)::numeric) * 100, 1)
    else 100
  end as accuracy_percent,
  created_at
from public.checkin_cam_xuc_records
order by created_at desc
limit 50;


-- 6. BẢNG CẤU HÌNH DASHBOARD / SỰ KIỆN (CONFIG TABLE)
-- Dùng để lưu tiêu đề sự kiện, thông điệp hiển thị trên Dashboard hoặc màn chiếu LED
create table if not exists public.checkin_dashboard_configs (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.checkin_dashboard_configs enable row level security;

drop policy if exists "Cho phép đọc cấu hình dashboard" on public.checkin_dashboard_configs;
drop policy if exists "Cho phép cập nhật cấu hình dashboard" on public.checkin_dashboard_configs;

create policy "Cho phép đọc cấu hình dashboard"
  on public.checkin_dashboard_configs
  for select
  to anon, authenticated
  using (true);

create policy "Cho phép cập nhật cấu hình dashboard"
  on public.checkin_dashboard_configs
  for all
  to anon, authenticated
  using (true);

-- Chèn dữ liệu cấu hình mặc định
insert into public.checkin_dashboard_configs (key, value)
values
  ('event_info', '{"title": "CHECK-IN CẢM XÚC", "subtitle": "Manabie AI Lab Workshop", "is_active": true}'::jsonb),
  ('display_settings', '{"refresh_interval_sec": 5, "show_leaderboard": true, "show_emotion_chart": true}'::jsonb)
on conflict (key) do nothing;


-- 7. PHÂN QUYỀN TRUY CẬP CÁC VIEW CHO ANON & AUTHENTICATED
grant select on public.v_checkin_dashboard_summary to anon, authenticated;
grant select on public.v_checkin_leaderboard to anon, authenticated;
grant select on public.v_checkin_class_stats to anon, authenticated;
grant select on public.v_checkin_emotion_distribution to anon, authenticated;
grant select on public.v_checkin_recent_activities to anon, authenticated;
