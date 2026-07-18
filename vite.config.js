import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon-32.png", "apple-touch-icon.png"],
      manifest: {
        name: "Cocina Express",
        short_name: "Cocina Express",
        description: "Accesorios de cocina en Comendador, Elías Piña. Entrega a domicilio.",
        start_url: "/",
        display: "standalone",
        background_color: "#F7F7F8",
        theme_color: "#E8362B",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // No metemos en caché las llamadas a Firestore: los productos,
        // pedidos y ajustes siempre deben leerse en vivo, nunca desde caché.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
