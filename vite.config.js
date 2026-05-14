import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/cfabg/",
  plugins: [react()],
  build: {
    sourcemap: true
  }
});
