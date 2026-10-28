import {
  ALL_EMOTIONS,
  BASKETS,
  BasketDef,
  BasketType,
  EmotionCategory,
  EmotionItemDef,
  getRandomEmotionItem,
} from '../data/emotions';
import { audio } from './audio';

export const PALETTE = {
  bg: '#050A1C',
  bgSoft: '#0D1836',
  edge: '#1D2B57',
  brand: '#4C6DF0',
  brandDeep: '#3C5AD2',
  mint: '#00D89A',
  ember: '#FF6A3D',
  gold: '#F4BE4F',
  cyan: '#32C8E6',
  white: '#EEF2FF',
  muted: '#7D8BB8',
  sad: '#38BDF8',
  happy: '#FBBF24',
  angry: '#EF4444',
  noise: '#EC4899',
};

const FONT = '"Be Vietnam Pro", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface HandInput {
  x: number;
  y: number;
  ix: number;
  iy: number;
  tx: number;
  ty: number;
  isPinching: boolean;
  handedness: string;
  playerId: number;
  landmarks?: LandmarkPoint[];
}

export interface GameState {
  score: number;
  correctCount: number;
  targetCount: number;
  wrongCount: number;
  sadCount: number;
  happyCount: number;
  angryCount: number;
  streak: number;
  bestStreak: number;
  multiplier: number;
  timeLeftSec: number;
  isGameOver: boolean;
  isWin: boolean;
  handsVisible: number;
  phase: 'CALIBRATE' | 'FLOW' | 'FINAL';
  eventText: string;
  countdown: number;
  round: 1 | 2;
  round1Correct: number;
  round2Correct: number;
  roundTarget: number;
  isRoundTransition: boolean;
  transitionCountdown: number;
}

export interface Ball {
  id: number;
  emotion: EmotionItemDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVy: number;
  r: number;
  seed: number;
  grabbedBy: number | null;
  consumedBy: BasketType | null;
  consumedProgress: number;
  dead: boolean;
  reach: number;
  trail: { x: number; y: number }[];
  releasedTimer: number;
}

interface Burst {
  x: number;
  y: number;
  color: string;
  text: string;
  age: number;
  life: number;
  shards: { a: number; v: number }[];
}

interface Shockwave {
  x: number;
  y: number;
  r: number;
  color: string;
  age: number;
  life: number;
}

interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vRot: number;
}

export class GameEngine {
  private width = 960;
  private height = 540;
  private onStateChange: (state: GameState) => void;

