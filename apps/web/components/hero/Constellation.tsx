"use client";

import { useEffect, useRef } from "react";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  pulse: number;
  pulseSpeed: number;
};

/**
 * The signature: a living memory constellation. Decisions drift as glowing
 * nodes connected by sky-blue threads. Quiet by default — slow, low-contrast.
 * Honors prefers-reduced-motion by rendering a single static frame.
 */
export function Constellation({
  className,
  density = 1,
  interactive = true,
}: {
  className?: string;
  density?: number;
  interactive?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes: Node[] = [];
    let raf = 0;
    let w = 0;
    let h = 0;

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round((w * h) / 26000 * density);
      nodes = Array.from({ length: Math.max(12, count) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.6 + 0.8,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.012 + 0.004,
      }));
    }

    function accent(alpha: number) {
      // sky-blue, mode-aware via computed style
      return `rgba(56, 189, 248, ${alpha})`;
    }

    const LINK_DIST = 132;

    function draw() {
      ctx!.clearRect(0, 0, w, h);

      // links
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DIST) {
            const strength = 1 - dist / LINK_DIST;
            ctx!.strokeStyle = accent(strength * 0.16);
            ctx!.lineWidth = strength * 0.8;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      // mouse links (draw a brighter web near the cursor)
      const m = mouse.current;
      if (m && interactive) {
        for (const n of nodes) {
          const dist = Math.hypot(n.x - m.x, n.y - m.y);
          if (dist < 180) {
            const strength = 1 - dist / 180;
            ctx!.strokeStyle = accent(strength * 0.35);
            ctx!.lineWidth = strength * 1.1;
            ctx!.beginPath();
            ctx!.moveTo(n.x, n.y);
            ctx!.lineTo(m.x, m.y);
            ctx!.stroke();
          }
        }
      }

      // nodes
      for (const n of nodes) {
        n.pulse += n.pulseSpeed;
        const glow = (Math.sin(n.pulse) + 1) / 2;
        const radius = n.r + glow * 0.7;

        ctx!.beginPath();
        ctx!.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx!.fillStyle = accent(0.35 + glow * 0.45);
        ctx!.fill();

        // soft halo
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, radius * 3, 0, Math.PI * 2);
        const grad = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 3);
        grad.addColorStop(0, accent(0.12 + glow * 0.08));
        grad.addColorStop(1, accent(0));
        ctx!.fillStyle = grad;
        ctx!.fill();
      }
    }

    function tick() {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      draw();
      raf = requestAnimationFrame(tick);
    }

    resize();
    if (reduced) {
      draw();
    } else {
      tick();
    }

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    let moveHandler: ((e: PointerEvent) => void) | null = null;
    let leaveHandler: (() => void) | null = null;
    if (interactive && !reduced) {
      moveHandler = (e: PointerEvent) => {
        const rect = canvas!.getBoundingClientRect();
        mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      };
      leaveHandler = () => {
        mouse.current = null;
      };
      window.addEventListener("pointermove", moveHandler);
      window.addEventListener("pointerleave", leaveHandler);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      if (moveHandler) window.removeEventListener("pointermove", moveHandler);
      if (leaveHandler) window.removeEventListener("pointerleave", leaveHandler);
    };
  }, [density, interactive]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ display: "block" }}
    />
  );
}
