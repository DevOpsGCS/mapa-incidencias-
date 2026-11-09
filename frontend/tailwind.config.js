/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        "line-control": "var(--line-control)",
        "text-strong": "var(--text-strong)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        "text-label": "var(--text-label)",
        accent: "var(--accent)",
        "accent-fill": "var(--accent-fill)",
        "accent-text": "var(--accent-text)",
      },
      borderRadius: {
        panel: "20px",
        card: "8px",
      },
      fontFamily: {
        sans: ["'Public Sans'", "sans-serif"],
        display: ["'Public Sans'", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
