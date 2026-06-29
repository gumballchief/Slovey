import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light mode
        bg: "var(--bg)",
        "bg-subtle": "var(--bg-subtle)",
        surface: "var(--surface)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          soft: "var(--primary-soft)",
        },
        accent: "var(--accent)",
        text: {
          DEFAULT: "var(--text)",
          muted: "var(--text-muted)",
        },
        border: "var(--border)",
        // Semantic
        conflict: "#F43F5E",
        clear: "#10B981",
        pending: "#F59E0B",
      },
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Geist Mono", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
        "surface-dark": "0 0 0 1px var(--border), inset 0 1px 0 rgba(255,255,255,0.03)",
        glow: "0 0 20px rgba(56,189,248,0.15)",
        "glow-sm": "0 0 10px rgba(56,189,248,0.1)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "draw-line": "drawLine 0.8s ease-out forwards",
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "connector": "connector 1.2s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        drawLine: {
          "0%": { strokeDashoffset: "200" },
          "100%": { strokeDashoffset: "0" },
        },
        connector: {
          "0%": { opacity: "0", strokeDashoffset: "300" },
          "40%": { opacity: "1" },
          "100%": { opacity: "1", strokeDashoffset: "0" },
        },
      },
      backgroundImage: {
        "grid-subtle": "radial-gradient(circle, var(--border) 1px, transparent 1px)",
        "aurora": "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(14,165,233,0.15), transparent)",
        "aurora-dark": "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56,189,248,0.08), transparent)",
      },
    },
  },
  plugins: [],
};

export default config;
