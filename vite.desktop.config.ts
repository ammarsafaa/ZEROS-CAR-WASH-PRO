// Desktop (Electron) build: static SPA shell in dist/client. Run: npx vite build -c vite.desktop.config.ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
export default defineConfig({
  tanstackStart: { server: { entry: "server" }, spa: { enabled: true, prerender: { outputPath: "/index.html" } } },
});
