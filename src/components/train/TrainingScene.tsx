"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box3, Color, Fog, Group, Object3D, PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import type { Rect } from "@/lib/game/geometry";
import { Arena } from "./Arena";
import { type CharacterLink, PlayerCharacter } from "./PlayerCharacter";
import { HoloTarget, TARGET_HITBOX_LAYER } from "./HoloTarget";
import { createFxStore, type FxStore, ImpactFx } from "./ImpactFx";
import type { RendererCallbacks, TrainingRuntime } from "./runtime";

/** Vị trí camera qua vai phải và điểm nhìn cố định. Điểm ngắm (crosshair) di chuyển trên khung hình này. */
const CAMERA_POS = new Vector3(0.75, 1.75, 3.4);
const LOOK_AT = new Vector3(0.25, 1.6, -14);
const AIM_DISTANCE = 20;

interface HitInfo {
  targetId: number;
  offsetRatio: number;
  point: Vector3;
}

export interface TrainingSceneProps {
  runtime: TrainingRuntime;
  callbacks: RendererCallbacks;
}

/**
 * Cảnh Three.js của phòng tập. Chỉ được render ở phía client (qua next/dynamic, ssr: false).
 */
export function TrainingScene({ runtime, callbacks }: TrainingSceneProps) {
  const quality = runtime.quality;
  const dpr: [number, number] = quality === "LOW" ? [1, 1] : quality === "MEDIUM" ? [1, 1.5] : [1, 2];
  return (
    <Canvas
      dpr={dpr}
      shadows={quality !== "LOW"}
      gl={{ antialias: quality !== "LOW", powerPreference: "high-performance", alpha: false }}
      camera={{ fov: runtime.fovDeg, near: 0.05, far: 150, position: CAMERA_POS.toArray() as [number, number, number] }}
      className="absolute inset-0 touch-none"
    >
      <SceneContent runtime={runtime} callbacks={callbacks} />
    </Canvas>
  );
}

