import { defineConfig } from "@twind/core";
import presetTailwind from "@twind/preset-tailwind";
import presetAutoprefix from "@twind/preset-autoprefix";

export default defineConfig({
  presets: [presetAutoprefix(), presetTailwind()],
  theme: {
    extend: {
      colors: {
        "surface-1": "#0b0b0b",
        "surface-2": "#0f0f0f",
        "surface-3": "#1a1a1a",
        "surface-4": "#121212",
        "text-primary": "#f2f0e9",
        "text-secondary": "#e2e8f0",
        "text-muted": "#94a3b8",
        "text-disabled": "#6b7280",
        accent: "#f97316",
        "accent-muted": "rgba(249, 115, 22, 0.1)",
        success: "#22c55e",
        error: "#f87171",
        "error-light": "#fca5a5",
        "border-subtle": "rgba(242, 240, 233, 0.08)",
        "border-medium": "rgba(242, 240, 233, 0.2)",
        "border-strong": "rgba(242, 240, 233, 0.35)"
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "Space Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace"
        ]
      },
      animation: {
        "spin-slow": "spin 2s linear infinite",
        "fade-in": "fadeIn 0.3s ease-out forwards",
        "cursor-blink": "cursorBlink 1s steps(2, end) infinite",
        "terminal-caret-blink": "terminalCaretBlink 1.6s steps(2, end) infinite"
      },
      keyframes: {
        fadeIn: {
          to: { opacity: "1" }
        },
        cursorBlink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" }
        },
        terminalCaretBlink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" }
        },
        spin: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" }
        }
      }
    }
  },
  hash: process.env.NODE_ENV === "production"
});
