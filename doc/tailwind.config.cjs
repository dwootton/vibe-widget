module.exports = {
  content: [
    "./index.html",
    "./App.tsx",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./data/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bone: "#F2F0E9",
        slate: "#1A1A1A",
        orange: "#F97316",
        "material-bg": "#2F2F2F"
      },
      fontFamily: {
        display: ["Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        hard: "4px 4px 0 0 #1A1A1A",
        "hard-sm": "2px 2px 0 0 #1A1A1A",
        "hard-lg": "6px 6px 0 0 #1A1A1A"
      }
    }
  },
  plugins: [require("@tailwindcss/typography")]
};
