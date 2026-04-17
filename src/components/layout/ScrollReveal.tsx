'use client';

import { useEffect } from 'react';

/**
 * ScrollReveal — adds a global IntersectionObserver that reveals elements
 * with the `data-reveal` attribute as they scroll into view.
 *
 * Usage: add `data-reveal` to any element you want to fade/slide in.
 * The component itself renders nothing; it only registers the observer once.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );

    const elements = document.querySelectorAll('[data-reveal]');
    elements.forEach((el) => observer.observe(el));

    // Re-observe when DOM changes (e.g. client-side navigation)
    const mutationObserver = new MutationObserver(() => {
      const newElements = document.querySelectorAll('[data-reveal]:not(.revealed)');
      newElements.forEach((el) => observer.observe(el));
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return null;
}
