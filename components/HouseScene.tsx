'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export type DeviceKind = 'ac' | 'fan' | 'fridge' | 'other' | 'light';
export interface SceneDevice { kind: DeviceKind; share: number; on: boolean }
export interface SceneProps {
  devices: SceneDevice[];
  /** 0..1 overall load: drives how many pulses travel on the main feed. */
  load: number;
  /** 0..1 battery level right now (null = no backup loads selected). */
  battery: number | null;
  /** True while the power-cut simulation is running. */
  outage: boolean;
  reduceMotion: boolean;
  /** Called every frame with the screen position of each label anchor (px, relative to the canvas). */
  onProject?: (key: string, x: number, y: number, visible: boolean) => void;
}

type V3 = [number, number, number];
const INK = '#16402A';
const GRID_GREEN = '#34D399';
const BACKUP_AMBER = '#FBBF24';

const ANCHORS: Record<string, V3> = {
  ac: [-1.9, 2.5, -1.9], other: [-0.4, 1.7, -2.0], fan: [-1.2, 2.8, 0.9], fridge: [2.2, 2.2, -1.6],
  light: [-2.0, 1.95, 1.0], battery: [4.3, 2.3, 0.6], grid: [-4.4, 3.55, 0.6],
};
const HUB: V3 = [0.2, 0.55, -2.02];
const BRANCHES: Record<DeviceKind, V3[]> = {
  ac: [HUB, [-0.8, 1.2, -2.0], [-1.9, 1.85, -1.95]],
  other: [HUB, [-0.1, 0.8, -2.0], [-0.4, 1.0, -2.0]],
  fan: [HUB, [-0.6, 1.6, -0.6], [-1.2, 2.2, 0.9]],
  fridge: [HUB, [1.2, 0.45, -1.9], [2.2, 1.0, -1.6]],
  light: [HUB, [-1.0, 0.25, 0.0], [-2.0, 1.0, 1.0]],
};

const curveFrom = (pts: V3[]) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);

function Block({ size, position, color, opacity = 1, edge = INK, edgeOpacity = 0.55, emissive = '#000000', emissiveIntensity = 0 }: {
  size: V3; position: V3; color: string; opacity?: number; edge?: string; edgeOpacity?: number; emissive?: string; emissiveIntensity?: number;
}) {
  const geo = useMemo(() => new THREE.BoxGeometry(size[0], size[1], size[2]), [size[0], size[1], size[2]]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  useEffect(() => () => { geo.dispose(); edges.dispose(); }, [geo, edges]);
  return (
    <group position={position}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={color} roughness={0.5} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {edgeOpacity > 0 && <lineSegments geometry={edges}><lineBasicMaterial color={edge} transparent opacity={edgeOpacity} /></lineSegments>}
    </group>
  );
}

function Wire({ curve, color, opacity = 1 }: { curve: THREE.CatmullRomCurve3; color: string; opacity?: number }) {
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 48, 0.014, 6, false), [curve]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo}><meshBasicMaterial color={color} transparent opacity={opacity} /></mesh>;
}

function Pulses({ curve, count, speed, reverse, color, still }: { curve: THREE.CatmullRomCurve3; count: number; speed: number; reverse?: boolean; color: string; still: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const g = refs.current[i];
      if (!g) continue;
      let u = still ? (i + 0.5) / count : (t * speed + i / count) % 1;
      if (reverse) u = 1 - u;
      g.position.copy(curve.getPoint(u));
      g.scale.setScalar(0.7 + 0.6 * Math.sin(u * Math.PI));
    }
  });
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <mesh><sphereGeometry args={[0.055, 10, 10]} /><meshBasicMaterial color={color} /></mesh>
          <mesh><sphereGeometry args={[0.14, 10, 10]} /><meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
        </group>
      ))}
    </>
  );
}

function Orb({ kind, share, on }: { kind: DeviceKind; share: number; on: boolean }) {
  const a = ANCHORS[kind];
  return (
    <group position={[a[0], a[1] - 0.3, a[2]]}>
      <mesh><sphereGeometry args={[0.085, 16, 16]} /><meshStandardMaterial color={on ? '#86EFAC' : '#2F4A3A'} emissive={on ? '#22C55E' : '#000000'} emissiveIntensity={on ? 0.8 + share * 2.2 : 0} /></mesh>
      {on && <mesh><sphereGeometry args={[0.18 + share * 0.25, 16, 16]} /><meshBasicMaterial color="#4ADE80" transparent opacity={0.1 + share * 0.28} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>}
    </group>
  );
}

