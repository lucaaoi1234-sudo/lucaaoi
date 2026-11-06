"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Alert, Button, Spinner } from "../ui";
import { Crosshair } from "../Crosshair";
import { useAuth } from "@/lib/client/auth-context";
import { errorMessage } from "@/lib/client/api";
import { SfxPlayer } from "@/lib/client/audio";
import { persistSessionResult, useSettings } from "@/lib/client/data";
import { getWebGLStatus } from "@/lib/client/webgl";
import type { Difficulty, DurationSec, TrainingMode } from "@/lib/game/config";
import { TrainingEngine, type EngineEvent, type EngineSnapshot, type SessionResult } from "@/lib/game/engine";
import { randomSeed } from "@/lib/game/rng";
import { clamp } from "@/lib/game/scoring";
import type { GraphicsQuality, SettingsInput } from "@/lib/validation/schemas";
import { Fallback2D } from "./Fallback2D";
import { HitMarker, Hud, type Popup } from "./Hud";
import { MenuPanel, type SessionConfig } from "./MenuPanel";
import { Summary, type SaveState } from "./Summary";
import type { RendererCallbacks, TrainingRuntime } from "./runtime";

const TrainingScene = dynamic(() => import("./TrainingScene").then((m) => m.TrainingScene), {
  ssr: false,
  loading: () => <Spinner label="Đang tải cảnh 3D…" />,
});

const COUNTDOWN_STEP_MS = 800;
const POPUP_LIFETIME_MS = 750;
const MARKER_LIFETIME_MS = 260;

export interface TrainingPreset {
  mode?: TrainingMode;
  durationSec?: DurationSec;
  difficulty?: Difficulty;
}

type Phase = "menu" | "loading" | "countdown" | "playing" | "paused" | "finished";

interface ActiveSession {
  engine: TrainingEngine;
  runtime: TrainingRuntime;
  renderer: "3d" | "2d";
  unsubscribe: () => void;
}

interface Marker {
  kind: "hit" | "miss";
  version: number;
  x: number;
  y: number;
}

/** Các hành động được gọi từ callback/listener ngoài React. Luôn trỏ tới phiên bản mới nhất. */
interface Actions {
  rendererReady: () => void;
  rendererFatal: (message: string) => void;
  engineEvent: (event: EngineEvent) => void;
  keyDown: (event: KeyboardEvent) => void;
  pointerLockLost: () => void;
}

const subscribeNever = () => () => {};

/**
 * Trang điều phối phòng tập: quản lý vòng đời buổi tập (menu → tải → đếm ngược → chơi ⇄ tạm dừng → kết thúc),
 * khóa con trỏ, phím tắt, HUD, phản hồi trúng/trượt, âm thanh và lưu kết quả.
 * Cảnh 3D (TrainingScene) hoặc chế độ 2D dự phòng chỉ chịu trách nhiệm hiển thị và raycast.
 */
