import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdmin } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { releaseOrderStock } from "@/lib/stock";

export const dynamic = "force-dynamic";

/**
 * Webhook "Connect": recebe eventos das contas dos lojistas.
 * A confirmação do pagamento vem SEMPRE daqui, nunca da página de sucesso.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Webhook não configurado" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  const admin = createAdmin();
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;
        // Pix/boleto: "completed" chega antes do pagamento; só vale quando paid
        if (s.payment_status === "paid" && s.metadata?.order_id) {
          await admin
            .from("orders")
            .update({ payment_status: "paid", paid_at: new Date().toISOString() })
            .eq("id", s.metadata.order_id)
            .eq("payment_status", "unpaid");
        }
        break;
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = s.metadata?.order_id;
        if (orderId) {
          const { data: changed } = await admin
            .from("orders")
            .update({ payment_status: event.type === "checkout.session.expired" ? "expired" : "failed" })
            .eq("id", orderId)
            .eq("payment_status", "unpaid")
            .select("id");
          // só devolve o estoque se esta chamada mudou o pedido (idempotente)
          if (changed?.length) await releaseOrderStock(admin, orderId);
        }
        break;
      }
      case "account.updated": {
        const a = event.data.object as Stripe.Account;
        await admin
          .from("organizations")
          .update({ stripe_charges_enabled: a.charges_enabled })
          .eq("stripe_account_id", a.id);
        break;
      }
    }
  } catch (e) {
    console.error("webhook", event.type, e);
    return NextResponse.json({ error: "Falha ao processar" }, { status: 500 }); // Stripe tenta de novo
  }
  return NextResponse.json({ received: true });
}
