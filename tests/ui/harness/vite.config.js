// Vite server for the UI test harness: real components, mocked data layer.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const mocks = path.resolve(here, "mocks.js");
const heic2any = path.resolve(here, "heic2any.js");
export default defineConfig({
  root: here,
  plugins: [react()],
  server: { fs: { allow: [path.resolve(here, "../../..")] } },
  resolve: {
    alias: [
      { find: /^firebase\/firestore$/, replacement: mocks },
      { find: /^firebase\/auth$/, replacement: mocks },
      { find: /^firebase\/storage$/, replacement: mocks },
      { find: /^heic2any$/, replacement: heic2any },
      { find: /^(\.\.?\/)+firebase$/, replacement: mocks },
      { find: /^(\.\.?\/)+api\/firestore$/, replacement: mocks },
      { find: /^(\.\.?\/)+api\/claude$/, replacement: mocks },
      { find: /^\.\/firestore$/, replacement: mocks },
      { find: /^\.\/claude$/, replacement: mocks },
    ],
  },
});