  private state: GameState = {
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

  private balls: Ball[] = [];
  private hands: HandInput[] = [];
  private bursts: Burst[] = [];
  private shockwaves: Shockwave[] = [];
  private confettiList: Confetti[] = [];
  private bgParticles: { x: number; y: number; size: number; color: string; vy: number; alpha: number }[] = [];

  private nextBallId = 1;
  private elapsedMs = 0;
  private lastSpawnMs = 0;
  private countdownTimer = 0;
  private transitionTimer = 0;
  private lastSecondTimer = 0;
  private shake = 0;
  private successPulse = 0;

  // Basket images
  private basketImages: Record<BasketType, HTMLImageElement> = {
    sad: new Image(),
    happy: new Image(),
    angry: new Image(),
  };

  // Preloaded GIF image elements
  private gifImages: Map<string, HTMLImageElement> = new Map();

  constructor(onStateChange: (state: GameState) => void) {
    this.onStateChange = onStateChange;

    // Load basket racket images
    this.basketImages.sad.src = BASKETS.sad.imgUrl;
    this.basketImages.happy.src = BASKETS.happy.imgUrl;
    this.basketImages.angry.src = BASKETS.angry.imgUrl;

    // Preload emotion and noise gifs
    ALL_EMOTIONS.forEach((item) => {
      if (!this.gifImages.has(item.gifUrl)) {
        const img = new Image();
        img.src = item.gifUrl;
        this.gifImages.set(item.gifUrl, img);
      }
    });

    this.initBgParticles();
  }

  private initBgParticles() {
    this.bgParticles = [];
    const count = this.width < 600 ? 25 : 40;
    for (let i = 0; i < count; i++) {
      this.bgParticles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2 + 1,
        color: Math.random() > 0.5 ? PALETTE.brand : PALETTE.mint,
        vy: -(Math.random() * 0.35 + 0.1),
        alpha: Math.random() * 0.35 + 0.1,
      });
    }
  }

  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.initBgParticles();
  }

  updateHands(hands: HandInput[]) {
    this.hands = hands;
    this.state.handsVisible = hands.length;
  }

  update(dt: number) {
    if (this.state.isGameOver) {
      this.updateBursts(dt);
      this.updateConfetti(dt);
      return;
    }

    this.elapsedMs += dt;

    // COUNTDOWN PHASE (Khởi đầu trận đấu)
    if (this.state.countdown > 0) {
      this.countdownTimer += dt;
      if (this.countdownTimer >= 1000) {
        this.countdownTimer -= 1000;
        this.state.countdown -= 1;
        if (this.state.countdown > 0) {
          audio.playPinch();
        } else {
          this.state.phase = 'FLOW';
          this.state.round = 1;
          this.state.eventText = 'VÒNG 1: 10 CẢM XÚC (30S) — CHỤM TAY BỐC • MỞ TAY THẢ!';
          audio.playPower();
        }
        this.onStateChange({ ...this.state });
      }
      return;
    }

    // ROUND TRANSITION OVERLAY (Chuyển giao giữa Vòng 1 và Vòng 2)
    if (this.state.isRoundTransition) {
      this.transitionTimer += dt;
      if (this.transitionTimer >= 950) {
        this.transitionTimer -= 950;
        this.state.transitionCountdown -= 1;
        if (this.state.transitionCountdown > 0) {
          audio.playPinch();
        } else {
          // BẮT ĐẦU VÒNG 2: TĂNG TỐC!
          this.state.isRoundTransition = false;
          this.state.round = 2;
          this.state.timeLeftSec = 30;
          this.state.roundTarget = 10;
          this.state.phase = 'FLOW';
          this.state.eventText = 'VÒNG 2: TĂNG TỐC! 10 CẢM XÚC (30S) — CHỤM TAY BỐC • MỞ TAY THẢ!';
          audio.playPower();
          this.lastSpawnMs = this.elapsedMs;
        }
        this.onStateChange({ ...this.state });
      }
      this.updateBursts(dt);
      this.updateConfetti(dt);
      return;
    }

    // GAMEPLAY TIMER (30s mỗi vòng)
    this.lastSecondTimer += dt;
    if (this.lastSecondTimer >= 1000) {
      this.lastSecondTimer -= 1000;
      this.state.timeLeftSec = Math.max(0, this.state.timeLeftSec - 1);

      if (this.state.round === 1) {
        if (this.state.timeLeftSec <= 0) {
          // Hết giờ Vòng 1: Tự động chuyển sang Vòng 2
          this.startRoundTransition(false);
          return;
        }
      } else {
        // Vòng 2
        if (this.state.timeLeftSec <= 10 && this.state.phase !== 'FINAL') {
          this.state.phase = 'FINAL';
          this.state.eventText = 'TĂNG TỐC TỘT ĐỈNH! 10 GIÂY CUỐI CÙNG!';
          audio.playPower();
        }

        if (this.state.timeLeftSec <= 0) {
          this.endGame();
          return;
        }
      }
      this.onStateChange({ ...this.state });
    }

    // SPAWN EMOTION ICONS (Vòng 1: Rơi ít, chậm. Vòng 2: Rơi nhiều hơn, nhanh hơn)
    const isMobile = this.width < 600;
    const isRound1 = this.state.round === 1;

    let spawnInterval: number;
    let maxActiveBalls: number;

    if (isRound1) {
      // VÒNG 1: Rơi ít (thời gian cách nhau dài hơn, tối đa 3-4 quả)
      spawnInterval = isMobile ? 2100 : 1900;
      maxActiveBalls = isMobile ? 3 : 4;
    } else {
      // VÒNG 2: Rơi nhiều hơn (thời gian cách nhau ngắn lại, tối đa 6-8 quả)
      if (this.state.phase === 'FINAL') {
        spawnInterval = isMobile ? 850 : 750;
        maxActiveBalls = isMobile ? 7 : 8;
      } else {
        spawnInterval = isMobile ? 1050 : 920;
        maxActiveBalls = isMobile ? 6 : 8;
      }
    }

    if (this.elapsedMs - this.lastSpawnMs >= spawnInterval && this.balls.length < maxActiveBalls) {
      this.spawnBall();
      this.lastSpawnMs = this.elapsedMs;
    }

    // UPDATE BALLS & PINCH
    this.updateBalls(dt);
    this.updateBursts(dt);
    this.updateConfetti(dt);

    if (this.successPulse > 0) {
      this.successPulse = Math.max(0, this.successPulse - dt / 500);
    }
  }

  private startRoundTransition(completedEarly = true) {
    if (this.state.round !== 1 || this.state.isRoundTransition) return;
    this.state.isRoundTransition = true;
    this.transitionTimer = 0;
    this.state.transitionCountdown = 3;
    this.state.eventText = completedEarly
      ? 'XUẤT SẮC! HOÀN THÀNH VÒNG 1! CHUẨN BỊ VÀO VÒNG 2: TĂNG TỐC!'
      : 'HẾT GIỜ VÒNG 1! CHUẨN BỊ VÀO VÒNG 2: TĂNG TỐC!';
    audio.playCheer();

    // Dọn sạch các bóng rơi trên màn hình với hiệu ứng pháo hoa dễ thương
    for (const ball of this.balls) {
      if (!ball.dead && !ball.consumedBy) {
        this.spawnBurst(ball.x, ball.y, '#00D89A', '★');
        ball.dead = true;
      }
    }
    this.onStateChange({ ...this.state });
  }

  getBalls(): Ball[] {
    return this.balls;
  }

  private spawnBall() {
    const isRound1 = this.state.round === 1;
    // Tần suất ảnh nhiễu: Vòng 1 ít nhiễu (14%), Vòng 2 nhiều nhiễu hơn (26%)
    const noiseRate = isRound1 ? 0.14 : 0.26;
    const emotion = getRandomEmotionItem(noiseRate);
    const minDim = Math.min(this.width, this.height);
    const isPortrait = this.height > this.width;
    const isMobile = this.width < 600;

    // Phóng to ảnh thêm 100px (đường kính tăng 100px -> bán kính r tăng ~48-50px)
    const baseR = Math.min(46, Math.max(28, minDim * (isPortrait ? 0.076 : 0.052)));
    const r = isMobile ? Math.min(76, baseR + 36) : Math.min(90, baseR + 48);
    const margin = r + 24;
    const spawnX = margin + Math.random() * (this.width - margin * 2);

    // Fall speed: Vòng 1 rơi chậm (0.036 - 0.040), Vòng 2 rơi nhanh hơn rõ rệt (0.082 - 0.110)
    let baseSpeed: number;
    if (isRound1) {
      baseSpeed = isMobile ? 0.034 : 0.040;
    } else {
      if (this.state.phase === 'FINAL') {
        baseSpeed = isMobile ? 0.098 : 0.112;
      } else {
        baseSpeed = isMobile ? 0.082 : 0.092;
      }
    }

    const spawnVy = baseSpeed + Math.random() * (isRound1 ? 0.008 : 0.018);

    this.balls.push({
      id: this.nextBallId++,
      emotion,
      x: spawnX,
      y: -r - 12,
      vx: (Math.random() - 0.5) * (isRound1 ? 0.015 : 0.028),
      vy: spawnVy,
      baseVy: spawnVy,
      r,
      seed: Math.random() * 100,
      grabbedBy: null,
      consumedBy: null,
      consumedProgress: 0,
      dead: false,
      reach: 0,
      trail: [],
      releasedTimer: 0,
    });
  }

  private updateBalls(dt: number) {
    const basketPositions = this.getBasketBounds();

    // =========================================================================
    // BƯỚC 1: XỬ LÝ CÁC BÓNG ĐANG ĐƯỢC GIỮ HOẶC ĐANG BỊ HÚT VÀO GIỎ
    // =========================================================================
    for (const ball of this.balls) {
      if (ball.dead) continue;

      // Xử lý hiệu ứng khi bóng được thả trúng giỏ
      if (ball.consumedBy) {
        ball.consumedProgress += dt / 380;
        const targetBasket = basketPositions[ball.consumedBy];
        ball.x += (targetBasket.cx - ball.x) * 0.22;
        ball.y += (targetBasket.cy - ball.y) * 0.22;
        ball.r *= 0.93;
        if (ball.consumedProgress >= 1 || ball.r < 4) {
          ball.dead = true;
        }
        continue;
      }

      // Xử lý bóng đang bị 1 bàn tay giữ
      if (ball.grabbedBy !== null) {
        const controllingHand = this.hands.find((h) => h.playerId === ball.grabbedBy) || null;

        if (!controllingHand) {
          // Bàn tay mất tracking: thả bóng ra
          this.checkDropIntoBasket(ball, basketPositions);
          ball.grabbedBy = null;
          if (!ball.consumedBy) {
            ball.releasedTimer = 500;
            ball.vx = 0;
            ball.vy = 0;
          }
        } else if (!controllingHand.isPinching) {
          // Người chơi mở tay thả bóng ra:
          this.checkDropIntoBasket(ball, basketPositions);
          ball.grabbedBy = null;
          if (!ball.consumedBy) {
            // Không trúng giỏ: Dừng 0.5s chờ người chơi chạm lại
            ball.releasedTimer = 500;
            ball.vx = 0;
            ball.vy = 0;
          }
        } else {
          // Bàn tay vẫn đang chụm giữ và di chuyển bóng
          ball.x += (controllingHand.x - ball.x) * 0.45;
          ball.y += (controllingHand.y - ball.y) * 0.45;
          ball.vx = 0;
          ball.vy = 0;
          ball.releasedTimer = 0;

          // Hiệu ứng trail vệt sáng
          ball.trail.push({ x: ball.x, y: ball.y });
          if (ball.trail.length > 8) ball.trail.shift();
        }
      }
    }

    // =========================================================================
    // BƯỚC 2: TẬP HỢP CÁC BÀN TAY ĐANG BẬN GIỮ BÓNG (CHỈ GẮP 1 CẢM XÚC DUY NHẤT)
    // =========================================================================
    const occupiedHandIds = new Set<number>();
    for (const ball of this.balls) {
      if (!ball.dead && !ball.consumedBy && ball.grabbedBy !== null) {
        occupiedHandIds.add(ball.grabbedBy);
      }
    }

    // =========================================================================
    // BƯỚC 3: CÁC BÀN TAY ĐANG CHỤM VÀ RẢNH RỖI SẼ BỐC QUẢ BÓNG GẦN NHẤT
    // =========================================================================
    for (const hand of this.hands) {
      // Bàn tay đang bận giữ bóng KHÔNG ĐƯỢC bốc thêm bất kỳ quả bóng nào khác!
      if (hand.isPinching && !occupiedHandIds.has(hand.playerId)) {
        let closestBall: Ball | null = null;
        let minDistance = Infinity;

        for (const ball of this.balls) {
          if (ball.dead || ball.consumedBy || ball.grabbedBy !== null) continue;

          const d = Math.hypot(hand.x - ball.x, hand.y - ball.y);
          if (d < ball.r * 1.55 && d < minDistance) {
            minDistance = d;
            closestBall = ball;
          }
        }

        if (closestBall) {
          // Chỉ bốc 1 quả bóng gần nhất duy nhất và khóa bàn tay này lại ngay
          closestBall.grabbedBy = hand.playerId;
          closestBall.releasedTimer = 0;
          occupiedHandIds.add(hand.playerId);
          audio.playGrab();
        }
      }
    }

    // =========================================================================
    // BƯỚC 4: CẬP NHẬT VẬT LÝ VÀ HIỆU ỨNG CHO CÁC BÓNG TỰ DO
    // =========================================================================
    for (const ball of this.balls) {
      if (ball.dead || ball.consumedBy) continue;

      if (ball.grabbedBy === null) {
        // Cập nhật hiệu ứng vòng tròn nhắm khi bàn tay lại gần
        let isNearHand = false;
        for (const hand of this.hands) {
          const d = Math.hypot(hand.x - ball.x, hand.y - ball.y);
          if (d < ball.r * 1.55) {
            isNearHand = true;
            ball.reach = Math.min(1, ball.reach + dt / 120);
          }
        }
        if (!isNearHand) {
          ball.reach = Math.max(0, ball.reach - dt / 150);
        }

        // Xử lý đếm ngược 0.5s sau khi thả ra ngoài giỏ
        if (ball.releasedTimer > 0) {
          ball.releasedTimer -= dt;
          if (ball.releasedTimer <= 0) {
            ball.releasedTimer = 0;
            // Hết 0.5s không ai chạm: Tiếp tục rơi xuống!
            const isRound1 = this.state.round === 1;
            const fallbackSpeed = isRound1 ? 0.036 : 0.088;
            ball.vy = ball.baseVy > 0 ? ball.baseVy : fallbackSpeed;
            ball.vx = (Math.random() - 0.5) * (isRound1 ? 0.015 : 0.028);
          }
        } else {
          // Kiểm tra an toàn: nếu vy <= 0 và không ai giữ, khôi phục tốc độ rơi
          if (ball.vy <= 0) {
            const isRound1 = this.state.round === 1;
            const fallbackSpeed = isRound1 ? 0.036 : 0.088;
            ball.vy = ball.baseVy > 0 ? ball.baseVy : fallbackSpeed;
          }
        }

        // Trọng lực kéo xuống nếu có vận tốc hướng lên
        if (ball.vy < 0) {
          ball.vy += 0.0006 * dt;
        }

        // Rơi tự nhiên theo vật lý
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // Va đập vào 2 bên mép màn hình
        if (ball.x - ball.r < 8) {
          ball.x = ball.r + 8;
          ball.vx = Math.abs(ball.vx);
        } else if (ball.x + ball.r > this.width - 8) {
          ball.x = this.width - 8 - ball.r;
          ball.vx = -Math.abs(ball.vx);
        }

        // Chạm đáy màn hình mà không được người chơi bốc thả vào giỏ:
        // Tự trôi qua an toàn, KHÔNG tính điểm và KHÔNG trừ điểm!
        if (ball.y > this.height + ball.r * 0.5) {
          ball.dead = true;
        }
      }
    }

    this.balls = this.balls.filter((b) => !b.dead);
  }

  private checkDropIntoBasket(
    ball: Ball,
    baskets: Record<BasketType, { cx: number; cy: number; w: number; h: number }>
  ) {
    let nearestBasketType: BasketType | null = null;
    let minDistance = Infinity;

    for (const [typeStr, b] of Object.entries(baskets)) {
      const type = typeStr as BasketType;
      const d = Math.hypot(ball.x - b.cx, ball.y - b.cy);
      // Responsive catch zone around the racket
      const catchRadius = Math.max(b.w * 0.68, b.h * 0.68);
      if (d < catchRadius && d < minDistance) {
        minDistance = d;
        nearestBasketType = type;
      }
    }

    if (nearestBasketType) {
      // 1. Check if NOISE (hot-face or dizzy-face)
      if (ball.emotion.isNoise) {
        this.handleNoiseDrop(ball, nearestBasketType, baskets[nearestBasketType]);
      }
      // 2. Check if MATCHING CORE BASKET
      else if (ball.emotion.category === nearestBasketType) {
        this.handleCorrectSort(ball, nearestBasketType, baskets[nearestBasketType]);
      }
      // 3. Check if WRONG CORE BASKET
      else {
        this.handleWrongSort(ball, nearestBasketType, baskets[nearestBasketType]);
      }
    }
  }

  private handleCorrectSort(
    ball: Ball,
    basketType: BasketType,
    basket: { cx: number; cy: number; w: number; h: number }
  ) {
    ball.consumedBy = basketType;
    ball.consumedProgress = 0;

    this.state.correctCount += 1;
    if (this.state.round === 1) {
      this.state.round1Correct += 1;
    } else {
      this.state.round2Correct += 1;
    }
    this.state.correctCount = this.state.round1Correct + this.state.round2Correct;

    this.state.streak += 1;
    this.state.bestStreak = Math.max(this.state.bestStreak, this.state.streak);
    this.state.multiplier = Math.min(5, 1 + Math.floor(this.state.streak / 3));

    const addedScore = 100 * this.state.multiplier;
    this.state.score += addedScore;

    if (basketType === 'sad') this.state.sadCount += 1;
    else if (basketType === 'happy') this.state.happyCount += 1;
    else if (basketType === 'angry') this.state.angryCount += 1;

    this.successPulse = 1;
    audio.playSuccess();

    const basketInfo = BASKETS[basketType];
    this.spawnBurst(
      basket.cx,
      basket.cy - basket.h * 0.32,
      basketInfo.color,
      `+${addedScore} ĐÚNG! ${basketInfo.title}`
    );

    this.shockwaves.push({
      x: basket.cx,
      y: basket.cy,
      r: 18,
      color: basketInfo.color,
      age: 0,
      life: 420,
    });

    const currentCount = this.state.round === 1 ? this.state.round1Correct : this.state.round2Correct;
    this.state.eventText = `CHÍNH XÁC! +${addedScore} (Vòng ${this.state.round}: ${currentCount}/10)`;
    this.onStateChange({ ...this.state });

    // ROUND 1 CLEAR: Đạt đủ 10 cảm xúc đúng ở Vòng 1 -> Chuyển sang Vòng 2
    if (this.state.round === 1 && this.state.round1Correct >= 10) {
      this.startRoundTransition(true);
    } else if (this.state.round === 2 && this.state.round2Correct >= 10) {
      // WIN CONDITION: Đạt đủ 10 cảm xúc đúng ở Vòng 2 -> Chiến thắng tuyệt đối!
      this.winGame();
    }
  }

  private handleWrongSort(
    ball: Ball,
    attemptedBasket: BasketType,
    basket: { cx: number; cy: number; w: number; h: number }
  ) {
    this.state.wrongCount += 1;
    this.state.streak = 0;
    this.state.multiplier = 1;

    // Bốc sai sẽ trừ 100 điểm
    this.state.score = Math.max(0, this.state.score - 100);

    this.shake = 16;
    audio.playError();

    const correctName = BASKETS[ball.emotion.category as BasketType]?.title || 'KHÁC';
    const attemptedName = BASKETS[attemptedBasket].title;

    this.spawnBurst(
      basket.cx,
      basket.cy - basket.h * 0.32,
      '#EF4444',
      `-100 SAI! ${correctName}`
    );

    // Ball bounces away upward and fades
    ball.vy = -0.19;
    ball.vx = (ball.x < basket.cx ? -1 : 1) * 0.12;

    this.state.eventText = `BỐC SAI GIỎ! -100 ĐIỂM! ${ball.emotion.label} là ${correctName}, không phải ${attemptedName}!`;
    this.onStateChange({ ...this.state });
  }

  private handleNoiseDrop(
    ball: Ball,
    attemptedBasket: BasketType,
    basket: { cx: number; cy: number; w: number; h: number }
  ) {
    this.state.wrongCount += 1;
    this.state.streak = 0;
    this.state.multiplier = 1;

    // Bốc sai ảnh nhiễu sẽ trừ 100 điểm
    this.state.score = Math.max(0, this.state.score - 100);

    this.shake = 22;
    audio.playError();

    const attemptedName = BASKETS[attemptedBasket].title;

    this.spawnBurst(
      basket.cx,
      basket.cy - basket.h * 0.35,
      '#EC4899',
      `-100 ẢNH NHIỄU!`
    );

    // Ball bounces away upward with strong impulse
    ball.vy = -0.22;
    ball.vx = (ball.x < basket.cx ? -1 : 1) * 0.15;

    this.state.eventText = `ẢNH NHIỄU! -100 ĐIỂM! Mở tay để nó tự rơi qua, không hợp rổ ${attemptedName}!`;
    this.onStateChange({ ...this.state });
  }

  private winGame() {
    this.state.isGameOver = true;
    this.state.isWin = true;
    this.state.eventText = 'CHIẾN THẮNG! ĐÃ HOÀN THÀNH XUẤT SẮC CẢ 2 VÒNG CHƠI!';
    audio.playCheer();

    for (let i = 0; i < 90; i++) {
      this.confettiList.push({
        x: Math.random() * this.width,
        y: -10 - Math.random() * 80,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 3 + 2,
        size: Math.random() * 8 + 6,
        color: ['#00D89A', '#4C6DF0', '#F4BE4F', '#32C8E6', '#EC4899'][Math.floor(Math.random() * 5)],
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.15,
      });
    }

    this.onStateChange({ ...this.state });
  }

  private endGame() {
    this.state.isGameOver = true;
    this.state.isWin = this.state.correctCount >= this.state.targetCount;
    this.state.eventText = this.state.isWin ? 'CHIẾN THẮNG CHECK-IN!' : 'HẾT THỜI GIAN 30S!';
    if (this.state.isWin) {
      audio.playCheer();
    } else {
      audio.playChime();
    }
    this.onStateChange({ ...this.state });
  }

  private spawnBurst(x: number, y: number, color: string, text: string) {
    const shards = [];
    for (let i = 0; i < 12; i++) {
      shards.push({
        a: (i / 12) * Math.PI * 2 + Math.random() * 0.2,
        v: Math.random() * 0.7 + 0.5,
      });
    }
    this.bursts.push({
      x,
      y,
      color,
      text,
      age: 0,
      life: 850,
      shards,
    });
  }

  private updateBursts(dt: number) {
    this.bursts.forEach((b) => (b.age += dt));
    this.bursts = this.bursts.filter((b) => b.age < b.life);

    this.shockwaves.forEach((sw) => {
      sw.age += dt;
      sw.r += dt * 0.18;
    });
    this.shockwaves = this.shockwaves.filter((sw) => sw.age < sw.life);
  }

  private updateConfetti(dt: number) {
    this.confettiList.forEach((c) => {
      c.x += c.vx;
      c.y += c.vy;
      c.rot += c.vRot;
      if (c.y > this.height + 20) {
        c.y = -10;
        c.x = Math.random() * this.width;
      }
    });
  }

  getBasketBounds(): Record<BasketType, { cx: number; cy: number; w: number; h: number }> {
    const w = this.width;
    const h = this.height;
    const isPortrait = h > w;

    // Mobile-first sizing
    const basketW = isPortrait
      ? Math.min(115, Math.max(76, w * 0.28))
      : Math.min(180, Math.max(105, w * 0.21));
    const basketH = basketW * 1.05;
    const bottomOffset = isPortrait ? basketH * 0.58 : basketH * 0.52;
    const cy = h - bottomOffset;

    return {
      sad: { cx: w * BASKETS.sad.xPercent, cy, w: basketW, h: basketH },
      happy: { cx: w * BASKETS.happy.xPercent, cy, w: basketW, h: basketH },
      angry: { cx: w * BASKETS.angry.xPercent, cy, w: basketW, h: basketH },
    };
  }

  // ---------------------------------------------------------------------------
  // DRAWING
  // ---------------------------------------------------------------------------
  draw(ctx: CanvasRenderingContext2D) {
    const { width: w, height: h } = this;

    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake *= 0.88;
    }

    // Semi-transparent backdrop for AR video passthrough
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.65, 30, w * 0.5, h * 0.5, Math.max(w, h));
    grad.addColorStop(0, 'rgba(5, 10, 28, 0.42)');
    grad.addColorStop(1, 'rgba(13, 24, 54, 0.68)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    this.drawBgParticles(ctx);
    this.drawAmbientGrid(ctx);
    this.drawBaskets(ctx);
    this.drawShockwaves(ctx);
    this.drawBalls(ctx);
    this.drawHands(ctx);
    this.drawBursts(ctx);
    this.drawConfetti(ctx);
    this.drawPhaseOverlay(ctx);

    ctx.restore();
  }

  private drawBgParticles(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.bgParticles) {
      p.y += p.vy;
      if (p.y < 0) p.y = this.height;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawAmbientGrid(ctx: CanvasRenderingContext2D) {
    const spacing = Math.max(38, Math.min(56, this.width * 0.08));
    ctx.save();
    ctx.fillStyle = 'rgba(125, 139, 184, 0.07)';
    for (let y = 0; y < this.height; y += spacing) {
      for (let x = 0; x < this.width; x += spacing) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }
    ctx.restore();
  }

  private drawBaskets(ctx: CanvasRenderingContext2D) {
    const bounds = this.getBasketBounds();
    const pulse = (Math.sin(this.elapsedMs / 320) + 1) / 2;
    const isSmall = this.width < 500;

    for (const [typeStr, b] of Object.entries(bounds)) {
      const type = typeStr as BasketType;
      const def = BASKETS[type];
      const img = this.basketImages[type];

      ctx.save();

      // Holographic glowing ground pool
      const aura = ctx.createRadialGradient(b.cx, b.cy + b.h * 0.25, 0, b.cx, b.cy + b.h * 0.25, b.w * 0.75);
      aura.addColorStop(0, def.glowColor);
      aura.addColorStop(0.6, 'rgba(5, 10, 28, 0.25)');
      aura.addColorStop(1, 'rgba(5, 10, 28, 0)');
      ctx.fillStyle = aura;
      ctx.fillRect(b.cx - b.w, b.cy - b.h * 0.5, b.w * 2, b.h * 1.5);

      // Light beam pointing up
      const beam = ctx.createLinearGradient(0, b.cy - b.h * 0.75, 0, b.cy + b.h * 0.35);
      beam.addColorStop(0, 'rgba(255, 255, 255, 0)');
      beam.addColorStop(0.7, def.glowColor);
      beam.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(b.cx - b.w * 0.3, b.cy - b.h * 0.55);
      ctx.lineTo(b.cx + b.w * 0.3, b.cy - b.h * 0.55);
      ctx.lineTo(b.cx + b.w * 0.44, b.cy + b.h * 0.28);
      ctx.lineTo(b.cx - b.w * 0.44, b.cy + b.h * 0.28);
      ctx.closePath();
      ctx.fill();

      // Draw Racket Image
      if (img.complete && img.naturalWidth > 0) {
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 16 + pulse * 12;
        ctx.drawImage(img, b.cx - b.w * 0.46, b.cy - b.h * 0.52, b.w * 0.92, b.h * 0.92);
        ctx.shadowBlur = 0;
      }

      // Basket Hologram Base Ring
      ctx.beginPath();
      ctx.ellipse(b.cx, b.cy + b.h * 0.38, b.w * 0.46, b.h * 0.15, 0, 0, Math.PI * 2);
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Basket Name Tag Pill (responsive size for mobile)
      const pillW = Math.max(68, b.w * 0.76);
      const pillH = isSmall ? 26 : 32;
      const pillY = b.cy + b.h * 0.28;

      ctx.fillStyle = 'rgba(5, 10, 28, 0.92)';
      ctx.beginPath();
      ctx.roundRect(b.cx - pillW / 2, pillY, pillW, pillH, 10);
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = def.color;
      const titleFontSize = isSmall ? 12 : 14;
      ctx.font = `900 ${titleFontSize}px ${FONT}`;
      ctx.fillText(def.title, b.cx, pillY + pillH * 0.48);

      // Emotion Count sorted in this basket
      let count = 0;
      if (type === 'sad') count = this.state.sadCount;
      else if (type === 'happy') count = this.state.happyCount;
      else if (type === 'angry') count = this.state.angryCount;

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 ${isSmall ? 11 : 12}px ${MONO}`;
      ctx.fillText(`+${count}`, b.cx, pillY - (isSmall ? 10 : 13));

      ctx.restore();
    }
  }

  private drawBalls(ctx: CanvasRenderingContext2D) {
    for (const ball of this.balls) {
      if (ball.dead) continue;
      const held = ball.grabbedBy !== null;
      const isNoise = ball.emotion.isNoise;
      const accent = ball.emotion.color;

      // Motion Trail khi được kéo
      if (held && ball.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.lineCap = 'round';
        ball.trail.forEach((pt, i) => {
          if (i === 0) return;
          const prev = ball.trail[i - 1];
          ctx.globalAlpha = (i / ball.trail.length) * 0.45;
          ctx.lineWidth = (i / ball.trail.length) * ball.r * 0.55;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
        });
        ctx.restore();
      }

      ctx.save();
      ctx.translate(ball.x, ball.y);

      // Targeting guide ring khi bàn tay tới gần
      if (ball.reach > 0.05 && !held) {
        ctx.save();
        ctx.globalAlpha = ball.reach * 0.9;
        ctx.strokeStyle = isNoise ? '#EC4899' : accent;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 7]);
        ctx.lineDashOffset = -this.elapsedMs / 25;
        ctx.beginPath();
        ctx.arc(0, 0, ball.r * 1.05, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Vòng tròn báo hiệu 0.5s chờ sau khi thả mà chưa vào giỏ
      if (ball.releasedTimer > 0 && !held) {
        ctx.save();
        const progress = Math.max(0, ball.releasedTimer / 500);
        ctx.globalAlpha = 0.75 * progress;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = this.elapsedMs / 20;
        ctx.beginPath();
        ctx.arc(0, 0, ball.r * (1 + 0.12 * (1 - progress)), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // AR HAND RENDERING (Theo chuẩn game AR gắp nhiệm vụ giao AI: 2 đầu ngón tay & tâm gắp)
  // ---------------------------------------------------------------------------
  private drawHands(ctx: CanvasRenderingContext2D) {
    this.hands.forEach((hand) => {
      const on = hand.isPinching;
      const color = on ? PALETTE.mint : 'rgba(238,242,255,0.72)';

      ctx.save();
      ctx.lineCap = 'round';

      ctx.strokeStyle = color;
      ctx.lineWidth = on ? 4.5 : 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = on ? 16 : 6;
      ctx.beginPath();
      ctx.moveTo(hand.ix, hand.iy);
      ctx.lineTo(hand.tx, hand.ty);
      ctx.stroke();

      [[hand.ix, hand.iy], [hand.tx, hand.ty]].forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, on ? 10 : 7.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });

      ctx.beginPath();
      ctx.arc(hand.x, hand.y, on ? 16 : 28, 0, Math.PI * 2);
      ctx.strokeStyle = on ? PALETTE.mint : 'rgba(238,242,255,0.32)';
      ctx.lineWidth = 2.5;
      if (!on) ctx.setLineDash([6, 8]);
      ctx.stroke();
      ctx.restore();
    });
  }

  private drawBursts(ctx: CanvasRenderingContext2D) {
    const isSmall = this.width < 500;

    for (const b of this.bursts) {
      const t = b.age / b.life;
      const ease = 1 - Math.pow(1 - t, 3);

      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.translate(b.x, b.y - ease * 42);

      // Shards
      ctx.strokeStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2.5 * (1 - t);
      ctx.lineCap = 'round';

      b.shards.forEach((s) => {
        const inner = 22 + ease * 42 * s.v;
        const outer = inner + 13 * (1 - t);
        ctx.beginPath();
        ctx.moveTo(Math.cos(s.a) * inner, Math.sin(s.a) * inner);
        ctx.lineTo(Math.cos(s.a) * outer, Math.sin(s.a) * outer);
        ctx.stroke();
      });

      // Burst Floating Text (clamped for small mobile screens)
      ctx.fillStyle = b.color;
      const burstFontSize = isSmall ? 14 : 17;
      ctx.font = `900 ${burstFontSize}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 12;
      ctx.fillText(b.text, 0, -30);

      ctx.restore();
    }
  }

  private drawShockwaves(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const sw of this.shockwaves) {
      const p = sw.age / sw.life;
      ctx.globalAlpha = (1 - p) * 0.7;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3 * (1 - p);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawConfetti(ctx: CanvasRenderingContext2D) {
    if (this.confettiList.length === 0) return;
    ctx.save();
    for (const c of this.confettiList) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
      ctx.restore();
    }
    ctx.restore();
  }

  private drawPhaseOverlay(ctx: CanvasRenderingContext2D) {
    // 3..2..1 Countdown
    if (this.state.countdown > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(5, 10, 28, 0.78)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PALETTE.gold;
      ctx.shadowColor = PALETTE.gold;
      ctx.shadowBlur = 36;
      ctx.font = `900 ${Math.min(140, this.width * 0.2)}px ${MONO}`;
      ctx.fillText(String(this.state.countdown), this.width / 2, this.height / 2 - 20);

      ctx.shadowBlur = 0;
      ctx.fillStyle = PALETTE.white;
      const subtitleSize = Math.max(14, Math.min(20, this.width * 0.04));
      ctx.font = `900 ${subtitleSize}px ${FONT}`;
      ctx.fillText('CHECK-IN CẢM XÚC: SẴN SÀNG!', this.width / 2, this.height / 2 + 75);
      ctx.restore();
      return;
    }

    // ROUND TRANSITION OVERLAY (Chuyển sang Vòng 2)
    if (this.state.isRoundTransition) {
      ctx.save();
      ctx.fillStyle = 'rgba(5, 10, 28, 0.86)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Badge: HOÀN THÀNH VÒNG 1
      ctx.fillStyle = PALETTE.mint;
      ctx.shadowColor = PALETTE.mint;
      ctx.shadowBlur = 24;
      const titleSize = Math.max(14, Math.min(22, this.width * 0.045));
      ctx.font = `900 ${titleSize}px ${FONT}`;
      ctx.fillText('✓ HOÀN THÀNH VÒNG 1 (KHỞI ĐỘNG)', this.width / 2, this.height / 2 - 80);

      // Main Heading: VÒNG 2: TĂNG TỐC!
      ctx.fillStyle = '#FF6A3D';
      ctx.shadowColor = '#FF6A3D';
      ctx.shadowBlur = 32;
      const mainSize = Math.max(24, Math.min(42, this.width * 0.075));
      ctx.font = `900 ${mainSize}px ${FONT}`;
      ctx.fillText('🔥 VÒNG 2: TĂNG TỐC! 🔥', this.width / 2, this.height / 2 - 25);

      // Subtitle: Rơi nhiều hơn và nhanh hơn!
      ctx.shadowBlur = 0;
      ctx.fillStyle = PALETTE.white;
      const descSize = Math.max(12, Math.min(17, this.width * 0.032));
      ctx.font = `700 ${descSize}px ${FONT}`;
      ctx.fillText('Cảm xúc sẽ rơi NHIỀU HƠN & NHANH HƠN!', this.width / 2, this.height / 2 + 25);

      // Countdown number
      ctx.fillStyle = PALETTE.gold;
      ctx.shadowColor = PALETTE.gold;
      ctx.shadowBlur = 28;
      const countSize = Math.max(48, Math.min(68, this.width * 0.1));
      ctx.font = `900 ${countSize}px ${MONO}`;
      ctx.fillText(String(this.state.transitionCountdown), this.width / 2, this.height / 2 + 80);

      ctx.restore();
      return;
    }

    // Top Header Event Pill (responsive for mobile-first)
    const bannerW = Math.min(this.width - 24, 460);
    const bannerH = 34;

    ctx.save();
    ctx.fillStyle = 'rgba(5, 10, 28, 0.8)';
    ctx.beginPath();
    ctx.roundRect(this.width / 2 - bannerW / 2, 12, bannerW, bannerH, 10);
    ctx.fill();
    ctx.strokeStyle = this.state.phase === 'FINAL' ? PALETTE.angry : PALETTE.brand;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.state.phase === 'FINAL' ? PALETTE.angry : PALETTE.gold;
    const bannerFontSize = Math.max(10, Math.min(13, bannerW * 0.032));
    ctx.font = `900 ${bannerFontSize}px ${FONT}`;
    ctx.fillText(this.state.eventText, this.width / 2, 12 + bannerH / 2);
    ctx.restore();
  }
}
