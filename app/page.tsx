import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold">Uniformes e camisas personalizadas</h1>
      <p className="text-slate-600">
        Crie sua loja de roupas esportivas, receba pedidos com nome, número e brasão já montados no editor.
      </p>
      <div className="flex gap-3">
        <Link href="/signup" className="btn">Criar minha loja</Link>
        <Link href="/login" className="btn-secondary">Entrar</Link>
      </div>
    </main>
  );
}
