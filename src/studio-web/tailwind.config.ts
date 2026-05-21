import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--bg))",
        foreground: "hsl(var(--text))",
        panel: {
          DEFAULT: "hsl(var(--panel))",
          2: "hsl(var(--panel-2))",
        },
        surface: "hsl(var(--surface))",
        border: "hsl(var(--border))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--faint))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          2: "hsl(var(--accent-2))",
        },
        ring: "hsl(var(--selection))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        destructive: "hsl(var(--danger))",
      },
      borderRadius: {
        control: "6px",
        panel: "6px",
        card: "6px",
        modal: "8px",
      },
      fontSize: {
        body: ["13px", { lineHeight: "1.5" }],
        compact: ["12px", { lineHeight: "1.4" }],
        heading: ["12px", { lineHeight: "1.4", letterSpacing: "0.05em" }],
        "editor-value": [
          "13px",
          { lineHeight: "1.5", fontVariantNumeric: "tabular-nums" },
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
