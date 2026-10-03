"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { createClient } from "@/lib/supabase/client";
import { brl, normalizeColors, type ColorOption, type Product } from "@/lib/types";

const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setProducts((await api<{ products: Product[] }>("/api/merchant/products")).products);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function remove(p: Product) {
    if (!confirm(`Excluir "${p.name}"?`)) return;
    try {
      await api(`/api/merchant/products/${p.id}`, { method: "DELETE" });
      load();
    } catch (e) { setError((e as Error).message); }
  }

  async function setStock(p: Product, stock: number) {
    if (!Number.isInteger(stock) || stock < 0) return;
    try {
      await api(`/api/merchant/products/${p.id}`, { method: "PATCH", body: JSON.stringify({ stock }) });
      load();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <button className="btn" onClick={() => { setEditing(null); setShowForm(true); }}>Adicionar produto</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {showForm && (
        <ProductForm
          product={editing}
          onDone={() => { setShowForm(false); load(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <div key={p.id} className="card space-y-2">
            {(p.base_image_url ?? normalizeColors(p.available_colors)[0]?.image_url)
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={(p.base_image_url ?? normalizeColors(p.available_colors)[0]?.image_url)!} alt={p.name} className="h-48 w-full rounded object-contain bg-slate-100" />
              : <div className="flex h-48 items-center justify-center rounded bg-slate-100 text-sm text-slate-400">Sem imagem</div>}
            <div className="flex items-start justify-between">
              <h3 className="font-semibold">{p.name}</h3>
              <span className="font-semibold text-brand-700">{brl(p.price)}</span>
            </div>
            <p className="text-xs text-slate-500">
              Cores: {normalizeColors(p.available_colors).map((c) => c.name).join(", ") || "—"} · Tamanhos: {p.available_sizes.join(", ")}
            </p>
            <label className="flex items-center gap-2 text-sm">
              Estoque
              <input
                type="number" min={0} defaultValue={p.stock}
                onBlur={(e) => Number(e.target.value) !== p.stock && setStock(p, Number(e.target.value))}
                className="input !w-24"
              />
              {!p.active && <span className="text-xs text-amber-600">inativo</span>}
            </label>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => { setEditing(p); setShowForm(true); }}>Editar</button>
              <button className="btn-secondary !text-red-600" onClick={() => remove(p)}>Excluir</button>
            </div>
          </div>
        ))}
        {products.length === 0 && <p className="text-sm text-slate-500">Nenhum produto ainda.</p>}
      </div>
    </div>
  );
}

type ColorRow = {
  id: string;
  name: string;
  image_url: string | null;
  back_image_url: string | null;
  file: File | null;
  backFile: File | null;
};

async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 5_000_000) throw new Error("Imagem inválida (máx. 5 MB)");
  const supabase = createClient();
  const { data: u } = await supabase.auth.getUser();
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${u.user!.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file);
  if (error) throw new Error("Falha no upload da imagem");
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

function ProductForm({ product, onDone, onCancel }: { product: Product | null; onDone: () => void; onCancel: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ColorRow[]>(() => {
    const existing = normalizeColors(product?.available_colors);
    const list: ColorOption[] = existing.length ? existing : [{ name: "", image_url: null }];
    return list.map((c) => ({
      id: crypto.randomUUID(),
      name: c.name,
      image_url: c.image_url,
      back_image_url: c.back_image_url ?? null,
      file: null,
      backFile: null,
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
      const filled = rows.filter((r) => r.name.trim());
      const colors = [];
      for (const r of filled) {
        const image_url = r.file ? await uploadImage(r.file) : r.image_url;
        const back_image_url = r.backFile ? await uploadImage(r.backFile) : r.back_image_url;
        colors.push({ name: r.name.trim(), image_url, back_image_url });
      }
      const body = {
        name: f.get("name"),
        description: f.get("description") || null,
        price: Number(f.get("price")),
        stock: Number(f.get("stock")),
        available_colors: colors,
        available_sizes: csv(String(f.get("sizes"))),
        base_image_url: colors.find((c) => c.image_url)?.image_url ?? product?.base_image_url ?? null,
        active: f.get("active") === "on",
      };
      await api(product ? `/api/merchant/products/${product.id}` : "/api/merchant/products", {
        method: product ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2 font-semibold">{product ? "Editar produto" : "Novo produto"}</div>
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
      <div className="md:col-span-2 space-y-2">
        <label className="label">Cores — foto da frente e das costas da camisa para cada cor</label>
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded border p-2">
            {(r.file || r.image_url) && (
              // eslint-disable-next-line @next/next/no-img-element
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
              Frente {r.image_url && !r.file && "✓"}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => updateRow(r.id, { file: e.target.files?.[0] ?? null })}
                className="input"
              />
            </label>
            <label className="text-xs text-slate-600">
              Costas {r.back_image_url && !r.backFile && "✓"}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => updateRow(r.id, { backFile: e.target.files?.[0] ?? null })}
                className="input"
              />
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
          onClick={() => setRows((x) => [...x, { id: crypto.randomUUID(), name: "", image_url: null, back_image_url: null, file: null, backFile: null }])}
        >
          + Adicionar cor
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={product?.active ?? true} /> Visível na loja
      </label>
      {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
      <div className="md:col-span-2 flex gap-2">
        <button className="btn" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
