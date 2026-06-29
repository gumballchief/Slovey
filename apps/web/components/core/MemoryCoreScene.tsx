"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

const SKY = new THREE.Color("#38BDF8");
const DEEP = new THREE.Color("#0A0F1C");
const CORAL = new THREE.Color("#F43F5E");
const GREEN = new THREE.Color("#10B981");

const DECISIONS = [
  "PR #29499 — verbs must match the contract",
  "PR #28182 — no build-time env inlining",
  "PR #29296 — payments handled internally",
  "PR #29501 — no platform deploy configs",
  "PR #29442 — security goes through review",
  "PR #29295 — fix the root cause, not symptoms",
];

/* ─────────────── Core: fresnel rim + breathing displacement ─────────────── */
function Core({ pulseRef }: { pulseRef: React.MutableRefObject<number> }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uRim: { value: SKY },
      uInner: { value: DEEP },
    }),
    []
  );

  useFrame((state, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      // ease pulse back to 0
      pulseRef.current = THREE.MathUtils.damp(pulseRef.current, 0, 3, delta);
      matRef.current.uniforms.uPulse.value = pulseRef.current;
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.08;
      meshRef.current.rotation.x += delta * 0.02;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 7]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        transparent
        vertexShader={`
          uniform float uTime;
          uniform float uPulse;
          varying vec3 vNormal;
          varying vec3 vView;

          // cheap 3d noise
          vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
          vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
          vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
          vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
          float snoise(vec3 v){
            const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
            vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
            vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
            vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
            i=mod289(i);
            vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
            float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
            vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
            vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
            vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
            vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
            vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
            vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
            vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
            p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
            vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
            return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
          }

          void main(){
            vNormal = normalize(normalMatrix * normal);
            float n = snoise(normal * 1.6 + uTime * 0.15);
            float disp = n * (0.035 + uPulse * 0.12);
            vec3 pos = position + normal * disp;
            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            vView = -mv.xyz;
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform vec3 uRim;
          uniform vec3 uInner;
          uniform float uPulse;
          varying vec3 vNormal;
          varying vec3 vView;
          void main(){
            vec3 V = normalize(vView);
            float fres = pow(1.0 - max(dot(normalize(vNormal), V), 0.0), 2.2);
            vec3 col = mix(uInner, uRim, fres);
            col += uRim * uPulse * 0.6;
            float alpha = 0.55 + fres * 0.45 + uPulse * 0.3;
            gl_FragColor = vec4(col, alpha);
          }
        `}
      />
    </mesh>
  );
}

/* ─────────────── Orbital rings ─────────────── */
function Rings() {
  const group = useRef<THREE.Group>(null);
  const rings = useMemo(
    () => [
      { r: 1.7, tilt: [0.5, 0.2, 0], speed: 0.12 },
      { r: 2.2, tilt: [-0.7, 0.5, 0.3], speed: -0.08 },
      { r: 2.7, tilt: [0.3, -0.6, 0.4], speed: 0.05 },
    ],
    []
  );
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((_, delta) => {
    rings.forEach((ring, i) => {
      const m = refs.current[i];
      if (m) m.rotation.z += delta * ring.speed;
    });
  });
  return (
    <group ref={group}>
      {rings.map((ring, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          rotation={ring.tilt as [number, number, number]}
          scale={[1, 0.92, 1]}
        >
          <torusGeometry args={[ring.r, 0.004, 16, 160]} />
          <meshBasicMaterial color={SKY} transparent opacity={0.18} />
        </mesh>
      ))}
    </group>
  );
}

/* ─────────────── Decision nodes drifting on orbits ─────────────── */
function Nodes({
  onHover,
}: {
  onHover: (text: string | null, x: number, y: number) => void;
}) {
  const COUNT = 160;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const ringDefs = useMemo(
    () => [
      { r: 1.7, tilt: [0.5, 0.2, 0], speed: 0.12 },
      { r: 2.2, tilt: [-0.7, 0.5, 0.3], speed: -0.08 },
      { r: 2.7, tilt: [0.3, -0.6, 0.4], speed: 0.05 },
    ],
    []
  );

  const nodes = useMemo(() => {
    return Array.from({ length: COUNT }, (_, i) => {
      const ring = ringDefs[i % ringDefs.length];
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(ring.tilt[0], ring.tilt[1], ring.tilt[2])
      );
      return {
        ring,
        q,
        angle: Math.random() * Math.PI * 2,
        speed: ring.speed * (0.6 + Math.random() * 0.8),
        active: Math.random() > 0.86,
        scale: 0.012 + Math.random() * 0.02,
        decision: DECISIONS[i % DECISIONS.length],
      };
    });
  }, [ringDefs]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const n = nodes[i];
      const a = n.angle + t * n.speed;
      const v = new THREE.Vector3(
        Math.cos(a) * n.ring.r,
        Math.sin(a) * n.ring.r * 0.92,
        0
      ).applyQuaternion(n.q);
      dummy.position.copy(v);
      const pulse = n.active ? 1 + Math.sin(t * 2 + i) * 0.3 : 1;
      dummy.scale.setScalar(n.scale * pulse);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.copy(n.active ? SKY : SKY).multiplyScalar(n.active ? 1.6 : 0.7);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, COUNT]}
      onPointerMove={(e) => {
        e.stopPropagation();
        const id = e.instanceId;
        if (id != null) onHover(nodes[id].decision, e.clientX, e.clientY);
      }}
      onPointerOut={() => onHover(null, 0, 0)}
    >
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/* ─────────────── Starfield with cursor parallax ─────────────── */
function Starfield() {
  const ref = useRef<THREE.Points>(null);
  const { pointer } = useThree();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 1400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const radius = 6 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y = THREE.MathUtils.damp(
      ref.current.rotation.y,
      pointer.x * 0.15,
      2,
      delta
    );
    ref.current.rotation.x = THREE.MathUtils.damp(
      ref.current.rotation.x,
      -pointer.y * 0.15,
      2,
      delta
    );
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.02} color={SKY} transparent opacity={0.5} sizeAttenuation toneMapped={false} />
    </points>
  );
}

