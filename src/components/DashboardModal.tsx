import React, { useEffect, useState, useMemo } from 'react';
import {
  CheckInRecord,
  fetchCheckInLeaderboard,
  fetchDashboardSummary,
  isSupabaseConfigured,
  DashboardSummary,
} from '../services/supabase';
import { CharacterAvatar } from './PlayerSetupModal';
import { getCharacterById, PLAYER_CHARACTERS } from '../data/characters';
import { audio } from '../utils/audio';

interface DashboardModalProps {
  open: boolean;
  onClose: () => void;
}

// Dữ liệu mẫu ban đầu để bảng luôn hiển thị đẹp mắt ngay cả khi Supabase chưa có dữ liệu thực tế
const SAMPLE_RECORDS: CheckInRecord[] = [
  {
    id: 'sample-1',
    group_name: 'Biệt Đội Alpha',
    class_name: '10A1',
    player_name: 'Biệt Đội Alpha',
    character_id: PLAYER_CHARACTERS[0].id,
    character_name: PLAYER_CHARACTERS[0].name,
    score: 1650,
    correct_count: 20,
    target_count: 20,
    wrong_count: 0,
    sad_count: 7,
    happy_count: 8,
    angry_count: 5,
    best_streak: 12,
    duration_sec: 24,
    is_win: true,
    mode: 'ar',
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'sample-2',
    group_name: 'Tia Chớp Xanh',
    class_name: '10A2',
    player_name: 'Tia Chớp Xanh',
    character_id: PLAYER_CHARACTERS[1].id,
    character_name: PLAYER_CHARACTERS[1].name,
    score: 1420,
    correct_count: 19,
    target_count: 20,
    wrong_count: 1,
    sad_count: 6,
    happy_count: 8,
    angry_count: 5,
    best_streak: 9,
    duration_sec: 26,
    is_win: true,
    mode: 'ar',
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: 'sample-3',
    group_name: 'Chiến Binh Cảm Xúc',
    class_name: '11A1',
    player_name: 'Chiến Binh Cảm Xúc',
    character_id: PLAYER_CHARACTERS[5].id,
    character_name: PLAYER_CHARACTERS[5].name,
    score: 1300,
    correct_count: 18,
    target_count: 20,
    wrong_count: 2,
    sad_count: 5,
    happy_count: 9,
    angry_count: 4,
    best_streak: 8,
    duration_sec: 28,
    is_win: false,
    mode: 'ar',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'sample-4',
    group_name: 'Siêu Cánh Cụt',
    class_name: '10A1',
    player_name: 'Siêu Cánh Cụt',
    character_id: PLAYER_CHARACTERS[6].id,
    character_name: PLAYER_CHARACTERS[6].name,
    score: 1150,
    correct_count: 17,
    target_count: 20,
    wrong_count: 1,
    sad_count: 6,
    happy_count: 7,
    angry_count: 4,
    best_streak: 6,
    duration_sec: 29,
    is_win: false,
    mode: 'ar',
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: 'sample-5',
    group_name: 'Gấu Trúc Thông Thái',
    class_name: '12A1',
    player_name: 'Gấu Trúc Thông Thái',
    character_id: PLAYER_CHARACTERS[4].id,
    character_name: PLAYER_CHARACTERS[4].name,
    score: 980,
    correct_count: 16,
    target_count: 20,
    wrong_count: 3,
    sad_count: 5,
    happy_count: 6,
    angry_count: 5,
    best_streak: 5,
    duration_sec: 30,
    is_win: false,
    mode: 'ar',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
];

const TEAMS_PER_PAGE = 20; // Mỗi bảng không hiển thị quá 20 đội chơi

export function DashboardModal({ open, onClose }: DashboardModalProps) {
  const [records, setRecords] = useState<CheckInRecord[]>(SAMPLE_RECORDS);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLiveSupabase, setIsLiveSupabase] = useState<boolean>(false);

  // Tải dữ liệu từ Supabase khi mở Modal
  const loadData = async () => {
    setLoading(true);
    if (!isSupabaseConfigured()) {
      setRecords(SAMPLE_RECORDS);
      setIsLiveSupabase(false);
      setLoading(false);
      return;
    }

    try {
      const [boardRes, summaryRes] = await Promise.all([
        fetchCheckInLeaderboard(100),
        fetchDashboardSummary(),
      ]);

      if (boardRes && boardRes.length > 0) {
        setRecords(boardRes);
        setIsLiveSupabase(true);
      } else {
        // Nếu Supabase chưa có bản ghi nào thì dùng dữ liệu mẫu
        setRecords(SAMPLE_RECORDS);
        setIsLiveSupabase(false);
      }

      if (summaryRes) {
        setSummary(summaryRes);
      }
    } catch (e) {
      console.warn('Lỗi tải dữ liệu Dashboard:', e);
      setRecords(SAMPLE_RECORDS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
      setCurrentPage(1);
    }
  }, [open]);

  // Danh sách các lớp học hiện có
  const classList = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.class_name) set.add(r.class_name);
    });
    return Array.from(set).sort();
  }, [records]);

  // Lọc dữ liệu theo lớp
  const filteredRecords = useMemo(() => {
    if (selectedClass === 'all') return records;
    return records.filter((r) => r.class_name === selectedClass);
  }, [records, selectedClass]);

  // Phân trang: Mỗi bảng KHÔNG hiển thị quá 20 đội chơi
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / TEAMS_PER_PAGE));
  const currentTeams = useMemo(() => {
    const start = (currentPage - 1) * TEAMS_PER_PAGE;
    return filteredRecords.slice(start, start + TEAMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  if (!open) return null;

  // Tính các chỉ số KPI tóm tắt
  const totalPlays = summary?.total_plays ?? records.length;
  const highestScore = summary?.highest_score ?? Math.max(...records.map((r) => r.score), 0);
  const totalWins = summary?.total_wins ?? records.filter((r) => r.is_win).length;
  const winPercent =
    totalPlays > 0
      ? summary?.win_rate_percent ?? Math.round((totalWins / totalPlays) * 100)
      : 0;
  const totalHappy = summary?.total_happy ?? records.reduce((s, r) => s + r.happy_count, 0);
  const totalSad = summary?.total_sad ?? records.reduce((s, r) => s + r.sad_count, 0);
  const totalAngry = summary?.total_angry ?? records.reduce((s, r) => s + r.angry_count, 0);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-2.5 sm:p-5 bg-[#030714]/92 backdrop-blur-xl animate-modal-backdrop"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-5xl max-h-[96vh] rounded-3xl bg-gradient-to-br from-[#0c1635]/98 via-[#070e24]/98 to-[#040817]/98 border border-[#4C6DF0]/40 shadow-[0_25px_80px_rgba(0,0,0,0.9)] p-3.5 sm:p-6 flex flex-col gap-3 sm:gap-4 overflow-hidden animate-modal-dialog">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/10 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-[#00D89A]/15 border border-[#00D89A]/40 text-[#00D89A] text-[10px] sm:text-xs font-black tracking-wider uppercase">
                MANABIE AI LAB
              </span>
              <span className="text-white/40 text-xs">·</span>
              <span className="text-white/70 text-[11px] sm:text-xs font-semibold">
                Bảng Điều Khiển Sự Kiện
              </span>
              <span className="text-white/40 text-xs">·</span>
              <span
                className={`px-2 py-0.2 rounded-full text-[9px] font-bold ${
                  isLiveSupabase
                    ? 'bg-[#00D89A]/20 text-[#00D89A] border border-[#00D89A]/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {isLiveSupabase ? '● Supabase Realtime' : '○ Dữ liệu mẫu (Chờ chơi)'}
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white mt-1 flex items-center gap-2">
              <span>📊 BẢNG ĐIỀU KHIỂN & BẢNG XẾP HẠNG</span>
            </h2>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Nút Làm Mới */}
            <button
              type="button"
              onClick={() => {
                audio.playClick();
                loadData();
              }}
              disabled={loading}
              className="min-h-[34px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Cập nhật kết quả mới nhất"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            {/* Nút Đóng */}
            <button
              type="button"
              onClick={() => {
                audio.playClick();
                onClose();
              }}
              className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <span>✕</span>
              <span>Đóng</span>
            </button>
          </div>
        </div>

        {/* 4 Thẻ KPI Tóm Tắt Đầu Trang */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 shrink-0 text-xs">
          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#4C6DF0]/10 border border-[#4C6DF0]/30 flex flex-col">
            <span className="text-[10px] text-[#8ba2ff] font-bold uppercase tracking-wider">
              👥 Tổng Đội Tham Gia
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <b className="text-lg sm:text-2xl font-black font-mono text-white">{totalPlays}</b>
              <span className="text-[10px] text-white/50">lượt chơi</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#00D89A]/10 border border-[#00D89A]/30 flex flex-col">
            <span className="text-[10px] text-[#00D89A] font-bold uppercase tracking-wider">
              🏆 Điểm Kỷ Lục
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <b className="text-lg sm:text-2xl font-black font-mono text-[#00D89A]">
                {highestScore.toLocaleString()}
              </b>
              <span className="text-[10px] text-[#00D89A]/70">điểm</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#38BDF8]/10 border border-[#38BDF8]/30 flex flex-col">
            <span className="text-[10px] text-[#38BDF8] font-bold uppercase tracking-wider">
              🎯 Tỷ Lệ Hoàn Thành 2 Vòng
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <b className="text-lg sm:text-2xl font-black font-mono text-white">{winPercent}%</b>
              <span className="text-[10px] text-[#38BDF8]">({totalWins}/{totalPlays})</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#FF6A3D]/10 border border-[#FF6A3D]/30 flex flex-col">
            <span className="text-[10px] text-[#FF6A3D] font-bold uppercase tracking-wider">
              💖 Năng Lượng Cảm Xúc
            </span>
            <div className="flex items-center gap-1.5 mt-1 font-mono text-[11px] font-bold">
              <span className="text-[#FBBF24]">Vui: {totalHappy}</span>
              <span className="text-white/30">·</span>
              <span className="text-[#38BDF8]">Buồn: {totalSad}</span>
              <span className="text-white/30">·</span>
              <span className="text-[#EF4444]">Giận: {totalAngry}</span>
            </div>
          </div>
        </div>

        {/* Thanh Lọc Theo Lớp */}
        <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
            <span className="text-[11px] text-white/50 font-bold uppercase mr-1">Lớp:</span>
            <button
              type="button"
              onClick={() => {
                setSelectedClass('all');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedClass === 'all'
                  ? 'bg-[#00D89A] text-[#050A1C] shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-white/70'
              }`}
            >
              Tất cả ({records.length})
            </button>
            {classList.map((c) => {
              const count = records.filter((r) => r.class_name === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setSelectedClass(c);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedClass === c
                      ? 'bg-[#4C6DF0] text-white shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-white/70'
                  }`}
                >
                  {c} ({count})
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-[#00D89A] font-semibold">
            ⚡ Mỗi bảng hiển thị tối đa <b>20 đội chơi</b>
          </div>
        </div>

        {/* BẢNG SỐ LIỆU (DẠNG BẢNG - TỐI ĐA 20 ĐỘI CHƠI) */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-[#060c20]/90 custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-[#09112a] border-b border-white/10 text-[10px] text-white/60 uppercase font-black tracking-wider z-10">
              <tr>
                <th className="py-2.5 px-3 text-center w-12">Hạng</th>
                <th className="py-2.5 px-3">Tên Đội / Nhóm</th>
                <th className="py-2.5 px-3 text-center">Lớp</th>
                <th className="py-2.5 px-3 text-right">Tổng Điểm</th>
                <th className="py-2.5 px-3 text-center">Đúng</th>
                <th className="py-2.5 px-3 text-center">Chuỗi</th>
                <th className="py-2.5 px-3 text-center">Độ Chính Xác</th>
                <th className="py-2.5 px-3 text-center">Thời Gian</th>
                <th className="py-2.5 px-3 text-center">Kết Quả</th>
                <th className="py-2.5 px-3 text-right">Thời Điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {currentTeams.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-white/50">
                    Chưa có đội nào thuộc lớp này. Hãy bấm "Tất cả" để xem toàn bộ nhé!
                  </td>
                </tr>
              ) : (
                currentTeams.map((team, idx) => {
                  const rank = (currentPage - 1) * TEAMS_PER_PAGE + idx + 1;
                  const char = getCharacterById(team.character_id);
                  const accuracy =
                    team.correct_count + team.wrong_count > 0
                      ? Math.round(
                          (team.correct_count / (team.correct_count + team.wrong_count)) * 100
                        )
                      : 100;

                  return (
                    <tr
                      key={team.id || `team-${idx}`}
                      className={`hover:bg-white/5 transition-colors ${
                        rank === 1
                          ? 'bg-[#FBBF24]/10 font-bold'
                          : rank === 2
                          ? 'bg-[#38BDF8]/10'
                          : rank === 3
                          ? 'bg-[#FF6A3D]/10'
                          : ''
                      }`}
                    >
                      {/* Cột Hạng */}
                      <td className="py-2 px-3 text-center">
                        {rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#FBBF24] text-[#050A1C] font-black text-xs shadow-[0_0_12px_rgba(251,191,36,0.6)]">
                            1
                          </span>
                        ) : rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#CBD5E1] text-[#050A1C] font-black text-xs shadow-md">
                            2
                          </span>
                        ) : rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#B45309] text-white font-black text-xs shadow-md">
                            3
                          </span>
                        ) : (
                          <span className="font-mono text-white/50 font-bold text-xs">#{rank}</span>
                        )}
                      </td>

                      {/* Cột Tên Đội + Avatar */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4C6DF0]/30 to-[#00D89A]/30 border border-[#00D89A]/40 flex items-center justify-center p-0.5 shrink-0">
                            <CharacterAvatar character={char} />
                          </div>
                          <span className="font-bold text-white text-xs sm:text-sm">
                            {team.group_name}
                          </span>
                        </div>
                      </td>

                      {/* Cột Lớp */}
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-[#4C6DF0]/20 border border-[#4C6DF0]/40 text-[#8ba2ff] font-bold text-[11px]">
                          {team.class_name}
                        </span>
                      </td>

                      {/* Cột Tổng Điểm */}
                      <td className="py-2 px-3 text-right">
                        <span className="font-mono font-black text-sm sm:text-base text-[#00D89A]">
                          {team.score.toLocaleString()}
                        </span>
                      </td>

                      {/* Cột Cảm Xúc Đúng */}
                      <td className="py-2 px-3 text-center">
                        <span className="font-mono font-bold text-white">
                          {team.correct_count}
                          <span className="text-white/40">/{team.target_count || 20}</span>
                        </span>
                      </td>

                      {/* Cột Chuỗi Combo */}
                      <td className="py-2 px-3 text-center">
                        <span className="font-mono font-bold text-[#FBBF24]">
                          ×{team.best_streak}
                        </span>
                      </td>

                      {/* Cột Độ Chính Xác */}
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`font-mono font-bold ${
                            accuracy >= 90
                              ? 'text-[#00D89A]'
                              : accuracy >= 75
                              ? 'text-[#38BDF8]'
                              : 'text-rose-400'
                          }`}
                        >
                          {accuracy}%
                        </span>
                      </td>

                      {/* Cột Thời Gian */}
                      <td className="py-2 px-3 text-center font-mono text-white/70">
                        {team.duration_sec}s
                      </td>

                      {/* Cột Kết Quả */}
                      <td className="py-2 px-3 text-center">
                        {team.is_win ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#00D89A]/15 border border-[#00D89A]/40 text-[#00D89A] text-[10px] font-bold whitespace-nowrap">
                            🏆 Thắng V2
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 text-[10px] whitespace-nowrap">
                            ✓ Hoàn thành
                          </span>
                        )}
                      </td>

                      {/* Cột Thời Điểm */}
                      <td className="py-2 px-3 text-right font-mono text-[10px] text-white/50 whitespace-nowrap">
                        {team.created_at
                          ? new Date(team.created_at).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Vừa xong'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Phân Trang: Đảm bảo mỗi bảng hiển thị tối đa 20 đội */}
        <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 text-xs text-white/60">
          <div>
            Hiển thị{' '}
            <b className="text-white">
              {filteredRecords.length > 0 ? (currentPage - 1) * TEAMS_PER_PAGE + 1 : 0} -{' '}
              {Math.min(currentPage * TEAMS_PER_PAGE, filteredRecords.length)}
            </b>{' '}
            trên tổng số <b className="text-[#00D89A]">{filteredRecords.length}</b> đội chơi (Giới hạn tối đa 20 đội/bảng)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => {
                audio.playClick();
                setCurrentPage((p) => Math.max(1, p - 1));
              }}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all cursor-pointer"
            >
              ← Trang trước
            </button>
            <span className="font-mono font-bold text-white px-2">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => {
                audio.playClick();
                setCurrentPage((p) => Math.min(totalPages, p + 1));
              }}
              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all cursor-pointer"
            >
              Trang sau →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
