import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uniformes Personalizados",
  description: "Plataforma para lojas de roupas esportivas com editor de customização",
};

// Cor da barra do navegador/janela (azul-marinho da logo)
export const viewport: Viewport = { themeColor: "#0b1f44" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Black+Ops+One&family=Graduate&family=Oswald:wght@700&family=Permanent+Marker&family=Russo+One&family=Teko:wght@700&display=swap"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
