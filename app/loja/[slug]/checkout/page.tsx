"use client";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { api } from "@/lib/fetcher";
import { brl } from "@/lib/types";

export default function CheckoutPage({ params }: { params: { slug: string } }) {
  const { items, total, clear } = useCart();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setError("");
    try {
      const res = await api<{ checkout_url?: string; whatsapp_url?: string }>("/api/store/checkout", {
        method: "POST",
        body: JSON.stringify({
          organization_slug: params.slug,
          customer_name: f.get("name"),
          customer_email: f.get("email"),
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            size: i.size,
            customization_data: i.customization_data,
            customization_image: i.customization_image,
          })),
        }),
      });
      if (res.whatsapp_url) {
        clear(); // pedido salvo: segue para a conversa com a loja
        window.location.href = res.whatsapp_url;
      } else if (res.checkout_url) {
        // Stripe: o carrinho só é limpo na página de sucesso; a confirmação real vem pelo webhook
        window.location.href = res.checkout_url;
      }
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return <p className="text-slate-500">Carrinho vazio. <Link className="text-brand-700" href={`/loja/${params.slug}`}>Ver produtos</Link></p>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={onSubmit} className="card space-y-4">
        <h1 className="text-xl font-bold">Seus dados</h1>
        <div>
          <label className="label">Nome</label>
          <input name="name" required minLength={2} className="input" />
        </div>
        <div>
          <label className="label">E-mail</label>
          <input name="email" type="email" required className="input" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn w-full" disabled={loading}>{loading ? "Enviando..." : "Enviar pedido"}</button>
      </form>
      <div className="card space-y-2">
        <h2 className="font-bold">Resumo</h2>
        {items.map((i) => (
          <div key={i.key} className="flex items-center gap-3 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={i.customization_image} alt="" className="h-14 w-28 rounded bg-slate-100 object-contain" />
            <span className="flex-1">{i.quantity}× {i.product_name} ({i.size})</span>
            <span>{brl(i.unit_price * i.quantity)}</span>
          </div>
        ))}
        <p className="border-t pt-2 text-right font-bold">Total: {brl(total)}</p>
      </div>
    </div>
  );
}
