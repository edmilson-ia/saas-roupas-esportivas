import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "@/components/CartProvider";
import { useStore } from "@/components/StoreLayout";
import { brl, normalizeColors } from "@/lib/types";

export default function ProductPage() {
  const { slug, id } = useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const { products } = useStore();
  const product = products.find((p) => p.id === id);
  const colors = normalizeColors(product?.available_colors);

  const [colorName, setColorName] = useState(colors[0]?.name ?? "");
  const [size, setSize] = useState(product?.available_sizes[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");

  if (!product) return <p className="text-red-600">Produto não encontrado.</p>;

  const color = colors.find((c) => c.name === colorName);
  const shown = color?.image_url ?? product.base_image_url;

  function addToCart() {
    if (!size) return setError("Escolha um tamanho");
    cart.add({
      product_id: product!.id,
      product_name: product!.name,
      unit_price: Number(product!.price),
      quantity,
      size,
      customization_data: colorName ? { color: colorName } : {},
      customization_image: shown ?? "",
    });
    navigate(`/loja/${slug}/carrinho`);
  }

  return (
    <div className="space-y-4">
      <Link to={`/loja/${slug}`} className="text-sm text-brand-700 hover:underline">
        ← Voltar ao catálogo
      </Link>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div className="card flex items-center justify-center bg-slate-50 !p-2">
            {shown ? (
              <img src={shown} alt={product.name} className="max-h-[520px] w-full object-contain" />
            ) : (
              <div className="flex h-72 items-center justify-center text-slate-400">Sem imagem</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            {product.description && <p className="text-slate-600">{product.description}</p>}
            <p className="mt-1 text-2xl font-bold text-brand-700">{brl(product.price)}</p>
          </div>

          <div role="note" className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
            <b>Personalização na hora.</b> O nome, o número e o brasão são feitos pela própria loja, na hora de preparar
            a sua camisa. Combine os detalhes pelo WhatsApp.
          </div>

          {colors.length > 1 && (
            <div>
              <label className="label">Cor: {colorName}</label>
              <div className="flex flex-wrap gap-3">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setColorName(c.name)}
                    className="flex w-20 flex-col items-center gap-1 text-xs"
                  >
                    <span
                      className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded border-2 bg-slate-100 ${colorName === c.name ? "border-brand-600 ring-2 ring-brand-300" : "border-slate-300"}`}
                    >
                      {c.image_url && <img src={c.image_url} alt={c.name} className="h-full w-full object-contain" />}
                    </span>
                    <span className={colorName === c.name ? "font-semibold text-brand-700" : "text-slate-600"}>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

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

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label" htmlFor="qtd">Quantidade</label>
              <input
                id="qtd"
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                className="input !w-24"
              />
            </div>
            <p className="pb-2 text-sm text-slate-600">
              Total: <b className="text-base text-slate-900">{brl(Number(product.price) * quantity)}</b>
            </p>
          </div>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button className="btn w-full sm:w-auto" onClick={addToCart}>Adicionar ao carrinho</button>
        </div>
      </div>
    </div>
  );
}
