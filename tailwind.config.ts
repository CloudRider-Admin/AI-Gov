import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          black: "rgb(var(--color-bg-primary-rgb) / <alpha-value>)",
          dark: "rgb(var(--color-bg-secondary-rgb) / <alpha-value>)",
          gray: "rgb(var(--color-bg-tertiary-rgb) / <alpha-value>)",
          border: "rgb(var(--color-border-rgb) / <alpha-value>)",
          text: "rgb(var(--color-text-primary-rgb) / <alpha-value>)",
          muted: "rgb(var(--color-text-muted-rgb) / <alpha-value>)",
          green: "rgb(var(--color-accent-rgb) / <alpha-value>)",
          "green-dim": "rgb(var(--color-accent-dim-rgb) / <alpha-value>)",
          cyan: "rgb(var(--color-cyan-rgb) / <alpha-value>)",
          amber: "rgb(var(--color-amber-rgb) / <alpha-value>)",
        },
      },
      fontFamily: {
        mono: ["var(--font-space-mono)", "Courier New", "monospace"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      animation: {
        blink: "blink 1s step-end infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        glow: "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(0, 255, 136, 0.2)" },
          "100%": { boxShadow: "0 0 20px rgba(0, 255, 136, 0.4)" },
        },
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(var(--grid-line-color, rgba(42, 42, 42, 0.3)) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line-color, rgba(42, 42, 42, 0.3)) 1px, transparent 1px)",
        "dot-pattern":
          "radial-gradient(circle, var(--grid-dot-color, rgba(80, 80, 80, 0.55)) 0.7px, transparent 1.1px)",
        "dot-pattern-accent":
          "radial-gradient(circle, var(--grid-dot-accent-color, rgba(0, 255, 136, 0.95)) 0.9px, transparent 1.4px)",
      },
      backgroundSize: {
        grid: "10px 10px",
        dots: "14px 14px",
      },
    },
  },
  plugins: [],
};

export default config;
