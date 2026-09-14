import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // "./" makes the build work when served from a GitHub Pages project
  // page (e.g. https://username.github.io/repo-name/) as well as from
  // any other subpath. Change to "/" if you deploy to a domain root.
  base: "./",
  build: {
    outDir: "dist",
  },
});
