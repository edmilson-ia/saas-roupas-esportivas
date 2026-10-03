import type { MetadataRoute } from "next";

/** App do lojista (painel). A vitrine de cada loja tem o próprio manifesto em /loja/[slug]/manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gold'n Ports · Painel",
    short_name: "Painel",
    description: "Gerencie produtos e pedidos da sua loja de camisas personalizadas",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1f44",
    theme_color: "#0b1f44",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
