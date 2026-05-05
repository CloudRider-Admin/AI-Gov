"use client";

import { useRef, useState, useMemo, useCallback, memo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sphere, Environment, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { List, Globe as GlobeIcon, ArrowRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavigationPoint {
  id: string;
  label: string;
  description: string;
  position: [number, number, number];
  color: string;
  href: string;
  category: 'learn' | 'playbook' | 'topic' | 'framework' | 'tool' | 'consult';
}

interface DragState {
  isDragging: boolean;
  isHovering: boolean;
  hasDragged: boolean;
  lastX: number;
  startX: number;
  velocityX: number;
  rotationY: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GLOBE_RADIUS = 2.5;

const CATEGORY_CONFIG: Record<string, { color: string; label: string }> = {
  learn:     { color: '#00ff88', label: 'Learning'   },
  playbook:  { color: '#00d4ff', label: 'Playbooks'  },
  topic:     { color: '#ffb800', label: 'Topics'     },
  framework: { color: '#ff3366', label: 'Frameworks' },
  tool:      { color: '#a855f7', label: 'Tools'      },
  consult:   { color: '#a855f7', label: 'Advisor'    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function latLongToVector3(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

// ─── Navigation Points ────────────────────────────────────────────────────────

const navigationPoints: NavigationPoint[] = [
  // Learning Hub (Green cluster - Northern Hemisphere)
  {
    id: 'learn',
    label: 'Learning Hub',
    description: 'Explore all learning paths',
    position: latLongToVector3(50, 0, GLOBE_RADIUS),
    color: '#00ff88',
    href: '/learn',
    category: 'learn',
  },
  {
    id: 'getting-started',
    label: 'Getting Started',
    description: 'Begin your governance journey',
    position: latLongToVector3(65, 25, GLOBE_RADIUS),
    color: '#00ff88',
    href: '/learn/getting-started',
    category: 'learn',
  },
  {
    id: 'scaling',
    label: 'Scaling',
    description: 'Grow your governance program',
    position: latLongToVector3(60, -20, GLOBE_RADIUS),
    color: '#00ff88',
    href: '/learn/scaling',
    category: 'learn',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Expert-level governance',
    position: latLongToVector3(55, 340, GLOBE_RADIUS),
    color: '#00ff88',
    href: '/learn/advanced',
    category: 'learn',
  },

  // Playbooks (Cyan cluster - Eastern Hemisphere)
  {
    id: 'playbooks',
    label: 'Playbooks',
    description: 'Implementation guides',
    position: latLongToVector3(25, 90, GLOBE_RADIUS),
    color: '#00d4ff',
    href: '/playbooks',
    category: 'playbook',
  },
  {
    id: 'starter-pack',
    label: 'Starter Pack',
    description: '90-day implementation blueprint',
    position: latLongToVector3(10, 75, GLOBE_RADIUS),
    color: '#00d4ff',
    href: '/playbooks/ai-governance-starter-pack',
    category: 'playbook',
  },
  {
    id: 'spreadsheets',
    label: 'Spreadsheets to Policies',
    description: 'Document AI use cases',
    position: latLongToVector3(35, 110, GLOBE_RADIUS),
    color: '#00d4ff',
    href: '/playbooks/spreadsheets-to-policies',
    category: 'playbook',
  },
  {
    id: 'aup',
    label: 'Acceptable Use Policy',
    description: 'Create effective AI policies',
    position: latLongToVector3(5, 105, GLOBE_RADIUS),
    color: '#00d4ff',
    href: '/playbooks/ai-acceptable-use-policy',
    category: 'playbook',
  },
  {
    id: 'shadow-ai',
    label: 'Shadow AI',
    description: 'Govern unsanctioned AI',
    position: latLongToVector3(20, 60, GLOBE_RADIUS),
    color: '#00d4ff',
    href: '/playbooks/shadow-ai-governance',
    category: 'playbook',
  },

  // Topics (Amber cluster - Southern Hemisphere)
  {
    id: 'topics',
    label: 'Topics',
    description: 'Explore governance concepts',
    position: latLongToVector3(-30, 180, GLOBE_RADIUS),
    color: '#ffb800',
    href: '/topics',
    category: 'topic',
  },
  {
    id: 'strategy',
    label: 'Strategy',
    description: 'Planning & alignment',
    position: latLongToVector3(-20, 160, GLOBE_RADIUS),
    color: '#ffb800',
    href: '/topics/strategy',
    category: 'topic',
  },
  {
    id: 'risk-compliance',
    label: 'Risk & Compliance',
    description: 'Regulatory frameworks',
    position: latLongToVector3(-40, 195, GLOBE_RADIUS),
    color: '#ffb800',
    href: '/topics/risk-compliance',
    category: 'topic',
  },
  {
    id: 'security',
    label: 'Security',
    description: 'AI-specific threats',
    position: latLongToVector3(-25, 210, GLOBE_RADIUS),
    color: '#ffb800',
    href: '/topics/security',
    category: 'topic',
  },
  {
    id: 'ethics',
    label: 'Ethics',
    description: 'Responsible AI principles',
    position: latLongToVector3(-45, 165, GLOBE_RADIUS),
    color: '#ffb800',
    href: '/topics/ethics',
    category: 'topic',
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Day-to-day governance',
    position: latLongToVector3(-15, 145, GLOBE_RADIUS),
    color: '#ffb800',
    href: '/topics/operations',
    category: 'topic',
  },

  // Frameworks (Pink cluster - Western Hemisphere)
  {
    id: 'nist-framework',
    label: 'NIST AI RMF',
    description: 'Risk management framework',
    position: latLongToVector3(40, -90, GLOBE_RADIUS),
    color: '#ff3366',
    href: '/playbooks',
    category: 'framework',
  },
  {
    id: 'iso-42001',
    label: 'ISO 42001',
    description: 'AI management system',
    position: latLongToVector3(30, -110, GLOBE_RADIUS),
    color: '#ff3366',
    href: '/playbooks',
    category: 'framework',
  },
  {
    id: 'eu-ai-act',
    label: 'EU AI Act',
    description: 'European compliance',
    position: latLongToVector3(50, -70, GLOBE_RADIUS),
    color: '#ff3366',
    href: '/topics/risk-compliance',
    category: 'framework',
  },

  // Tools & Templates (Purple cluster - Equatorial)
  {
    id: 'templates',
    label: 'Templates',
    description: 'Ready-to-use tools',
    position: latLongToVector3(0, 45, GLOBE_RADIUS),
    color: '#a855f7',
    href: '/#templates',
    category: 'tool',
  },
  {
    id: 'executive-guide',
    label: 'Executive Guide',
    description: 'Board-ready insights',
    position: latLongToVector3(-10, 30, GLOBE_RADIUS),
    color: '#a855f7',
    href: '/playbooks/executive-guide-ai-risk',
    category: 'tool',
  },

  // AI Advisor (Purple - South)
  {
    id: 'advisor',
    label: 'AI Advisor (Govi)',
    description: 'Get personalized guidance',
    position: latLongToVector3(-60, -45, GLOBE_RADIUS),
    color: '#a855f7',
    href: '/govi',
    category: 'consult',
  },

  // Additional Navigation Points
  {
    id: 'monitoring',
    label: 'Monitoring',
    description: 'Track AI system performance',
    position: latLongToVector3(-35, 125, GLOBE_RADIUS),
    color: '#ffb800',
    href: '/topics/operations',
    category: 'topic',
  },
  {
    id: 'data-governance',
    label: 'Data Governance',
    description: 'Manage AI training data',
    position: latLongToVector3(15, 200, GLOBE_RADIUS),
    color: '#ffb800',
    href: '/topics/operations',
    category: 'topic',
  },
  {
    id: 'model-cards',
    label: 'Model Cards',
    description: 'Document AI models',
    position: latLongToVector3(45, 135, GLOBE_RADIUS),
    color: '#00d4ff',
    href: '/playbooks',
    category: 'tool',
  },
  {
    id: 'vendor-management',
    label: 'Vendor Management',
    description: 'Evaluate AI providers',
    position: latLongToVector3(-5, 250, GLOBE_RADIUS),
    color: '#ffb800',
    href: '/topics/strategy',
    category: 'topic',
  },
  {
    id: 'incident-response',
    label: 'Incident Response',
    description: 'Handle AI failures',
    position: latLongToVector3(-50, 225, GLOBE_RADIUS),
    color: '#ff3366',
    href: '/topics/security',
    category: 'topic',
  },
  {
    id: 'testing-validation',
    label: 'Testing & Validation',
    description: 'Verify AI reliability',
    position: latLongToVector3(20, -135, GLOBE_RADIUS),
    color: '#00d4ff',
    href: '/playbooks',
    category: 'tool',
  },
  {
    id: 'privacy',
    label: 'Privacy',
    description: 'Protect user data',
    position: latLongToVector3(-55, 85, GLOBE_RADIUS),
    color: '#ffb800',
    href: '/topics/ethics',
    category: 'topic',
  },
  {
    id: 'explainability',
    label: 'Explainability',
    description: 'Interpret AI decisions',
    position: latLongToVector3(-70, 10, GLOBE_RADIUS),
    color: '#ffb800',
    href: '/topics/ethics',
    category: 'topic',
  },
  {
    id: 'change-management',
    label: 'Change Management',
    description: 'Adopt AI governance',
    position: latLongToVector3(35, -50, GLOBE_RADIUS),
    color: '#ffb800',
    href: '/topics/strategy',
    category: 'topic',
  },
  {
    id: 'audit-trail',
    label: 'Audit Trail',
    description: 'Maintain compliance records',
    position: latLongToVector3(-10, -160, GLOBE_RADIUS),
    color: '#ff3366',
    href: '/topics/risk-compliance',
    category: 'topic',
  },
  {
    id: 'roi-metrics',
    label: 'ROI & Metrics',
    description: 'Measure governance value',
    position: latLongToVector3(70, 215, GLOBE_RADIUS),
    color: '#a855f7',
    href: '/topics/strategy',
    category: 'topic',
  },
  {
    id: 'stakeholder-comms',
    label: 'Stakeholder Comms',
    description: 'Engage leadership',
    position: latLongToVector3(10, -210, GLOBE_RADIUS),
    color: '#a855f7',
    href: '/playbooks/executive-guide-ai-risk',
    category: 'tool',
  },
];

// ─── Connection definitions ────────────────────────────────────────────────────

const CONNECTIONS = [
  { from: 'learn', to: 'getting-started' },
  { from: 'learn', to: 'scaling' },
  { from: 'learn', to: 'advanced' },
  { from: 'playbooks', to: 'starter-pack' },
  { from: 'playbooks', to: 'aup' },
  { from: 'topics', to: 'strategy' },
  { from: 'topics', to: 'risk-compliance' },
  { from: 'topics', to: 'security' },
  { from: 'topics', to: 'ethics' },
  { from: 'topics', to: 'operations' },
  { from: 'risk-compliance', to: 'nist-framework' },
  { from: 'risk-compliance', to: 'eu-ai-act' },
  { from: 'advisor', to: 'playbooks' },
  { from: 'templates', to: 'executive-guide' },
];

// ─── Static Globe Components (memoised) ───────────────────────────────────────

const WireframeGlobe = memo(function WireframeGlobe() {
  return (
    <group>
      <Sphere args={[GLOBE_RADIUS, 64, 64]}>
        <meshBasicMaterial color="#00ff88" wireframe transparent opacity={0.1} />
      </Sphere>
      <Sphere args={[GLOBE_RADIUS - 0.05, 32, 32]}>
        <meshBasicMaterial color="#00ff88" transparent opacity={0.03} side={THREE.BackSide} />
      </Sphere>
      <Sphere args={[GLOBE_RADIUS + 0.1, 32, 32]}>
        <meshBasicMaterial color="#00ff88" transparent opacity={0.05} side={THREE.BackSide} />
      </Sphere>
    </group>
  );
});

const GlobeGridLines = memo(function GlobeGridLines() {
  const latitudeLines = useMemo(() => {
    const lines: THREE.Vector3[][] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lon = 0; lon <= 360; lon += 10)
        pts.push(new THREE.Vector3(...latLongToVector3(lat, lon, GLOBE_RADIUS)));
      lines.push(pts);
    }
    return lines;
  }, []);

  const longitudeLines = useMemo(() => {
    const lines: THREE.Vector3[][] = [];
    for (let lon = 0; lon < 360; lon += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 10)
        pts.push(new THREE.Vector3(...latLongToVector3(lat, lon, GLOBE_RADIUS)));
      lines.push(pts);
    }
    return lines;
  }, []);

  return (
    <group>
      {latitudeLines.map((pts, i) => (
        <Line key={`lat-${i}`} points={pts} color="#00ff88" lineWidth={0.5} transparent opacity={0.15} />
      ))}
      {longitudeLines.map((pts, i) => (
        <Line key={`lon-${i}`} points={pts} color="#00ff88" lineWidth={0.5} transparent opacity={0.15} />
      ))}
    </group>
  );
});

// ─── Animated Arc ──────────────────────────────────────────────────────────────

const AnimatedArc = memo(function AnimatedArc({
  from,
  to,
  color,
  isHighlighted,
  timeOffset,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  isHighlighted: boolean;
  timeOffset: number;
}) {
  const dotRef = useRef<THREE.Mesh>(null);

  const curve = useMemo(
    () =>
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(...from),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(...to)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from[0], from[1], from[2], to[0], to[1], to[2]]
  );

  const points = useMemo(() => curve.getPoints(50), [curve]);

  useFrame((state) => {
    if (!dotRef.current) return;
    const t = ((state.clock.elapsedTime * 0.25 + timeOffset) % 1 + 1) % 1;
    dotRef.current.position.copy(curve.getPoint(t));
    (dotRef.current.material as THREE.MeshBasicMaterial).opacity = isHighlighted
      ? 0.95
      : 0.35 + Math.sin(state.clock.elapsedTime * 2 + timeOffset) * 0.12;
  });

  return (
    <>
      <Line
        points={points}
        color={isHighlighted ? color : '#00ff88'}
        lineWidth={isHighlighted ? 2 : 0.5}
        transparent
        opacity={isHighlighted ? 0.45 : 0.08}
      />
      <mesh ref={dotRef}>
        <sphereGeometry args={[isHighlighted ? 0.045 : 0.022, 8, 8]} />
        <meshBasicMaterial color={isHighlighted ? color : '#00d4ff'} transparent opacity={0.7} />
      </mesh>
    </>
  );
});

// ─── Connection Lines ──────────────────────────────────────────────────────────

function ConnectionLines({ hoveredPoint }: { hoveredPoint: string | null }) {
  return (
    <group>
      {CONNECTIONS.map((conn, i) => {
        const fromPt = navigationPoints.find((p) => p.id === conn.from);
        const toPt = navigationPoints.find((p) => p.id === conn.to);
        if (!fromPt || !toPt) return null;
        const isHighlighted = hoveredPoint === conn.from || hoveredPoint === conn.to;
        return (
          <AnimatedArc
            key={`arc-${i}`}
            from={fromPt.position}
            to={toPt.position}
            color={fromPt.color}
            isHighlighted={isHighlighted}
            timeOffset={i / CONNECTIONS.length}
          />
        );
      })}
    </group>
  );
}

// ─── Navigation Pin ────────────────────────────────────────────────────────────

interface NavigationPinProps {
  point: NavigationPoint;
  isHovered: boolean;
  onHover: (id: string) => void;
  onLeave: () => void;
  onPinClick: (point: NavigationPoint) => void;
  dragRef: React.MutableRefObject<DragState>;
}

const NavigationPin = memo(function NavigationPin({
  point,
  isHovered,
  onHover,
  onLeave,
  onPinClick,
  dragRef,
}: NavigationPinProps) {
  const pinRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (pinRef.current) {
      pinRef.current.rotation.y = state.clock.elapsedTime * 2;
    }
    if (glowRef.current) {
      const base = isHovered ? 1.5 : 1;
      glowRef.current.scale.setScalar(base + Math.sin(state.clock.elapsedTime * 2) * 0.2);
    }
    if (pulseRef.current && isHovered) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.3;
      pulseRef.current.scale.setScalar(s);
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.3 + Math.sin(state.clock.elapsedTime * 4) * 0.2;
    }
  });

  return (
    <group position={point.position}>
      {/* Pulsing outer ring on hover */}
      {isHovered && (
        <mesh ref={pulseRef}>
          <ringGeometry args={[0.15, 0.22, 32]} />
          <meshBasicMaterial color={point.color} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color={point.color} transparent opacity={0.3} />
      </mesh>

      {/* Main pin */}
      <mesh
        ref={pinRef}
        onPointerOver={(e) => { e.stopPropagation(); onHover(point.id); }}
        onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
        onClick={(e) => {
          e.stopPropagation();
          if (!dragRef.current.hasDragged) onPinClick(point);
        }}
      >
        <octahedronGeometry args={[0.08, 0]} />
        <meshPhysicalMaterial
          color={point.color}
          emissive={point.color}
          emissiveIntensity={isHovered ? 1.5 : 0.8}
          metalness={1}
          roughness={0.2}
          clearcoat={1}
        />
      </mesh>

      {/* Enhanced tooltip */}
      {isHovered && (
        <Html
          position={[0, 0.28, 0]}
          center
          distanceFactor={12}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div style={{ transform: 'scale(0.9)', transformOrigin: 'bottom center' }}>
            <div
              className="bg-black/90 backdrop-blur-md border rounded-xl shadow-2xl"
              style={{
                borderColor: point.color,
                boxShadow: `0 0 20px ${point.color}40, 0 4px 12px rgba(0,0,0,0.5)`,
                padding: '8px 12px',
                minWidth: '130px',
                maxWidth: '200px',
              }}
            >
              <div
                className="font-mono font-bold leading-tight text-xs"
                style={{ color: point.color, letterSpacing: '0.4px' }}
              >
                {point.label}
              </div>
              <div
                className="font-sans mt-1 leading-snug text-xs"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                {point.description}
              </div>
              <div
                className="font-mono mt-2 text-xs"
                style={{ color: point.color }}
              >
                → Explore
              </div>
            </div>
            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: point.color, boxShadow: `0 0 5px ${point.color}` }}
            />
          </div>
        </Html>
      )}

      {/* Stem line */}
      <Line
        points={[[0, 0, 0], [0, -0.3, 0]]}
        color={point.color}
        lineWidth={1}
        transparent
        opacity={isHovered ? 0.8 : 0.3}
      />
    </group>
  );
});