function SceneContent({ runtime, callbacks }: TrainingSceneProps) {
  const { camera, gl, size, scene } = useThree();
  const engine = runtime.engine;
  const quality = runtime.quality;
  const shadows = quality !== "LOW";
  const sparkleCount = quality === "LOW" ? 20 : quality === "MEDIUM" ? 60 : 140;

  const [targetIds, setTargetIds] = useState<number[]>(() => engine.getTargets().map((t) => t.id));
  const targetsRoot = useRef<Group>(null);
  const characterRoot = useRef<Group>(null);
  const readyRef = useRef(false);
  const lastAspect = useRef(0);
  const fx = useMemo<FxStore>(() => createFxStore(), []);
  const link = useRef<CharacterLink>({ aimWorld: new Vector3(0, 1.6, -20), muzzle: new Vector3(), muzzleFlash: 0 });
  const raycaster = useMemo(() => {
    const rc = new Raycaster();
    rc.layers.set(TARGET_HITBOX_LAYER);
    return rc;
  }, []);
  const aimVec = useMemo(() => new Vector2(), []);
  const trackingId = useRef<number | null>(null);

  // Camera cố định, nhìn về điểm LOOK_AT.
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    cam.position.copy(CAMERA_POS);
    cam.lookAt(LOOK_AT);
    cam.fov = runtime.fovDeg;
    cam.updateProjectionMatrix();
    fx.camera = cam;
  }, [camera, fx, runtime.fovDeg]);

  // Sương mù và nền.
  useEffect(() => {
    scene.background = new Color("#03050b");
    scene.fog = new Fog("#05070f", 24, 72);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  // Mất WebGL context (ví dụ GPU bị reset) là lỗi không thể khắc phục trong phiên này.
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      callbacks.onFatal("Card đồ hoạ vừa bị reset (mất WebGL context). Hãy thử lại hoặc chuyển sang chế độ 2D.");
    };
    canvas.addEventListener("webglcontextlost", onLost);
    return () => canvas.removeEventListener("webglcontextlost", onLost);
  }, [gl, callbacks]);

  // Đồng bộ danh sách bia với engine qua sự kiện.
  useEffect(() => {
    return engine.subscribe((event) => {
      switch (event.type) {
        case "spawn":
          setTargetIds((ids) => [...ids.filter((x) => x !== event.target.id), event.target.id]);
          break;
        case "hit":
          if (runtime.engine.getTrackingTarget()?.id !== event.targetId) {
            setTargetIds((ids) => ids.filter((x) => x !== event.targetId));
          }
          break;
        case "expire":
          setTargetIds((ids) => ids.filter((x) => x !== event.targetId));
          break;
        case "finish":
          setTargetIds([]);
          break;
        case "miss":
          break;
      }
    });
  }, [engine, runtime]);

  /** Tia từ điểm ngắm (NDC) qua camera tới hitbox bia gần nhất. */
  const raycastAim = useCallback((): HitInfo | null => {
    raycaster.setFromCamera(aimVec.set(runtime.aim.x, runtime.aim.y), camera);
    const root = targetsRoot.current;
    if (!root) return null;
    const hits = raycaster.intersectObjects(root.children, true);
    for (const h of hits) {
      const id = h.object.userData.targetId as number | undefined;
      if (typeof id !== "number") continue;
      const group: Object3D | null = h.object.parent;
      const radius = group ? group.scale.x : 1;
      const offset = group ? h.point.distanceTo(group.position) / Math.max(radius, 1e-6) : 0;
      return { targetId: id, offsetRatio: Math.min(1, offset), point: h.point.clone() };
    }
    return null;
  }, [aimVec, camera, raycaster, runtime]);

  /** Vùng NDC bị nhân vật chiếm chỗ: bia không được sinh ra trong vùng này. */
  const computeExclusion = (): Rect[] => {
    const root = characterRoot.current;
    if (!root) return [];
    camera.updateMatrixWorld();
    const box = new Box3().setFromObject(root);
    const corners: Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) corners.push(new Vector3(x, y, z).project(camera));
      }
    }
    const pad = 0.05;
    const x0 = Math.max(-1, Math.min(...corners.map((c) => c.x)) - pad);
    const x1 = Math.min(1, Math.max(...corners.map((c) => c.x)) + pad);
    const y0 = Math.max(-1, Math.min(...corners.map((c) => c.y)) - pad);
    const y1 = Math.min(1, Math.max(...corners.map((c) => c.y)) + pad);
    return [{ x0, y0, x1, y1 }];
  };

  // Bắn: raycast từ điểm ngắm, vẽ tia đạn và báo cho engine kết quả.
  useEffect(() => {
    runtime.fire = () => {
      if (runtime.engine.getStatus() !== "running") return;
      const hit = raycastAim();
      const far = raycaster.ray.at(AIM_DISTANCE, new Vector3());
      const end = hit ? hit.point : far;
      fx.spawnTracer(link.current.muzzle, end, !!hit);
      fx.spawnImpact(end, !!hit);
      link.current.muzzleFlash = 1;
      runtime.engine.shoot(performance.now(), hit ? { targetId: hit.targetId, offsetRatio: hit.offsetRatio } : null);
    };
    return () => {
      runtime.fire = null;
    };
  }, [runtime, raycastAim, raycaster, fx]);

  useFrame(() => {
    // Điểm ngắm trong không gian thế giới: dùng để xoay nhân vật và súng.
    raycaster.setFromCamera(aimVec.set(runtime.aim.x, runtime.aim.y), camera);
    raycaster.ray.at(AIM_DISTANCE, link.current.aimWorld);

    // Đồng bộ khung nhìn với engine (khi đổi kích thước cửa sổ).
    const aspect = size.width / Math.max(1, size.height);
    if (Math.abs(aspect - lastAspect.current) > 1e-3) {
      lastAspect.current = aspect;
      engine.setViewport({ aspect, fovYDeg: runtime.fovDeg });
      if (readyRef.current || characterRoot.current) {
        engine.setExclusion(computeExclusion());
      }
    }

    if (!readyRef.current && characterRoot.current) {
      readyRef.current = true;
      engine.setExclusion(computeExclusion());
      callbacks.onReady();
    }

    // Bia tracking: kiểm tra tâm ngắm có đang trên bia hay không (raycast mỗi khung hình).
    let onTarget = false;
    if (engine.mode === "TRACKING" && engine.getStatus() === "running") {
      const tracking = engine.getTrackingTarget();
      trackingId.current = tracking?.id ?? null;
      const hit = raycastAim();
      onTarget = !!hit && hit.targetId === trackingId.current;
    }
    engine.tick(performance.now(), onTarget);
  });

  return (
    <>
      <Arena shadows={shadows} sparkleCount={sparkleCount} />
      <group ref={characterRoot}>
        <PlayerCharacter link={link} shadows={shadows} />
      </group>
      <group ref={targetsRoot}>
        {targetIds.map((id) => (
          <HoloTarget key={id} id={id} engine={engine} quality={quality} />
        ))}
      </group>
      <ImpactFx store={fx} />
    </>
  );
}
