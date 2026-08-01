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
          950: "#04060A",
          900: "#080B11",
          850: "#0B0F16",
          800: "#0F141D",
          700: "#161C27",
          600: "#1F2733",
          500: "#2A3441",
        },
        neon: {
          DEFAULT: "#8B3DFF",
          soft: "#B78AFF",
          bright: "#D5BCFF",
          deep: "#6422C7",
          dark: "#35106F",
        },
        muted: "#8A94A6",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        neon: "0 0 24px -4px rgba(139,61,255,0.55)",
        "neon-lg": "0 0 60px -12px rgba(139,61,255,0.65)",
        glass: "0 24px 60px -30px rgba(0,0,0,0.9)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, rgba(139,61,255,0.07) 1px, transparent 1px), linear-gradient(to right, rgba(139,61,255,0.07) 1px, transparent 1px)",
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