export function TrainingPage({ preset }: { preset: TrainingPreset }) {
  const { user } = useAuth();
  const { settings, status: settingsStatus, error: settingsError } = useSettings();

  const [config, setConfig] = useState<SessionConfig>({
    mode: preset.mode ?? "FLICK",
    durationSec: preset.durationSec ?? 60,
    difficulty: preset.difficulty ?? "NORMAL",
  });
  const [phase, setPhase] = useState<Phase>("menu");
  // Trên server chưa biết WebGL có hỗ trợ hay không (null); phía client đọc kết quả kiểm tra đã cache.
  const webgl = useSyncExternalStore(subscribeNever, getWebGLStatus, () => null);
  const [use2d, setUse2d] = useState(false);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [hud, setHud] = useState<EngineSnapshot | null>(null);
  const [marker, setMarker] = useState<Marker | null>(null);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "saving" });
  const [fatal, setFatal] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const phaseRef = useRef<Phase>("menu");
  const sessionRef = useRef<ActiveSession | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const sfxRef = useRef<SfxPlayer | null>(null);
  const timersRef = useRef<{ countdown?: ReturnType<typeof setInterval>; hud?: ReturnType<typeof setInterval> }>({});
  const popupSeq = useRef(0);
  const pendingLock = useRef(false);
  const settingsRef = useRef<SettingsInput>(settings);
  const userRef = useRef(user);
  const configRef = useRef(config);
  const resultRef = useRef<SessionResult | null>(null);
  const use2dRef = useRef(use2d);
  const webglRef = useRef(webgl);
  const settingsStatusRef = useRef(settingsStatus);

  // Ref cho các hành động (được cập nhật sau mỗi lần render, không ghi ref trong lúc render).
  const actions = useRef<Actions | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
    userRef.current = user;
    configRef.current = config;
    use2dRef.current = use2d;
    webglRef.current = webgl;
    settingsStatusRef.current = settingsStatus;
  });

  const getSfx = (): SfxPlayer => {
    if (!sfxRef.current) sfxRef.current = new SfxPlayer();
    return sfxRef.current;
  };

  /** Vị trí điểm ngắm theo pixel trong vùng chơi (để đặt dấu ngắm và popup). */
  const aimPixels = (): { x: number; y: number } => {
    const s = sessionRef.current;
    const el = stageRef.current;
    if (!s || !el) return { x: 0, y: 0 };
    return {
      x: ((s.runtime.aim.x + 1) / 2) * el.clientWidth,
      y: ((1 - s.runtime.aim.y) / 2) * el.clientHeight,
    };
  };

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const requestLock = () => {
    const el = stageRef.current;
    const s = sessionRef.current;
    if (!el || !s || typeof document === "undefined") return;
    if (document.pointerLockElement === el) {
      s.runtime.locked = true;
      return;
    }
    if (typeof el.requestPointerLock !== "function") return;
    try {
      const maybe = el.requestPointerLock() as unknown;
      if (maybe && typeof (maybe as Promise<void>).catch === "function") {
        (maybe as Promise<void>).catch(() => {
          // Bị từ chối (ví dụ iframe không cho phép): dùng con trỏ hệ thống thay thế.
          if (sessionRef.current) sessionRef.current.runtime.locked = false;
        });
      }
    } catch {
      if (sessionRef.current) sessionRef.current.runtime.locked = false;
    }
  };

  const releaseLock = () => {
    if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
    if (sessionRef.current) sessionRef.current.runtime.locked = false;
  };

  const stopTimers = () => {
    if (timersRef.current.countdown) clearInterval(timersRef.current.countdown);
    if (timersRef.current.hud) clearInterval(timersRef.current.hud);
    timersRef.current = {};
  };

  const disposeSession = () => {
    stopTimers();
    const s = sessionRef.current;
    if (s) {
      s.unsubscribe();
      s.runtime.fire = null;
    }
    sessionRef.current = null;
    setSession(null);
  };

  const pushMarker = (kind: "hit" | "miss") => {
    const p = aimPixels();
    setMarker((m) => ({ kind, version: (m?.version ?? 0) + 1, x: p.x, y: p.y }));
    window.setTimeout(() => {
      setMarker((m) => (m && m.kind === kind ? null : m));
    }, MARKER_LIFETIME_MS);
  };

  const pushPopup = (text: string, tone: Popup["tone"]) => {
    const p = aimPixels();
    const id = ++popupSeq.current;
    setPopups((list) => [...list.slice(-5), { id, text, tone, x: p.x, y: p.y }]);
    window.setTimeout(() => setPopups((list) => list.filter((x) => x.id !== id)), POPUP_LIFETIME_MS);
  };

  const persist = async (res: SessionResult) => {
    setSave({ status: "saving" });
    try {
      const outcome = await persistSessionResult(res, !!userRef.current);
      setSave(outcome.storage === "server" ? { status: "server" } : { status: "local" });
    } catch (e) {
      setSave({ status: "error", message: errorMessage(e) });
    }
  };

  const finishSession = () => {
    const s = sessionRef.current;
    if (!s) return;
    stopTimers();
    releaseLock();
    const res = s.engine.getResult();
    resultRef.current = res;
    setResult(res);
    setHud(s.engine.getSnapshot());
    setPhaseBoth("finished");
    void persist(res);
  };

  const beginPlaying = () => {
    const s = sessionRef.current;
    if (!s) return;
    s.engine.start(performance.now());
    getSfx().playStart();
    setPhaseBoth("playing");
    timersRef.current.hud = setInterval(() => {
      const cur = sessionRef.current;
      if (cur) setHud(cur.engine.getSnapshot());
    }, 100);
  };

  const beginCountdown = () => {
    if (phaseRef.current !== "loading") return;
    setPhaseBoth("countdown");
    let remaining = 3;
    setCountdown(remaining);
    timersRef.current.countdown = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }
      if (timersRef.current.countdown) clearInterval(timersRef.current.countdown);
      timersRef.current.countdown = undefined;
      beginPlaying();
    }, COUNTDOWN_STEP_MS);
  };

  const startSession = () => {
    const currentWebgl = webglRef.current;
    if (settingsStatusRef.current !== "ready" || !currentWebgl) return;
    disposeSession();

    const cfg = configRef.current;
    const current = settingsRef.current;
    const renderer: "3d" | "2d" = currentWebgl.supported && !use2dRef.current ? "3d" : "2d";
    const player = getSfx();
    player.unlock();
    player.setVolume(current.volume);

    const engine = new TrainingEngine({
      mode: cfg.mode,
      difficulty: cfg.difficulty,
      durationSec: cfg.durationSec,
      seed: randomSeed(),
      viewport: { aspect: 16 / 9, fovYDeg: current.fov },
    });
    const quality: GraphicsQuality = renderer === "3d" ? current.graphicsQuality : "LOW";
    const runtime: TrainingRuntime = {
      engine,
      aim: { x: 0, y: 0 },
      locked: false,
      quality,
      fovDeg: current.fov,
      fire: null,
    };
    const unsubscribe = engine.subscribe((event) => actions.current?.engineEvent(event));
    const next: ActiveSession = { engine, runtime, renderer, unsubscribe };
    sessionRef.current = next;
    resultRef.current = null;
    setSession(next);
    setResult(null);
    setSave({ status: "saving" });
    setFatal(null);
    setNotice(null);
    setPopups([]);
    setMarker(null);
    setHud(engine.getSnapshot());
    setCountdown(3);
    setPhaseBoth("loading");
    pendingLock.current = true;
  };

  const pauseSession = () => {
    const s = sessionRef.current;
    if (!s || phaseRef.current !== "playing") return;
    s.engine.pause(performance.now());
    // Nếu hết giờ đúng lúc tạm dừng thì engine đã kết thúc (finish đã được xử lý qua sự kiện).
    if (s.engine.getStatus() !== "paused") return;
    releaseLock();
    setHud(s.engine.getSnapshot());
    setPhaseBoth("paused");
  };

  const resumeSession = () => {
    const s = sessionRef.current;
    if (!s || phaseRef.current !== "paused") return;
    s.engine.resume(performance.now());
    requestLock();
    setPhaseBoth("playing");
  };

  const quitToMenu = (message?: string) => {
    releaseLock();
    disposeSession();
    setPhaseBoth("menu");
    setNotice(message ?? null);
  };

  const onFatal = (message: string) => {
    releaseLock();
    disposeSession();
    setFatal(message);
    setPhaseBoth("menu");
  };

  // Cập nhật các hành động sau mỗi lần render (chỉ ghi ref trong effect).
  useEffect(() => {
    actions.current = {
      rendererReady: () => beginCountdown(),
      rendererFatal: (message) => onFatal(message),
      engineEvent: (event) => {
        switch (event.type) {
          case "hit":
            getSfx().playHit();
            pushMarker("hit");
            pushPopup(event.points > 0 ? `+${event.points}` : "TRÚNG", "hit");
            break;
          case "miss":
            getSfx().playMiss();
            pushMarker("miss");
            if (event.reason === "falseStart") pushPopup("BẮN SỚM", "miss");
            break;
          case "finish":
            finishSession();
            break;
          default:
            break;
        }
      },
      keyDown: (event) => {
        const p = phaseRef.current;
        if (event.key === "Escape") {
          if (p === "playing") {
            event.preventDefault();
            pauseSession();
          } else if (p === "loading" || p === "countdown") {
            quitToMenu();
          }
          return;
        }
        if (event.code === "Space" && (p === "playing" || p === "paused")) {
          event.preventDefault();
          if (p === "playing") pauseSession();
          else resumeSession();
          return;
        }
        if (event.key === "p" || event.key === "P") {
          if (p === "playing") pauseSession();
          else if (p === "paused") resumeSession();
          return;
        }
        if ((event.key === "r" || event.key === "R") && p === "paused") startSession();
      },
      pointerLockLost: () => {
        // Người chơi nhấn Esc (trình duyệt thoát khóa con trỏ) khi đang chơi → tạm dừng.
        if (phaseRef.current === "playing") pauseSession();
      },
    };
  });

  const callbacks = useMemo<RendererCallbacks>(
    () => ({
      onReady: () => actions.current?.rendererReady(),
      onFatal: (message) => actions.current?.rendererFatal(message),
    }),
    [],
  );

  // Gắn/gỡ sự kiện toàn cục và dọn dẹp khi rời trang.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => actions.current?.keyDown(e);
    const onLockChange = () => {
      const el = stageRef.current;
      const s = sessionRef.current;
      const locked = !!el && typeof document !== "undefined" && document.pointerLockElement === el;
      if (s) s.runtime.locked = locked;
      if (!locked) actions.current?.pointerLockLost();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerlockchange", onLockChange);
    const timers = timersRef.current;
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerlockchange", onLockChange);
      if (timers.countdown) clearInterval(timers.countdown);
      if (timers.hud) clearInterval(timers.hud);
      if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
      sessionRef.current?.unsubscribe();
      sessionRef.current = null;
    };
  }, []);

  // Sau khi phiên được gắn vào DOM, yêu cầu khóa con trỏ (vẫn trong thời gian kích hoạt bởi cú click).
  useEffect(() => {
    if (session && pendingLock.current) {
      pendingLock.current = false;
      requestLock();
    }
  }, [session]);

  // Vòng lặp cập nhật vị trí tâm ngắm trên màn hình (không đi qua React state).
  useEffect(() => {
    if (!session) return;
    let raf = 0;
    const frame = () => {
      const s = sessionRef.current;
      const el = stageRef.current;
      const cross = crosshairRef.current;
      if (s && el && cross) {
        const x = ((s.runtime.aim.x + 1) / 2) * el.clientWidth;
        const y = ((1 - s.runtime.aim.y) / 2) * el.clientHeight;
        cross.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [session]);

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = sessionRef.current;
    const el = stageRef.current;
    if (!s || !el) return;
    const rect = el.getBoundingClientRect();
    if (s.runtime.locked) {
      // Con trỏ bị khóa: chuyển động chuột (nhân độ nhạy) điều khiển tâm ngắm.
      const sens = settingsRef.current.sensitivity;
      s.runtime.aim.x = clamp(s.runtime.aim.x + (e.movementX * sens * 2) / rect.width, -1, 1);
      s.runtime.aim.y = clamp(s.runtime.aim.y - (e.movementY * sens * 2) / rect.height, -1, 1);
    } else {
      // Không khóa con trỏ: tâm ngắm bám đúng vị trí con trỏ.
      s.runtime.aim.x = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      s.runtime.aim.y = clamp(-(((e.clientY - rect.top) / rect.height) * 2 - 1), -1, 1);
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const s = sessionRef.current;
    if (!s || phaseRef.current !== "playing" || !s.runtime.fire) return;
    getSfx().playShot();
    s.runtime.fire();
    setHud(s.engine.getSnapshot());
  };

  const canStart = settingsStatus === "ready" && webgl !== null;
  const startLabel = settingsStatus === "loading" || webgl === null ? "Đang chuẩn bị…" : "Bắt đầu buổi tập";
  const webglNotice =
    webgl && !webgl.supported
      ? `Thiết bị không hỗ trợ WebGL${webgl.reason ? ` (${webgl.reason})` : ""}. Phòng tập sẽ chạy ở chế độ 2D dự phòng với cùng quy tắc tính điểm.`
      : null;

  const isStageVisible = session !== null && phase !== "menu" && phase !== "finished";
  const showHud = phase === "playing" || phase === "paused" || phase === "countdown";

  return (
    <div className="space-y-6">
      {phase === "menu" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neon/80">Phòng tập</p>
              <h1 className="neon-text mt-1 text-3xl font-bold text-white sm:text-4xl">Luyện aim 3D</h1>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={use2d}
                onChange={(e) => setUse2d(e.target.checked)}
                className="h-4 w-4 accent-cyan-400"
                disabled={webgl !== null && !webgl.supported}
              />
              Dùng chế độ 2D (nhẹ hơn)
            </label>
          </div>
          {settingsStatus === "error" && (
            <Alert>Không tải được cài đặt ({settingsError}). Đang dùng cài đặt mặc định.</Alert>
          )}
          {notice && <Alert tone="info">{notice}</Alert>}
          {fatal && <Alert>{fatal}</Alert>}
          <MenuPanel
            config={config}
            onChange={setConfig}
            onStart={startSession}
            canStart={canStart}
            startLabel={startLabel}
            webglNotice={webglNotice}
            guestNotice={!user}
            error={null}
          />
        </>
      )}

      {isStageVisible && session && (
        <div className="space-y-3">
          <div
            ref={stageRef}
            onPointerMove={onPointerMove}
            onPointerDown={onPointerDown}
            className="glass relative w-full select-none overflow-hidden rounded-2xl"
            style={{
              height: "min(78vh, 56.25vw)",
              minHeight: 320,
              cursor: phase === "playing" ? "none" : "default",
              touchAction: "none",
            }}
            data-testid="training-stage"
            data-renderer={session.renderer}
            data-phase={phase}
          >
            {session.renderer === "3d" ? (
              <TrainingScene runtime={session.runtime} callbacks={callbacks} />
            ) : (
              <Fallback2D runtime={session.runtime} callbacks={callbacks} />
            )}

            {showHud && hud && (
              <Hud snap={hud} mode={session.engine.mode} difficulty={session.engine.difficulty} onPause={pauseSession} />
            )}

            {(phase === "playing" || phase === "countdown") && (
              <div ref={crosshairRef} className="pointer-events-none absolute left-0 top-0 will-change-transform" aria-hidden="true">
                <div className="-translate-x-1/2 -translate-y-1/2">
                  <Crosshair size={settings.crosshairSize} color={settings.crosshairColor} />
                </div>
              </div>
            )}

            {marker && (
              <div className="pointer-events-none absolute" style={{ left: marker.x, top: marker.y }}>
                <div className="-translate-x-1/2 -translate-y-1/2">
                  <HitMarker kind={marker.kind} version={marker.version} />
                </div>
              </div>
            )}

            {popups.map((p) => (
              <div key={p.id} className="pointer-events-none absolute animate-popup" style={{ left: p.x, top: p.y - 26 }}>
                <span
                  className={`-translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${
                    p.tone === "hit" ? "text-white drop-shadow-[0_0_6px_rgba(103,232,249,0.9)]" : "text-rose-300"
                  }`}
                >
                  {p.text}
                </span>
              </div>
            ))}

            {phase === "loading" && (
              <Overlay>
                <Spinner label="Đang khởi tạo phòng tập…" />
              </Overlay>
            )}

            {phase === "countdown" && (
              <Overlay>
                <p key={countdown} className="animate-popup text-7xl font-black text-white drop-shadow-[0_0_20px_rgba(34,211,238,0.9)]">
                  {countdown}
                </p>
              </Overlay>
            )}

            {phase === "paused" && (
              <Overlay>
                <div className="glass w-full max-w-sm p-6 text-center">
                  <p className="text-xs uppercase tracking-[0.3em] text-neon/80">Đang tạm dừng</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Tạm dừng</h2>
                  <p className="mt-2 text-sm text-slate-400">Thời gian đã dừng lại. Nhấn Esc, P hoặc Space để tiếp tục.</p>
                  <div className="mt-5 grid gap-2">
                    <Button variant="primary" onClick={resumeSession}>
                      ▶ Tiếp tục
                    </Button>
                    <Button onClick={startSession}>↻ Chơi lại</Button>
                    <Button variant="danger" onClick={() => quitToMenu("Buổi tập đã hủy và không được lưu.")}>
                      Thoát về menu
                    </Button>
                  </div>
                </div>
              </Overlay>
            )}
          </div>
          {phase === "playing" && (
            <p className="text-center text-xs text-slate-500">Chuột: ngắm · Chuột trái: bắn · Esc / P: tạm dừng</p>
          )}
        </div>
      )}

      {phase === "finished" && result && (
        <Summary
          result={result}
          save={save}
          onRetry={() => {
            if (resultRef.current) void persist(resultRef.current);
          }}
          onReplay={startSession}
          onMenu={() => quitToMenu()}
        />
      )}
    </div>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">{children}</div>
  );
}
