import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Bind to 0.0.0.0 so a phone on the same network (or a tunnel) can reach the
// dev server. iOS motion sensors still require HTTPS — see README.
export default defineConfig({
  plugins: [react()],
  server: { host: true },
});
