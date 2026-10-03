import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore, whatsappLink } from "@/components/StoreLayout";
import { brl, normalizeColors, type Product } from "@/lib/types";

type Sort = "recent" | "price_asc" | "price_desc" | "name";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Catalog() {
  const { slug } = useParams();
  const { store, products } = useStore();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  const visible = useMemo(() => {
    const q = norm(query.trim());
    const list = products.filter((p) => !q || norm(p.name).includes(q) || norm(p.description ?? "").includes(q));
    const by: Record<Sort, (a: Product, b: Product) => number> = {
      recent: () => 0, // o banco já devolve do mais novo para o mais antigo
      price_asc: (a, b) => Number(a.price) - Number(b.price),
      price_desc: (a, b) => Number(b.price) - Number(a.price),
      name: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
    };
    return [...list].sort(by[sort]);
  }, [products, query, sort]);

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-xl bg-brand-900 bg-cover bg-center p-6 text-white sm:p-10"
        style={{ backgroundImage: "url(/hero.jpg)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-brand-900/95 via-brand-900/75 to-brand-700/40" />
        <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
          <img src="/logo.png" alt={store.name} width={520} height={247} className="h-28 w-auto drop-shadow-lg sm:h-36" />
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">Camisas personalizadas</h1>
            <p className="mt-1 max-w-md text-brand-100">
              Escolha o modelo, coloque nome, número e brasão e envie o pedido pelo WhatsApp.
            </p>
            {store.whatsapp && (
              <a
                href={whatsappLink(store.whatsapp, "Olá! Vi o catálogo e gostaria de mais informações.")}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50"
              >
                Falar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar camisa (ex.: flamengo)"
          className="input sm:flex-1"
          aria-label="Buscar produtos"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input sm:!w-52" aria-label="Ordenar">
          <option value="recent">Mais recentes</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
          <option value="name">Nome (A–Z)</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-slate-500">
          {products.length === 0 ? "Nenhum produto disponível no momento." : "Nenhuma camisa encontrada para essa busca."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((p) => {
            const colors = normalizeColors(p.available_colors);
            const cover = p.base_image_url ?? colors.find((c) => c.image_url)?.image_url ?? null;
            return (
              <Link
                key={p.id}
                to={`/loja/${slug}/produto/${p.id}`}
                className="card group flex flex-col overflow-hidden !p-0 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative bg-slate-100">
                  {cover ? (
                    <img src={cover} alt={p.name} loading="lazy" className="h-64 w-full object-contain p-2 transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-slate-400">Sem imagem</div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
                    Personalizável
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <h3 className="font-semibold leading-tight">{p.name}</h3>
                  {colors.length > 1 && (
                    <div className="flex items-center gap-1">
                      {colors.slice(0, 4).map((c) =>
                        c.image_url ? (
                          <img key={c.name} src={c.image_url} alt={c.name} title={c.name} loading="lazy" className="h-8 w-8 rounded border bg-white object-contain" />
                        ) : null
                      )}
                      <span className="text-xs text-slate-500">{colors.length} cores</span>
                    </div>
                  )}
                  <p className="mt-auto text-lg font-bold text-brand-700">{brl(p.price)}</p>
                  <span className="btn w-full">Personalizar</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
