"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";

export default function SuccessPage({ params }: { params: { slug: string } }) {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, [clear]);

  return (
    <div className="card space-y-2 text-center">
      <h1 className="text-2xl font-bold">Pedido recebido!</h1>
      <p className="text-slate-600">
        Estamos confirmando o seu pagamento. Pagamentos por Pix podem levar alguns instantes; a loja só começa a
        produção depois da confirmação.
      </p>
      <Link href={`/loja/${params.slug}`} className="btn">Voltar à loja</Link>
    </div>
  );
}
