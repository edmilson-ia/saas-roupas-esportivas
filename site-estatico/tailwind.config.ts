import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Paleta extraída da logo: ciano → azul, com azul-marinho do contorno
        brand: {
          50: "#ecf9ff", 100: "#d2f1ff", 200: "#a8e5ff", 300: "#6bd4ff", 400: "#2bbcf5",
          500: "#0aa2e0", 600: "#0585c0", 700: "#066a9a", 800: "#0a5578", 900: "#0b1f44",
        },
      },
    },
  },
  plugins: [],
};
export default config;
