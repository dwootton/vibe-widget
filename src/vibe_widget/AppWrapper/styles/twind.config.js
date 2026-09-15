import { defineConfig } from "@twind/core";
import presetTailwind from "@twind/preset-tailwind";
import presetAutoprefix from "@twind/preset-autoprefix";

export default defineConfig({
  presets: [presetAutoprefix(), presetTailwind()],
  theme: {
    extend: {
      // Surfaces, text and borders follow the JupyterLab theme when it exposes
      // --jp-* variables; the dark values below remain the fallback.
      colors: {
        "surface-1": "var(--jp-layout-color0, #0b0b0b)",
        "surface-2": "var(--jp-layout-color1, #0f0f0f)",
        "surface-3": "var(--jp-layout-color2, #1a1a1a)",
        "surface-4": "var(--jp-layout-color3, #121212)",
        "text-primary": "var(--jp-ui-font-color0, #f2f0e9)",
        "text-secondary": "var(--jp-ui-font-color1, #e2e8f0)",
        "text-muted": "var(--jp-ui-font-color2, #94a3b8)",
        "text-disabled": "var(--jp-ui-font-color3, #6b7280)",
        accent: "#f97316",
        "accent-muted": "rgba(249, 115, 22, 0.1)",
        success: "#22c55e",
        error: "#f87171",
        "error-light": "#fca5a5",
        "border-subtle": "var(--jp-border-color3, rgba(242, 240, 233, 0.08))",
        "border-medium": "var(--jp-border-color2, rgba(242, 240, 233, 0.2))",
        "border-strong": "var(--jp-border-color1, rgba(242, 240, 233, 0.35))"
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
