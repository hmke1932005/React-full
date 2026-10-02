import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The app calls the backend with relative URLs (/api/..., /uploads/...), so
// both `npm run dev` and `npm run preview` proxy them to the Laravel API.
// Production hosting does the same through vercel.json / netlify.toml.
// Override the backend with VITE_API_TARGET (see .env.example).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_TARGET || "https://full-api-production-084f.up.railway.app";
  const proxy = {
    "/api": { target, changeOrigin: true, secure: true },
    "/uploads": { target, changeOrigin: true, secure: true },
  };

  return {
    plugins: [react()],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
  };
});
