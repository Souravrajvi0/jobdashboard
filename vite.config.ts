import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  server: { host: "::", port: 8080 },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"],
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      // src/server.ts wraps the TanStack server entry with SSR error handling.
      server: { entry: "server" },
      importProtection: { behavior: "error", client: { files: ["**/server/**"] } },
    }),
    // node-server preset: the app uses node:sqlite, so it must run on Node, not an edge runtime.
    ...(command === "build" ? [nitro({ preset: "node-server" })] : []),
    viteReact(),
  ],
}));
