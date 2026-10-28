const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const SUPABASE_URL = rawUrl.replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = rawKey;

/**
 * Kiểm tra xem người dùng đã cấu hình đầy đủ Supabase trong .env chưa
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('your-project-id') &&
    !SUPABASE_ANON_KEY.includes('your-anon') &&
    SUPABASE_URL.startsWith('https://')
  );
}

export interface CheckInRecord {
  id?: string;
  group_name: string;
  class_name: string;
  player_name?: string;
  character_id: string;
  character_name: string;
  score: number;
  correct_count: number;
  target_count: number;
  wrong_count: number;
  sad_count: number;
  happy_count: number;
  angry_count: number;
  best_streak: number;
  duration_sec: number;
  is_win: boolean;
  mode: 'ar' | 'mouse';
  created_at?: string;
}

/**
 * Lưu kết quả lượt chơi lên Supabase PostgREST API
 * Không phụ thuộc thư viện ngoài, tải siêu nhẹ và hoạt động 100% trên mọi thiết bị
 */
export async function saveCheckInRecord(
  record: CheckInRecord
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Chưa cấu hình VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY trong file .env',
    };
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/checkin_cam_xuc_records`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      let errorText = '';
      try {
        const errJson = await response.json();
        errorText = errJson.message || errJson.error || JSON.stringify(errJson);
      } catch {
        errorText = await response.text();
      }
      console.warn('Lỗi Supabase API:', response.status, errorText);
      return { success: false, error: `Supabase (${response.status}): ${errorText}` };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Lỗi kết nối mạng tới Supabase:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Tải danh sách kết quả cao nhất từ Supabase (Bảng xếp hạng)
 */
export async function fetchCheckInLeaderboard(
  limit = 20
): Promise<CheckInRecord[] | null> {
  if (!isSupabaseConfigured()) return null;

  const endpoint = `${SUPABASE_URL}/rest/v1/checkin_cam_xuc_records?select=*&order=score.desc,correct_count.desc,duration_sec.asc&limit=${limit}`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('Lỗi tải danh sách Supabase:', response.status);
      return null;
    }

    const data = await response.json();
    return Array.isArray(data) ? (data as CheckInRecord[]) : null;
  } catch (err) {
    console.warn('Lỗi kết nối Supabase:', err);
    return null;
  }
}

export interface DashboardSummary {
  total_plays: number;
  total_groups: number;
  total_classes: number;
  total_players: number;
  highest_score: number;
  avg_score: number;
  total_wins: number;
  win_rate_percent: number;
  total_emotions_sorted: number;
  total_happy: number;
  total_sad: number;
  total_angry: number;
  avg_accuracy_percent: number;
}

export interface GroupLeaderboardItem {
  rank: number;
  group_name: string;
  class_name: string;
  rep_player: string;
  character_name: string;
  best_score: number;
  best_correct: number;
  max_streak: number;
  best_time_sec: number;
  total_attempts: number;
  win_count: number;
  last_played_at: string;
}

/**
 * Tải số liệu tổng quan Dashboard từ Supabase View v_checkin_dashboard_summary
 */
export async function fetchDashboardSummary(): Promise<DashboardSummary | null> {
  if (!isSupabaseConfigured()) return null;

  const endpoint = `${SUPABASE_URL}/rest/v1/v_checkin_dashboard_summary?select=*&limit=1`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) && data.length > 0 ? (data[0] as DashboardSummary) : null;
  } catch (err) {
    console.warn('Lỗi kết nối v_checkin_dashboard_summary:', err);
    return null;
  }
}

/**
 * Tải bảng xếp hạng theo nhóm/đội từ Supabase View v_checkin_leaderboard
 */
export async function fetchGroupLeaderboard(
  limit = 20
): Promise<GroupLeaderboardItem[] | null> {
  if (!isSupabaseConfigured()) return null;

  const endpoint = `${SUPABASE_URL}/rest/v1/v_checkin_leaderboard?select=*&limit=${limit}`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) ? (data as GroupLeaderboardItem[]) : null;
  } catch (err) {
    console.warn('Lỗi kết nối v_checkin_leaderboard:', err);
    return null;
  }
}
