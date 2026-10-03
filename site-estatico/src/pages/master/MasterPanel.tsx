import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/Auth";
import { errMsg, supabase } from "@/lib/supabase";
import { brl } from "@/lib/types";

type Loja = {
  organization_id: string;
  nome: string;
  slug: string;
  email: string;
  whatsapp: string | null;
  criado_em: string;
  plano: "teste" | "mensal" | "isento";
  valido_ate: string | null;
  carencia_dias: number;
  bloqueada: boolean;
  bloqueio_motivo: string | null;
  cliente: string | null;
  valor_mensal: number | null;
  ativa: boolean;
  pedidos: number;
};
type Hist = { acao: string; detalhes: Record<string, unknown>; criado_em: string };

const DIA = 864e5;
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Texto e cor da situação, a partir dos mesmos campos que o banco usa para travar. */
function situacao(l: Loja): { texto: string; cls: string } {
  if (l.bloqueada) return { texto: "Bloqueada", cls: "bg-red-100 text-red-800" };
  if (l.plano === "isento") return { texto: "Isenta", cls: "bg-slate-100 text-slate-700" };
  if (!l.valido_ate) {
    return { texto: l.plano === "teste" ? "Teste sem prazo" : "Mensal sem vencimento", cls: "bg-blue-100 text-blue-800" };
  }
  const resto = new Date(l.valido_ate).getTime() - Date.now();
  const dias = Math.ceil(resto / DIA);
  if (resto >= 0) {
    return l.plano === "teste"
      ? { texto: `Em teste · ${dias} dia(s)`, cls: dias <= 2 ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800" }
      : { texto: `Ativa · vence em ${dias} dia(s)`, cls: dias <= 5 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800" };
  }
  return l.ativa
    ? { texto: "Em carência", cls: "bg-amber-100 text-amber-800" }
    : { texto: "Vencida · pausada", cls: "bg-red-100 text-red-800" };
}

const ACAO: Record<string, string> = {
  teste_iniciado: "Teste iniciado",
  pagamento: "Pagamento registrado",
  bloqueio: "Bloqueada",
  liberado: "Liberada",
  editado: "Dados editados",
};

export default function MasterPanel() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [papel, setPapel] = useState<"checando" | "sim" | "nao">("checando");
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Painel do dono";
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex, nofollow";
    document.head.appendChild(m);
    return () => m.remove();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("superadmins")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setPapel(data ? "sim" : "nao"));
  }, [session]);

  const carregar = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("master_listar");
    if (e) return setError(errMsg(e));
    setLojas((data ?? []) as Loja[]);
  }, []);

  const carregarHist = useCallback(async (id: string) => {
    const { data } = await supabase.rpc("master_historico", { p_org: id });
    setHist((data ?? []) as Hist[]);
  }, []);

  useEffect(() => {
    if (papel === "sim") carregar();
  }, [papel, carregar]);
  useEffect(() => {
    if (sel) carregarHist(sel);
  }, [sel, carregarHist]);

  /** Chama uma função master_*; o banco recusa quem não é superadmin. */
  async function chamar(fn: string, args: Record<string, unknown>, ok: string) {
    setBusy(true);
    setError("");
    setMsg("");
    const { error: e } = await supabase.rpc(fn, args);
    setBusy(false);
    if (e) return setError(errMsg(e));
    setMsg(ok);
    await carregar();
    if (sel) await carregarHist(sel);
  }

  async function sair() {
    await supabase.auth.signOut();
    navigate("/entrar", { replace: true });
  }

  if (papel === "checando") return <p className="p-6 text-slate-500">Carregando...</p>;
  if (papel === "nao") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold">Sem permissão</h1>
        <p className="text-slate-600">Esta área é restrita ao dono do sistema.</p>
        <button className="btn" onClick={sair}>Sair</button>
      </main>
    );
  }

  const loja = lojas.find((l) => l.organization_id === sel) ?? null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-brand-800 bg-brand-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" width={520} height={247} className="h-10 w-auto" />
            <span className="text-sm font-semibold">Painel do dono</span>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={carregar}>Atualizar</button>
            <button className="btn-secondary" onClick={sair}>Sair</button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-2">
          <h1 className="text-xl font-bold">Lojas ({lojas.length})</h1>
          {lojas.map((l) => {
            const s = situacao(l);
            return (
              <button
                key={l.organization_id}
                onClick={() => { setSel(l.organization_id); setMsg(""); setError(""); }}
                className={`card block w-full text-left hover:shadow-md ${sel === l.organization_id ? "ring-2 ring-brand-600" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{l.nome}</p>
                    <p className="text-xs text-slate-500">{l.cliente ?? l.email}</p>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.texto}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{l.pedidos} pedido(s) · /loja/{l.slug}</p>
              </button>
            );
          })}
          {lojas.length === 0 && <p className="text-sm text-slate-500">Nenhuma loja.</p>}
        </section>

        <section>
          {error && <p role="alert" className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {msg && <p className="mb-3 rounded bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</p>}
          {!loja ? (
            <p className="text-slate-500">Escolha uma loja para gerenciar a licença.</p>
          ) : (
            <Detalhe key={loja.organization_id} loja={loja} hist={hist} busy={busy} chamar={chamar} />
          )}
        </section>
      </main>
    </div>
  );
}

function Detalhe({
  loja, hist, busy, chamar,
}: {
  loja: Loja;
  hist: Hist[];
  busy: boolean;
  chamar: (fn: string, args: Record<string, unknown>, ok: string) => Promise<void>;
}) {
  const id = loja.organization_id;
  const s = situacao(loja);
  const [diasTeste, setDiasTeste] = useState("7");
  const [diasPag, setDiasPag] = useState("30");
  const [valorPag, setValorPag] = useState(loja.valor_mensal != null ? String(loja.valor_mensal) : "");
  const [motivo, setMotivo] = useState("");
  const [confirmaBloqueio, setConfirmaBloqueio] = useState(false);
  const [plano, setPlano] = useState<Loja["plano"]>(loja.plano);
  const [validoAte, setValidoAte] = useState(toLocalInput(loja.valido_ate));
  const [carencia, setCarencia] = useState(String(loja.carencia_dias));
  const [cliente, setCliente] = useState(loja.cliente ?? "");
  const [valor, setValor] = useState(loja.valor_mensal != null ? String(loja.valor_mensal) : "");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{loja.nome}</h2>
            <p className="text-sm text-slate-600">
              {loja.email} · WhatsApp {loja.whatsapp ?? "não cadastrado"} · criada em {fmt(loja.criado_em)}
            </p>
          </div>
          <span className={`rounded px-3 py-1 text-sm font-semibold ${s.cls}`}>{s.texto}</span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <div><dt className="text-slate-500">Plano</dt><dd className="font-medium">{loja.plano}</dd></div>
          <div><dt className="text-slate-500">Vence em</dt><dd className="font-medium">{fmt(loja.valido_ate)}</dd></div>
          <div><dt className="text-slate-500">Carência</dt><dd className="font-medium">{loja.carencia_dias} dia(s)</dd></div>
          <div><dt className="text-slate-500">Mensalidade</dt><dd className="font-medium">{loja.valor_mensal != null ? brl(loja.valor_mensal) : "—"}</dd></div>
        </dl>
        {loja.bloqueada && (
          <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-800">
            Bloqueada manualmente{loja.bloqueio_motivo ? `: ${loja.bloqueio_motivo}` : ""}. A loja não recebe pedidos.
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          A loja {loja.ativa ? "está recebendo" : "NÃO está recebendo"} novos pedidos agora. O catálogo e o painel do
          lojista continuam abertos, com os dados salvos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-2">
          <h3 className="font-semibold">Iniciar período de teste</h3>
          <label className="label" htmlFor="dt">Dias de teste (a partir de agora)</label>
          <input id="dt" type="number" min={1} max={365} value={diasTeste} onChange={(e) => setDiasTeste(e.target.value)} className="input" />
          <button
            className="btn" disabled={busy}
            onClick={() => chamar("master_iniciar_teste", { p_org: id, p_dias: Number(diasTeste) }, `Teste de ${diasTeste} dia(s) iniciado`)}
          >
            Iniciar teste
          </button>
        </div>

        <div className="card space-y-2">
          <h3 className="font-semibold">Registrar pagamento da mensalidade</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="dp">Dias a somar</label>
              <input id="dp" type="number" min={1} max={366} value={diasPag} onChange={(e) => setDiasPag(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="vp">Valor (R$)</label>
              <input id="vp" type="number" min={0} step="0.01" value={valorPag} onChange={(e) => setValorPag(e.target.value)} className="input" />
            </div>
          </div>
          <button
            className="btn" disabled={busy}
            onClick={() =>
              chamar("master_registrar_pagamento",
                { p_org: id, p_dias: Number(diasPag), p_valor: valorPag === "" ? null : Number(valorPag) },
                "Pagamento registrado")
            }
          >
            Registrar pagamento
          </button>
          <p className="text-xs text-slate-500">
            Em dia: soma ao vencimento. Atrasado: conta a partir de hoje. Não remove um bloqueio manual.
          </p>
        </div>

        <div className="card space-y-2">
          <h3 className="font-semibold">{loja.bloqueada ? "Liberar loja" : "Bloquear loja"}</h3>
          {loja.bloqueada ? (
            <>
              <p className="text-sm text-slate-600">Remove só o bloqueio manual. Licença vencida continua pausada.</p>
              <button className="btn" disabled={busy} onClick={() => chamar("master_liberar", { p_org: id }, "Loja liberada")}>
                Liberar
              </button>
            </>
          ) : (
            <>
              <label className="label" htmlFor="mb">Motivo (opcional)</label>
              <input id="mb" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} className="input" />
              {!confirmaBloqueio ? (
                <button className="btn !bg-red-600 hover:!bg-red-700" onClick={() => setConfirmaBloqueio(true)}>Bloquear</button>
              ) : (
                <div className="flex gap-2">
                  <button
                    className="btn !bg-red-700 hover:!bg-red-800" disabled={busy}
                    onClick={() => { setConfirmaBloqueio(false); chamar("master_bloquear", { p_org: id, p_motivo: motivo }, "Loja bloqueada"); }}
                  >
                    Confirmar bloqueio
                  </button>
                  <button className="btn-secondary" onClick={() => setConfirmaBloqueio(false)}>Cancelar</button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="card space-y-2">
          <h3 className="font-semibold">Editar licença</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="pl">Plano</label>
              <select id="pl" value={plano} onChange={(e) => setPlano(e.target.value as Loja["plano"])} className="input">
                <option value="teste">teste</option>
                <option value="mensal">mensal</option>
                <option value="isento">isento</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ca">Carência (dias)</label>
              <input id="ca" type="number" min={0} max={60} value={carencia} onChange={(e) => setCarencia(e.target.value)} className="input" />
            </div>
          </div>
          <label className="label" htmlFor="va">Vencimento (vazio = sem prazo)</label>
          <input id="va" type="datetime-local" value={validoAte} onChange={(e) => setValidoAte(e.target.value)} className="input" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="cl">Cliente</label>
              <input id="cl" value={cliente} onChange={(e) => setCliente(e.target.value)} maxLength={120} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="vl">Mensalidade (R$)</label>
              <input id="vl" type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="input" />
            </div>
          </div>
          <button
            className="btn" disabled={busy}
            onClick={() =>
              chamar("master_definir", {
                p_org: id,
                p_plano: plano,
                p_valido_ate: validoAte ? new Date(validoAte).toISOString() : null,
                p_carencia: Number(carencia),
                p_cliente: cliente,
                p_valor: valor === "" ? null : Number(valor),
              }, "Licença atualizada")
            }
          >
            Salvar alterações
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-2 font-semibold">Histórico</h3>
        {hist.length === 0 ? (
          <p className="text-sm text-slate-500">Sem registros ainda.</p>
        ) : (
          <ul className="divide-y text-sm">
            {hist.map((h, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>
                  <b>{ACAO[h.acao] ?? h.acao}</b>
                  {Object.keys(h.detalhes).length > 0 && (
                    <span className="text-slate-500"> · {Object.entries(h.detalhes).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}: ${String(v)}`).join(", ")}</span>
                  )}
                </span>
                <span className="text-slate-500">{fmt(h.criado_em)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
