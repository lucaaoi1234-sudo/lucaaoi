"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { DoubleSide, Group, Mesh, PerspectiveCamera, Vector3 } from "three";
import type { TrainingEngine } from "@/lib/game/engine";

/** Layer dành riêng cho hitbox bia: raycast chỉ kiểm tra layer này, nên vòng sáng/đĩa không chặn tia. */
export const TARGET_HITBOX_LAYER = 1;

const _dir = new Vector3();
const _forward = new Vector3();
const _far = new Vector3();

/**
 * Đặt bia trong không gian 3D từ toạ độ NDC (u, v) và chiều sâu (0..1 → 12..22 m).
 * Bán kính thế giới được tính để bia có cùng kích thước góc trên màn hình ở mọi khoảng cách.
 * @returns bán kính thế giới của bia
 */
export function placeTarget(
  camera: PerspectiveCamera,
  u: number,
  v: number,
  depthT: number,
  radiusNdc: number,
  out: Vector3,
): number {
  _far.set(u, v, 0.5).unproject(camera);
  _dir.copy(_far).sub(camera.position).normalize();
  const forward = camera.getWorldDirection(_forward);
  // Khoảng cách dọc theo trục nhìn (không phải khoảng cách tia) để bia nằm trên một mặt phẳng song song màn hình.
  const viewDot = Math.max(0.2, _dir.dot(forward));
  const depth = 12 + depthT * 10;
  out.copy(camera.position).addScaledVector(_dir, depth / viewDot);
  return depth * Math.tan(((camera.fov * Math.PI) / 180) / 2) * radiusNdc;
}

interface HoloTargetProps {
  id: number;
  engine: TrainingEngine;
  quality: "LOW" | "MEDIUM" | "HIGH";
}

/**
 * Bia hologram: vòng sáng, đĩa mờ, cung xoay, tâm sáng và hitbox vô hình.
 * Vị trí được cập nhật từ engine mỗi khung hình, nên bia tracking di chuyển mượt.
 * Group có `userData.targetId` và `scale` = bán kính thế giới, dùng để tính độ lệch tâm khi bắn trúng.
 */
export function HoloTarget({ id, engine, quality }: HoloTargetProps) {
  const camera = useThree((s) => s.camera as PerspectiveCamera);
  const group = useRef<Group>(null);
  const arcs = useRef<Group>(null);
  const spawnClock = useRef<number | null>(null);
  const pos = useRef(new Vector3());

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const view = engine.getTarget(id);
    if (!view) {
      g.visible = false;
      return;
    }
    if (spawnClock.current === null) spawnClock.current = state.clock.elapsedTime;
    const age = state.clock.elapsedTime - spawnClock.current;
    const pop = Math.min(1, age / 0.14);

    const radius = placeTarget(camera, view.u, view.v, view.depthT, view.radiusNdc, pos.current);
    g.position.copy(pos.current);
    g.scale.setScalar(Math.max(0.0001, radius * (0.6 + 0.4 * easeOutBack(pop))));
    g.lookAt(camera.position);
    g.visible = true;
    if (arcs.current) arcs.current.rotation.z += dt * (view.kind === "tracking" ? 2.4 : 1.2);
  });

  const segments = quality === "LOW" ? 24 : 48;
  return (
    <group ref={group} userData={{ targetId: id }}>
      <mesh>
        <circleGeometry args={[1, segments]} />
        <meshBasicMaterial color="#0ea5e9" transparent opacity={0.2} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.92, 1, segments]} />
        <meshBasicMaterial color="#67e8f9" toneMapped={false} side={DoubleSide} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.5, 0.52, segments]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.55} toneMapped={false} side={DoubleSide} />
      </mesh>
      <group ref={arcs}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
            <ringGeometry args={[0.7, 0.74, 16, 1, 0.2, 1.0]} />
            <meshBasicMaterial color="#e879f9" toneMapped={false} side={DoubleSide} />
          </mesh>
        ))}
      </group>
      <mesh>
        <circleGeometry args={[0.1, 16]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      {/* Hitbox: đĩa vô hình trên layer riêng. Ray được kiểm tra với đĩa này để biết trúng hay trượt. */}
      <mesh ref={(m: Mesh | null) => m?.layers.set(TARGET_HITBOX_LAYER)} userData={{ targetId: id }}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
      </mesh>
    </group>
  );
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
