import { useEffect, useState } from "react";
import { Link, Outlet, useOutletContext, useParams } from "react-router-dom";
import { CartProvider, useCart } from "./CartProvider";
import InstallButton from "./InstallButton";
import { errMsg, supabase } from "@/lib/supabase";
import type { Product } from "@/lib/types";

export type StoreData = { name: string; slug: string; whatsapp: string | null };
export type StoreCtx = { store: StoreData; products: Product[]; ativa: boolean };

export const useStore = () => useOutletContext<StoreCtx>();

export const whatsappLink = (phone: string, text: string) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

/** Aponta o manifesto do PWA para a loja aberta (o app instalado abre direto na vitrine dela). */
function useStoreManifest(store: StoreData | null) {
  useEffect(() => {
    if (!store) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const original = link.getAttribute("href") ?? "/manifest.webmanifest";
    const o = window.location.origin;
    const base = `/loja/${store.slug}`;
    const blob = new Blob(
      [
        JSON.stringify({
          name: store.name,
          short_name: store.name.slice(0, 12),
          description: `Catálogo de camisas personalizadas — ${store.name}`,
          id: `${o}${base}`,
          start_url: `${o}${base}`,
          scope: `${o}${base}/`,
          display: "standalone",
          orientation: "portrait",
          background_color: "#0b1f44",
          theme_color: "#0b1f44",
          lang: "pt-BR",
          icons: [
            { src: `${o}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
            { src: `${o}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
            { src: `${o}/icons/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        }),
      ],
      { type: "application/manifest+json" }
    );
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    document.title = `${store.name} · Catálogo`;
    return () => {
      link.setAttribute("href", original);
      URL.revokeObjectURL(url);
    };
  }, [store]);
}

function Header({ store }: { store: StoreData }) {
  const { slug, count } = useCart();
  return (
    <header className="sticky top-0 z-10 border-b border-brand-800 bg-brand-900 shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Link to={`/loja/${slug}`} aria-label={store.name}>
          <img src="/logo.png" alt={store.name} width={520} height={247} className="h-12 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <InstallButton className="btn-secondary !border-brand-500 !bg-transparent !text-brand-100 hover:!bg-brand-800" />
          {store.whatsapp && (
            <a
              href={whatsappLink(store.whatsapp, "Olá! Vi o catálogo e gostaria de mais informações.")}
              target="_blank"
              rel="noreferrer"
              className="btn hidden !bg-brand-500 hover:!bg-brand-400 sm:inline-flex"
            >
              WhatsApp
            </a>
          )}
          <Link to={`/loja/${slug}/carrinho`} className="btn-secondary">
            Carrinho
            {count > 0 && <span className="ml-2 rounded-full bg-brand-600 px-2 text-xs text-white">{count}</span>}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Shell({ slug }: { slug: string }) {
  const [data, setData] = useState<StoreCtx | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase.rpc("store_catalog", { p_slug: slug }).then(({ data: d, error: e }) => {
      if (!alive) return;
      if (e) setError(errMsg(e));
      else if (!d) setError("Loja não encontrada");
      // se o banco ainda não informa "ativa", considera liberada (quem trava de verdade é o banco)
      else setData({ ...(d as StoreCtx), ativa: (d as Partial<StoreCtx>).ativa !== false });
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  useStoreManifest(data?.store ?? null);

  return (
    <div className="flex min-h-screen flex-col">
      {data ? (
        <Header store={data.store} />
      ) : (
        <header className="border-b border-brand-800 bg-brand-900 px-4 py-2">
          <img src="/logo.png" alt="" className="h-12 w-auto" />
        </header>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {loading && <p className="text-slate-500">Carregando...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {data && !data.ativa && (
          <div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <b>Esta loja não está recebendo novos pedidos no momento.</b> Você pode ver o catálogo e montar sua camisa;
            o seu carrinho fica guardado. Fale com a loja pelo WhatsApp.
          </div>
        )}
        {data && <Outlet context={data} />}
      </main>
      <footer className="border-t bg-white py-4 text-center text-xs text-slate-500">
        {data?.store.name} · Personalização feita pela loja na hora · Pedidos combinados pelo WhatsApp
        <br />
        No iPhone: toque em Compartilhar → Adicionar à Tela de Início para instalar o app.
      </footer>
    </div>
  );
}

export default function StoreLayout() {
  const { slug = "" } = useParams();
  return (
    <CartProvider slug={slug}>
      <Shell slug={slug} />
    </CartProvider>
  );
}
