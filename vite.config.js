import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Bind to 0.0.0.0 so a phone on the same network (or a tunnel) can reach the
// dev server. iOS motion sensors still require HTTPS — see README.
//
// GitHub Pages serves the site from a subpath (https://<user>.github.io/roboarm/),
// so the production build needs base "/roboarm/". Dev stays at "/".
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/roboarm/" : "/",
  plugins: [react()],
  server: { host: true },
}));
