import { useCallback, useEffect, useState } from "react";
import { errMsg, supabase } from "@/lib/supabase";
import { brl, normalizeColors, type ColorOption, type Product } from "@/lib/types";
import { useOrg } from "./DashboardLayout";

const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

type ColorRow = {
  id: string;
  name: string;
  image_url: string | null;
  file: File | null;
};

export default function Products() {
  const org = useOrg();
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (err) return setError(errMsg(err));
    // ordem da vitrine: posição definida pelo lojista; sem posição vai para o fim (mais novos primeiro)
    const list = ((data ?? []) as Product[]).slice().sort(
      (a, b) => (a.ordem ?? Number.MAX_SAFE_INTEGER) - (b.ordem ?? Number.MAX_SAFE_INTEGER)
    );
    setProducts(list);
  }, []);

  /** Sobe/desce um produto e regrava as posições 1..N (a lista já está na ordem atual). */
  async function mover(index: number, delta: -1 | 1) {
    const alvo = index + delta;
    if (alvo < 0 || alvo >= products.length) return;
    setError("");
    const nova = products.slice();
    [nova[index], nova[alvo]] = [nova[alvo], nova[index]];
    const mudou = nova.map((p, i) => ({ p, pos: i + 1 })).filter(({ p, pos }) => p.ordem !== pos);
    const results = await Promise.all(
      mudou.map(({ p, pos }) => supabase.from("products").update({ ordem: pos }).eq("id", p.id).select("id").maybeSingle())
    );
    const falha = results.find((r) => r.error || !r.data);
    if (falha) {
      const msg = falha.error ? errMsg(falha.error) : "sem permissão";
      return setError(
        /ordem/.test(msg) ? "Para ordenar, rode antes o SQL 0006_ordem_produtos.sql no Supabase." : `Não foi possível reordenar (${msg})`
      );
    }
    load();
  }
  useEffect(() => {
    load();
  }, [load]);

  async function remove(p: Product) {
    if (!confirm(`Excluir "${p.name}"?`)) return;
    const { data, error: err } = await supabase.from("products").delete().eq("id", p.id).select("id");
    if (err) return setError(errMsg(err));
    if (!data?.length) return setError("Não foi possível excluir (sem permissão)");
    load();
  }

  async function setStock(p: Product, stock: number) {
    if (!Number.isInteger(stock) || stock < 0) return;
    const { data, error: err } = await supabase.from("products").update({ stock }).eq("id", p.id).select("id").maybeSingle();
    if (err) return setError(errMsg(err));
    if (!data) return setError("Não foi possível alterar o estoque (sem permissão)");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-xs text-slate-500">A vitrine segue esta ordem. Use ▲ ▼ para agrupar time por time.</p>
        </div>
        <button className="btn" onClick={() => { setEditing(null); setShowForm(true); }}>Adicionar produto</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {showForm && (
        <ProductForm
          key={editing?.id ?? "novo"}
          orgId={org.id}
          product={editing}
          nextOrdem={
            products.some((p) => "ordem" in p) ? Math.max(0, ...products.map((p) => p.ordem ?? 0)) + 1 : undefined
          }
          onDone={() => { setShowForm(false); load(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p, index) => {
          const colors = normalizeColors(p.available_colors);
          const cover = p.base_image_url ?? colors[0]?.image_url ?? null;
          return (
            <div key={p.id} className="card space-y-2">
              {cover ? (
                <img src={cover} alt={p.name} className="h-48 w-full rounded bg-slate-100 object-contain" />
              ) : (
                <div className="flex h-48 items-center justify-center rounded bg-slate-100 text-sm text-slate-400">Sem imagem</div>
              )}
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{p.name}</h3>
                <span className="font-semibold text-brand-700">{brl(p.price)}</span>
              </div>
              <p className="text-xs text-slate-500">
                Cores: {colors.map((c) => c.name).join(", ") || "—"} · Tamanhos: {p.available_sizes.join(", ")}
              </p>
              <label className="flex items-center gap-2 text-sm">
                Estoque
                <input
                  type="number"
                  min={0}
                  defaultValue={p.stock}
                  onBlur={(e) => Number(e.target.value) !== p.stock && setStock(p, Number(e.target.value))}
                  className="input !w-24"
                />
                {!p.active && <span className="text-xs text-amber-600">inativo</span>}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-secondary" onClick={() => { setEditing(p); setShowForm(true); }}>Editar</button>
                <button className="btn-secondary !text-red-600" onClick={() => remove(p)}>Excluir</button>
                <span className="ml-auto flex items-center gap-1" title="Ordem na vitrine">
                  <span className="text-xs text-slate-500">#{index + 1}</span>
                  <button
                    className="btn-secondary !px-2.5"
                    onClick={() => mover(index, -1)}
                    disabled={index === 0}
                    aria-label={`Subir ${p.name}`}
                  >
                    ▲
                  </button>
                  <button
                    className="btn-secondary !px-2.5"
                    onClick={() => mover(index, 1)}
                    disabled={index === products.length - 1}
                    aria-label={`Descer ${p.name}`}
                  >
                    ▼
                  </button>
                </span>
              </div>
            </div>
          );
        })}
        {products.length === 0 && <p className="text-sm text-slate-500">Nenhum produto ainda.</p>}
      </div>
    </div>
  );
}

async function uploadImage(orgId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 5_000_000) throw new Error("Imagem inválida (máx. 5 MB)");
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${orgId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file);
  if (error) throw new Error("Falha no upload da imagem");
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

function ProductForm({
  orgId, product, nextOrdem, onDone, onCancel,
}: { orgId: string; product: Product | null; nextOrdem?: number; onDone: () => void; onCancel: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ColorRow[]>(() => {
    const existing = normalizeColors(product?.available_colors);
    const list: ColorOption[] = existing.length ? existing : [{ name: "", image_url: null }];
    return list.map((c) => ({
      id: crypto.randomUUID(),
      name: c.name,
      image_url: c.image_url,
      file: null,
    }));
  });
  const updateRow = (id: string, patch: Partial<ColorRow>) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    setError("");
    try {
      const price = Number(f.get("price"));
      const stock = Number(f.get("stock"));
      const sizes = csv(String(f.get("sizes")));
      if (!String(f.get("name")).trim()) throw new Error("Informe o nome");
      if (!(price >= 0)) throw new Error("Preço inválido");
      if (!Number.isInteger(stock) || stock < 0) throw new Error("Estoque inválido");
      if (sizes.length === 0) throw new Error("Informe ao menos um tamanho");

      const colors: ColorOption[] = [];
      for (const r of rows.filter((x) => x.name.trim())) {
        colors.push({
          name: r.name.trim(),
          image_url: r.file ? await uploadImage(orgId, r.file) : r.image_url,
        });
      }
      const body = {
        name: String(f.get("name")).trim(),
        description: String(f.get("description") ?? "").trim() || null,
        price,
        stock,
        available_colors: colors,
        available_sizes: sizes,
        base_image_url: colors.find((c) => c.image_url)?.image_url ?? product?.base_image_url ?? null,
        active: f.get("active") === "on",
      };
      const q = product
        ? supabase.from("products").update(body).eq("id", product.id)
        : supabase.from("products").insert({ ...body, organization_id: orgId, ...(nextOrdem ? { ordem: nextOrdem } : {}) });
      const { data, error: err } = await q.select("id").maybeSingle();
      if (err) throw err;
      if (!data) throw new Error("Não foi possível salvar (sem permissão)");
      onDone();
    } catch (err) {
      setError(errMsg(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card grid gap-3 md:grid-cols-2">
      <div className="font-semibold md:col-span-2">{product ? "Editar produto" : "Novo produto"}</div>
      <div>
        <label className="label">Nome</label>
        <input name="name" required defaultValue={product?.name} className="input" />
      </div>
      <div>
        <label className="label">Preço (R$)</label>
        <input name="price" type="number" step="0.01" min={0} required defaultValue={product ? Number(product.price) : ""} className="input" />
      </div>
      <div className="md:col-span-2">
        <label className="label">Descrição</label>
        <textarea name="description" defaultValue={product?.description ?? ""} className="input" rows={2} />
      </div>
      <div>
        <label className="label">Tamanhos (ex.: P, M, G, GG)</label>
        <input name="sizes" required defaultValue={product?.available_sizes.join(", ") ?? "P, M, G, GG"} className="input" />
      </div>
      <div>
        <label className="label">Estoque</label>
        <input name="stock" type="number" min={0} required defaultValue={product?.stock ?? 0} className="input" />
      </div>
      <div className="space-y-2 md:col-span-2">
        <label className="label">Cores — uma foto da camisa para cada cor</label>
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded border p-2">
            {(r.file || r.image_url) && (
              <img
                src={r.file ? URL.createObjectURL(r.file) : r.image_url!}
                alt=""
                className="h-14 w-14 rounded bg-slate-100 object-contain"
              />
            )}
            <input
              value={r.name}
              onChange={(e) => updateRow(r.id, { name: e.target.value })}
              placeholder="Nome da cor (ex.: Vermelha)"
              className="input !w-56"
            />
            <label className="text-xs text-slate-600">
              Foto {r.image_url && !r.file && "✓"}
              <input type="file" accept="image/*" onChange={(e) => updateRow(r.id, { file: e.target.files?.[0] ?? null })} className="input" />
            </label>
            <button
              type="button"
              className="text-sm text-red-600"
              onClick={() => setRows((x) => (x.length > 1 ? x.filter((y) => y.id !== r.id) : x))}
            >
              Remover
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setRows((x) => [...x, { id: crypto.randomUUID(), name: "", image_url: null, file: null }])}
        >
          + Adicionar cor
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={product?.active ?? true} /> Visível na loja
      </label>
      {error && <p role="alert" className="text-sm text-red-600 md:col-span-2">{error}</p>}
      <div className="flex gap-2 md:col-span-2">
        <button className="btn" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
