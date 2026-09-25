/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Trustworthy gov palette: deep blue + saffron accent + green success
        navy:   { 50: "#eef3fb", 100: "#dce8f7", 500: "#2447a8", 700: "#1c3878", 900: "#101c3f" },
        saffron:{ 500: "#e0932e", 600: "#c67a1c" },
        leaf:   { 500: "#188a4d", 600: "#136b3c" },
      },
      fontFamily: {
        sans: ["Outfit", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["\"DM Mono\"", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        // Tinted shadows (navy hue) instead of generic flat black
        soft: "0 1px 2px 0 rgba(16, 28, 63, 0.06), 0 1px 1px 0 rgba(16, 28, 63, 0.04)",
        card: "0 4px 14px -4px rgba(16, 28, 63, 0.12), 0 2px 6px -2px rgba(16, 28, 63, 0.08)",
        lifted: "0 12px 28px -8px rgba(16, 28, 63, 0.22), 0 4px 10px -4px rgba(16, 28, 63, 0.12)",
        accent: "0 6px 16px -4px rgba(224, 147, 46, 0.35)",
      },
    },
  },
  plugins: [],
};