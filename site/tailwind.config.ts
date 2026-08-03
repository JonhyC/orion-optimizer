import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#000000",
        ink: {
          950: "#020202",
          900: "#070707",
          850: "#0B0B0B",
          800: "#111111",
          700: "#1A1A1A",
          600: "#252525",
          500: "#333333",
        },
        neon: {
          DEFAULT: "#D6A75B",
          soft: "#E8C37C",
          bright: "#FFE7B1",
          deep: "#A8762F",
          dark: "#5C3A12",
        },
        muted: "#8A94A6",
      /**
       * Espelham --critical e --good do globals.css.
       *
       * Existem porque o Tailwind 3 nao consegue aplicar opacidade a um
       * var() arbitrario: `bg-[var(--critical)]/10` nao gera regra
       * nenhuma. Como cores do tema, `bg-critical/10` ja funciona.
       * Manter os dois valores em sincronia com o globals.css.
       */
      critical: "#D03B3B",
      good: "#0CA30C",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        neon: "0 0 24px -4px rgba(214,167,91,0.45)",
        "neon-lg": "0 0 60px -12px rgba(214,167,91,0.55)",
        glass: "0 24px 60px -30px rgba(0,0,0,0.9)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, rgba(214,167,91,0.07) 1px, transparent 1px), linear-gradient(to right, rgba(214,167,91,0.07) 1px, transparent 1px)",
      },
      keyframes: {
        "float-y": {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        "pulse-glow": {
          "0%,100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        shimmer: {
          "100%": { transform: "translateX(220%)" },
        },
        "border-spin": {
          to: { "--angle": "360deg" },
        },
        "grid-drift": {
          to: { backgroundPosition: "0 -64px, -64px 0" },
        },
      },
      animation: {
        "float-y": "float-y 6s cubic-bezier(.4,0,.2,1) infinite",
        "pulse-glow": "pulse-glow 3.4s cubic-bezier(.4,0,.2,1) infinite",
        marquee: "marquee 42s linear infinite",
        shimmer: "shimmer 1.1s cubic-bezier(.4,0,.2,1)",
        "grid-drift": "grid-drift 12s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
