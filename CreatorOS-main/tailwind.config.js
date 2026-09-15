/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        minds: {
          bg: "#080C14",
          card: "#0F172A",
          border: "#1E293B",
          accent: "#3B82F6",
          purple: "#8B5CF6",
          emerald: "#10B981",
          amber: "#F59E0B"
        },
        canvas: "#08090A",
        panel: "#24343A",
        "panel-strong": "#1B282D",
        amber: {
          DEFAULT: "#E8A339",
          soft: "#FFD27A",
          deep: "#B8791F",
        },
        teal: "#39C6D6",
        emerald2: "#37C48A",
        border2: "rgba(255, 255, 255, 0.12)",
        "border2-strong": "rgba(255, 255, 255, 0.24)",
      },
      fontFamily: {
        display: ["Gendy", "Syne", "Fraunces", "serif"],
        body: ["Space Grotesk", "Inter", "sans-serif"],
        mono2: ["IBM Plex Mono", "monospace"],
      },
      keyframes: {
        kenburns: {
          "0%": { transform: "scale(1.1) translate(0, 0)" },
          "50%": { transform: "scale(1.22) translate(-2%, -1.6%)" },
          "100%": { transform: "scale(1.1) translate(0, 0)" },
        },
      },
      animation: {
        kenburns: "kenburns 18s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
