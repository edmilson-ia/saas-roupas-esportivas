import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/Auth";
import { errMsg, supabase } from "@/lib/supabase";

function Frame({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="mb-6 flex flex-col items-center gap-3 rounded-xl bg-brand-900 p-5">
        <img src="/logo.png" alt="Logo" width={520} height={247} className="h-20 w-auto" />
      </div>
      <h1 className="mb-4 text-2xl font-bold">{title}</h1>
      {children}
      <p className="mt-4 text-center text-sm text-slate-600">{footer}</p>
    </main>
  );
}

export function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to="/painel" replace />;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")).trim(),
      password: String(f.get("password")),
    });
    if (err) {
      setError("E-mail ou senha inválidos");
      setLoading(false);
      return;
    }
    navigate((location.state as { from?: string } | null)?.from ?? "/painel", { replace: true });
  }

  return (
    <Frame title="Entrar" footer={<>Não tem conta? <Link to="/cadastrar" className="font-semibold text-brand-700">Criar loja</Link></>}>
      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" required className="input" />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button className="btn w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
      </form>
    </Frame>
  );
}

export function SignupPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to="/painel" replace />;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    setError("");
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres");
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: String(f.get("email")).trim(),
      password,
      options: { data: { name: String(f.get("name")).trim() } }, // o banco cria a loja a partir disto
    });
    if (err) {
      setError(errMsg(err));
      setLoading(false);
      return;
    }
    if (!data.session) {
      setInfo("Conta criada! Confirme seu e-mail para entrar.");
      setLoading(false);
      return;
    }
    navigate("/painel", { replace: true });
  }

  return (
    <Frame title="Criar minha loja" footer={<>Já tem conta? <Link to="/entrar" className="font-semibold text-brand-700">Entrar</Link></>}>
      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="label" htmlFor="name">Nome da loja</label>
          <input id="name" name="name" required minLength={2} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Senha (mín. 8 caracteres)</label>
          <input id="password" name="password" type="password" required minLength={8} className="input" />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {info && <p className="text-sm text-brand-700">{info}</p>}
        <button className="btn w-full" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</button>
      </form>
    </Frame>
  );
}
