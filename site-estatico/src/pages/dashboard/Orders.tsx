import { useCallback, useEffect, useState } from "react";
import { formatPhone } from "@/lib/phone";
import { errMsg, supabase } from "@/lib/supabase";
import { brl, STATUS_LABEL, type Order } from "@/lib/types";

const BADGE: Record<Order["status"], string> = {
  pending: "bg-blue-100 text-blue-800",
  in_production: "bg-amber-100 text-amber-800",
  shipped: "bg-emerald-100 text-emerald-800",
};

/** WhatsApp do cliente com link para chamar; pedidos antigos ainda mostram o e-mail. */
function Contato({ order }: { order: Order }) {
  if (order.customer_phone) {
    return (
      <a
        href={`https://wa.me/${order.customer_phone}`}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-medium text-brand-700 hover:underline"
        title="Chamar no WhatsApp"
      >
        {formatPhone(order.customer_phone)} ↗
      </a>
    );
  }
  return <span className="text-xs text-slate-500">{order.customer_email ?? "—"}</span>;
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    let q = supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
    if (filter) q = q.eq("status", filter);
    const { data, error: err } = await q;
    if (err) return setError(errMsg(err));
    const list = (data ?? []) as Order[];
    setOrders(list);
    setSelected((s) => (s ? list.find((o) => o.id === s.id) ?? null : null));
  }, [filter]);
  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: Order["status"]) {
    setError("");
    const { data, error: err } = await supabase.from("orders").update({ status }).eq("id", id).select("id").maybeSingle();
    if (err) return setError(errMsg(err));
    if (!data) return setError("Não foi possível alterar o pedido (sem permissão)");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={load}>Atualizar</button>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input !w-48" aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-3">ID</th><th className="p-3">Cliente</th><th className="p-3">Status</th>
              <th className="p-3">Data</th><th className="p-3">Total</th><th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-3 font-mono text-xs">{o.id.slice(0, 8).toUpperCase()}</td>
                <td className="p-3">{o.customer_name}<br /><Contato order={o} /></td>
                <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs font-medium ${BADGE[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                <td className="p-3">{new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="p-3">{brl(o.total_price)}</td>
                <td className="p-3"><button className="btn-secondary" onClick={() => setSelected(o)}>Detalhes</button></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Nenhum pedido.</td></tr>}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">Pedido {selected.id.slice(0, 8).toUpperCase()}</h2>
                <p className="text-sm text-slate-600">{selected.customer_name} · <Contato order={selected} /></p>
              </div>
              <button className="btn-secondary" onClick={() => setSelected(null)}>Fechar</button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <button className="btn" disabled={selected.status === "in_production"} onClick={() => setStatus(selected.id, "in_production")}>Marcar como Em Produção</button>
              <button className="btn" disabled={selected.status === "shipped"} onClick={() => setStatus(selected.id, "shipped")}>Marcar como Enviado</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {selected.order_items.map((it) => (
                <div key={it.id} className="rounded border p-3 text-sm">
                  {it.customization_image_url ? (
                    <a href={it.customization_image_url} target="_blank" rel="noreferrer">
                      <img src={it.customization_image_url} alt="Customização" className="mb-2 w-full rounded bg-slate-100" />
                    </a>
                  ) : (
                    <div className="mb-2 rounded bg-slate-100 p-6 text-center text-slate-400">Sem imagem</div>
                  )}
                  <p><b>{it.quantity}×</b> tamanho {it.size} · {brl(it.price)}</p>
                  <p className="text-slate-600">
                    {it.customization_data.name && <>Nome: {it.customization_data.name} · </>}
                    {it.customization_data.number != null && <>Nº {it.customization_data.number} · </>}
                    {it.customization_data.color && <>Cor: {it.customization_data.color}</>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
