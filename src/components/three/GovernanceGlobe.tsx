"use client";

/**
 * GovernanceGlobe — interactive cartographic globe.
 *
 * Rendered with D3-geo's orthographic projection on a 2D canvas (the same
 * technique behind editorial globes like anthropic.com): real country & US-state
 * borders, a graticule, and a dotted fill applied ONLY to the jurisdictions
 * where AI governance acts apply. Drag to rotate (versor trackball); the
 * jurisdiction facing the viewer drives the spotlight card, and the quick-jump
 * dots smoothly fly the globe to a jurisdiction.
 *
 * The globe auto-rotates so each jurisdiction's spotlight card cycles into view.
 * Rotation pauses on any user interaction (drag / quick-jump) and resumes after
 * a short grace period. Honours `prefers-reduced-motion` and pauses off-screen.
 *
 * Themed to the GovSecure dark/neon palette.
 *
 * Geo data: /public/geo/{countries-110m,states-10m}.json (world-atlas / us-atlas).
 * Jurisdiction data + geometry binding: @/data/governanceJurisdictions.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  geoOrthographic,
  geoPath,
  geoGraticule10,
  geoDistance,
  geoContains,
  geoArea,
  geoBounds,
  type GeoProjection,
} from "d3-geo";
import { feature, mesh } from "topojson-client";
import type {
  Topology,
  GeometryCollection as TopoGeometryCollection,
} from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import versor from "versor";
import Link from "next/link";
import { List, Globe as GlobeIcon, ArrowRight } from "lucide-react";
import {
  governanceJurisdictions,
  STATUS_LABELS,
  STATUS_HEX,
  JURISDICTION_GEO,
  type GovernanceJurisdiction,
} from "@/data/governanceJurisdictions";

// ─── Geometry helpers ───────────────────────────────────────────────────────

const SPHERE = { type: "Sphere" } as const;

/** Auto-rotation speed (degrees of longitude per second) — gentle editorial spin. */
const AUTO_ROTATE_DEG_PER_SEC = 6;
/** Pause auto-rotation for this long after the user interacts, then resume. */
const INTERACTION_RESUME_MS = 1500;

interface Dot {
  lon: number;
  lat: number;
  jurIndex: number;
}

/** Target [lng, lat] each jurisdiction; centre of the polygon or the capital. */
const TARGETS: [number, number][] = governanceJurisdictions.map((j) => [
  j.location[1],
  j.location[0],
]);

/** Deterministic RNG so the dot field is stable across renders. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rejection-sample dots inside a feature, density scaled by spherical area. */
function sampleDots(
  feat: Feature<Geometry>,
  jurIndex: number,
  rng: () => number,
): Dot[] {
  const area = geoArea(feat); // steradians (0–4π)
  const target = Math.min(420, Math.max(10, Math.round(area * 11000)));
  const [[minLon, minLat], [maxLon, maxLat]] = geoBounds(feat);
  const dots: Dot[] = [];
  let attempts = 0;
  const maxAttempts = target * 40;
  while (dots.length < target && attempts < maxAttempts) {
    attempts++;
    const lon = minLon + rng() * (maxLon - minLon);
    const lat = minLat + rng() * (maxLat - minLat);
    if (geoContains(feat, [lon, lat])) dots.push({ lon, lat, jurIndex });
  }
  return dots;
}

interface GeoData {
  graticule: ReturnType<typeof geoGraticule10>;
  worldBorders: Geometry;
  stateBorders: Geometry;
  dots: Dot[];
  /** Marker fallbacks for jurisdictions with no polygon at this resolution. */
  markerJurs: number[];
}

// ─── Globe canvas ─────────────────────────────────────────────────────────────

