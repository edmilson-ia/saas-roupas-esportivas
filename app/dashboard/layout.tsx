import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { checkoutMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: org } = await supabase.from("organizations").select("name, slug").eq("id", auth.user.id).single();

  return (
    <div className="min-h-screen">
      <header className="border-b border-brand-800 bg-brand-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
            <Link href="/dashboard" aria-label={org?.name ?? "Minha loja"}>
              <Image src="/logo.png" alt={org?.name ?? "Minha loja"} width={520} height={247} className="h-10 w-auto" />
            </Link>
            <Link href="/dashboard/products" className="text-brand-100 hover:text-white">Produtos</Link>
            <Link href="/dashboard/orders" className="text-brand-100 hover:text-white">Pedidos</Link>
            {checkoutMode() === "stripe" && (
              <Link href="/dashboard/payments" className="text-brand-100 hover:text-white">Pagamentos</Link>
            )}
            <Link href="/dashboard/settings" className="text-brand-100 hover:text-white">Configurações</Link>
            {org?.slug && (
              <Link href={`/loja/${org.slug}`} target="_blank" className="text-brand-300 hover:text-white">Ver loja ↗</Link>
            )}
          </nav>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
