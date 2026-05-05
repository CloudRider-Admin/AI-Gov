# GovSecure Design System

One-page reference. When in doubt, **use the tokens listed here and no others** —
every inconsistency in the app was caused by developers having too many valid choices.

Design language: **terminal / precision-engineering aesthetic**. Dark mode default,
monospace for signals, neon-green as the single primary accent.

---

## Typography — the "mono-for-signals" rule

**`font-mono` is reserved for signals.** `font-sans` is the default for prose.

| Use `font-mono` for | Use `font-sans` for |
| --- | --- |
| Logo, header nav items | Body copy (policy descriptions, FAQ answers, risk reasoning) |
| Section eyebrows (uppercase, tracking-wider) | Long-form explanatory text |
| Timestamps, IDs, hashes | Marketing prose, empty states |
| `>` prompt prefixes, code/command output | Article / learn content |
| Status badges (Risk: HIGH, Priority: LOW) | Form helper text |
| Labels on form fields | Dialog body text |
| Counters ("Exchange 2 of 5"), metric values | Tooltip/hint text |

**Sizing scale:** `text-xs / text-sm / text-base / text-lg / text-xl / text-2xl`+ per
Tailwind defaults. Never use arbitrary sizes like `text-[10px]`. `text-xs` (12px) is
the absolute floor for accessibility.

---

## Colors — semantic tokens only

Never use raw Tailwind colors (`bg-blue-50`, `text-amber-500`, etc.). Every color in
the UI resolves to one of these:

| Token | Purpose | Example |
| --- | --- | --- |
| `terminal-black` | Page background | body, sections |
| `terminal-dark` | **Raised** surface (cards, dropdowns, modals) | Headers, cards, overlays |
| `terminal-gray` | **Sunken** surface (inputs, code blocks, inline chips) | textarea, `<pre>`, policy chips |
| `terminal-border` | Default border | cards, inputs, dividers |
| `terminal-text` | Primary text | headings, body |
| `terminal-muted` | Secondary text | captions, metadata, placeholders |
| `terminal-green` | **Primary / success / action** | CTAs, active nav, success states, key accents |
| `terminal-cyan` | **Info / clarification** | "We need more context" panels, info banners |
| `terminal-amber` | **Warning / non-fatal error** | Retry-able errors, upgrade prompts |
| `terminal-red` | **Critical / error** | Destructive actions, failed validations |

### Opacity modifier rule

Opacity modifiers like `/40`, `/60` reduce contrast. Rule of thumb:

- **`text-base` and above**: `/60` OK for de-emphasis
- **`text-sm`**: full opacity required
- **`text-xs`**: full opacity required (never `/60`, `/40`)

This keeps all text ≥ WCAG AA 4.5:1 contrast.

---

## Surfaces — 3 levels

| Pattern | Class | Use |
| --- | --- | --- |
| Raised | `card` (extends `glass`) | Cards, dropdowns, popovers |
| Sunken | `bg-terminal-gray/30` | Inputs, code blocks, inline chips |
| Overlay | `glass` | Modals, toasts (full-page overlays) |

Do **not** invent new surface shades (`bg-terminal-gray/70`, `bg-terminal-dark/50`, etc.).
If you need a new surface, add it here first.

---

## Radius — 3 sizes

| Class | Use |
| --- | --- |
| `rounded-md` | Chips, inline badges, inputs, code blocks |
| `rounded-xl` | Cards, surfaces, panels, dialogs |
| `rounded-full` | Pills, avatars, status dots, primary CTAs |

Never use `rounded-sm`, `rounded-lg`, `rounded-2xl`, `rounded-3xl`. If your element
doesn't fit one of the three, rethink the element.

---

## Spacing — 8pt scale

Use these Tailwind tokens only: `2, 4, 6, 8, 10, 12, 16, 20, 24, 32`
(i.e. 8px, 16px, 24px, 32px, 40px, 48px, 64px, 80px, 96px, 128px).

Avoid `3, 5, 7, 9, 11, 13, 14, 15, 18` — odd sizes drift into the design.

Section vertical rhythm: `py-20 md:py-28` (from the `.section` class).

---

## Buttons — 3 variants

| Variant | Class | Treatment | Use |
| --- | --- | --- | --- |
| Primary | `btn-primary` | Filled green, rounded-full | The single most important action on a screen |
| Secondary | `btn-secondary` | Outlined green, transparent, rounded-full | Supporting action, pairs with primary |
| Tertiary | `btn-tertiary` | Green text + underline on hover | Low-weight nav inside prose, dismissive actions |

No fourth variant. No "glass" button. Ad-hoc outlined buttons (e.g.
`border border-terminal-green rounded-md`) inside components should migrate to
`btn-secondary` when visually reasonable, or `btn-tertiary` when smaller.

---

## Icons

- Library: **Lucide** only. No emoji in UI (`💬`, `⚠`, `✓`) — screen readers announce
  them literally; use `MessageCircle`, `AlertTriangle`, `Check` instead.
- Sizes: `w-3.5 h-3.5` (inline with text), `w-4 h-4` (standalone UI), `w-5 h-5` (hero
  scale). Don't use `w-2` or `w-3`.
- Always pair with a text label or `aria-label`.

---

## Z-index contract

Layering is deterministic. Never invent ad-hoc z-index values.

| Layer | Class | Contents |
| --- | --- | --- |
| Background | `z-0` (default) | `MouseSpotlight` canvas, decorative brackets, section backgrounds |
| Content | (none / implicit stacking) | All page content inside `<main>` |
| Sticky chrome | `z-10` | Page-level sticky sub-headers (e.g. `/govi` topbar) |
| Overlay controls | `z-10` | View-mode toggles, floating buttons on 3D scenes |
| Global header | `z-50` | `Header` (sticky top nav) |
| Modals / command palette | `z-50` + overlay backdrop | `SearchModal`, dialogs |
| Toast / notification | `z-[60]` | Reserved; do not exceed |

Rules:
1. Interactive text must render **above** the `MouseSpotlight` canvas. The canvas lives at `z-0` — never raise it.
2. Any element that overlaps the cursor (tooltip, popover, dropdown) sits at `z-50` minimum.
3. If you need a new layer, add it to the table first.

---

## Motion

- Transitions: `transition-colors duration-300` default.
- Animations: defined in `tailwind.config.ts` keyframes (`blink`, `fadeIn`,
  `slideUp`, `glow`). Use `animate-*` utilities — don't invent one-off CSS.
- `@media (prefers-reduced-motion: reduce)` is respected globally. Always test
  with it enabled.

---

## Accessibility floor

- Contrast: WCAG AA (4.5:1 body, 3:1 large text). Use the opacity rule above.
- Touch targets: ≥ 44×44 px on mobile (`p-2` + `w-6 h-6` icon is the minimum).
- Focus: every interactive element gets the global `*:focus-visible` ring automatically
  (2px `terminal-green` outline + 2px offset). Don't remove it with `outline-none`
  without reinstating a visible alternative.
- Keyboard: forms use native `<summary>`, `<details>`, `<button>`, `<a>` —
  no custom `div` handlers without `role` + `tabIndex`.

---

## When adding a new component

1. Does it fit an existing surface, radius, color, typography rule? Use those.
2. If not, ask: is this a real new pattern or a drift? Discuss before adding to this doc.
3. Every new component goes in `src/components/ui/` with a consistent TS interface.