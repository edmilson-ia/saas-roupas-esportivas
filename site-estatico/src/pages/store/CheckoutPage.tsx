import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCart } from "@/components/CartProvider";
import { useStore, whatsappLink } from "@/components/StoreLayout";
import { errMsg, supabase } from "@/lib/supabase";
import { brl } from "@/lib/types";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function CheckoutPage() {
  const { slug } = useParams();
  const { store, ativa } = useStore();
  const { items, total, clear } = useCart();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const email = String(f.get("email") ?? "").trim();
    setError("");
    if (!ativa) return setError("Esta loja não está recebendo novos pedidos no momento");
    if (name.length < 2) return setError("Informe seu nome");
    if (!EMAIL.test(email)) return setError("Informe um e-mail válido");
    // falha ANTES de salvar, para não criar pedido sem ter para onde enviar
    if (!store.whatsapp) return setError("A loja ainda não configurou o WhatsApp para receber pedidos");

    setLoading(true);
    try {
      // 1) o banco confere preço, tamanho, cor e estoque e grava o pedido
      //    (sem personalização: a loja faz nome/número/brasão na hora)
      const { data, error: rpcErr } = await supabase.rpc("create_order", {
        p_slug: slug,
        p_name: name,
        p_email: email,
        p_items: items.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          size: it.size,
          customization_data: it.customization_data.color ? { color: it.customization_data.color } : {},
          customization_image_url: null,
        })),
      });
      if (rpcErr) throw rpcErr;
      const { order_id, total: saved } = data as { order_id: string; total: number };

      // 2) mensagem para a loja com o resumo
      const lines = items.map((it) => {
        const cor = it.customization_data.color ? ` - Cor: ${it.customization_data.color}` : "";
        return `${it.quantity}x ${it.product_name} - Tam. ${it.size}${cor} - ${brl(it.unit_price * it.quantity)}`;
      });
      const text =
        `Olá! Fiz um pedido pelo catálogo.\nPedido: #${order_id.slice(0, 8).toUpperCase()}\n` +
        `Cliente: ${name} (${email})\n\n${lines.join("\n")}\n\nTotal: ${brl(saved)}\n\n` +
        `Quero personalizar com nome, número e brasão. Podemos combinar?`;

      clear(); // só limpa depois do pedido salvo
      window.location.href = whatsappLink(store.whatsapp, text);
    } catch (err) {
      setError(errMsg(err));
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-slate-500">
        Carrinho vazio. <Link className="text-brand-700" to={`/loja/${slug}`}>Ver produtos</Link>
      </p>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={onSubmit} className="card space-y-4">
        <h1 className="text-xl font-bold">Seus dados</h1>
        <div>
          <label className="label" htmlFor="name">Nome</label>
          <input id="name" name="name" required minLength={2} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button className="btn w-full" disabled={loading || !ativa}>
          {!ativa ? "Pedidos pausados" : loading ? "Enviando..." : "Enviar pedido pelo WhatsApp"}
        </button>
      </form>
      <div className="card space-y-2">
        <h2 className="font-bold">Resumo</h2>
        {items.map((i) => (
          <div key={i.key} className="flex items-center gap-3 text-sm">
            {i.customization_image ? (
              <img src={i.customization_image} alt="" className="h-14 w-14 rounded bg-slate-100 object-contain" />
            ) : (
              <span className="h-14 w-14 rounded bg-slate-100" />
            )}
            <span className="flex-1">{i.quantity}× {i.product_name} ({i.size})</span>
            <span>{brl(i.unit_price * i.quantity)}</span>
          </div>
        ))}
        <p className="border-t pt-2 text-right font-bold">Total: {brl(total)}</p>
        <p className="text-xs text-slate-500">
          Nome, número e brasão são feitos pela loja na hora; combine os detalhes pelo WhatsApp. O valor final é
          conferido pela loja ao receber o pedido.
        </p>
      </div>
    </div>
  );
}
