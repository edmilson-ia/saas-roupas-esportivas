import { useState } from "react";
import { normalizePhone } from "@/lib/phone";
import { errMsg, supabase } from "@/lib/supabase";
import { useOrg } from "./DashboardLayout";

export default function Settings() {
  const org = useOrg();
  const [whatsapp, setWhatsapp] = useState(org.whatsapp ?? "");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    const phone = normalizePhone(whatsapp);
    if (phone === "invalid") return setError("Número de WhatsApp inválido (use DDD + número)");
    setSaving(true);
    // .select().maybeSingle(): com RLS, "0 linhas alteradas" não gera erro; sem isto pareceria salvo
    const { data, error: err } = await supabase
      .from("organizations")
      .update({ whatsapp: phone })
      .eq("id", org.id)
      .select("whatsapp")
      .maybeSingle();
    if (err) setError(errMsg(err));
    else if (!data) setError("Não foi possível salvar (sem permissão)");
    else {
      org.whatsapp = data.whatsapp;
      setWhatsapp(data.whatsapp ?? "");
      setMsg("Salvo!");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <form onSubmit={save} className="card space-y-3">
        <div>
          <label className="label" htmlFor="wa">WhatsApp da loja (com DDD)</label>
          <input
            id="wa"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="(11) 99999-8888"
            className="input"
          />
          <p className="mt-1 text-xs text-slate-500">
            Os clientes enviam o pedido para este número. Sem ele, a loja não consegue receber pedidos.
          </p>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {msg && <p className="text-sm text-brand-700">{msg}</p>}
        <button className="btn" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
      </form>
    </div>
  );
}
