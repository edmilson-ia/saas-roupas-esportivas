import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        // vendors em arquivos separados: ficam em cache entre deploys
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (id.includes("fabric")) return "fabric";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("react-router") || id.includes("react-dom") || id.includes("/react/")) return "react";
        },
      },
    },
  },
});
