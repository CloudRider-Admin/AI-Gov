"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { visualGuides } from "@/data/content";

export function VisualGuides() {
  const guidesWithImages = visualGuides.filter((g) => g.image);
  const [activeImage, setActiveImage] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (!activeImage) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setActiveImage(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeImage]);

  return (
    <section className="section">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-12">
          <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-2 block">
            Visual Governance Guides
          </span>
          <h2 className="section-title">
            Complex Concepts, Simplified
          </h2>
          <p className="section-subtitle mx-auto">
            Infographics and diagrams that make AI governance accessible.
          </p>
        </div>

        {/* Visual guides CTAs */}
        <div className="flex flex-col gap-5">
          {guidesWithImages.map((guide) => (
            <div
              key={guide.id}
              className="group relative w-full rounded-2xl overflow-hidden cursor-pointer"
              style={{ aspectRatio: "16/6" }}
              onClick={() => setActiveImage({ src: guide.image!, alt: guide.title })}
            >
              {/* Background image */}
              <Image
                src={guide.image!}
                alt={guide.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />

              {/* Left-side gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-terminal-black via-terminal-black/80 to-transparent" />

              {/* Content — left aligned, vertically centered */}
              <div className="absolute inset-0 flex flex-col justify-center px-12 max-w-xl">
                <span className="font-mono text-terminal-green text-xs uppercase tracking-widest mb-3">
                  {guide.type}
                </span>
                <h3 className="font-mono text-3xl font-bold text-terminal-text leading-tight mb-3 group-hover:text-terminal-green transition-colors">
                  {guide.title}
                </h3>
                <p className="font-sans text-terminal-muted text-sm mb-6">
                  {guide.description}
                </p>
                <div>
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-terminal-green text-terminal-green font-mono text-sm group-hover:bg-terminal-green group-hover:text-terminal-black transition-colors">
                    View Guide
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {activeImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setActiveImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white font-mono text-2xl leading-none"
            onClick={() => setActiveImage(null)}
            aria-label="Close"
          >
            ✕
          </button>
          <div
            className="relative w-full max-w-6xl max-h-[90vh]"
            style={{ aspectRatio: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={activeImage.src}
              alt={activeImage.alt}
              width={1920}
              height={1080}
              className="object-contain w-full h-full max-h-[90vh] rounded-xl"
            />
          </div>
        </div>
      )}
    </section>
  );
}