/* ─────────────── The product moment: incoming PR → verdict ─────────────── */
type Verdict = { kind: "clear" | "conflict"; text: string } | null;

function ProductMoment({
  pulseRef,
  onVerdict,
}: {
  pulseRef: React.MutableRefObject<number>;
  onVerdict: (v: Verdict) => void;
}) {
  const incoming = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Line>(null);
  const phase = useRef<{ t: number; state: number; conflict: boolean; target: THREE.Vector3 }>({
    t: 0,
    state: 0,
    conflict: false,
    target: new THREE.Vector3(),
  });

  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    return g;
  }, []);

  useFrame((state, delta) => {
    const p = phase.current;
    p.t += delta;
    const mesh = incoming.current;
    if (!mesh) return;

    // state 0: idle waiting → start every 6s
    if (p.state === 0 && p.t > 2) {
      p.state = 1;
      p.t = 0;
      p.conflict = Math.random() > 0.5;
      mesh.visible = true;
    }

    if (p.state === 1) {
      // fly in from right toward core
      const prog = Math.min(p.t / 1.6, 1);
      const eased = 1 - Math.pow(1 - prog, 3);
      mesh.position.set(
        THREE.MathUtils.lerp(5, 0.2, eased),
        THREE.MathUtils.lerp(1.5, 0, eased),
        THREE.MathUtils.lerp(2, 0, eased)
      );
      const m = mesh.material as THREE.MeshBasicMaterial;
      m.color.copy(p.conflict ? CORAL : SKY);
      if (prog >= 1) {
        p.state = 2;
        p.t = 0;
        pulseRef.current = 1;
        if (p.conflict) {
          const ang = Math.random() * Math.PI * 2;
          p.target.set(Math.cos(ang) * 2.2, Math.sin(ang) * 2.0, 0.5);
          onVerdict({ kind: "conflict", text: "Conflicts with PR #29296 — payments handled internally" });
        } else {
          onVerdict({ kind: "clear", text: "Clear — no conflicting decision" });
        }
      }
    }

    if (p.state === 2) {
      // hold verdict ~2.6s
      if (p.conflict && lineRef.current) {
        lineRef.current.visible = true;
        const arr = (lineGeo.attributes.position as THREE.BufferAttribute).array as Float32Array;
        arr[0] = 0; arr[1] = 0; arr[2] = 0;
        arr[3] = p.target.x; arr[4] = p.target.y; arr[5] = p.target.z;
        lineGeo.attributes.position.needsUpdate = true;
      }
      if (p.t > 2.6) {
        p.state = 0;
        p.t = 0;
        mesh.visible = false;
        if (lineRef.current) lineRef.current.visible = false;
        onVerdict(null);
      }
    }
  });

  return (
    <group>
      <mesh ref={incoming} visible={false}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={SKY} toneMapped={false} />
      </mesh>
      {/* @ts-expect-error line is a valid three element */}
      <line ref={lineRef} geometry={lineGeo} visible={false}>
        <lineBasicMaterial color={CORAL} transparent opacity={0.9} toneMapped={false} />
      </line>
    </group>
  );
}

/* ─────────────── Scene assembly ─────────────── */
function Scene({
  onHover,
  onVerdict,
  light,
}: {
  onHover: (t: string | null, x: number, y: number) => void;
  onVerdict: (v: Verdict) => void;
  light: boolean;
}) {
  const pulseRef = useRef(0);
  return (
    <>
      <Starfield />
      <Rings />
      <Nodes onHover={onHover} />
      <Core pulseRef={pulseRef} />
      <ProductMoment pulseRef={pulseRef} onVerdict={onVerdict} />
      <EffectComposer>
        <Bloom
          intensity={light ? 0.35 : 0.65}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.4}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export default function MemoryCoreScene({ light = false }: { light?: boolean }) {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [active, setActive] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Pause rendering when offscreen
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), {
      threshold: 0.05,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="relative w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 2]}
        frameloop={active ? "always" : "never"}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <Scene
          light={light}
          onHover={(text, x, y) => setTip(text ? { text, x, y } : null)}
          onVerdict={setVerdict}
        />
      </Canvas>

      {/* Hover tooltip */}
      {tip && (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded-md text-[11px] font-mono bg-[#0A0F1C] text-[#38BDF8] border border-[#38BDF8]/30 shadow-lg"
          style={{ left: tip.x + 12, top: tip.y + 12 }}
        >
          {tip.text}
        </div>
      )}

      {/* Verdict callout */}
      {verdict && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-40 pointer-events-none">
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono backdrop-blur-md border ${
              verdict.kind === "conflict"
                ? "bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/30"
                : "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${verdict.kind === "conflict" ? "bg-[#F43F5E]" : "bg-[#10B981]"}`} />
            {verdict.text}
          </div>
        </div>
      )}
    </div>
  );
}
