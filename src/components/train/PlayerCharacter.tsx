"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import { BoxGeometry, CapsuleGeometry, CylinderGeometry, DodecahedronGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from "three";

/** Tham chiếu dùng chung với renderer: điểm ngắm (thế giới), vị trí nòng súng, và độ sáng nòng khi bắn. */
export interface CharacterLink {
  aimWorld: Vector3;
  muzzle: Vector3;
  /** Giảm dần về 0 sau mỗi phát bắn. */
  muzzleFlash: number;
}

const FORWARD = new Vector3(0, 0, -1);
const MAX_YAW = 0.95;

interface Materials {
  armor: MeshStandardMaterial;
  suit: MeshStandardMaterial;
  gun: MeshStandardMaterial;
  accent: MeshStandardMaterial;
  visor: MeshStandardMaterial;
  glow: MeshBasicMaterial;
  flash: MeshBasicMaterial;
}

function createMaterials(): Materials {
  return {
    armor: new MeshStandardMaterial({ color: "#1d2636", metalness: 0.65, roughness: 0.35 }),
    suit: new MeshStandardMaterial({ color: "#111a2a", metalness: 0.2, roughness: 0.8 }),
    gun: new MeshStandardMaterial({ color: "#2a323f", metalness: 0.8, roughness: 0.28 }),
    accent: new MeshStandardMaterial({ color: "#0e7490", emissive: "#22d3ee", emissiveIntensity: 1.8 }),
    visor: new MeshStandardMaterial({ color: "#06202a", emissive: "#67e8f9", emissiveIntensity: 2.4 }),
    glow: new MeshBasicMaterial({ color: "#67e8f9", toneMapped: false }),
    flash: new MeshBasicMaterial({ color: "#a5f3fc", transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
  };
}

/**
 * Nhân vật low-poly toàn thân (≈1.9 m) cầm blaster giả tưởng.
 * Thân quay theo hướng ngắm (giới hạn ±55°), tay phải hướng súng về điểm ngắm, tay trái đỡ báng súng.
 * Hướng nhìn ban đầu của nhân vật là −Z (về phía bia).
 */
export function PlayerCharacter({ link, shadows }: {
  link: MutableRefObject<CharacterLink>;
  shadows: boolean;
}) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const rightPivot = useRef<Group>(null);
  const leftPivot = useRef<Group>(null);
  const gun = useRef<Group>(null);
  const glowRef = useRef<Mesh>(null);
  const flashRef = useRef<Mesh>(null);
  const mats = useMemo(() => createMaterials(), []);
  const geo = useMemo(() => createGeometries(), []);

  useFrame((_, dt) => {
    const b = body.current;
    const rp = rightPivot.current;
    const lp = leftPivot.current;
    const g = gun.current;
    if (!b || !rp || !lp || !g) return;
    const { aimWorld, muzzle } = link.current;
    const k = 1 - Math.exp(-dt * 10);

    // Thân: quay theo hướng ngắm (chỉ theo trục Y).
    const yaw = clamp(Math.atan2(aimWorld.x, -aimWorld.z), -MAX_YAW, MAX_YAW);
    b.rotation.y += (yaw - b.rotation.y) * k;
    b.updateMatrixWorld(true);

    const bodyInv = new Quaternion().copy(b.quaternion).invert();

    // Tay phải: nòng súng hướng về điểm ngắm.
    const rightShoulder = new Vector3(0.3, 1.5, 0).applyMatrix4(b.matrixWorld);
    const dirR = aimWorld.clone().sub(rightShoulder).normalize().applyQuaternion(bodyInv);
    const targetR = new Quaternion().setFromUnitVectors(FORWARD, dirR);
    rp.quaternion.slerp(targetR, Math.min(1, k * 1.8));
    rp.updateMatrixWorld(true);

    // Tay trái: đỡ báng súng phía trước (foregrip).
    const foregrip = new Vector3(0, -0.06, -0.42).applyMatrix4(g.matrixWorld);
    const leftShoulder = new Vector3(-0.3, 1.5, 0).applyMatrix4(b.matrixWorld);
    const dirL = foregrip.sub(leftShoulder).normalize().applyQuaternion(bodyInv);
    const targetL = new Quaternion().setFromUnitVectors(FORWARD, dirL);
    lp.quaternion.slerp(targetL, Math.min(1, k * 1.8));

    // Vị trí nòng súng (dùng để vẽ tia đạn).
    g.updateMatrixWorld(true);
    muzzle.set(0, 0.02, -0.74).applyMatrix4(g.matrixWorld);

    // Hiệu ứng nòng súng khi bắn.
    link.current.muzzleFlash = Math.max(0, link.current.muzzleFlash - dt * 9);
    const flash = link.current.muzzleFlash;
    if (flashRef.current) {
      flashRef.current.scale.setScalar(0.4 + flash * 2.2);
    }
    mats.flash.opacity = flash;
    if (glowRef.current) glowRef.current.scale.setScalar(1 + flash * 0.5);
  });

  const castShadow = shadows;
  return (
    <group ref={root} position={[0, 0, 0]}>
      <group ref={body}>
        {/* Chân */}
        {[-0.13, 0.13].map((x) => (
          <group key={`leg-${x}`}>
            <mesh geometry={geo.thigh} material={mats.suit} position={[x, 0.66, 0]} castShadow={castShadow} />
            <mesh geometry={geo.shin} material={mats.suit} position={[x, 0.27, 0]} castShadow={castShadow} />
            <mesh geometry={geo.boot} material={mats.armor} position={[x, 0.07, -0.03]} castShadow={castShadow} />
          </group>
        ))}
        {/* Hông, thân và giáp ngực */}
        <mesh geometry={geo.pelvis} material={mats.suit} position={[0, 0.98, 0]} castShadow={castShadow} />
        <mesh geometry={geo.belt} material={mats.accent} position={[0, 1.02, 0]} />
        <mesh geometry={geo.torso} material={mats.suit} position={[0, 1.3, 0]} castShadow={castShadow} />
        <mesh geometry={geo.chestPlate} material={mats.armor} position={[0, 1.34, -0.16]} castShadow={castShadow} />
        <mesh geometry={geo.chestStrip} material={mats.accent} position={[-0.14, 1.34, -0.2]} />
        <mesh geometry={geo.chestStrip} material={mats.accent} position={[0.14, 1.34, -0.2]} />
        <mesh geometry={geo.backpack} material={mats.armor} position={[0, 1.32, 0.2]} castShadow={castShadow} />
        <mesh geometry={geo.vent} material={mats.accent} position={[0, 1.46, 0.28]} />
        {/* Vai, cổ, đầu */}
        <mesh geometry={geo.shoulderPad} material={mats.armor} position={[-0.3, 1.55, 0]} castShadow={castShadow} />
        <mesh geometry={geo.shoulderPad} material={mats.armor} position={[0.3, 1.55, 0]} castShadow={castShadow} />
        <mesh geometry={geo.neck} material={mats.suit} position={[0, 1.6, 0]} />
        <mesh geometry={geo.helmet} material={mats.armor} position={[0, 1.76, 0]} castShadow={castShadow} />
        <mesh geometry={geo.visor} material={mats.visor} position={[0, 1.77, -0.13]} />
        <mesh geometry={geo.crest} material={mats.accent} position={[0, 1.9, 0.02]} />

        {/* Tay trái */}
        <group position={[-0.3, 1.5, 0]} ref={leftPivot}>
          <mesh geometry={geo.arm} material={mats.suit} position={[0, 0, -0.29]} castShadow={castShadow} />
          <mesh geometry={geo.glove} material={mats.armor} position={[0, 0, -0.58]} />
        </group>

        {/* Tay phải + súng */}
        <group position={[0.3, 1.5, 0]} ref={rightPivot}>
          <mesh geometry={geo.arm} material={mats.suit} position={[0, 0, -0.29]} castShadow={castShadow} />
          <group ref={gun} position={[0, 0, -0.58]}>
            <mesh geometry={geo.gunBody} material={mats.gun} position={[0, 0, -0.22]} castShadow={castShadow} />
            <mesh geometry={geo.gunBarrel} material={mats.gun} position={[0, 0.02, -0.55]} rotation={[Math.PI / 2, 0, 0]} />
            <mesh geometry={geo.gunGrip} material={mats.gun} position={[0, -0.13, -0.1]} rotation={[-0.25, 0, 0]} />
            <mesh geometry={geo.gunForeGrip} material={mats.gun} position={[0, -0.06, -0.42]} />
            <mesh geometry={geo.gunScope} material={mats.gun} position={[0, 0.09, -0.26]} />
            <mesh geometry={geo.gunCell} material={mats.accent} position={[0.055, 0, -0.25]} />
            <mesh geometry={geo.gunRail} material={mats.accent} position={[0, 0.066, -0.22]} />
            <mesh ref={glowRef} geometry={geo.muzzleTip} material={mats.glow} position={[0, 0.02, -0.69]} rotation={[0, 0, 0]} />
            <mesh ref={flashRef} geometry={geo.muzzleFlash} material={mats.flash} position={[0, 0.02, -0.72]} />
          </group>
          <mesh geometry={geo.glove} material={mats.armor} position={[0, 0, -0.58]} />
        </group>
      </group>
    </group>
  );
}

function createGeometries() {
  const torsoGeo = new BoxGeometry(0.46, 0.52, 0.26);
  return {
    thigh: new CapsuleGeometry(0.1, 0.3, 4, 8),
    shin: new CapsuleGeometry(0.085, 0.32, 4, 8),
    boot: new BoxGeometry(0.2, 0.14, 0.3),
    pelvis: new BoxGeometry(0.42, 0.18, 0.26),
    belt: new BoxGeometry(0.44, 0.05, 0.28),
    torso: torsoGeo,
    chestPlate: new BoxGeometry(0.4, 0.4, 0.08),
    chestStrip: new BoxGeometry(0.06, 0.3, 0.02),
    backpack: new BoxGeometry(0.34, 0.46, 0.14),
    vent: new BoxGeometry(0.2, 0.02, 0.01),
    shoulderPad: new DodecahedronGeometry(0.13, 0),
    neck: new CylinderGeometry(0.07, 0.08, 0.12, 8),
    helmet: new SphereGeometry(0.17, 16, 12).scale(1, 1.1, 1.05),
    visor: new BoxGeometry(0.24, 0.06, 0.1),
    crest: new BoxGeometry(0.04, 0.08, 0.22),
    arm: new CapsuleGeometry(0.065, 0.46, 4, 8).rotateX(Math.PI / 2),
    glove: new SphereGeometry(0.068, 10, 8),
    gunBody: new BoxGeometry(0.1, 0.12, 0.42),
    gunBarrel: new CylinderGeometry(0.028, 0.028, 0.26, 10),
    gunGrip: new BoxGeometry(0.07, 0.2, 0.08),
    gunForeGrip: new BoxGeometry(0.05, 0.1, 0.06),
    gunScope: new BoxGeometry(0.05, 0.05, 0.16),
    gunCell: new BoxGeometry(0.02, 0.1, 0.22),
    gunRail: new BoxGeometry(0.01, 0.01, 0.36),
    muzzleTip: new TorusGeometry(0.04, 0.01, 8, 16),
    muzzleFlash: new SphereGeometry(0.05, 12, 10),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