function Fan({ share, on, reduceMotion }: { share: number; on: boolean; reduceMotion: boolean }) {
  const blades = useRef<THREE.Group>(null);
  const speed = useRef(0);
  useFrame((_, dt) => {
    const target = on && !reduceMotion ? 2 + share * 12 : 0;
    speed.current += (target - speed.current) * Math.min(1, dt * 2.5);
    if (blades.current) blades.current.rotation.y += dt * speed.current;
  });
  return (
    <group position={[-1.2, 2.2, 0.9]}>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.015, 0.015, 0.4, 8]} /><meshStandardMaterial color="#9DB8A6" /></mesh>
      <mesh><cylinderGeometry args={[0.1, 0.1, 0.08, 16]} /><meshStandardMaterial color="#DDE9E0" /></mesh>
      <group ref={blades}>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
            <mesh position={[0.5, 0, 0]}><boxGeometry args={[0.85, 0.018, 0.15]} /><meshStandardMaterial color="#F2F7F3" /></mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Devices({ devices, reduceMotion }: { devices: SceneDevice[]; reduceMotion: boolean }) {
  const get = (k: DeviceKind) => devices.find((d) => d.kind === k);
  const ac = get('ac'), fan = get('fan'), fridge = get('fridge'), tv = get('other'), light = get('light');
  return (
    <>
      {ac && (
        <>
          <Block size={[1.4, 0.42, 0.3]} position={[-1.9, 2.0, -2.0]} color="#FFFFFF" />
          <Block size={[1.2, 0.04, 0.02]} position={[-1.9, 1.84, -1.84]} color={ac.on ? '#67E8F9' : '#52665A'} emissive={ac.on ? '#22D3EE' : '#000000'} emissiveIntensity={ac.on ? 0.6 + ac.share * 1.8 : 0} edgeOpacity={0} />
          <Orb kind="ac" share={ac.share} on={ac.on} />
        </>
      )}
      {fan && (<><Fan share={fan.share} on={fan.on} reduceMotion={reduceMotion} /><Orb kind="fan" share={fan.share} on={fan.on} /></>)}
      {fridge && (
        <>
          <Block size={[0.9, 1.9, 0.8]} position={[2.2, 0.95, -1.65]} color="#F3F7F4" />
          <Block size={[0.9, 0.02, 0.02]} position={[2.2, 1.35, -1.24]} color={INK} edgeOpacity={0} />
          <Block size={[0.04, 0.5, 0.05]} position={[2.58, 1.0, -1.22]} color="#9DB8A6" edgeOpacity={0} />
          <Orb kind="fridge" share={fridge.share} on={fridge.on} />
        </>
      )}
      {tv && (
        <>
          <Block size={[1.5, 0.85, 0.06]} position={[-0.4, 1.1, -2.1]} color="#16241C" />
          <Block size={[1.4, 0.76, 0.02]} position={[-0.4, 1.1, -2.06]} color={tv.on ? '#38BDF8' : '#0F1A14'} emissive={tv.on ? '#0EA5E9' : '#000000'} emissiveIntensity={tv.on ? 0.5 + tv.share * 1.4 : 0} edgeOpacity={0} />
          <Orb kind="other" share={tv.share} on={tv.on} />
        </>
      )}
      {light && (
        <>
          <group position={[-2.0, 0, 1.0]}>
            <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.2, 0.22, 0.04, 20]} /><meshStandardMaterial color="#DDE9E0" /></mesh>
            <mesh position={[0, 0.65, 0]}><cylinderGeometry args={[0.022, 0.022, 1.3, 8]} /><meshStandardMaterial color="#9DB8A6" /></mesh>
            <mesh position={[0, 1.4, 0]}><cylinderGeometry args={[0.12, 0.27, 0.3, 20, 1, true]} /><meshStandardMaterial color="#F2F7F3" side={THREE.DoubleSide} /></mesh>
            <mesh position={[0, 1.34, 0]}><sphereGeometry args={[0.09, 14, 14]} /><meshStandardMaterial color={light.on ? '#FFE3A3' : '#4B5A50'} emissive={light.on ? '#FFC857' : '#000000'} emissiveIntensity={light.on ? 1.2 + light.share * 2 : 0} /></mesh>
          </group>
          <Orb kind="light" share={light.share} on={light.on} />
        </>
      )}
    </>
  );
}

