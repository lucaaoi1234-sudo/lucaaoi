"use client";

import { Grid, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { Mesh } from "three";

/** Phòng tập sci-fi: sàn lưới neon, tường tối có dải sáng, cột và đèn trần. Không dùng ảnh/HDR bên ngoài. */
export function Arena({ shadows, sparkleCount }: { shadows: boolean; sparkleCount: number }) {
  const projector = useRef<Group>(null);
  const ringA = useRef<Mesh>(null);
  const ringB = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (projector.current) projector.current.rotation.z = t * 0.4;
    if (ringA.current) ringA.current.scale.setScalar(1 + Math.sin(t * 1.6) * 0.03);
    if (ringB.current) ringB.current.scale.setScalar(1 + Math.cos(t * 1.1) * 0.04);
  });

  return (
    <group>
      {/* Sàn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#070b16" metalness={0.5} roughness={0.45} />
      </mesh>
      <Grid
        position={[0, 0.005, 0]}
        args={[60, 60]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#0e4a5c"
        sectionSize={5}
        sectionThickness={1.1}
        sectionColor="#22d3ee"
        fadeDistance={34}
        fadeStrength={1.6}
        followCamera={false}
        infiniteGrid={false}
      />

      {/* Tường sau và tường bên */}
      <mesh position={[0, 6, -30]} receiveShadow>
        <planeGeometry args={[60, 14]} />
        <meshStandardMaterial color="#0a1020" roughness={0.9} />
      </mesh>
      <mesh position={[-20, 6, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[60, 14]} />
        <meshStandardMaterial color="#0a1020" roughness={0.9} />
      </mesh>
      <mesh position={[20, 6, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[60, 14]} />
        <meshStandardMaterial color="#0a1020" roughness={0.9} />
      </mesh>

      {/* Dải neon trên tường sau */}
      {[2.2, 5.4, 8.6].map((y, i) => (
        <mesh key={`strip-${y}`} position={[0, y, -29.9]}>
          <boxGeometry args={[58, 0.05, 0.05]} />
          <meshBasicMaterial color={i === 1 ? "#e879f9" : "#22d3ee"} toneMapped={false} />
        </mesh>
      ))}
      {/* Dải neon trên tường bên */}
      {[-19.9, 19.9].map((x) => (
        <mesh key={`side-${x}`} position={[x, 4, -6]} rotation={[0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <boxGeometry args={[0.05, 0.05, 40]} />
          <meshBasicMaterial color="#22d3ee" toneMapped={false} />
        </mesh>
      ))}

      {/* Trần và đèn trần */}
      <mesh position={[0, 12, -10]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#060a14" roughness={1} />
      </mesh>
      {[-8, 0, 8].map((x) => (
        <mesh key={`light-${x}`} position={[x, 11.9, -12]}>
          <boxGeometry args={[1.8, 0.04, 0.4]} />
          <meshBasicMaterial color="#bae6fd" toneMapped={false} />
        </mesh>
      ))}

      {/* Cột phát sáng */}
      {[-9, 9].map((x) => (
        <group key={`pillar-${x}`} position={[x, 0, -16]}>
          <mesh position={[0, 5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.6, 0.7, 10, 16]} />
            <meshStandardMaterial color="#0c1426" metalness={0.6} roughness={0.4} />
          </mesh>
          {[2, 5, 8].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.66, 0.035, 8, 32]} />
              <meshBasicMaterial color="#22d3ee" toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Bệ chiếu hologram dưới chân người chơi */}
      <group ref={projector} position={[0, 0.01, -2.5]}>
        <mesh ref={ringA} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.4, 1.46, 64]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.7} toneMapped={false} />
        </mesh>
        <mesh ref={ringB} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.1, 2.12, 64]} />
          <meshBasicMaterial color="#e879f9" transparent opacity={0.45} toneMapped={false} />
        </mesh>
      </group>

      {/* Hạt bụi phát sáng */}
      {sparkleCount > 0 && (
        <Sparkles count={sparkleCount} scale={[36, 9, 40]} position={[0, 4.5, -12]} size={2.2} speed={0.25} color="#67e8f9" opacity={0.6} />
      )}

      {/* Ánh sáng */}
      <ambientLight intensity={0.35} color="#3b4f78" />
      <hemisphereLight args={["#22d3ee", "#050510", 0.35]} />
      <directionalLight
        position={[4, 10, 6]}
        intensity={1.1}
        color="#cfefff"
        castShadow={shadows}
        shadow-mapSize-width={shadows ? 1024 : 256}
        shadow-mapSize-height={shadows ? 1024 : 256}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={30}
      />
      <pointLight position={[0, 5, -6]} intensity={40} distance={30} color="#22d3ee" />
      <pointLight position={[-7, 3, -14]} intensity={30} distance={26} color="#e879f9" />
      <pointLight position={[6, 2.5, -4]} intensity={18} distance={18} color="#38bdf8" />
    </group>
  );
}
