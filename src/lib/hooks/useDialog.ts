"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Modal dialog behaviour for a panel or drawer: Escape closes it, Tab is
 * trapped inside it, focus moves in on open, and returns to whatever opened it
 * on close.
 *
 * Without this a keyboard or screen-reader user can tab straight out of an open
 * drawer into the page behind — which still scrolls, still takes clicks, and
 * gives no way back. That is a WCAG 2.1.2 (no keyboard trap, in the inverse
 * sense of losing context), 2.4.3 (focus order) and 4.1.2 (name, role, value)
 * failure, and a Section 508 procurement blocker.
 *
 * Returns a ref to spread onto the dialog container. Pair it with
 * `role="dialog" aria-modal="true"` and an `aria-labelledby` pointing at the
 * dialog's heading.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  // Held in a ref so a re-rendered parent passing a new closure does not
  // re-run the effect and steal focus mid-interaction.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus in. Prefer the first control; fall back to the container so
    // the screen reader still announces the dialog when it holds no controls.
    const first = container.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? container).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === firstEl || active === container)) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && active === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    // The page behind must not scroll while a modal is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, []);

  return ref;
}