function Scene({ devices, load, battery, outage, reduceMotion, onProject }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const { pointer, camera, size } = useThree();
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = size.width / size.height < 1.0 ? 44 : 31;
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  const feed = useMemo(() => curveFrom([[-4.4, 3.2, 0.6], [-3.8, 2.6, 0.6], [-3.4, 2.15, 0.6], [-3.12, 1.95, 0.6]]), []);
  const trunk = useMemo(() => curveFrom([[-2.95, 1.95, 0.6], [-2.8, 0.5, 0.5], [-2.2, 0.08, -0.2], [-0.9, 0.08, -1.2], HUB]), []);
  const batt = useMemo(() => curveFrom([[3.85, 0.4, 0.6], [2.8, 0.1, 0.5], [1.4, 0.1, -0.9], HUB]), []);
  const branches = useMemo(() => Object.fromEntries((Object.keys(BRANCHES) as DeviceKind[]).map((k) => [k, curveFrom(BRANCHES[k])])) as Record<DeviceKind, THREE.CatmullRomCurve3>, []);

  const level = battery ?? 0;
  const empty = outage && level <= 0.001;
  const battColor = empty ? '#EF4444' : level > 0.3 ? '#22C55E' : '#F59E0B';
  const cells = empty ? 0 : Math.max(level > 0 ? 1 : 0, Math.ceil(level * 5));
  const powered = devices.some((d) => d.on);
  const gridUp = !outage;
  const theta = Math.max(0, Math.min(1, level)) * Math.PI * 2;

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    if (group.current) {
      const target = reduceMotion ? 0 : Math.sin(t * 0.2) * 0.08 + pointer.x * 0.2;
      group.current.rotation.y += (target - group.current.rotation.y) * Math.min(1, dt * 3);
    }
    if (lamp.current) lamp.current.intensity += ((powered ? 14 : 0) - lamp.current.intensity) * Math.min(1, dt * 4);
    if (onProject && group.current) {
      group.current.updateWorldMatrix(true, false);
      for (const key of Object.keys(ANCHORS)) {
        tmp.set(...ANCHORS[key]);
        group.current.localToWorld(tmp);
        tmp.project(camera);
        onProject(key, (tmp.x * 0.5 + 0.5) * size.width, (-tmp.y * 0.5 + 0.5) * size.height, tmp.z < 1);
      }
    }
  });

  return (
    <group ref={group} position={[0, -0.8, 0]}>
      <pointLight ref={lamp} position={[0, 2.1, 0.4]} color="#FFE2A8" distance={9} decay={2} intensity={0} />

      {/* stage floor and rings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}><circleGeometry args={[9.5, 72]} /><meshStandardMaterial color="#0B2A1A" roughness={0.9} /></mesh>
      {[6.3, 7.6, 8.9].map((r, i) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.27, 0]}><ringGeometry args={[r, r + 0.03, 96]} /><meshBasicMaterial color="#34D399" transparent opacity={0.34 - i * 0.09} /></mesh>
      ))}

      {/* cutaway home: floor, back wall, left wall, glass ceiling, corner posts */}
      <Block size={[6.2, 0.25, 4.6]} position={[0, -0.125, 0]} color="#143D29" edge="#4ADE80" edgeOpacity={0.9} />
      <Block size={[6.2, 2.45, 0.16]} position={[0, 1.225, -2.3]} color="#1B4F35" opacity={0.82} edge="#9DF0BF" edgeOpacity={0.8} />
      <Block size={[0.16, 2.45, 4.6]} position={[-3.1, 1.225, 0]} color="#1B4F35" opacity={0.82} edge="#9DF0BF" edgeOpacity={0.8} />
      <Block size={[6.2, 0.05, 4.6]} position={[0, 2.47, 0]} color="#9DF0BF" opacity={0.08} edge="#9DF0BF" edgeOpacity={0.9} />
      <Block size={[0.06, 2.45, 0.06]} position={[3.1, 1.225, 2.3]} color="#9DF0BF" edgeOpacity={0} />
      <Block size={[0.06, 2.45, 0.06]} position={[3.1, 1.225, -2.3]} color="#9DF0BF" edgeOpacity={0} />
      <Block size={[0.06, 2.45, 0.06]} position={[-3.1, 1.225, 2.3]} color="#9DF0BF" edgeOpacity={0} />
      {/* window on the back wall */}
      <Block size={[1.0, 0.9, 0.03]} position={[1.05, 1.7, -2.2]} color="#D8F3E6" opacity={0.6} emissive="#FFE3A3" emissiveIntensity={powered ? 0.5 : 0.02} edgeOpacity={0.7} />
      {/* distribution hub */}
      <Block size={[0.22, 0.22, 0.08]} position={[HUB[0], HUB[1], -2.17]} color="#1B3B28" edge="#34D399" edgeOpacity={0.9} />

      <Devices devices={devices} reduceMotion={reduceMotion} />

      {/* utility pole + meter */}
      <Block size={[0.12, 3.3, 0.12]} position={[-4.4, 1.65, 0.6]} color="#B9C9BE" edgeOpacity={0.4} />
      <Block size={[0.9, 0.07, 0.1]} position={[-4.4, 3.22, 0.6]} color="#B9C9BE" edgeOpacity={0.4} />
      <Block size={[0.5, 0.6, 0.5]} position={[-3.95, 0.3, 0.9]} color="#C6D4CA" edgeOpacity={0.5} />
      <mesh position={[-4.4, 3.4, 0.6]}><sphereGeometry args={[0.07, 12, 12]} /><meshStandardMaterial color={gridUp ? '#4ADE80' : '#EF4444'} emissive={gridUp ? '#22C55E' : '#EF4444'} emissiveIntensity={gridUp ? 1.6 : 1.2} /></mesh>
      <Block size={[0.16, 0.32, 0.24]} position={[-3.2, 1.95, 0.6]} color="#DDE9E0" edgeOpacity={0.6} />

      {/* energy lines */}
      <Wire curve={feed} color={gridUp ? '#7FD6A6' : '#4B5F53'} opacity={gridUp ? 0.9 : 0.5} />
      <Wire curve={trunk} color={gridUp ? '#7FD6A6' : '#4B5F53'} opacity={gridUp ? 0.9 : 0.5} />
      <Wire curve={batt} color={BACKUP_AMBER} opacity={0.55} />
      {devices.map((d) => <Wire key={d.kind} curve={branches[d.kind]} color={d.on ? (gridUp ? '#7FD6A6' : BACKUP_AMBER) : '#3D5446'} opacity={d.on ? 0.6 : 0.35} />)}

      {gridUp && <Pulses curve={feed} count={Math.max(3, Math.round(3 + load * 5))} speed={0.2 + load * 0.3} color={GRID_GREEN} still={reduceMotion} />}
      {gridUp && <Pulses curve={trunk} count={Math.max(3, Math.round(3 + load * 6))} speed={0.2 + load * 0.3} color={GRID_GREEN} still={reduceMotion} />}
      {devices.filter((d) => d.on).map((d) => (
        <Pulses key={d.kind} curve={branches[d.kind]} count={1 + Math.round(d.share * 4)} speed={0.25 + d.share * 0.3} color={gridUp ? GRID_GREEN : BACKUP_AMBER} still={reduceMotion} />
      ))}
      {battery !== null && gridUp && <Pulses curve={batt} count={2} speed={0.12} reverse color={BACKUP_AMBER} still={reduceMotion} />}
      {battery !== null && outage && !empty && <Pulses curve={batt} count={4} speed={0.35} color={BACKUP_AMBER} still={reduceMotion} />}

      {/* battery */}
      <group position={[4.3, 0, 0.6]}>
        <mesh position={[0, 0.92, 0]}><capsuleGeometry args={[0.42, 1.0, 6, 24]} /><meshStandardMaterial color="#1D2B23" roughness={0.4} metalness={0.25} /></mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[0, 0.4 + i * 0.28, 0.43]}>
            <boxGeometry args={[0.5, 0.13, 0.03]} />
            <meshStandardMaterial color={i < cells ? battColor : '#33463A'} emissive={i < cells ? battColor : '#000000'} emissiveIntensity={i < cells ? 1.3 : 0} />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}><ringGeometry args={[0.75, 0.86, 64]} /><meshBasicMaterial color="#2A4636" /></mesh>
        {theta > 0.03 && (
          <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.75, 0.86, 64, 1, 0, theta]} />
            <meshBasicMaterial color={battColor} />
          </mesh>
        )}
      </group>
    </group>
  );
}

export default function HouseScene(props: SceneProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [8.8, 7.2, 10.8], fov: 31 }}
      frameloop={props.reduceMotion ? 'demand' : 'always'}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      onCreated={({ gl, camera }) => { gl.setClearColor(0x000000, 0); camera.lookAt(0.3, 1.45, 0); }}
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 9, 7]} intensity={2.1} />
      <hemisphereLight args={['#FFFFFF', '#3C7A55', 0.55]} />
      <Scene {...props} />
    </Canvas>
  );
}
