import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(dir, "web"),
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: path.resolve(dir, "dist"),
    emptyOutDir: true,
  },
});
