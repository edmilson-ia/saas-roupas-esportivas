"use client";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { brl } from "@/lib/types";

export default function CartPage({ params }: { params: { slug: string } }) {
  const { items, remove, setQuantity, total } = useCart();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Carrinho</h1>
      {items.length === 0 ? (
        <p className="text-slate-500">
          Seu carrinho está vazio. <Link className="text-brand-700" href={`/loja/${params.slug}`}>Ver produtos</Link>
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.key} className="card flex gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.customization_image} alt="Customização" className="h-28 w-56 rounded bg-slate-100 object-contain" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold">{it.product_name}</p>
                  <p className="text-slate-600">
                    Tamanho {it.size}
                    {it.customization_data.name && <> · Nome: {it.customization_data.name}</>}
                    {it.customization_data.number != null && <> · Nº {it.customization_data.number}</>}
                    {it.customization_data.color && <> · {it.customization_data.color}</>}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number" min={1} max={100} value={it.quantity}
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
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold">Total: {brl(total)}</p>
            <Link href={`/loja/${params.slug}/checkout`} className="btn">Enviar pedido</Link>
          </div>
        </>
      )}
    </div>
  );
}
