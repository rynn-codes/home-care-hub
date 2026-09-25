import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  /**
   * A build stamp the running page can print.
   *
   * Karynn opened the demo link and could not tell whether she was looking at
   * the current build or a cached one — and neither could I, from a screenshot.
   * Settings now prints this, so "which version am I on?" is answerable by
   * reading the screen instead of guessing.
   */
  define: {
    __BUILD_STAMP__: JSON.stringify(
      new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
    ),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  build: {
    // The single-file demo has nowhere to fetch an image from, so every asset
    // is inlined as a data URL. A served build keeps Vite's usual 4 KB cut-off.
    assetsInlineLimit: process.env.VITE_STANDALONE_DEMO === "true" ? 1024 * 1024 : 4096,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
