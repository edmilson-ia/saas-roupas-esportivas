"use client";
import Image from "next/image";
import Link from "next/link";
import InstallButton from "./InstallButton";
import { useCart } from "./CartProvider";

export default function StoreHeader({ name, whatsapp }: { name: string; whatsapp: string | null }) {
  const { slug, count } = useCart();
  return (
    <header className="sticky top-0 z-10 border-b border-brand-800 bg-brand-900 shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Link href={`/loja/${slug}`} aria-label={name}>
          <Image src="/logo.png" alt={name} width={520} height={247} priority className="h-12 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <InstallButton className="btn-secondary !border-brand-500 !bg-transparent !text-brand-100 hover:!bg-brand-800" />
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Olá! Vi o catálogo e gostaria de mais informações.")}`}
              target="_blank"
              rel="noreferrer"
              className="btn hidden !bg-brand-500 hover:!bg-brand-400 sm:inline-flex"
            >
              WhatsApp
            </a>
          )}
          <Link href={`/loja/${slug}/carrinho`} className="btn-secondary">
            Carrinho
            {count > 0 && <span className="ml-2 rounded-full bg-brand-600 px-2 text-xs text-white">{count}</span>}
          </Link>
        </div>
      </div>
    </header>
  );
}
