"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/fetcher";

type Status = { connected: boolean; charges_enabled: boolean; details_submitted?: boolean };

export default function PaymentsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Status>("/api/merchant/stripe/connect").then(setStatus).catch((e) => setError(e.message));
  }, []);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const { url } = await api<{ url: string }>("/api/merchant/stripe/connect", { method: "POST" });
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Pagamentos</h1>
      <p className="text-sm text-slate-600">
        Conecte sua conta Stripe para receber os pagamentos dos clientes diretamente. Sem a conta conectada, a loja
        não consegue finalizar pedidos.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!status ? (
        !error && <p className="text-slate-500">Carregando...</p>
      ) : (
        <div className="card space-y-3">
          <p>
            Situação:{" "}
            {status.charges_enabled ? (
              <b className="text-brand-700">Pronto para receber</b>
            ) : status.connected ? (
              <b className="text-amber-600">Cadastro incompleto</b>
            ) : (
              <b className="text-slate-600">Não conectada</b>
            )}
          </p>
          {!status.charges_enabled && (
            <button className="btn" onClick={connect} disabled={busy}>
              {busy ? "Abrindo..." : status.connected ? "Continuar cadastro no Stripe" : "Conectar conta Stripe"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
