import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/types";
import { useOrg } from "./DashboardLayout";

type Sub = { plan: string; status: string; monthly_price: number | null; billing_date: string | null };

export default function Overview() {
  const org = useOrg();
  const [orders, setOrders] = useState<{ status: string; total_price: number }[] | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string; stock: number }[]>([]);
  const [sub, setSub] = useState<Sub | null>(null);

  useEffect(() => {
    supabase.from("orders").select("status, total_price").then(({ data }) => setOrders(data ?? []));
    supabase.from("products").select("id, name, stock").then(({ data }) => setProducts(data ?? []));
    supabase
      .from("subscriptions")
      .select("plan, status, monthly_price, billing_date")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSub(data as Sub | null));
  }, []);

  const count = (s: string) => orders?.filter((o) => o.status === s).length ?? 0;
  const revenue = orders?.reduce((s, o) => s + Number(o.total_price), 0) ?? 0;
  const lowStock = products.filter((p) => p.stock <= 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Visão geral</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Pedidos novos" value={count("pending")} />
        <Stat label="Em produção" value={count("in_production")} />
        <Stat label="Enviados" value={count("shipped")} />
        <Stat label="Total vendido" value={brl(revenue)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-semibold">Assinatura</h2>
          {sub ? (
            <p className="text-sm text-slate-600">
              Plano <b>{sub.plan}</b> · {sub.status} · {brl(sub.monthly_price ?? 0)}/mês
              {sub.billing_date && <> · próxima cobrança {new Date(sub.billing_date + "T00:00").toLocaleDateString("pt-BR")}</>}
            </p>
          ) : (
            <p className="text-sm text-slate-500">Sem assinatura.</p>
          )}
        </div>
        <div className="card">
          <h2 className="mb-2 font-semibold">Estoque baixo</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum produto com estoque baixo.</p>
          ) : (
            <ul className="text-sm text-slate-600">
              {lowStock.map((p) => (
                <li key={p.id}>{p.name}: {p.stock} un.</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="card text-sm">
        Link da sua loja:{" "}
        <Link className="font-semibold text-brand-700" to={`/loja/${org.slug}`}>
          {window.location.origin}/loja/{org.slug}
        </Link>
        {!org.whatsapp && (
          <p className="mt-2 text-amber-700">
            Falta cadastrar o WhatsApp da loja em <Link className="underline" to="/painel/configuracoes">Configurações</Link>.
            Sem ele, os clientes não conseguem enviar pedidos.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
