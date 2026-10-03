import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "@/components/Auth";
import { supabase } from "@/lib/supabase";

export type Org = { id: string; name: string; slug: string; whatsapp: string | null };
export const useOrg = () => useOutletContext<Org>();

type Licenca = {
  plano: "teste" | "mensal" | "isento";
  dias_restantes: number | null;
  em_carencia: boolean;
  bloqueada: boolean;
  ativa: boolean;
};

/** Faixa de aviso da licença. Sempre diz que os dados estão salvos. */
function LicencaBanner({ l }: { l: Licenca }) {
  const box = (cls: string, text: React.ReactNode) => (
    <div role="status" className={`border-b px-4 py-2 text-center text-sm ${cls}`}>{text}</div>
  );
  if (!l.ativa) {
    return box(
      "border-red-300 bg-red-50 text-red-900",
      <>
        <b>Loja pausada: não está recebendo novos pedidos.</b> Seus dados estão salvos e você pode continuar vendo e
        exportando tudo. Fale com o suporte para reativar.
      </>
    );
  }
  if (l.plano === "teste" && l.dias_restantes !== null) {
    const urgente = l.dias_restantes <= 2;
    return box(
      urgente ? "border-amber-300 bg-amber-50 text-amber-900" : "border-brand-200 bg-brand-50 text-brand-900",
      <>
        Período de teste: {l.dias_restantes <= 0 ? "termina hoje" : `${l.dias_restantes} dia(s) restante(s)`}. Depois
        dele, a loja para de receber novos pedidos (seus dados continuam salvos).
      </>
    );
  }
  if (l.plano === "mensal" && l.em_carencia) {
    return box(
      "border-amber-300 bg-amber-50 text-amber-900",
      <>Mensalidade vencida. Regularize para a loja não ser pausada. Seus dados continuam salvos.</>
    );
  }
  if (l.plano === "mensal" && l.dias_restantes !== null && l.dias_restantes <= 5) {
    return box(
      "border-amber-300 bg-amber-50 text-amber-900",
      <>Sua mensalidade vence em {Math.max(l.dias_restantes, 0)} dia(s).</>
    );
  }
  return null;
}

export default function DashboardLayout() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [org, setOrg] = useState<Org | null>(null);
  const [error, setError] = useState("");
  const [licenca, setLicenca] = useState<Licenca | null>(null);

  useEffect(() => {
    if (!session) return;
    // se a função ainda não existe no banco, simplesmente não mostra faixa (quem trava é o banco)
    supabase.rpc("minha_licenca").then(({ data, error: e }) => {
      if (!e && data) setLicenca(data as Licenca);
    });
  }, [session]);

  useEffect(() => {
    document.title = "Painel · Gold'n Ports";
    if (!session) return;
    supabase
      .from("organizations")
      .select("id, name, slug, whatsapp")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (e) setError("Não foi possível carregar sua loja");
        else if (!data) setError("Sua loja ainda não foi criada. Saia e entre novamente.");
        else setOrg(data as Org);
      });
  }, [session]);

  async function logout() {
    await supabase.auth.signOut();
    navigate("/entrar", { replace: true });
  }

  const link = ({ isActive }: { isActive: boolean }) =>
    isActive ? "text-white" : "text-brand-100 hover:text-white";

  return (
    <div className="min-h-screen">
      <header className="border-b border-brand-800 bg-brand-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
            <Link to="/painel" aria-label="Início do painel">
              <img src="/logo.png" alt="Gold'n Ports" width={520} height={247} className="h-10 w-auto" />
            </Link>
            <NavLink to="/painel" end className={link}>Visão geral</NavLink>
            <NavLink to="/painel/produtos" className={link}>Produtos</NavLink>
            <NavLink to="/painel/pedidos" className={link}>Pedidos</NavLink>
            <NavLink to="/painel/configuracoes" className={link}>Configurações</NavLink>
            {org && (
              <a href={`/loja/${org.slug}`} target="_blank" rel="noreferrer" className="text-brand-300 hover:text-white">
                Ver loja ↗
              </a>
            )}
          </nav>
          <button onClick={logout} className="btn-secondary">Sair</button>
        </div>
      </header>
      {licenca && <LicencaBanner l={licenca} />}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && <p className="text-red-600">{error}</p>}
        {!org && !error && <p className="text-slate-500">Carregando...</p>}
        {org && <Outlet context={org} />}
      </main>
    </div>
  );
}
