"use client";

import { useEffect, useRef, useState } from "react";
import type { TrainingEngine } from "@/lib/game/engine";
import { ndcDistance } from "@/lib/game/geometry";
import type { RendererCallbacks, TrainingRuntime } from "./runtime";

/**
 * Chế độ dự phòng 2D cho thiết bị/trình duyệt không hỗ trợ WebGL.
 * Dùng đúng engine và cùng quy tắc tính điểm; khác biệt duy nhất là trúng/trượt được xác định bằng
 * khoảng cách trên mặt phẳng màn hình thay vì raycast 3D.
 */
export function Fallback2D({ runtime, callbacks }: { runtime: TrainingRuntime; callbacks: RendererCallbacks }) {
  const engine: TrainingEngine = runtime.engine;
  const stage = useRef<HTMLDivElement>(null);
  const elements = useRef(new Map<number, HTMLDivElement>());
  const [targetIds, setTargetIds] = useState<number[]>(() => engine.getTargets().map((t) => t.id));

  useEffect(() => {
    return engine.subscribe((event) => {
      if (event.type === "spawn") setTargetIds((ids) => [...ids.filter((x) => x !== event.target.id), event.target.id]);
      if (event.type === "expire") setTargetIds((ids) => ids.filter((x) => x !== event.targetId));
      if (event.type === "hit" && engine.getTrackingTarget()?.id !== event.targetId) {
        setTargetIds((ids) => ids.filter((x) => x !== event.targetId));
      }
      if (event.type === "finish") setTargetIds([]);
    });
  }, [engine]);

  // Đồng bộ khung nhìn với kích thước thực của vùng chơi.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      engine.setViewport({ aspect: w / h, fovYDeg: runtime.fovDeg });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [engine, runtime.fovDeg]);

  // Bắn: tìm bia gần tâm ngắm nhất nằm trong bán kính.
  useEffect(() => {
    runtime.fire = () => {
      if (engine.getStatus() !== "running") return;
      const aspect = stage.current ? stage.current.clientWidth / Math.max(1, stage.current.clientHeight) : 16 / 9;
      let best: { id: number; ratio: number } | null = null;
      for (const t of engine.getTargets()) {
        const d = ndcDistance(runtime.aim.x, runtime.aim.y, t.u, t.v, aspect);
        const ratio = d / t.radiusNdc;
        if (ratio <= 1 && (!best || ratio < best.ratio)) best = { id: t.id, ratio };
      }
      engine.shoot(performance.now(), best ? { targetId: best.id, offsetRatio: best.ratio } : null);
    };
    return () => {
      runtime.fire = null;
    };
  }, [engine, runtime]);

  // Vòng lặp khung hình: cập nhật vị trí bia và tính thời gian bám.
  useEffect(() => {
    let raf = 0;
    let ready = false;
    const frame = () => {
      const el = stage.current;
      if (el) {
        const aspect = el.clientWidth / Math.max(1, el.clientHeight);
        let onTarget = false;
        if (engine.mode === "TRACKING") {
          const tracking = engine.getTrackingTarget();
          onTarget = !!tracking && ndcDistance(runtime.aim.x, runtime.aim.y, tracking.u, tracking.v, aspect) <= tracking.radiusNdc;
        }
        engine.tick(performance.now(), onTarget);

        const w = el.clientWidth;
        const h = el.clientHeight;
        for (const [id, node] of elements.current) {
          const view = engine.getTarget(id);
          if (!view) continue;
          const px = view.radiusNdc * (h / 2);
          node.style.left = `${((view.u + 1) / 2) * w}px`;
          node.style.top = `${((1 - view.v) / 2) * h}px`;
          node.style.width = `${px * 2}px`;
          node.style.height = `${px * 2}px`;
        }
        if (!ready) {
          ready = true;
          callbacks.onReady();
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine, runtime, callbacks]);

  return (
    <div
      ref={stage}
      className="absolute inset-0 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(34,211,238,0.18), transparent 60%), linear-gradient(180deg,#060a16 0%,#0b1227 60%,#0d1630 100%)",
      }}
      data-testid="fallback-2d-arena"
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.35) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          transform: "perspective(500px) rotateX(55deg)",
          transformOrigin: "bottom",
        }}
      />
      {targetIds.map((id) => (
        <div
          key={id}
          ref={(node) => {
            if (node) elements.current.set(id, node);
            else elements.current.delete(id);
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-300 bg-cyan-400/20 shadow-[0_0_24px_rgba(103,232,249,0.6)]"
          style={{ left: 0, top: 0, width: 40, height: 40 }}
        >
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </div>
      ))}
    </div>
  );
}
