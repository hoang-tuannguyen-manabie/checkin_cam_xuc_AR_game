import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { ALL_EMOTIONS } from '../data/emotions';
import { Ball, GameEngine, GameState, HandInput, LandmarkPoint } from '../utils/engine';
import { audio } from '../utils/audio';

const MAX_CANVAS_PIXEL_RATIO = 1.5;
const MAX_FRAME_DELTA_MS = 50;
const MAX_PHYSICS_STEP_MS = 1000 / 120;
const UI_STATE_PUBLISH_INTERVAL_MS = 75;
const PINCH_DISTANCE = 85;
const MAX_HANDS = 2;

interface GameProps {
  onGameOver: (state: GameState) => void;
  onStateUpdate: (state: GameState) => void;
  demoMode: boolean;
}

export function Game({ onGameOver, onStateUpdate, demoMode }: GameProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gifOverlayRef = useRef<HTMLDivElement>(null);
  const domItemsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const requestRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastHandDetectMsRef = useRef<number>(0);
  const cachedInputsRef = useRef<HandInput[]>([]);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const pixelRatioRef = useRef(1);
  const mouseRef = useRef({ x: 0, y: 0, down: false, inside: false });
  const finishedRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const onGameOverRef = useRef(onGameOver);
  const onStateUpdateRef = useRef(onStateUpdate);

  onGameOverRef.current = onGameOver;
  onStateUpdateRef.current = onStateUpdate;

  const [isLoading, setIsLoading] = useState(!demoMode);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Hàm dừng và giải phóng AR Camera triệt để (tắt phần cứng camera, WebGL, MediaPipe)
  const stopCamera = useCallback(() => {
    // 1. Dừng ngay requestAnimationFrame
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = 0;
    }

    // 2. Dừng trực tiếp toàn bộ hardware camera tracks của MediaStream
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (err) {
        console.warn('Lỗi khi tắt MediaStream tracks:', err);
      }
      mediaStreamRef.current = null;
    }

    // 3. Tắt và giải phóng video element
    const video = videoRef.current;
    if (video) {
      try {
        if (video.srcObject) {
          (video.srcObject as MediaStream).getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {
              // ignore
            }
          });
          video.srcObject = null;
        }
        video.pause();
      } catch {
        // ignore
      }
    }

    // 4. Đóng và giải phóng Mediapipe HandLandmarker (giải phóng WebGL/GPU và bộ nhớ WASM)
    if (landmarkerRef.current) {
      try {
        landmarkerRef.current.close();
      } catch (err) {
        console.warn('Lỗi khi giải phóng HandLandmarker:', err);
      }
      landmarkerRef.current = null;
    }

    // 5. Dọn sạch các icon DOM overlay
    domItemsRef.current.forEach((el) => el.remove());
    domItemsRef.current.clear();
  }, []);

  useEffect(() => {
    let active = true;
    let lastPublishedAt = -Infinity;
    let lastPublishedState: GameState | null = null;
    finishedRef.current = false;

    engineRef.current = new GameEngine((state) => {
      const now = performance.now();
      const priorityUpdate =
        !lastPublishedState ||
        state.score !== lastPublishedState.score ||
        state.correctCount !== lastPublishedState.correctCount ||
        state.wrongCount !== lastPublishedState.wrongCount ||
        state.streak !== lastPublishedState.streak ||
        state.phase !== lastPublishedState.phase ||
        state.round !== lastPublishedState.round ||
        state.isRoundTransition !== lastPublishedState.isRoundTransition ||
        state.countdown !== lastPublishedState.countdown ||
        state.isGameOver !== lastPublishedState.isGameOver;

      if (priorityUpdate || now - lastPublishedAt >= UI_STATE_PUBLISH_INTERVAL_MS) {
        lastPublishedAt = now;
        lastPublishedState = state;
        onStateUpdateRef.current(state);
      }
      if (state.isGameOver && !finishedRef.current) {
        finishedRef.current = true;
        // Tắt camera ngay lập tức khi kết thúc trò chơi để máy không bị lag
        stopCamera();
        onGameOverRef.current(state);
      }
    });

    const init = async () => {
      audio.init();
      await document.fonts?.ready?.catch(() => undefined);
      if (!active) return;

      if (demoMode) {
        setIsLoading(false);
        startGameLoop();
        return;
      }

      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
        );
        if (!active || finishedRef.current) return;

        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: MAX_HANDS,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 } },
          audio: false,
        });

        if (!active || finishedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        mediaStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (!active || finishedRef.current) {
              stopCamera();
              return;
            }
            videoRef.current?.play().catch(() => undefined);
            setCameraReady(true);
            setIsLoading(false);
            startGameLoop();
          };
        }
      } catch (err) {
        console.warn('Không mở được camera, chuyển sang chế độ chuột:', err);
        setCameraError('Không mở được camera. Trò chơi đã tự chuyển sang chế độ chuột — gắp thả mượt mà.');
        setIsLoading(false);
        startGameLoop();
      }
    };

    init();

    return () => {
      active = false;
      stopCamera();
    };
  }, [demoMode, stopCamera]);

  const startGameLoop = () => {
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      if (finishedRef.current) return;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const engine = engineRef.current;
      if (!canvas || !container || !engine) return;

      const frameDt = Math.max(0, Math.min(MAX_FRAME_DELTA_MS, currentTime - lastTime));
      lastTime = currentTime;

      const logicalWidth = Math.max(1, container.clientWidth);
      const logicalHeight = Math.max(1, container.clientHeight);
      const pixelRatio = Math.min(MAX_CANVAS_PIXEL_RATIO, Math.max(1, window.devicePixelRatio || 1));
      const targetWidth = Math.max(1, Math.floor(logicalWidth * pixelRatio));
      const targetHeight = Math.max(1, Math.floor(logicalHeight * pixelRatio));

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        pixelRatioRef.current = pixelRatio;
        ctxRef.current = canvas.getContext('2d', {
          alpha: true,
          desynchronized: true,
        } as CanvasRenderingContext2DSettings);
        if (ctxRef.current) {
          ctxRef.current.imageSmoothingEnabled = true;
          ctxRef.current.imageSmoothingQuality = 'high';
        }
        engine.resize(logicalWidth, logicalHeight);
      }

      const ctx =
        ctxRef.current ||
        (canvas.getContext('2d', { alpha: true, desynchronized: true } as CanvasRenderingContext2DSettings));
      if (!ctx) return;
      ctxRef.current = ctx;

      const hands = demoMode || cameraError ? getMouseInputs() : getCameraInputs();
      engine.updateHands(hands);

      let remainingDt = frameDt;
      while (remainingDt > 0) {
        const physicsDt = Math.min(MAX_PHYSICS_STEP_MS, remainingDt);
        engine.update(physicsDt);
        remainingDt -= physicsDt;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(pixelRatioRef.current, 0, 0, pixelRatioRef.current, 0, 0);
      engine.draw(ctx);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Đồng bộ ảnh GIF động nguyên bản ở tầng DOM (+100px, chuyển động 60fps mượt mà)
      syncGifOverlays(engine.getBalls());

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
  };

  const syncGifOverlays = (balls: Ball[]) => {
    const overlay = gifOverlayRef.current;
    if (!overlay) return;
    const itemsMap = domItemsRef.current;
    const activeIds = new Set<number>();

    for (const ball of balls) {
      if (ball.dead) continue;
      activeIds.add(ball.id);

      let itemEl = itemsMap.get(ball.id);
      if (!itemEl) {
        itemEl = document.createElement('div');
        itemEl.className = 'absolute pointer-events-none will-change-transform flex items-center justify-center';
        const img = document.createElement('img');
        img.src = ball.emotion.gifUrl;
        img.alt = ball.emotion.label;
        img.className = 'w-full h-full object-contain pointer-events-none select-none';
        img.draggable = false;
        itemEl.appendChild(img);
        overlay.appendChild(itemEl);
        itemsMap.set(ball.id, itemEl);
      }

      // Đường kính phóng to thêm 100px so với ban đầu
      const size = Math.round(ball.r * 2);
      itemEl.style.width = `${size}px`;
      itemEl.style.height = `${size}px`;

      const isGrabbed = ball.grabbedBy !== null;
      const isHoverWaiting = !isGrabbed && (ball.releasedTimer ?? 0) > 0;
      let transform = `translate3d(${(ball.x - size / 2).toFixed(1)}px, ${(ball.y - size / 2).toFixed(1)}px, 0)`;

      if (ball.consumedBy) {
        const scale = Math.max(0, 1 - ball.consumedProgress);
        transform += ` scale(${scale.toFixed(2)})`;
      } else if (isGrabbed) {
        transform += ` scale(1.08)`;
      } else if (isHoverWaiting) {
        transform += ` scale(1.03)`;
      }

      itemEl.style.transform = transform;
      itemEl.style.filter = isGrabbed
        ? `drop-shadow(0 0 24px ${ball.emotion.color})`
        : isHoverWaiting
        ? `drop-shadow(0 0 18px rgba(255, 255, 255, 0.8))`
        : 'drop-shadow(0 4px 14px rgba(0,0,0,0.55))';
    }

    for (const [id, el] of itemsMap.entries()) {
      if (!activeIds.has(id)) {
        el.remove();
        itemsMap.delete(id);
      }
    }
  };

  const getCameraInputs = (): HandInput[] => {
    if (finishedRef.current) return [];
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    const container = containerRef.current;
    if (!video || !landmarker || !container || video.readyState < 2) return cachedInputsRef.current;

    const now = performance.now();
    if (now - lastHandDetectMsRef.current < 25) return cachedInputsRef.current;
    if (lastVideoTimeRef.current === video.currentTime) return cachedInputsRef.current;

    lastVideoTimeRef.current = video.currentTime;
    lastHandDetectMsRef.current = now;

    let results: HandLandmarkerResult | null = null;
    try {
      results = landmarker.detectForVideo(video, now);
    } catch {
      return cachedInputsRef.current;
    }

    if (!results?.landmarks?.length) {
      cachedInputsRef.current = [];
      return cachedInputsRef.current;
    }

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const inputs: HandInput[] = [];

    results.landmarks.forEach((landmarks, index) => {
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];
      // Ảnh camera bị lật gương nên phải đảo trục x
      const ix = (1 - indexTip.x) * cw;
      const iy = indexTip.y * ch;
      const tx = (1 - thumbTip.x) * cw;
      const ty = thumbTip.y * ch;
      const dist = Math.hypot(ix - tx, iy - ty);

      inputs.push({
        x: (ix + tx) / 2,
        y: (iy + ty) / 2,
        ix,
        iy,
        tx,
        ty,
        isPinching: dist < PINCH_DISTANCE,
        handedness: results?.handednesses[index]?.[0]?.categoryName || 'Unknown',
        playerId: index,
      });
    });

    cachedInputsRef.current = inputs;
    return cachedInputsRef.current;
  };

  const getMouseInputs = (): HandInput[] => {
    const mouse = mouseRef.current;
    if (!mouse.inside) return [];
    return [
      {
        x: mouse.x,
        y: mouse.y,
        ix: mouse.x - (mouse.down ? 8 : 28),
        iy: mouse.y - (mouse.down ? 6 : 18),
        tx: mouse.x + (mouse.down ? 8 : 28),
        ty: mouse.y + (mouse.down ? 6 : 18),
        isPinching: mouse.down,
        handedness: 'Right',
        playerId: 0,
      },
    ];
  };

  const updateMouse = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseRef.current.x = event.clientX - rect.left;
    mouseRef.current.y = event.clientY - rect.top;
    mouseRef.current.inside = true;
  };

  const usingMouse = demoMode || Boolean(cameraError);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none touch-none bg-[#050A1C]"
      onPointerDown={(e) => {
        updateMouse(e);
        mouseRef.current.down = true;
      }}
      onPointerUp={() => {
        mouseRef.current.down = false;
      }}
      onPointerMove={updateMouse}
      onPointerLeave={() => {
        mouseRef.current.inside = false;
        mouseRef.current.down = false;
      }}
    >
      {/* Hidden preloaded GIFs to keep animation frames ticking in Chromium */}
      <div
        className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        {ALL_EMOTIONS.map((item) => (
          <img key={item.id} src={item.gifUrl} alt="" />
        ))}
      </div>

      {/* AR Live Webcam Video - Ẩn hoàn toàn để không hiển thị ảnh camera làm nền theo yêu cầu */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="opacity-0 pointer-events-none absolute inset-0 -z-50"
      />

      {/* Main Canvas with AR Hand Tracker and Gameplay */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />

      {/* Tầng hiển thị icon GIF động nguyên bản phóng to thêm 100px (100% native animation 60fps) */}
      <div
        ref={gifOverlayRef}
        className="absolute inset-0 pointer-events-none overflow-hidden z-15"
      />

      {/* Note hướng dẫn trong game: Chụm tay để bốc • Mở tay để thả */}
      <div className="absolute bottom-2.5 sm:bottom-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-[#050C22]/90 border border-[#00D89A]/50 text-white text-[10px] sm:text-xs font-bold shadow-xl flex items-center gap-2 max-w-[94vw] text-center backdrop-blur-md animate-slide-bottom">
        <span className="text-sm sm:text-base">🖐️</span>
        <span>
          <b className="text-[#00D89A]">CHỤM TAY</b> để bốc • <b className="text-[#FBBF24]">MỞ TAY</b> để thả vào giỏ
        </span>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#050A1C]/90 backdrop-blur-md">
          <div className="w-16 h-16 border-4 border-[#00D89A] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white font-black text-lg">ĐANG KẾT NỐI CAMERA & AR MODEL...</p>
          <span className="text-[#00D89A] text-xs font-bold mt-1">Chuẩn bị nhận diện bàn tay AR</span>
        </div>
      )}

      {/* Notification banner if using mouse */}
      {usingMouse && (
        <div className="absolute top-2.5 sm:top-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1 rounded-full bg-[#0d1836]/90 border border-[#38BDF8]/40 text-[#38BDF8] text-[10px] sm:text-xs font-bold shadow-lg flex items-center gap-1.5 max-w-[92vw] text-center">
          <span>🖱️</span>
          <span>Dự phòng chuột: <b>Nhấp giữ</b> để bốc • <b>Nhả chuột</b> để thả vào giỏ</span>
        </div>
      )}
    </div>
  );
}