// ─── Data Particles ────────────────────────────────────────────────────────────

function DataParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 150;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = GLOBE_RADIUS + 0.2 + Math.random() * 0.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      pos[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.03) * 0.1;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#00d4ff" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

// ─── Camera Controller (subtle Y tilt) ────────────────────────────────────────

function CameraController() {
  const { camera } = useThree();

  useFrame((state) => {
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, state.pointer.y * 0.6, 0.04);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// ─── Globe Group (handles rotation) ───────────────────────────────────────────

function GlobeGroup({
  dragRef,
  hoveredPoint,
  onHover,
  onLeave,
  onPinClick,
  visibleCategories,
}: {
  dragRef: React.MutableRefObject<DragState>;
  hoveredPoint: string | null;
  onHover: (id: string) => void;
  onLeave: () => void;
  onPinClick: (point: NavigationPoint) => void;
  visibleCategories: Set<string>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const drag = dragRef.current;
    if (!drag.isDragging) {
      drag.velocityX *= 0.92;
      drag.rotationY += drag.velocityX;
      if (Math.abs(drag.velocityX) < 0.0003 && !drag.isHovering) {
        drag.rotationY += 0.003;
      }
    }
    groupRef.current.rotation.y = drag.rotationY;
  });

  const visiblePoints = useMemo(
    () => navigationPoints.filter((p) => visibleCategories.has(p.category)),
    [visibleCategories]
  );

  return (
    <group ref={groupRef}>
      <WireframeGlobe />
      <GlobeGridLines />
      <ConnectionLines hoveredPoint={hoveredPoint} />
      {visiblePoints.map((point) => (
        <NavigationPin
          key={point.id}
          point={point}
          isHovered={hoveredPoint === point.id}
          onHover={onHover}
          onLeave={onLeave}
          onPinClick={onPinClick}
          dragRef={dragRef}
        />
      ))}
      {/* Central core glow */}
      <mesh>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

// ─── Scene ─────────────────────────────────────────────────────────────────────

function Scene({
  dragRef,
  visibleCategories,
}: {
  dragRef: React.MutableRefObject<DragState>;
  visibleCategories: Set<string>;
}) {
  const router = useRouter();
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  const handleHover = useCallback(
    (id: string) => {
      setHoveredPoint(id);
      dragRef.current.isHovering = true;
    },
    [dragRef]
  );

  const handleLeave = useCallback(() => {
    setHoveredPoint(null);
    dragRef.current.isHovering = false;
  }, [dragRef]);

  const handlePinClick = useCallback(
    (point: NavigationPoint) => {
      router.push(point.href);
    },
    [router]
  );

  return (
    <>
      <Environment preset="night" />
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#00ff88" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#00d4ff" />
      <spotLight position={[0, 15, 0]} angle={0.3} penumbra={1} intensity={0.8} />

      <CameraController />
      <DataParticles />

      <GlobeGroup
        dragRef={dragRef}
        hoveredPoint={hoveredPoint}
        onHover={handleHover}
        onLeave={handleLeave}
        onPinClick={handlePinClick}
        visibleCategories={visibleCategories}
      />
    </>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────

export function InteractiveGlobe() {
  const dragRef = useRef<DragState>({
    isDragging: false,
    isHovering: false,
    hasDragged: false,
    lastX: 0,
    startX: 0,
    velocityX: 0,
    rotationY: 0,
  });

  const [visibleCategories, setVisibleCategories] = useState<Set<string>>(
    () => new Set(['learn', 'playbook', 'topic', 'framework', 'tool', 'consult'])
  );
  const [viewMode, setViewMode] = useState<'globe' | 'list'>('globe');

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current.isDragging = true;
    dragRef.current.hasDragged = false;
    dragRef.current.lastX = e.clientX;
    dragRef.current.startX = e.clientX;
    dragRef.current.velocityX = 0;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.lastX;
    dragRef.current.velocityX = dx * 0.005;
    dragRef.current.rotationY += dragRef.current.velocityX;
    dragRef.current.lastX = e.clientX;
    if (Math.abs(e.clientX - dragRef.current.startX) > 5) {
      dragRef.current.hasDragged = true;
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current.isDragging = false;
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat) && next.size > 1) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  // Legend entries: deduplicate consult (same color/concept as tool)
  const legendEntries = useMemo(
    () => Object.entries(CATEGORY_CONFIG).filter(([cat]) => cat !== 'consult'),
    []
  );

  // Points grouped by category — powers the accessible list view fallback
  const groupedPoints = useMemo(() => {
    const groups: Record<string, NavigationPoint[]> = {};
    for (const p of navigationPoints) {
      const key = p.category === 'consult' ? 'tool' : p.category;
      (groups[key] ||= []).push(p);
    }
    return groups;
  }, []);

  return (
    <div className="w-full h-full min-h-[400px] relative select-none">
      {/* View-mode toggle — top right */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border border-terminal-border bg-terminal-black/70 backdrop-blur-sm p-0.5">
        <button
          type="button"
          onClick={() => setViewMode('globe')}
          aria-pressed={viewMode === 'globe'}
          aria-label="Globe view"
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono transition-colors ${
            viewMode === 'globe'
              ? 'bg-terminal-green/15 text-terminal-green'
              : 'text-terminal-muted hover:text-terminal-text'
          }`}
        >
          <GlobeIcon className="w-3.5 h-3.5" aria-hidden="true" />
          Globe
        </button>
        <button
          type="button"
          onClick={() => setViewMode('list')}
          aria-pressed={viewMode === 'list'}
          aria-label="Show all as a list"
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono transition-colors ${
            viewMode === 'list'
              ? 'bg-terminal-green/15 text-terminal-green'
              : 'text-terminal-muted hover:text-terminal-text'
          }`}
        >
          <List className="w-3.5 h-3.5" aria-hidden="true" />
          Show all
        </button>
      </div>

      {viewMode === 'globe' ? (
        <>
          {/* Canvas container — handles all pointer & touch drag events */}
          <div
            className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <Canvas
              camera={{ position: [0, 0, 6], fov: 50 }}
              gl={{ antialias: true, alpha: true }}
              style={{ background: 'transparent' }}
            >
              <Scene dragRef={dragRef} visibleCategories={visibleCategories} />
            </Canvas>
          </div>

          {/* Category filter legend */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 flex-wrap justify-center px-2">
            {legendEntries.map(([cat, cfg]) => {
              const active = visibleCategories.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className="px-2.5 py-0.5 rounded-md text-xs font-mono border transition-all duration-200"
                  style={{
                    borderColor: active ? cfg.color : `${cfg.color}55`,
                    color: active ? cfg.color : 'rgba(255,255,255,0.6)',
                    backgroundColor: active ? `${cfg.color}1f` : 'transparent',
                  }}
                >
                  ● {cfg.label}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        /* Accessible list-view fallback — same navigation content, screen-reader friendly */
        <nav
          aria-label="Site navigation"
          className="w-full h-full overflow-y-auto p-4 pt-12"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {legendEntries.map(([cat, cfg]) => {
              const points = groupedPoints[cat] ?? [];
              if (points.length === 0) return null;
              return (
                <section
                  key={cat}
                  className="rounded-xl border border-terminal-border bg-terminal-gray/30 p-4"
                >
                  <h3
                    className="font-mono text-xs uppercase tracking-wider mb-2 flex items-center gap-2"
                    style={{ color: cfg.color }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: cfg.color }}
                      aria-hidden="true"
                    />
                    {cfg.label}
                  </h3>
                  <ul className="space-y-1.5">
                    {points.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={p.href}
                          className="group flex items-start gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-terminal-gray/50 transition-colors"
                        >
                          <ArrowRight
                            className="w-3.5 h-3.5 mt-0.5 shrink-0 text-terminal-muted group-hover:text-terminal-green transition-colors"
                            aria-hidden="true"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block font-mono text-sm text-terminal-text group-hover:text-terminal-green transition-colors">
                              {p.label}
                            </span>
                            <span className="block text-xs font-sans text-terminal-muted leading-relaxed">
                              {p.description}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}