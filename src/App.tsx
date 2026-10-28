import { useCallback, useEffect, useState } from 'react';
import { Game } from './components/Game';
import { CharacterAvatar, PlayerSetupModal } from './components/PlayerSetupModal';
import { DashboardModal } from './components/DashboardModal';
import { BRAND_MASCOTS, MANABIE_MARK } from './data/brand';
import {
  getCharacterById,
  loadSavedPlayerProfile,
  PLAYER_CHARACTERS,
  PlayerProfile,
  savePlayerProfile,
} from './data/characters';
import { BASKETS, NOISE_EMOTIONS } from './data/emotions';
import { CheckInRecord, isSupabaseConfigured, saveCheckInRecord } from './services/supabase';
import { audio } from './utils/audio';
import { GameState } from './utils/engine';

type Screen = 'intro' | 'playing' | 'debrief';

const DEFAULT_PROFILE: PlayerProfile = {
  groupName: 'Nhóm 1 - Khám Phá',
  className: '10A1',
  playerName: '',
  characterId: PLAYER_CHARACTERS[0].id,
  characterImage: PLAYER_CHARACTERS[0].image,
  characterName: PLAYER_CHARACTERS[0].name,
};

const EMPTY_GAME_STATE: GameState = {
  score: 0,
  correctCount: 0,
  targetCount: 20,
  wrongCount: 0,
  sadCount: 0,
  happyCount: 0,
  angryCount: 0,
  streak: 0,
  bestStreak: 0,
  multiplier: 1,
  timeLeftSec: 30,
  isGameOver: false,
  isWin: false,
  handsVisible: 0,
  phase: 'CALIBRATE',
  eventText: 'CHECK-IN CẢM XÚC: CHUẨN BỊ BẮT ĐẦU...',
  countdown: 3,
  round: 1,
  round1Correct: 0,
  round2Correct: 0,
  roundTarget: 10,
  isRoundTransition: false,
  transitionCountdown: 0,
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('intro');
  const [demoMode, setDemoMode] = useState(false);
  const [muted, setMuted] = useState(false);
  // Hiện bảng chọn nhân vật & đặt tên đội ngay từ đầu như game kéo co cùng AI
  const [profileModalOpen, setProfileModalOpen] = useState(true);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>(() => {
    return loadSavedPlayerProfile() || DEFAULT_PROFILE;
  });
  const [state, setState] = useState<GameState>(EMPTY_GAME_STATE);
  const [finalState, setFinalState] = useState<GameState>(EMPTY_GAME_STATE);
  const [runKey, setRunKey] = useState(0);
  const [supabaseStatus, setSupabaseStatus] = useState<
    'idle' | 'saving' | 'saved' | 'unconfigured' | 'error'
  >('idle');
  const [supabaseError, setSupabaseError] = useState<string>('');

  useEffect(() => {
    const intensity =
      state.phase === 'FINAL' ? 1 : state.streak >= 3 ? 0.65 : 0.25;
    audio.setIntensity(intensity);
  }, [state.phase, state.streak]);

  const onGameOver = useCallback(
    (s: GameState) => {
      audio.stopMusic();
      setFinalState(s);
      setScreen('debrief');

      // Tự động lưu kết quả vào Supabase sau mỗi lượt chơi
      if (!isSupabaseConfigured()) {
        setSupabaseStatus('unconfigured');
        return;
      }

      setSupabaseStatus('saving');
      const durationSec = Math.max(1, 30 - s.timeLeftSec);
      const record: CheckInRecord = {
        group_name: playerProfile.groupName,
        class_name: playerProfile.className,
        player_name: playerProfile.groupName,
        character_id: playerProfile.characterId,
        character_name: playerProfile.characterName,
        score: s.score,
        correct_count: s.correctCount,
        target_count: s.targetCount,
        wrong_count: s.wrongCount,
        sad_count: s.sadCount,
        happy_count: s.happyCount,
        angry_count: s.angryCount,
        best_streak: s.bestStreak,
        duration_sec: durationSec,
        is_win: s.isWin,
        mode: demoMode ? 'mouse' : 'ar',
      };

      saveCheckInRecord(record).then((res) => {
        if (res.success) {
          setSupabaseStatus('saved');
        } else {
          setSupabaseStatus('error');
          setSupabaseError(res.error || 'Lỗi không xác định khi lưu Supabase');
        }
      });
    },
    [playerProfile, demoMode]
  );

  const handleStartGame = (mouseMode: boolean) => {
    audio.init();
    audio.startMusic();
    setDemoMode(mouseMode);
    setState(EMPTY_GAME_STATE);
    setRunKey((k) => k + 1);
    setScreen('playing');
  };

  const handleSaveProfile = (newProfile: PlayerProfile) => {
    setPlayerProfile(newProfile);
    savePlayerProfile(newProfile);
    setProfileModalOpen(false);
  };

  const selectedChar = getCharacterById(playerProfile.characterId);

  return (
    <div
      className="app-pointer-stage flex h-dvh flex-col overflow-hidden bg-[var(--ink)]"
      data-screen={screen}
    >
      {/* MODAL CÀI ĐẶT THÔNG TIN NHÓM & NHÂN VẬT (Không có nút đóng để bắt buộc hoàn thành thông tin ban đầu) */}
      <PlayerSetupModal
        open={profileModalOpen}
        initialProfile={playerProfile}
        onConfirm={handleSaveProfile}
      />

      {/* DASHBOARD MODAL DẠNG BẢNG (Tối đa 20 đội chơi mỗi bảng) */}
      <DashboardModal
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
      />

      {/* MÀN HÌNH CHƠI AR */}
      {screen === 'playing' ? (
        <div key="screen-playing" className="flex-1 flex flex-col h-full overflow-hidden animate-page-enter">
          <EmotionGameHud
            state={state}
            profile={playerProfile}
            muted={muted}
            onToggleMute={() => {
              setMuted((m) => {
                audio.setMuted(!m);
                return !m;
              });
            }}
            onQuit={() => {
              audio.stopMusic();
              setScreen('intro');
            }}
          />
          <main className="relative min-h-0 flex-1">
            <Game
              key={runKey}
              demoMode={demoMode}
              onStateUpdate={setState}
              onGameOver={onGameOver}
            />
          </main>
        </div>
      ) : screen === 'intro' ? (
        /* MÀN HÌNH GIỚI THIỆU CHECK-IN CẢM XÚC */
        <div key="screen-intro" className="flex-1 flex flex-col h-full overflow-hidden animate-page-enter">
          <EmotionIntro
            profile={playerProfile}
            character={selectedChar}
            onOpenSetup={() => setProfileModalOpen(true)}
            onOpenDashboard={() => setDashboardOpen(true)}
            onStart={handleStartGame}
          />
        </div>
      ) : (
        /* MÀN HÌNH TỔNG KẾT & CHIẾN THẮNG */
        <div key="screen-debrief" className="flex-1 flex flex-col h-full overflow-hidden animate-page-enter">
          <EmotionDebrief
            state={finalState}
            profile={playerProfile}
            character={selectedChar}
            supabaseStatus={supabaseStatus}
            supabaseError={supabaseError}
            onReplay={() => handleStartGame(demoMode)}
            onOpenSetup={() => {
              setProfileModalOpen(true);
              setScreen('intro');
            }}
            onOpenDashboard={() => setDashboardOpen(true)}
            onBackToIntro={() => setScreen('intro')}
          />
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* HUD TRÊN MÀN HÌNH CHƠI - MOBILE FIRST                              */
/* ================================================================== */

function EmotionGameHud({
  state,
  profile,
  muted,
  onToggleMute,
  onQuit,
}: {
  state: GameState;
  profile: PlayerProfile;
  muted: boolean;
  onToggleMute: () => void;
  onQuit: () => void;
}) {
  const isTimeLow = state.timeLeftSec <= 10;
  const char = getCharacterById(profile.characterId);
  const progressPercent = Math.min(100, Math.round((state.correctCount / state.targetCount) * 100));

  return (
    <header
      className={`game-hud shrink-0 flex flex-col ${state.streak >= 3 ? 'hud-hot' : ''} ${
        state.phase === 'FINAL' ? 'hud-final' : ''
      }`}
    >
      {/* Primary Row: Essential Stats & Controls */}
      <div className="flex items-center justify-between px-2.5 sm:px-5 py-1.5 gap-2 min-h-[50px] sm:min-h-[56px]">
        {/* Profile Badge (compact on mobile) */}
        <div className="flex items-center gap-2 pr-2 border-r border-white/10 shrink-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#4C6DF0]/30 to-[#00D89A]/30 border border-[#00D89A]/50 p-0.5 shadow-sm">
            <CharacterAvatar character={char} />
          </div>
          <div className="hidden xs:flex sm:flex flex-col">
            <span className="text-white text-[11px] sm:text-xs font-black truncate max-w-[95px] sm:max-w-[130px]">
              {profile.groupName}
            </span>
            <span className="text-[#00D89A] text-[10px] font-bold">
              {profile.className}
            </span>
          </div>
        </div>

        {/* Vòng chơi badge */}
        <div className="flex flex-col items-center px-1.5 sm:px-3 border-r border-white/10 shrink-0">
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white/50">
            Vòng
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-black uppercase tracking-wider ${
              state.round === 1
                ? 'bg-[#38BDF8]/20 border border-[#38BDF8]/50 text-[#38BDF8]'
                : 'bg-[#FF6A3D]/25 border border-[#FF6A3D]/60 text-[#FF6A3D] animate-pulse'
            }`}
          >
            {state.round === 1 ? '1: Chậm' : '2: Nhanh 🔥'}
          </span>
        </div>

        {/* Đồng hồ thời gian */}
        <div
          className={`flex flex-col items-center px-2 sm:px-3 border-r border-white/10 shrink-0 ${
            isTimeLow ? 'animate-pulse' : ''
          }`}
        >
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white/50">
            Thời Gian
          </span>
          <div className="flex items-baseline gap-0.5">
            <span
              className={`text-xl sm:text-2xl font-black font-mono leading-none ${
                isTimeLow ? 'text-rose-400' : 'text-[#00D89A]'
              }`}
            >
              {state.timeLeftSec}
            </span>
            <span
              className={`text-[10px] sm:text-xs font-bold ${
                isTimeLow ? 'text-rose-400' : 'text-[#00D89A]'
              }`}
            >
              s
            </span>
          </div>
        </div>

        {/* Điểm số & Combo */}
        <div className="flex items-center gap-2 sm:gap-4 px-2 sm:px-3 border-r border-white/10 shrink-0">
          <div className="flex flex-col items-center">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white/50">
              Điểm
            </span>
            <span className="text-lg sm:text-xl font-black font-mono text-white leading-none">
              {state.score}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white/50">
              Combo
            </span>
            <span
              className="text-base sm:text-lg font-black font-mono leading-none"
              style={{ color: state.multiplier > 1 ? '#00D89A' : '#eef2ff' }}
            >
              ×{state.multiplier}
            </span>
          </div>
        </div>

        {/* Hand Tracking Signal & Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div
            className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-bold border ${
              state.handsVisible > 0
                ? 'border-[#00D89A]/60 bg-[#00D89A]/15 text-[#00D89A]'
                : 'border-white/20 bg-white/5 text-white/50'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                state.handsVisible > 0 ? 'bg-[#00D89A] animate-ping' : 'bg-white/30'
              }`}
            />
            <span className="hidden xs:inline">{state.handsVisible > 0 ? `${state.handsVisible} TAY` : 'TÌM TAY'}</span>
          </div>

          <button
            onClick={onToggleMute}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center text-xs sm:text-sm transition-all"
            title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {muted ? '🔇' : '🔊'}
          </button>

          <button
            onClick={onQuit}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/70 hover:text-rose-300 flex items-center justify-center text-xs sm:text-sm font-black transition-all"
            title="Thoát trò chơi"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Secondary Row: Target Progress & Mini Basket Counters */}
      <div className="flex items-center justify-between px-2.5 sm:px-5 py-1 bg-[#050c22]/90 border-t border-white/5 gap-2 text-[10px] sm:text-xs">
        {/* Progress bar towards 10 emotions per round */}
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <span className="text-white/60 font-black shrink-0 whitespace-nowrap text-[10px] sm:text-xs">
            {state.round === 1 ? 'VÒNG 1: ' : 'VÒNG 2: '}
            <b className="text-[#00D89A] font-mono">
              {state.round === 1 ? state.round1Correct : state.round2Correct}/10
            </b>
            <span className="text-[9px] sm:text-[10px] text-white/40 ml-1">
              (Tổng: {state.correctCount}/20)
            </span>
          </span>
          <div className="w-full h-1.5 sm:h-2 rounded-full bg-white/10 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-300 ${
                state.round === 1
                  ? 'bg-gradient-to-r from-[#38BDF8] to-[#00D89A]'
                  : 'bg-gradient-to-r from-[#00D89A] via-[#FBBF24] to-[#EF4444]'
              }`}
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    ((state.round === 1 ? state.round1Correct : state.round2Correct) / 10) * 100
                  )
                )}%`,
              }}
            />
          </div>
        </div>

        {/* 3 mini basket counters */}
        <div className="flex items-center gap-1 shrink-0 font-mono font-bold">
          <span
            className="px-1.5 py-0.5 rounded border text-[9px] sm:text-[10px]"
            style={{ borderColor: BASKETS.sad.color, color: BASKETS.sad.color, background: 'rgba(56, 189, 248, 0.1)' }}
          >
            B:{state.sadCount}
          </span>
          <span
            className="px-1.5 py-0.5 rounded border text-[9px] sm:text-[10px]"
            style={{ borderColor: BASKETS.happy.color, color: BASKETS.happy.color, background: 'rgba(251, 191, 36, 0.1)' }}
          >
            V:{state.happyCount}
          </span>
          <span
            className="px-1.5 py-0.5 rounded border text-[9px] sm:text-[10px]"
            style={{ borderColor: BASKETS.angry.color, color: BASKETS.angry.color, background: 'rgba(239, 68, 68, 0.1)' }}
          >
            G:{state.angryCount}
          </span>
        </div>
      </div>
    </header>
  );
}

