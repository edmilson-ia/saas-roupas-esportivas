import { Link, useParams } from "react-router-dom";
import { useCart } from "@/components/CartProvider";
import { useStore } from "@/components/StoreLayout";
import { brl } from "@/lib/types";

export default function CartPage() {
  const { slug } = useParams();
  const { items, remove, setQuantity, total } = useCart();
  const { ativa } = useStore();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Carrinho</h1>
      {items.length === 0 ? (
        <p className="text-slate-500">
          Seu carrinho está vazio. <Link className="text-brand-700" to={`/loja/${slug}`}>Ver produtos</Link>
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.key} className="card flex flex-wrap gap-4">
                {it.customization_image ? (
                  <img src={it.customization_image} alt={it.product_name} className="h-28 w-28 rounded bg-slate-100 object-contain" />
                ) : (
                  <span className="h-28 w-28 rounded bg-slate-100" />
                )}
                <div className="min-w-40 flex-1 text-sm">
                  <p className="font-semibold">{it.product_name}</p>
                  <p className="text-slate-600">
                    Tamanho {it.size}
                    {it.customization_data.color && <> · {it.customization_data.color}</>}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={it.quantity}
                      onChange={(e) => setQuantity(it.key, Number(e.target.value) || 1)}
                      className="input !w-20"
                    />
                    <button className="text-red-600" onClick={() => remove(it.key)}>Remover</button>
                  </div>
                </div>
                <p className="font-semibold">{brl(it.unit_price * it.quantity)}</p>
              </div>
            ))}
          </div>
          <p className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
            <b>Personalização na hora:</b> nome, número e brasão são feitos pela loja. Combine os detalhes pelo WhatsApp
            depois de enviar o pedido.
          </p>
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold">Total: {brl(total)}</p>
            {ativa ? (
              <Link to={`/loja/${slug}/checkout`} className="btn">Enviar pedido</Link>
            ) : (
              <button className="btn" disabled>Pedidos pausados</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
