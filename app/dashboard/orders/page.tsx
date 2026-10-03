"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/fetcher";
import { brl, STATUS_LABEL, type Order } from "@/lib/types";

const BADGE: Record<Order["status"], string> = {
  pending: "bg-blue-100 text-blue-800",
  in_production: "bg-amber-100 text-amber-800",
  shipped: "bg-emerald-100 text-emerald-800",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api<{ orders: Order[] }>(`/api/merchant/orders${filter ? `?status=${filter}` : ""}`);
      setOrders(res.orders);
      setSelected((s) => (s ? res.orders.find((o) => o.id === s.id) ?? null : null));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: Order["status"]) {
    try {
      await api(`/api/merchant/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      load();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input !w-48">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
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
                <td className="p-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td className="p-3">{o.customer_name}<br /><span className="text-xs text-slate-500">{o.customer_email}</span></td>
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
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">Pedido {selected.id.slice(0, 8)}</h2>
                <p className="text-sm text-slate-600">{selected.customer_name} · {selected.customer_email}</p>
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
                  {it.customization_image_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <a href={it.customization_image_url} target="_blank" rel="noreferrer"><img src={it.customization_image_url} alt="Customização" className="mb-2 w-full rounded bg-slate-100" /></a>
                    : <div className="mb-2 rounded bg-slate-100 p-6 text-center text-slate-400">Sem imagem</div>}
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
