/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#fafafa",
        surface: "#ffffff",
        surfaceElevated: "#ffffff",
        border: "#e4e4e7",
        borderSoft: "#f0f0f2",
        muted: "#71717a",
        text: "#18181b",
        textSecondary: "#52525b",
        accent: "#3b82f6",
        accentHover: "#2563eb",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "1rem",
        panel: "1.25rem",
        input: "0.75rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        bubble: "0 1px 2px rgb(0 0 0 / 0.04)",
        soft: "0 2px 8px rgb(0 0 0 / 0.04)",
      },
    },
  },
  plugins: [],
};
