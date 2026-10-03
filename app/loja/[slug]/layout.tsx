import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartProvider } from "@/components/CartProvider";
import StoreHeader from "@/components/StoreHeader";
import { createAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getStore(slug: string) {
  const { data } = await createAdmin()
    .from("organizations")
    .select("name, whatsapp")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const store = await getStore(params.slug);
  return store
    ? {
        title: `${store.name} · Catálogo`,
        description: `Camisas personalizadas — ${store.name}`,
        manifest: `/loja/${params.slug}/manifest.webmanifest`,
        appleWebApp: { capable: true, title: store.name, statusBarStyle: "black-translucent" },
      }
    : {};
}

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  const store = await getStore(params.slug);
  if (!store) notFound();

  return (
    <CartProvider slug={params.slug}>
      <div className="flex min-h-screen flex-col">
        <StoreHeader name={store.name} whatsapp={store.whatsapp} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t bg-white py-4 text-center text-xs text-slate-500">
          {store.name} · Os pedidos são combinados pelo WhatsApp
          <br />
          No iPhone: toque em Compartilhar → Adicionar à Tela de Início para instalar o app.
        </footer>
      </div>
    </CartProvider>
  );
}
