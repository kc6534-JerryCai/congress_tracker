import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Allow temporary public links from `cloudflared tunnel --url http://localhost:5173`.
    allowedHosts: [".trycloudflare.com"],
    // Forward /api calls to the FastAPI backend so the frontend never sees the API key.
    proxy: { "/api": "http://localhost:8000" },
  },
});
