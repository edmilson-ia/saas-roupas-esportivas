import { lazy, Suspense, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "@/components/CartProvider";
import type { EditorHandle } from "@/components/ShirtEditor";
import { useStore } from "@/components/StoreLayout";
import { brl } from "@/lib/types";

// Fabric.js é pesado: só baixa quando alguém abre um produto
const ShirtEditor = lazy(() => import("@/components/ShirtEditor"));

export default function ProductPage() {
  const { slug, id } = useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const { products } = useStore();
  const editor = useRef<EditorHandle>(null);
  const product = products.find((p) => p.id === id);
  const [size, setSize] = useState(product?.available_sizes[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");

  if (!product) return <p className="text-red-600">Produto não encontrado.</p>;

  function saveImage() {
    const { image } = editor.current!.exportDesign();
    const a = document.createElement("a");
    a.href = image;
    a.download = `${product!.name}.png`;
    a.click();
  }

  function addToCart() {
    if (!size) return setError("Escolha um tamanho");
    const { image, data } = editor.current!.exportDesign();
    cart.add({
      product_id: product!.id,
      product_name: product!.name,
      unit_price: Number(product!.price),
      quantity,
      size,
      customization_data: data,
      customization_image: image,
    });
    navigate(`/loja/${slug}/carrinho`);
  }

  return (
    <div className="space-y-4">
      <Link to={`/loja/${slug}`} className="text-sm text-brand-700 hover:underline">
        ← Voltar ao catálogo
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          {product.description && <p className="text-slate-600">{product.description}</p>}
        </div>
        <p className="text-2xl font-bold text-brand-700">{brl(product.price)}</p>
      </div>
      <p className="text-xs text-slate-500">
        1. Escolha a cor · 2. Na aba Costas, coloque nome e número · 3. Na aba Frente, adicione o brasão · 4. Escolha o
        tamanho e envie o pedido
      </p>
      <div className="card">
        <Suspense fallback={<p className="text-slate-500">Carregando editor...</p>}>
          <ShirtEditor editorRef={editor} baseImageUrl={product.base_image_url} colors={product.available_colors} />
        </Suspense>
      </div>
      <div className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Tamanho</label>
          <div className="flex flex-wrap gap-2">
            {product.available_sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`h-10 min-w-10 rounded-md border px-3 text-sm font-semibold ${size === s ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white hover:bg-slate-50"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Quantidade</label>
          <input
            type="number"
            min={1}
            max={100}
            value={quantity}
            onChange={(e) => setQuantity(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
            className="input !w-24"
          />
        </div>
        <p className="text-sm text-slate-600">
          Total: <b className="text-base text-slate-900">{brl(Number(product.price) * quantity)}</b>
        </p>
        <button className="btn-secondary" onClick={saveImage}>Baixar imagem (PNG)</button>
        <button className="btn" onClick={addToCart}>Adicionar ao carrinho</button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
