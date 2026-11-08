import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Everything the app runs ships inside it, so nothing may load from elsewhere. Styles stay inline because
// Monaco and Mermaid set them on elements, and images and workers allow data: and blob: for the exports
// and the editor worker. No 'unsafe-eval', so injected text can't be run as code.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'"
].join("; ");

// Only for the built app. Vite's dev server needs inline scripts for hot reloading.
function contentSecurityPolicy(): Plugin {
  return {
    apply: "build",
    name: "diagramdesk-content-security-policy",
    transformIndexHtml: () => [
      {
        attrs: { content: CONTENT_SECURITY_POLICY, "http-equiv": "Content-Security-Policy" },
        injectTo: "head-prepend",
        tag: "meta"
      }
    ]
  };
}

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true
  }
});
