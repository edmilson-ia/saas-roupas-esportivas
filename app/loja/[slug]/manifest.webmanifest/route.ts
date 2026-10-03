import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Manifesto do app do cliente: abre direto na vitrine da loja. */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const { data: store } = await createAdmin()
    .from("organizations")
    .select("name")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!store) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });

  const base = `/loja/${params.slug}`;
  return NextResponse.json(
    {
      name: store.name,
      short_name: store.name.slice(0, 12),
      description: `Catálogo de camisas personalizadas — ${store.name}`,
      id: base,
      start_url: base,
      scope: `${base}/`,
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
    },
    { headers: { "content-type": "application/manifest+json" } }
  );
}
