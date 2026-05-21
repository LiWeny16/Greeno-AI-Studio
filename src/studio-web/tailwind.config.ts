import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#101214",
        panel: "#171a1d",
        panelBorder: "#2b3137",
        accent: "#4fb3a5",
        warning: "#d6a84f"
      }
    }
  },
  plugins: []
} satisfies Config;