function GlobeCanvas({
  seek,
  onFrontChange,
}: {
  seek: { index: number; nonce: number };
  onFrontChange: (index: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<GeoData | null>(null);
  const projRef = useRef<GeoProjection | null>(null);
  const draggingRef = useRef(false);
  const seekRef = useRef<{ index: number; nonce: number }>(seek);
  const activeRef = useRef(0);
  const lastFrontRef = useRef(-1);
  const animRef = useRef<number | null>(null);
  const spinRef = useRef<number | null>(null);
  const seekingRef = useRef(false);
  const onScreenRef = useRef(true);

  seekRef.current = seek;

  // ── Load + precompute geo data once ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [worldRes, usRes] = await Promise.all([
        fetch("/geo/countries-110m.json"),
        fetch("/geo/states-10m.json"),
      ]);
      const worldTopo = (await worldRes.json()) as Topology;
      const usTopo = (await usRes.json()) as Topology;
      if (cancelled) return;

      const countries = (
        feature(
          worldTopo,
          worldTopo.objects.countries as TopoGeometryCollection,
        ) as FeatureCollection<Geometry>
      ).features;
      const states = (
        feature(
          usTopo,
          usTopo.objects.states as TopoGeometryCollection,
        ) as FeatureCollection<Geometry>
      ).features;

      const byCountry = new Map(countries.map((f) => [String(f.properties?.name), f]));
      const byState = new Map(states.map((f) => [String(f.properties?.name), f]));

      const rng = mulberry32(0x9e3779b9);
      const dots: Dot[] = [];
      const markerJurs: number[] = [];

      governanceJurisdictions.forEach((j, idx) => {
        const geo = JURISDICTION_GEO[j.id] ?? {};
        let matched = false;
        for (const name of geo.countries ?? []) {
          const f = byCountry.get(name);
          if (f) {
            dots.push(...sampleDots(f, idx, rng));
            matched = true;
          }
        }
        for (const name of geo.states ?? []) {
          const f = byState.get(name);
          if (f) {
            dots.push(...sampleDots(f, idx, rng));
            matched = true;
          }
        }
        if (!matched) markerJurs.push(idx);
      });

      setData({
        graticule: geoGraticule10(),
        worldBorders: mesh(worldTopo, worldTopo.objects.countries as TopoGeometryCollection),
        stateBorders: mesh(usTopo, usTopo.objects.states as TopoGeometryCollection),
        dots,
        markerJurs,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Set up projection, rendering, and interaction once data is ready ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const projection = geoOrthographic().clipAngle(90).rotate([-TARGETS[0][0], -TARGETS[0][1]]);
    projRef.current = projection;
    const path = geoPath(projection, ctx);

    let cssW = 0;
    let cssH = 0;
    const resize = () => {
      cssW = canvas.offsetWidth;
      cssH = canvas.offsetHeight;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      const size = Math.min(cssW, cssH);
      projection.scale(size / 2 - 6).translate([cssW / 2, cssH / 2]);
      render();
    };

    function render() {
      if (!ctx) return;
      ctx.save();
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx.scale(dpr, dpr);

      // Sphere — fully opaque so the page's dot-mesh/aurora background
      // effect does not bleed through the globe.
      ctx.beginPath();
      path(SPHERE);
      ctx.fillStyle = "rgb(6, 22, 14)";
      ctx.fill();

      // Graticule — symmetric grid lines, kept light & bright
      ctx.beginPath();
      path(data!.graticule);
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "rgba(210, 235, 222, 0.32)";
      ctx.stroke();

      // Continent / country borders — light & bright
      ctx.beginPath();
      path(data!.worldBorders);
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = "rgba(224, 240, 232, 0.62)";
      ctx.stroke();

      // US state borders — slightly softer than national outlines
      ctx.beginPath();
      path(data!.stateBorders);
      ctx.lineWidth = 0.45;
      ctx.strokeStyle = "rgba(210, 232, 222, 0.32)";
      ctx.stroke();

      // Dot field — back-face culled, grouped by colour, active drawn last.
      const rot = projection.rotate();
      const center: [number, number] = [-rot[0], -rot[1]];
      const active = activeRef.current;

      const drawDots = (predicate: (d: Dot) => boolean, size: number, alpha: number) => {
        ctx.globalAlpha = alpha;
        let curColor = "";
        for (const d of data!.dots) {
          if (!predicate(d)) continue;
          if (geoDistance([d.lon, d.lat], center) > 1.5708) continue;
          const p = projection([d.lon, d.lat]);
          if (!p) continue;
          const color = STATUS_HEX[governanceJurisdictions[d.jurIndex].status];
          if (color !== curColor) {
            ctx.fillStyle = color;
            curColor = color;
          }
          ctx.fillRect(p[0] - size / 2, p[1] - size / 2, size, size);
        }
      };

      drawDots((d) => d.jurIndex !== active, 1.5, 0.7);
      drawDots((d) => d.jurIndex === active, 2.2, 1);

      // Marker fallbacks (city-states / global standards)
      ctx.globalAlpha = 1;
      for (const idx of data!.markerJurs) {
        const [lng, lat] = TARGETS[idx];
        if (geoDistance([lng, lat], center) > 1.5708) continue;
        const p = projection([lng, lat]);
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p[0], p[1], idx === active ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle = STATUS_HEX[governanceJurisdictions[idx].status];
        ctx.fill();
      }

      // Sphere rim
      ctx.beginPath();
      path(SPHERE);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = "rgba(0, 255, 136, 0.18)";
      ctx.stroke();

      ctx.restore();

      // Report the jurisdiction now facing the viewer.
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < TARGETS.length; i++) {
        const dist = geoDistance(TARGETS[i], center);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
      activeRef.current = best;
      if (best !== lastFrontRef.current) {
        lastFrontRef.current = best;
        onFrontChange(best);
      }
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Timestamp (performance.now clock) before which auto-rotation stays paused.
    let interactionResumeAt = 0;

    // ── versor trackball drag ──
    let v0: [number, number, number];
    let q0: [number, number, number, number];
    let r0: [number, number, number];

    const toPoint = (e: PointerEvent): [number, number] => {
      const rect = canvas!.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };

    const onPointerDown = (e: PointerEvent) => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      seekRef.current = { ...seekRef.current, nonce: -1 }; // cancel any seek
      seekingRef.current = false;
      draggingRef.current = true;
      const p = projection.invert!(toPoint(e));
      if (!p) return;
      v0 = versor.cartesian(p);
      r0 = projection.rotate();
      q0 = versor(r0);
      canvas!.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const inv = projection.rotate(r0).invert!(toPoint(e));
      if (!inv) return;
      const v1 = versor.cartesian(inv);
      const q1 = versor.multiply(q0, versor.delta(v0, v1));
      projection.rotate(versor.rotation(q1));
      render();
    };
    const onPointerUp = (e: PointerEvent) => {
      draggingRef.current = false;
      interactionResumeAt = performance.now() + INTERACTION_RESUME_MS;
      try {
        canvas!.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("resize", resize);
    resize();
    canvas.style.opacity = "1";

    // ── React to seek commands (quick-jump) ──
    let lastSeekNonce = -2;
    const seekPoll = setInterval(() => {
      const s = seekRef.current;
      if (s.nonce === lastSeekNonce || s.nonce < 0 || draggingRef.current) return;
      lastSeekNonce = s.nonce;
      const r1: [number, number] = [-TARGETS[s.index][0], -TARGETS[s.index][1]];
      const start = projection.rotate();
      const interp = versor.interpolate([start[0], start[1], start[2] ?? 0], [r1[0], r1[1], 0]);
      const t0 = performance.now();
      const dur = 900;
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / dur);
        const e = t * (2 - t); // ease-out
        projection.rotate(interp(e));
        render();
        if (t < 1 && !draggingRef.current) {
          animRef.current = requestAnimationFrame(step);
        } else {
          // Seek finished (or was interrupted) — hold, then resume auto-spin.
          seekingRef.current = false;
          interactionResumeAt = performance.now() + INTERACTION_RESUME_MS;
        }
      };
      seekingRef.current = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = requestAnimationFrame(step);
    }, 80);

    // ── Auto-rotation loop ──
    // Runs continuously; skips the work while the user is interacting, during a
    // quick-jump seek, within the post-interaction grace period, or off-screen.
    let spinLast = 0;
    const spinFrame = (ts: number) => {
      spinRef.current = requestAnimationFrame(spinFrame);
      const dt = Math.min(ts - spinLast, 64); // clamp first frame / tab-return jumps
      spinLast = ts;
      if (
        draggingRef.current ||
        seekingRef.current ||
        !onScreenRef.current ||
        ts < interactionResumeAt
      ) {
        return;
      }
      const r = projection.rotate();
      projection.rotate([r[0] + (AUTO_ROTATE_DEG_PER_SEC * dt) / 1000, r[1], r[2] ?? 0]);
      render();
    };
    if (!prefersReducedMotion) {
      spinRef.current = requestAnimationFrame(spinFrame);
    }

    // Pause the spin (skip render work) whenever the globe is scrolled off-screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreenRef.current = entry.isIntersecting;
      },
      { threshold: 0.05 },
    );
    io.observe(canvas);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("resize", resize);
      clearInterval(seekPoll);
      io.disconnect();
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (spinRef.current) cancelAnimationFrame(spinRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div className="relative h-full w-full">
      {!data && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-sm text-terminal-muted">Loading globe…</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab touch-none opacity-0 transition-opacity duration-700 active:cursor-grabbing"
        style={{ contain: "layout paint size" }}
      />
    </div>
  );
}

// ─── Spotlight helpers ─────────────────────────────────────────────────────────

function statusClasses(status: GovernanceJurisdiction["status"]): string {
  switch (status) {
    case "in-force":
    case "enacted":
      return "border-amber/40 bg-amber/10 text-amber";
    case "proposed":
      return "border-cyan/40 bg-cyan/10 text-cyan";
    default:
      return "border-terminal-green/40 bg-terminal-green/10 text-terminal-green";
  }
}

// NOTE: full literal class strings so Tailwind's JIT detects them.
const DOT_CLASS: Record<GovernanceJurisdiction["status"], { active: string; idle: string }> = {
  "in-force": { active: "w-6 bg-amber", idle: "w-2 bg-amber/40 hover:bg-amber/70" },
  enacted: { active: "w-6 bg-amber", idle: "w-2 bg-amber/40 hover:bg-amber/70" },
  proposed: { active: "w-6 bg-cyan", idle: "w-2 bg-cyan/40 hover:bg-cyan/70" },
  framework: {
    active: "w-6 bg-terminal-green",
    idle: "w-2 bg-terminal-green/40 hover:bg-terminal-green/70",
  },
};

function dotClass(status: GovernanceJurisdiction["status"], active: boolean): string {
  return active ? DOT_CLASS[status].active : DOT_CLASS[status].idle;
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function GovernanceGlobe() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [seek, setSeek] = useState({ index: 0, nonce: 0 });
  const [viewMode, setViewMode] = useState<"globe" | "list">("globe");

  const handleFrontChange = useCallback((i: number) => setActiveIndex(i), []);
  const seekTo = useCallback((i: number) => setSeek((s) => ({ index: i, nonce: s.nonce + 1 })), []);
  const active = governanceJurisdictions[activeIndex];

  return (
    <div className="relative h-full w-full select-none">
      {/* View-mode toggle */}
      <div className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-md border border-terminal-border bg-terminal-black/70 p-0.5 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setViewMode("globe")}
          aria-pressed={viewMode === "globe"}
          aria-label="Globe view"
          className={`flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs transition-colors ${
            viewMode === "globe"
              ? "bg-terminal-green/15 text-terminal-green"
              : "text-terminal-muted hover:text-terminal-text"
          }`}
        >
          <GlobeIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Globe
        </button>
        <button
          type="button"
          onClick={() => setViewMode("list")}
          aria-pressed={viewMode === "list"}
          aria-label="Show all jurisdictions as a list"
          className={`flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs transition-colors ${
            viewMode === "list"
              ? "bg-terminal-green/15 text-terminal-green"
              : "text-terminal-muted hover:text-terminal-text"
          }`}
        >
          <List className="h-3.5 w-3.5" aria-hidden="true" />
          Show all
        </button>
      </div>

      {viewMode === "globe" ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, rgba(0,255,136,0.08), transparent 62%)",
            }}
          />

          <div className="absolute inset-0 z-10">
            <GlobeCanvas seek={seek} onFrontChange={handleFrontChange} />
          </div>

          {/* Spotlight card — reflects whatever is facing the viewer */}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex flex-col items-center px-3">
            <div
              key={active.id}
              className="pointer-events-auto w-full max-w-md animate-fade-in rounded-xl border border-terminal-border/70 bg-terminal-black/80 p-4 shadow-2xl backdrop-blur-md"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${statusClasses(
                    active.status,
                  )}`}
                >
                  {STATUS_LABELS[active.status]}
                </span>
                <span className="font-mono text-xs text-terminal-muted">{active.region}</span>
              </div>
              <div className="font-mono text-lg font-bold leading-tight text-terminal-text">
                {active.act}
              </div>
              <p className="mt-1 font-sans text-sm leading-relaxed text-terminal-muted">
                {active.note}
              </p>
            </div>

            {/* Quick-jump dots */}
            <div className="pointer-events-auto mx-auto mt-4 flex max-w-xs flex-wrap items-center justify-center gap-x-2.5 gap-y-2">
              {governanceJurisdictions.map((j, i) => (
                <button
                  key={j.id}
                  type="button"
                  aria-label={`Rotate to ${j.act}`}
                  aria-current={i === activeIndex}
                  onClick={() => seekTo(i)}
                  className={`h-2 shrink-0 rounded-full transition-all duration-300 ${dotClass(
                    j.status,
                    i === activeIndex,
                  )}`}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <nav
          aria-label="AI governance jurisdictions"
          className="h-full w-full overflow-y-auto p-4 pt-12"
        >
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {governanceJurisdictions.map((j) => (
              <li key={j.id}>
                <Link
                  href="/topics/risk-compliance"
                  className="group flex items-start gap-2 rounded-md -mx-2 px-2 py-1.5 transition-colors hover:bg-terminal-gray/50"
                >
                  <ArrowRight
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terminal-muted transition-colors group-hover:text-terminal-green"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-sm text-terminal-text transition-colors group-hover:text-terminal-green">
                        {j.act}
                      </span>
                      <span
                        className={`rounded-md border px-1 py-0.5 font-mono text-[9px] uppercase tracking-wider ${statusClasses(
                          j.status,
                        )}`}
                      >
                        {STATUS_LABELS[j.status]}
                      </span>
                    </span>
                    <span className="block font-sans text-xs leading-relaxed text-terminal-muted">
                      {j.region} — {j.note}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
