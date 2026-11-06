"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  RingGeometry,
  Vector3,
} from "three";

const TRACER_LIFE = 0.12;
const RING_LIFE = 0.35;
const TRACER_POOL = 6;
const RING_POOL = 8;

interface Tracer {
  line: Line;
  material: LineBasicMaterial;
  life: number;
}
interface Ring {
  mesh: Mesh;
  material: MeshBasicMaterial;
  life: number;
  hit: boolean;
}

/** Kho hiệu ứng dùng chung giữa renderer và component hiển thị. Không tạo object mới khi bắn. */
export interface FxStore {
  tracers: Tracer[];
  rings: Ring[];
  nextTracer: number;
  nextRing: number;
  camera: PerspectiveCamera | null;
  spawnTracer(from: Vector3, to: Vector3, hit: boolean): void;
  spawnImpact(point: Vector3, hit: boolean): void;
}

export function createFxStore(): FxStore {
  const tracers: Tracer[] = Array.from({ length: TRACER_POOL }, () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(6), 3));
    const material = new LineBasicMaterial({ color: "#67e8f9", transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    return { line: new Line(geometry, material), material, life: 0 };
  });
  const rings: Ring[] = Array.from({ length: RING_POOL }, () => {
    const material = new MeshBasicMaterial({
      color: "#67e8f9",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    return { mesh: new Mesh(new RingGeometry(0.85, 1, 32), material), material, life: 0, hit: true };
  });

  const store: FxStore = {
    tracers,
    rings,
    nextTracer: 0,
    nextRing: 0,
    camera: null,
    spawnTracer(from, to, hit) {
      const t = store.tracers[store.nextTracer % TRACER_POOL];
      store.nextTracer += 1;
      if (!t) return;
      const attr = t.line.geometry.getAttribute("position") as BufferAttribute;
      attr.setXYZ(0, from.x, from.y, from.z);
      attr.setXYZ(1, to.x, to.y, to.z);
      attr.needsUpdate = true;
      t.material.color.set(hit ? "#67e8f9" : "#fda4af");
      t.life = TRACER_LIFE;
      t.material.opacity = 1;
    },
    spawnImpact(point, hit) {
      const r = store.rings[store.nextRing % RING_POOL];
      store.nextRing += 1;
      if (!r) return;
      r.mesh.position.copy(point);
      if (store.camera) r.mesh.lookAt(store.camera.position);
      r.material.color.set(hit ? "#67e8f9" : "#fda4af");
      r.hit = hit;
      r.life = RING_LIFE;
      r.material.opacity = 1;
      r.mesh.scale.setScalar(0.2);
    },
  };
  return store;
}

/** Vẽ và làm mờ dần các tia đạn và vòng xung kích. */
export function ImpactFx({ store }: { store: FxStore }) {
  const objects = useMemo(
    () => ({ tracers: store.tracers.map((t) => t.line), rings: store.rings.map((r) => r.mesh) }),
    [store],
  );

  useFrame((_, dt) => {
    for (const t of store.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.material.opacity = Math.max(0, t.life / TRACER_LIFE);
    }
    for (const r of store.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const k = 1 - Math.max(0, r.life) / RING_LIFE;
      r.mesh.scale.setScalar(0.2 + k * (r.hit ? 0.9 : 0.4));
      r.material.opacity = Math.max(0, 1 - k);
    }
  });

  return (
    <group>
      {objects.tracers.map((line, i) => (
        <primitive key={`tracer-${i}`} object={line} />
      ))}
      {objects.rings.map((mesh, i) => (
        <primitive key={`ring-${i}`} object={mesh} />
      ))}
    </group>
  );
}
