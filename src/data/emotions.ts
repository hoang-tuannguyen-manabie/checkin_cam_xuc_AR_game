export type EmotionCategory = 'sad' | 'happy' | 'angry' | 'noise';
export type BasketType = 'sad' | 'happy' | 'angry';

export interface EmotionItemDef {
  id: string;
  category: EmotionCategory;
  label: string;
  gifUrl: string;
  color: string;
  isNoise?: boolean;
}

export interface BasketDef {
  type: BasketType;
  title: string;
  subtitle: string;
  color: string;
  glowColor: string;
  imgUrl: string;
  xPercent: number;
}

const base = import.meta.env.BASE_URL || '/';
const asset = (relPath: string) => `${base}${relPath.replace(/^\/+/, '')}`;

export const BASKETS: Record<BasketType, BasketDef> = {
  sad: {
    type: 'sad',
    title: 'BUỒN',
    subtitle: 'Nỗi buồn, u sầu',
    color: '#38BDF8',
    glowColor: 'rgba(56, 189, 248, 0.45)',
    imgUrl: asset('asset/baskets/basket_left.png'),
    xPercent: 0.18,
  },
  happy: {
    type: 'happy',
    title: 'VUI',
    subtitle: 'Niềm vui, hạnh phúc',
    color: '#FBBF24',
    glowColor: 'rgba(251, 191, 36, 0.45)',
    imgUrl: asset('asset/baskets/basket_center.png'),
    xPercent: 0.50,
  },
  angry: {
    type: 'angry',
    title: 'GIẬN',
    subtitle: 'Tức giận, phẫn nộ',
    color: '#EF4444',
    glowColor: 'rgba(239, 68, 68, 0.45)',
    imgUrl: asset('asset/baskets/basket_right.png'),
    xPercent: 0.82,
  },
};

export const ALL_EMOTIONS: EmotionItemDef[] = [
  // --- VUI (Happy) ---
  {
    id: 'happy_grin',
    category: 'happy',
    label: 'Cười toét',
    gifUrl: asset('asset/grin.gif'),
    color: '#FBBF24',
  },
  {
    id: 'happy_grinning',
    category: 'happy',
    label: 'Cười tươi',
    gifUrl: asset('asset/grinning.gif'),
    color: '#FBBF24',
  },
  {
    id: 'happy_joy',
    category: 'happy',
    label: 'Vui sướng',
    gifUrl: asset('asset/joy.gif'),
    color: '#FBBF24',
  },
  {
    id: 'happy_smile_big',
    category: 'happy',
    label: 'Rạng rỡ',
    gifUrl: asset('asset/smile-with-big-eyes.gif'),
    color: '#FBBF24',
  },

  // --- BUỒN (Sad) ---
  {
    id: 'sad_cry',
    category: 'sad',
    label: 'Khóc buồn',
    gifUrl: asset('asset/cry.gif'),
    color: '#38BDF8',
  },
  {
    id: 'sad_loudly_crying',
    category: 'sad',
    label: 'Khóc nấc',
    gifUrl: asset('asset/loudly-crying.gif'),
    color: '#38BDF8',
  },
  {
    id: 'sad_sweat',
    category: 'sad',
    label: 'Toát mồ hôi',
    gifUrl: asset('asset/sweat.gif'),
    color: '#38BDF8',
  },

  // --- GIẬN (Angry) ---
  {
    id: 'angry_face',
    category: 'angry',
    label: 'Giận dữ',
    gifUrl: asset('asset/angry.gif'),
    color: '#EF4444',
  },
  {
    id: 'angry_rage',
    category: 'angry',
    label: 'Thịnh nộ',
    gifUrl: asset('asset/rage.gif'),
    color: '#EF4444',
  },
  {
    id: 'angry_triumph',
    category: 'angry',
    label: 'Hậm hực',
    gifUrl: asset('asset/triumph.gif'),
    color: '#EF4444',
  },

  // --- ẢNH NHIỄU (Noise - Không phù hợp rổ nào) ---
  {
    id: 'noise_hot_face',
    category: 'noise',
    label: 'Bốc hỏa',
    gifUrl: asset('asset/hot-face.gif'),
    color: '#EC4899',
    isNoise: true,
  },
  {
    id: 'noise_dizzy_face',
    category: 'noise',
    label: 'Chóng mặt',
    gifUrl: asset('asset/dizzy-face.gif'),
    color: '#A855F7',
    isNoise: true,
  },
];

export const CORE_EMOTIONS = ALL_EMOTIONS.filter((e) => !e.isNoise);
export const NOISE_EMOTIONS = ALL_EMOTIONS.filter((e) => e.isNoise);

/**
 * Sinh ngẫu nhiên cảm xúc: 76% cảm xúc chuẩn, 24% ảnh nhiễu (hot-face, dizzy-face)
 */
export function getRandomEmotionItem(noiseRate = 0.24): EmotionItemDef {
  const isNoise = Math.random() < noiseRate;
  if (isNoise && NOISE_EMOTIONS.length > 0) {
    const idx = Math.floor(Math.random() * NOISE_EMOTIONS.length);
    return NOISE_EMOTIONS[idx];
  }
  const idx = Math.floor(Math.random() * CORE_EMOTIONS.length);
  return CORE_EMOTIONS[idx];
}
