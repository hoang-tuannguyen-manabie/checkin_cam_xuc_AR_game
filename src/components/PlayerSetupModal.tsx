import React, { useEffect, useState } from 'react';
import {
  CHARACTERS_SPRITE_SHEET,
  getCharacterById,
  PLAYER_CHARACTERS,
  PlayerCharacter,
  PlayerProfile,
} from '../data/characters';
import { audio } from '../utils/audio';

interface PlayerSetupModalProps {
  open: boolean;
  initialProfile: PlayerProfile | null;
  onConfirm: (profile: PlayerProfile) => void;
  onClose?: () => void;
}

export function CharacterAvatar({
  character,
  className = 'w-full h-full',
  imgClassName = 'w-full h-full object-contain',
}: {
  character: PlayerCharacter;
  className?: string;
  imgClassName?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [useSpriteFallback, setUseSpriteFallback] = useState(false);

  const { x, y, width, height } = character.cropRect;
  const bgPosX = (x / (513 - width)) * 100;
  const bgPosY = (y / (486 - height)) * 100;
  const bgSizeX = (513 / width) * 100;
  const bgSizeY = (486 / height) * 100;

  return (
    <div className={`relative overflow-hidden flex items-center justify-center select-none ${className}`}>
      {!loaded && !useSpriteFallback && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#2a1b5e] via-[#3b267e] to-[#1e1246] animate-pulse rounded-xl"
          aria-hidden="true"
        />
      )}

      {!useSpriteFallback ? (
        <img
          src={character.image}
          alt={character.name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setUseSpriteFallback(true);
            setLoaded(true);
          }}
          className={`${imgClassName} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        <div
          role="img"
          aria-label={character.name}
          className="w-full h-full rounded-xl"
          style={{
            backgroundImage: `url(${CHARACTERS_SPRITE_SHEET})`,
            backgroundPosition: `${bgPosX.toFixed(3)}% ${bgPosY.toFixed(3)}%`,
            backgroundSize: `${bgSizeX.toFixed(3)}% ${bgSizeY.toFixed(3)}%`,
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
    </div>
  );
}

export function PlayerSetupModal({
  open,
  initialProfile,
  onConfirm,
  onClose,
}: PlayerSetupModalProps) {
  const [groupName, setGroupName] = useState<string>(initialProfile?.groupName ?? 'Nhóm 1 - Khám Phá');
  const [className, setClassName] = useState<string>(initialProfile?.className ?? '10A1');
  const [selectedCharId, setSelectedCharId] = useState<string>(
    initialProfile?.characterId ?? PLAYER_CHARACTERS[0].id
  );
  const [activeTab, setActiveTab] = useState<'info' | 'character'>('info');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (initialProfile) {
        setGroupName(initialProfile.groupName);
        setClassName(initialProfile.className);
        setSelectedCharId(initialProfile.characterId);
      }
      setErrorMsg(null);
    }
  }, [open, initialProfile]);

  if (!open) return null;

  const selectedCharacter = getCharacterById(selectedCharId);

  const handleRandomChar = () => {
    audio.playClick();
    const randomIndex = Math.floor(Math.random() * PLAYER_CHARACTERS.length);
    setSelectedCharId(PLAYER_CHARACTERS[randomIndex].id);
  };

  const handleConfirm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    audio.init();

    if (!groupName.trim()) {
      setErrorMsg('Vui lòng nhập tên nhóm của bạn nhé!');
      setActiveTab('info');
      return;
    }
    if (!className.trim()) {
      setErrorMsg('Vui lòng điền thông tin lớp học!');
      setActiveTab('info');
      return;
    }

    audio.playClick();
    onConfirm({
      groupName: groupName.trim().slice(0, 30),
      className: className.trim().slice(0, 20),
      playerName: '',
      characterId: selectedCharacter.id,
      characterImage: selectedCharacter.image,
      characterName: selectedCharacter.name,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-2.5 sm:p-4 bg-[#050A1C]/94 backdrop-blur-xl animate-modal-backdrop"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-xl sm:max-w-2xl rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#121c42]/98 via-[#0c1635]/98 to-[#060b1e]/98 border border-[#4C6DF0]/40 shadow-[0_20px_70px_rgba(0,0,0,0.85)] p-3.5 sm:p-5 flex flex-col gap-3 animate-modal-dialog">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-[#00D89A]/15 border border-[#00D89A]/40 text-[#00D89A] text-[10px] sm:text-xs font-black tracking-wider uppercase">
                Check-in Cảm Xúc
              </span>
              <span className="text-white/40 text-xs">·</span>
              <span className="text-white/70 text-[11px] sm:text-xs font-semibold">Thông tin đội chơi</span>
            </div>
            <h2 className="text-base sm:text-xl font-black text-white mt-0.5">
              Điền Nhóm, Lớp & Chọn Nhân Vật
            </h2>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-[#070e24] border border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => {
              audio.playClick();
              setActiveTab('info');
            }}
            className={`flex-1 min-h-[34px] py-1 px-2 rounded-lg text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'info'
                ? 'bg-gradient-to-r from-[#4C6DF0] to-[#3C5AD2] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>📝</span>
            <span>1. Tên Nhóm & Lớp</span>
          </button>
          <button
            type="button"
            onClick={() => {
              audio.playClick();
              setActiveTab('character');
            }}
            className={`flex-1 min-h-[34px] py-1 px-2 rounded-lg text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'character'
                ? 'bg-gradient-to-r from-[#4C6DF0] to-[#3C5AD2] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>🎭</span>
            <span>2. Chọn Nhân Vật ({PLAYER_CHARACTERS.length})</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2 shrink-0">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TAB 1: THÔNG TIN NHÓM & LỚP */}
        {activeTab === 'info' && (
          <form key="tab-info" onSubmit={handleConfirm} className="flex flex-col gap-2.5 animate-tab-content">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Tên nhóm */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-black uppercase text-[#00D89A] tracking-wider">
                  Tên Nhóm / Đội <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={groupName}
                  maxLength={30}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="VD: Nhóm 1, Biệt đội Alpha..."
                  className="w-full px-3 py-2 rounded-xl bg-[#09112a] border border-[#1d2b57] focus:border-[#00D89A] focus:outline-none text-white font-bold text-sm transition-all"
                />
                <div className="flex gap-1 flex-wrap mt-0.5">
                  {['Nhóm 1', 'Nhóm 2', 'Nhóm 3', 'Tia Chớp'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setGroupName(preset)}
                      className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-semibold transition-all cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lớp */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-black uppercase text-[#32C8E6] tracking-wider">
                  Lớp Học <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={className}
                  maxLength={20}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="VD: 10A1, 11B2..."
                  className="w-full px-3 py-2 rounded-xl bg-[#09112a] border border-[#1d2b57] focus:border-[#32C8E6] focus:outline-none text-white font-bold text-sm transition-all"
                />
                <div className="flex gap-1 flex-wrap mt-0.5">
                  {['10A1', '10A2', '11A1', '12A1'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setClassName(preset)}
                      className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-semibold transition-all cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Card xem trước nhân vật */}
            <div className="p-2.5 rounded-xl bg-[#081028]/80 border border-white/10 flex items-center justify-between gap-3 mt-0.5">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#4C6DF0]/30 to-[#00D89A]/30 border border-[#00D89A]/60 flex items-center justify-center p-0.5 shadow-md">
                  <CharacterAvatar character={selectedCharacter} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    Nhân vật đại diện
                  </span>
                  <div className="text-xs sm:text-sm font-black text-white">{selectedCharacter.name}</div>
                  <div className="text-[10px] text-[#00D89A] font-semibold">
                    {groupName || 'Chưa đặt nhóm'} · Lớp {className || 'Chưa chọn'}
                  </div>
                </div>
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleRandomChar}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer"
                  title="Chọn ngẫu nhiên"
                >
                  🎲
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('character')}
                  className="px-2.5 py-1 rounded-lg bg-[#4C6DF0]/25 hover:bg-[#4C6DF0]/40 border border-[#4C6DF0]/50 text-[#8ba2ff] hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Đổi →
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: CHỌN NHÂN VẬT (36 CHARACTERS - GỌN GÀNG KHÔNG CẦN SCROLL) */}
        {activeTab === 'character' && (
          <div key="tab-character" className="flex flex-col gap-2 animate-tab-content">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/70 font-semibold">
                Đang chọn: <b className="text-[#00D89A] ml-1">{selectedCharacter.name}</b>
              </span>
              <button
                type="button"
                onClick={handleRandomChar}
                className="px-2.5 py-0.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>🎲</span> Ngẫu nhiên
              </button>
            </div>

            {/* Grid 36 nhân vật xếp gọn 9 cột x 4 hàng (Desktop) hoặc 6 cột x 6 hàng (Mobile) không scroll */}
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-1 sm:gap-1.5 p-1.5 sm:p-2 rounded-xl bg-[#060c20] border border-white/10">
              {PLAYER_CHARACTERS.map((char) => {
                const isSelected = char.id === selectedCharId;
                return (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => {
                      audio.playClick();
                      setSelectedCharId(char.id);
                    }}
                    className={`relative p-0.5 sm:p-1 rounded-lg transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#00D89A]/30 to-[#4C6DF0]/30 border-2 border-[#00D89A] scale-105 z-10 shadow-md'
                        : 'bg-white/5 hover:bg-white/10 border border-transparent'
                    }`}
                    title={char.name}
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center">
                      <CharacterAvatar character={char} />
                    </div>
                    <span className="text-[7px] sm:text-[8px] font-bold text-white/70 truncate w-full text-center leading-tight">
                      {char.name.split(' ')[0]}
                    </span>
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#00D89A] text-[#050A1C] text-[8px] font-black flex items-center justify-center">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={() => handleConfirm()}
            className="w-full sm:w-auto min-h-[42px] px-8 py-2.5 rounded-xl bg-gradient-to-r from-[#00D89A] via-[#10B981] to-[#059669] text-[#022318] hover:shadow-[0_0_28px_rgba(0,216,154,0.6)] font-black text-xs sm:text-sm uppercase tracking-wider transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 shadow-lg"
          >
            <span>Vào Check-in Ngay</span>
            <span>➔</span>
          </button>
        </div>
      </div>
    </div>
  );
}