/* ================================================================== */
/* MÀN HÌNH GIỚI THIỆU "CHECK-IN CẢM XÚC" - SINGLE SCREEN (NO SCROLL) */
/* ================================================================== */

function EmotionIntro({
  profile,
  character,
  onOpenSetup,
  onOpenDashboard,
  onStart,
}: {
  profile: PlayerProfile;
  character: ReturnType<typeof getCharacterById>;
  onOpenSetup: () => void;
  onOpenDashboard: () => void;
  onStart: (mouseMode: boolean) => void;
}) {
  return (
    <div className="workshop-stage force-motion flex-1 flex flex-col justify-between p-3 sm:p-5 overflow-hidden h-full">
      {/* Background visual atmosphere */}
      <div className="workshop-atmosphere" aria-hidden="true">
        <span className="workshop-grid" />
        <span className="workshop-scanline" />
        <span className="workshop-glow workshop-glow-a" />
        <span className="workshop-glow workshop-glow-b" />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between gap-3 pb-2 border-b border-white/10 shrink-0 animate-slide-top">
        <div className="flex items-center gap-2.5">
          <img className="h-6 sm:h-7 object-contain" src={MANABIE_MARK} alt="Manabie" />
          <div className="flex flex-col">
            <span className="text-white font-black text-xs sm:text-sm tracking-wider">MANABIE AI LAB</span>
            <span className="text-[#00D89A] text-[10px] font-bold">HOẠT ĐỘNG KHỞI ĐỘNG AR</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenDashboard}
            className="min-h-[32px] px-3 py-1 rounded-xl bg-gradient-to-r from-[#4C6DF0]/30 to-[#00D89A]/30 hover:from-[#4C6DF0]/50 hover:to-[#00D89A]/50 border border-[#00D89A]/50 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="Xem bảng xếp hạng Top 20 đội chơi"
          >
            <span>📊</span>
            <span>Bảng Xếp Hạng</span>
          </button>
          <div className="px-2.5 py-0.5 rounded-full bg-[#00D89A]/15 border border-[#00D89A]/40 text-[#00D89A] text-[10px] font-black tracking-wider uppercase">
            ● SẴN SÀNG
          </div>
        </div>
      </header>

      {/* Main Content - Cố gắng vừa vặn trên 1 màn hình */}
      <main className="my-auto py-2 flex flex-col lg:flex-row items-center justify-center gap-4 sm:gap-8 max-w-5xl mx-auto w-full">
        {/* Left Column: Titles, Rule, Actions */}
        <div className="flex flex-col gap-2.5 max-w-lg w-full animate-slide-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-[#4C6DF0]/25 border border-[#4C6DF0]/40 text-[#8ba2ff] text-[10px] font-black uppercase tracking-wider">
              Khởi động AR
            </span>
            <span className="text-white/40 text-xs">·</span>
            <span className="text-[#F4BE4F] text-[10px] sm:text-xs font-bold">Cử Chỉ Bàn Tay AR</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight">
            CHECK-IN <br />
            <span className="bg-gradient-to-r from-[#38BDF8] via-[#FBBF24] to-[#EF4444] bg-clip-text text-transparent">
              CẢM XÚC
            </span>
          </h1>

          <p className="text-white/80 text-xs sm:text-sm leading-relaxed">
            Dùng <b>cử chỉ bàn tay AR</b>:{' '}
            <b className="text-[#00D89A]">Chụm tay để bốc</b>, di chuyển đến giỏ và{' '}
            <b className="text-[#FBBF24]">mở tay để thả</b>! ⚠️ Bốc sai giỏ hoặc bốc phải ảnh nhiễu sẽ{' '}
            <b className="text-rose-400">bị trừ 100 điểm</b>.
          </p>

          {/* Quick Metrics: 2 Vòng chơi rõ ràng (30s & 10 cảm xúc mỗi vòng) */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 sm:p-2.5 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/35 flex flex-col">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                <span className="text-[#38BDF8] font-black uppercase text-[10px]">VÒNG 1: KHỞI ĐỘNG (30S)</span>
              </div>
              <b className="text-white text-xs sm:text-sm font-black mt-0.5">Rơi Ít · Chậm Rãi</b>
              <span className="text-[10px] text-white/60">Mục tiêu: 10 cảm xúc</span>
            </div>

            <div className="p-2 sm:p-2.5 rounded-xl bg-[#FF6A3D]/10 border border-[#FF6A3D]/35 flex flex-col">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#FF6A3D] animate-ping" />
                <span className="text-[#FF6A3D] font-black uppercase text-[10px]">VÒNG 2: TĂNG TỐC (30S) 🔥</span>
              </div>
              <b className="text-white text-xs sm:text-sm font-black mt-0.5">Rơi Nhiều · Nhanh Hơn</b>
              <span className="text-[10px] text-[#00D89A] font-bold">Mục tiêu: 10 cảm xúc</span>
            </div>
          </div>

          {/* Player / Group Info Card */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-[#121c42]/90 to-[#0c1635]/90 border border-[#4C6DF0]/40 shadow-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#4C6DF0]/30 to-[#00D89A]/30 border border-[#00D89A]/60 flex items-center justify-center p-0.5 shadow-md shrink-0">
                <CharacterAvatar character={character} />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">
                  Đội check-in
                </span>
                <span className="text-xs sm:text-sm font-black text-white">{profile.groupName}</span>
                <span className="text-[10px] text-[#00D89A] font-semibold">
                  Lớp: {profile.className}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenSetup}
              className="min-h-[34px] px-3 py-1 rounded-xl bg-[#4C6DF0]/25 hover:bg-[#4C6DF0]/40 border border-[#4C6DF0]/60 text-white text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 shrink-0"
            >
              <span>✏️</span>
              <span>Đổi</span>
            </button>
          </div>

          {/* Action buttons (Mobile-first large touch targets) */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => onStart(false)}
              className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#00D89A] via-[#10B981] to-[#059669] text-[#022318] hover:shadow-[0_0_28px_rgba(0,216,154,0.6)] font-black text-xs sm:text-sm uppercase tracking-wider transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🖐️</span>
              <span>Vào Check-in bằng Camera AR</span>
              <span>➔</span>
            </button>

            <button
              type="button"
              onClick={() => onStart(true)}
              className="min-h-[40px] px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🖱️</span>
              <span>Chơi chuột (Dự phòng)</span>
            </button>
          </div>
        </div>

        {/* Right Preview Card: 3 Giỏ Cảm Xúc Phân Loại (Đã bỏ thẻ ảnh nhiễu theo yêu cầu) */}
        <div className="flex flex-col items-center justify-center gap-3 p-4 sm:p-5 rounded-3xl bg-[#09112a]/85 border border-white/10 shadow-xl max-w-sm w-full animate-slide-right">
          <div className="flex items-center gap-1.5 text-white/70 text-xs font-black uppercase tracking-wider">
            <span>🎯</span>
            <span>3 Giỏ Vợt Cảm Xúc</span>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full">
            <div className="flex flex-col items-center p-2.5 rounded-2xl bg-[#38BDF8]/10 border border-[#38BDF8]/40">
              <img src={BASKETS.sad.imgUrl} alt="Buồn" className="w-12 h-12 sm:w-14 sm:h-14 object-contain" />
              <span className="text-[#38BDF8] text-xs font-black mt-1">BUỒN</span>
            </div>

            <div className="flex flex-col items-center p-2.5 rounded-2xl bg-[#FBBF24]/10 border border-[#FBBF24]/40">
              <img src={BASKETS.happy.imgUrl} alt="Vui" className="w-12 h-12 sm:w-14 sm:h-14 object-contain" />
              <span className="text-[#FBBF24] text-xs font-black mt-1">VUI</span>
            </div>

            <div className="flex flex-col items-center p-2.5 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/40">
              <img src={BASKETS.angry.imgUrl} alt="Giận" className="w-12 h-12 sm:w-14 sm:h-14 object-contain" />
              <span className="text-[#EF4444] text-xs font-black mt-1">GIẬN</span>
            </div>
          </div>

          <p className="text-[11px] text-white/70 text-center leading-relaxed">
            💡 <b>Hướng dẫn chơi:</b> <span className="text-[#00D89A]">Chụm tay để bốc</span> icon, di chuyển đến giỏ và <span className="text-[#FBBF24]">mở tay để thả</span>!
          </p>
        </div>
      </main>

      {/* Footer Steps */}
      <footer className="py-1.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px] text-white/50 shrink-0 animate-slide-bottom">
        <div className="flex items-center gap-2">
          <span><b>01</b> Chụm tay để bốc</span>
          <i>›</i>
          <span><b>02</b> Kéo vào giỏ Buồn/Vui/Giận</span>
          <i>›</i>
          <span><b>03</b> Mở tay để thả (Sai trừ 100đ)</span>
        </div>
        <div className="text-[#00D89A] font-bold">Check-in Cảm Xúc · Manabie AI Lab</div>
      </footer>
    </div>
  );
}

/* ================================================================== */
/* MÀN HÌNH TỔNG KẾT & CHIẾN THẮNG - SINGLE SCREEN (NO SCROLL)        */
/* ================================================================== */

function EmotionDebrief({
  state,
  profile,
  character,
  supabaseStatus,
  supabaseError,
  onReplay,
  onOpenSetup,
  onOpenDashboard,
  onBackToIntro,
}: {
  state: GameState;
  profile: PlayerProfile;
  character: ReturnType<typeof getCharacterById>;
  supabaseStatus: 'idle' | 'saving' | 'saved' | 'unconfigured' | 'error';
  supabaseError?: string;
  onReplay: () => void;
  onOpenSetup: () => void;
  onOpenDashboard: () => void;
  onBackToIntro: () => void;
}) {
  const isWin = state.isWin;
  const accuracy =
    state.correctCount + state.wrongCount > 0
      ? Math.round((state.correctCount / (state.correctCount + state.wrongCount)) * 100)
      : 100;

  return (
    <div className="debrief-v3 force-motion flex-1 flex flex-col justify-between p-2.5 sm:p-4 overflow-hidden h-full">
      <div className="debrief-atmosphere" aria-hidden="true" />

      {/* Header */}
      <header className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0 animate-slide-top">
        <div className="flex items-center gap-2">
          <img className="h-6 sm:h-7 object-contain" src={MANABIE_MARK} alt="Manabie" />
          <div className="flex flex-col">
            <span className="text-white font-black text-xs sm:text-sm">TỔNG KẾT CHECK-IN CẢM XÚC</span>
            <span className="text-[#00D89A] text-[10px] font-bold">MANABIE AI LAB</span>
          </div>
        </div>

        <button
          onClick={onBackToIntro}
          className="min-h-[32px] px-3 py-1 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all"
        >
          ← Trang chủ
        </button>
      </header>

      {/* Main debrief card - Gọn gàng trên 1 màn hình */}
      <main className="my-auto py-2 max-w-2xl mx-auto w-full flex flex-col items-center gap-2 sm:gap-3">
        {/* Victory Banner (Compact) */}
        <div
          className={`w-full p-3 sm:p-4 rounded-2xl border flex items-center justify-between gap-3 relative overflow-hidden animate-banner-pop ${
            isWin
              ? 'bg-gradient-to-r from-[#00D89A]/20 via-[#10B981]/15 to-transparent border-[#00D89A] shadow-[0_0_30px_rgba(0,216,154,0.25)]'
              : 'bg-gradient-to-r from-[#4C6DF0]/20 via-[#3C5AD2]/15 to-transparent border-[#4C6DF0] shadow-[0_0_20px_rgba(76,109,240,0.15)]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="text-3xl sm:text-4xl shrink-0">{isWin ? '🏆' : '🎉'}</div>
            <div className="flex flex-col text-left">
              <span
                className={`px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider w-max ${
                  isWin ? 'bg-[#00D89A] text-[#022318]' : 'bg-[#4C6DF0] text-white'
                }`}
              >
                {isWin ? 'CHECK-IN XUẤT SẮC' : 'HOÀN THÀNH 2 VÒNG'}
              </span>
              <h2 className="text-base sm:text-xl font-black text-white mt-0.5">
                {isWin ? 'Đã Hoàn Thành Toàn Diện 2 Vòng Chơi!' : 'Hoàn Thành Lượt Check-in Cảm Xúc!'}
              </h2>
              <span className="text-[11px] text-white/70">
                Đội: <b>{profile.groupName}</b> · Lớp: <b>{profile.className}</b>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end shrink-0 pl-2 border-l border-white/10">
            <span className="text-[9px] font-bold text-white/50 uppercase">Tổng điểm</span>
            <span className="text-xl sm:text-3xl font-black font-mono text-[#00D89A] leading-tight">
              {state.score}
            </span>
          </div>
        </div>

        {/* 4 Core Metrics */}
        <div className="grid grid-cols-4 gap-2 w-full animate-slide-bottom">
          <div className="p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center">
            <span className="text-[9px] font-bold text-white/50 uppercase">Đúng</span>
            <b className="text-base sm:text-xl font-black font-mono text-[#00D89A]">{state.correctCount}/20</b>
          </div>
          <div className="p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center">
            <span className="text-[9px] font-bold text-white/50 uppercase">Chuỗi</span>
            <b className="text-base sm:text-xl font-black font-mono text-[#F4BE4F]">×{state.bestStreak}</b>
          </div>
          <div className="p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center">
            <span className="text-[9px] font-bold text-white/50 uppercase">Chính Xác</span>
            <b className="text-base sm:text-xl font-black font-mono text-[#38BDF8]">{accuracy}%</b>
          </div>
          <div className="p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center">
            <span className="text-[9px] font-bold text-white/50 uppercase">Sai / Nhiễu</span>
            <b className="text-base sm:text-xl font-black font-mono text-rose-400">{state.wrongCount}</b>
          </div>
        </div>

        {/* 2 Vòng & 3 Giỏ Chi Tiết (Combined Row) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
          {/* 2 Vòng chơi */}
          <div className="p-2.5 rounded-xl bg-[#081028]/90 border border-white/10 flex flex-col gap-1.5">
            <span className="text-[10px] font-black text-white/60 uppercase tracking-wider text-center">
              Thành Tích Theo Vòng (30s)
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex flex-col items-center p-1.5 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/30">
                <span className="text-[9px] font-bold text-[#38BDF8]">V1 (CHẬM)</span>
                <b className="text-sm sm:text-base font-black font-mono text-white">{state.round1Correct}/10</b>
              </div>
              <div className="flex flex-col items-center p-1.5 rounded-lg bg-[#FF6A3D]/10 border border-[#FF6A3D]/30">
                <span className="text-[9px] font-bold text-[#FF6A3D]">V2 (NHANH 🔥)</span>
                <b className="text-sm sm:text-base font-black font-mono text-white">{state.round2Correct}/10</b>
              </div>
            </div>
          </div>

          {/* 3 Giỏ phân loại */}
          <div className="p-2.5 rounded-xl bg-[#081028]/90 border border-white/10 flex flex-col gap-1.5">
            <span className="text-[10px] font-black text-white/60 uppercase tracking-wider text-center">
              Phân Loại Vào 3 Giỏ
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="flex flex-col items-center p-1.5 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/30">
                <span className="text-[9px] font-bold text-[#38BDF8]">BUỒN</span>
                <b className="text-sm sm:text-base font-black font-mono text-white">{state.sadCount}</b>
              </div>
              <div className="flex flex-col items-center p-1.5 rounded-lg bg-[#FBBF24]/10 border border-[#FBBF24]/30">
                <span className="text-[9px] font-bold text-[#FBBF24]">VUI</span>
                <b className="text-sm sm:text-base font-black font-mono text-white">{state.happyCount}</b>
              </div>
              <div className="flex flex-col items-center p-1.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30">
                <span className="text-[9px] font-bold text-[#EF4444]">GIẬN</span>
                <b className="text-sm sm:text-base font-black font-mono text-white">{state.angryCount}</b>
              </div>
            </div>
          </div>
        </div>

        {/* Supabase Save Status Card (Slim 1 line) */}
        <div
          className={`w-full px-3 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-[11px] ${
            supabaseStatus === 'saved'
              ? 'bg-[#00D89A]/10 border-[#00D89A]/40 text-[#00D89A]'
              : supabaseStatus === 'saving'
              ? 'bg-[#4C6DF0]/10 border-[#4C6DF0]/40 text-[#8ba2ff]'
              : supabaseStatus === 'error'
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
              : 'bg-white/5 border-white/10 text-white/60'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span>
              {supabaseStatus === 'saved'
                ? '⚡'
                : supabaseStatus === 'saving'
                ? '⏳'
                : supabaseStatus === 'error'
                ? '⚠️'
                : '☁️'}
            </span>
            <span className="font-bold">
              {supabaseStatus === 'saved'
                ? 'Đã lưu kết quả lên Supabase thành công!'
                : supabaseStatus === 'saving'
                ? 'Đang đồng bộ dữ liệu lên Supabase...'
                : supabaseStatus === 'error'
                ? `Lỗi lưu Supabase: ${supabaseError}`
                : 'Chế độ chơi ngoại tuyến (Chưa cấu hình Supabase)'}
            </span>
          </div>

          {supabaseStatus === 'saved' && (
            <span className="px-2 py-0.2 rounded-full bg-[#00D89A]/20 text-[#00D89A] text-[9px] font-black uppercase shrink-0">
              Đồng bộ ✓
            </span>
          )}
        </div>

        {/* Action buttons (Mobile-first touch friendly) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 w-full pt-0.5">
          <button
            type="button"
            onClick={onReplay}
            className="min-h-[42px] px-6 py-2 rounded-2xl bg-gradient-to-r from-[#00D89A] to-[#10B981] text-[#022318] hover:shadow-[0_0_24px_rgba(0,216,154,0.6)] font-black text-xs sm:text-sm uppercase tracking-wider transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>↻</span>
            <span>Chơi Lại Lượt Mới</span>
          </button>

          <button
            type="button"
            onClick={onOpenDashboard}
            className="min-h-[40px] px-4 py-2 rounded-2xl bg-gradient-to-r from-[#4C6DF0]/30 to-[#00D89A]/30 hover:from-[#4C6DF0]/50 hover:to-[#00D89A]/50 border border-[#00D89A]/50 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>📊</span>
            <span>Bảng Xếp Hạng (Top 20)</span>
          </button>

          <button
            type="button"
            onClick={onOpenSetup}
            className="min-h-[40px] px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>✏️</span>
            <span>Đổi Nhóm & Nhân Vật</span>
          </button>
        </div>
      </main>

      <footer className="py-1 border-t border-white/10 text-center text-[10px] text-white/40 shrink-0">
        Check-in Cảm Xúc · Manabie AI Lab · AR Hand Tracking
      </footer>
    </div>
  );
}
