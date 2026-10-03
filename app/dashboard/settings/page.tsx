"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";

export default function SettingsPage() {
  const [whatsapp, setWhatsapp] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ settings: { whatsapp: string | null } }>("/api/merchant/settings")
      .then((r) => setWhatsapp(r.settings.whatsapp ?? ""))
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    setError("");
    try {
      const r = await api<{ whatsapp: string | null }>("/api/merchant/settings", {
        method: "PATCH",
        body: JSON.stringify({ whatsapp }),
      });
      setWhatsapp(r.whatsapp ?? "");
      setMsg("Salvo!");
    } catch (err) {
      setError((err as Error).message);
    }
    setSaving(false);
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <form onSubmit={save} className="card space-y-3">
        <div>
          <label className="label">WhatsApp da loja (com DDD)</label>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="(11) 99999-8888"
            disabled={!loaded}
            className="input"
          />
          <p className="mt-1 text-xs text-slate-500">
            Os clientes enviam o pedido para este número. Sem ele, a loja não consegue receber pedidos.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {msg && <p className="text-sm text-brand-700">{msg}</p>}
        <button className="btn" disabled={saving || !loaded}>{saving ? "Salvando..." : "Salvar"}</button>
      </form>
    </div>
  );
}
