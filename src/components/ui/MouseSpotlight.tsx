"use client";

import { useEffect, useRef } from "react";

/**
 * Interactive dot-mesh background with wave ripple on hover.
 * Base layer: dim CSS dot pattern. Around the cursor a radial mask cuts
 * it out and a canvas draws bright accent dots with a time-animated sine-
 * wave displacement — dots ripple outward from the cursor.
 */

const GRID = 14;           // matches tailwind bg-dots size
const RADIUS = 280;        // hover/ripple area radius in px
const WAVE_AMP = 5;        // max outward dot displacement
const WAVELENGTH = 55;     // distance between wave crests
const WAVE_SPEED = 1.8;    // wave travel speed (rad/sec)
const ACCENT = "0, 255, 136";

const BASE_MASK = (x: number, y: number) =>
  `radial-gradient(${RADIUS}px circle at ${x}px ${y}px, transparent 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.85) 78%, rgba(0,0,0,1) 100%)`;

export function MouseSpotlight() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Respect reduced-motion — dim base layer only, no ripple.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let rafId: number | null = null;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = (now: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      const p = posRef.current;
      if (!p) {
        rafId = null;
        return;
      }

      const phaseTime = (now / 1000) * WAVE_SPEED * Math.PI;
      const twoPi = Math.PI * 2;
      const radiusSq = RADIUS * RADIUS;

      // Only iterate cells intersecting the hover circle
      const minX = Math.max(0, Math.floor((p.x - RADIUS) / GRID) * GRID);
      const maxX = Math.min(w, Math.ceil((p.x + RADIUS) / GRID) * GRID);
      const minY = Math.max(0, Math.floor((p.y - RADIUS) / GRID) * GRID);
      const maxY = Math.min(h, Math.ceil((p.y + RADIUS) / GRID) * GRID);

      for (let gy = minY; gy <= maxY; gy += GRID) {
        for (let gx = minX; gx <= maxX; gx += GRID) {
          const dx = gx - p.x;
          const dy = gy - p.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > radiusSq) continue;

          const dist = Math.sqrt(distSq);
          const falloff = 1 - dist / RADIUS;
          const falloffSq = falloff * falloff;

          // Radial sine wave — rings move inward toward cursor over time
          const phase = (dist / WAVELENGTH) * twoPi - phaseTime;
          const wave = Math.sin(phase);

          // Displace along outward radial vector, scaled by falloff
          const offsetMag = wave * WAVE_AMP * falloffSq;
          const invDist = dist > 0 ? 1 / dist : 0;
          const px = gx + dx * invDist * offsetMag;
          const py = gy + dy * invDist * offsetMag;

          // Brightness: crests glow brighter, edges fade out
          const alpha = falloffSq * (0.45 + 0.4 * (wave * 0.5 + 0.5));
          const r = 0.9 + falloffSq * 0.7;

          ctx.fillStyle = `rgba(${ACCENT}, ${alpha.toFixed(3)})`;
          ctx.fillRect(px - r, py - r, r * 2, r * 2);
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    const ensureAnimating = () => {
      if (rafId == null) rafId = requestAnimationFrame(draw);
    };

    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      const mask = BASE_MASK(e.clientX, e.clientY);
      base.style.setProperty("mask-image", mask);
      base.style.setProperty("-webkit-mask-image", mask);
      ensureAnimating();
    };

    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        posRef.current = null;
        base.style.removeProperty("mask-image");
        base.style.removeProperty("-webkit-mask-image");
      }
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseout", onOut);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onOut);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
      <div ref={baseRef} className="absolute inset-0 dot-bg opacity-70" />
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
