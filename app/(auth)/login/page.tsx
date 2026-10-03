"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/fetcher";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="mb-6 flex flex-col items-center gap-3 rounded-xl bg-brand-900 p-5">
        <Image src="/logo.png" alt="Logo" width={520} height={247} priority className="h-20 w-auto" />
      </div>
      <h1 className="mb-4 text-2xl font-bold">Entrar</h1>
      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" required className="input" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Não tem conta? <Link href="/signup" className="font-semibold text-brand-700">Criar loja</Link>
      </p>
    </main>
  );
}
