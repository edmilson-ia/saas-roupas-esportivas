import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, dbError, handle, parseBody } from "@/lib/api";
import { checkoutSchema } from "@/lib/validation";
import { createAdmin } from "@/lib/supabase/server";
import { checkoutMode } from "@/lib/config";
import { appUrl, getStripe, platformFeePercent, toCents } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type Item = ReturnType<typeof checkoutSchema.parse>["items"][number];
type Line = { item: Item; name: string; price: number };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Sobe as imagens e grava os itens do pedido. */
async function saveItems(admin: SupabaseClient, orgId: string, orderId: string, lines: Line[]) {
  const rows = [];
  for (const { item, price } of lines) {
    let imageUrl: string | null = null;
    if (item.customization_image) {
      const buf = Buffer.from(item.customization_image.split(",")[1], "base64");
      const path = `${orgId}/${orderId}/${randomUUID()}.png`;
      const { error } = await admin.storage.from("customizations").upload(path, buf, { contentType: "image/png" });
      dbError(error);
      imageUrl = admin.storage.from("customizations").getPublicUrl(path).data.publicUrl;
    }
    rows.push({
      order_id: orderId,
      organization_id: orgId,
      product_id: item.product_id,
      quantity: item.quantity,
      size: item.size,
      customization_data: item.customization_data,
      customization_image_url: imageUrl,
      price: price.toFixed(2),
    });
  }
  const { error } = await admin.from("order_items").insert(rows).select("id");
  dbError(error);
  return rows;
}

function whatsappUrl(phone: string, orderId: string, customer: string, email: string, lines: Line[], rows: { customization_image_url: string | null }[], total: number) {
  const body = lines
    .map(({ item, name, price }, i) => {
      const c = item.customization_data;
      const extras = [c.color && `Cor: ${c.color}`, c.name && `Nome: ${c.name}`, c.number != null && `Nº ${c.number}`]
        .filter(Boolean)
        .join(" | ");
      return [
        `${item.quantity}x ${name} - Tam. ${item.size} - ${brl(price * item.quantity)}`,
        extras && `   ${extras}`,
        rows[i].customization_image_url && `   Design: ${rows[i].customization_image_url}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
  const text = `Olá! Fiz um pedido pelo catálogo.\nPedido: #${orderId.slice(0, 8).toUpperCase()}\nCliente: ${customer} (${email})\n\n${body}\n\nTotal: ${brl(total)}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export const POST = handle(async (req: Request) => {
  const body = await parseBody(req, checkoutSchema);
  const admin = createAdmin();
  const mode = checkoutMode();

  // As colunas do Stripe só existem depois da migration 0002
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select(mode === "stripe" ? "id, whatsapp, stripe_account_id, stripe_charges_enabled" : "id, whatsapp")
    .eq("slug", body.organization_slug)
    .maybeSingle<{ id: string; whatsapp: string | null; stripe_account_id?: string | null; stripe_charges_enabled?: boolean }>();
  dbError(orgErr);
  if (!org) throw new ApiError(404, "Loja não encontrada");
  if (mode === "stripe" && (!org.stripe_account_id || !org.stripe_charges_enabled)) {
    throw new ApiError(400, "Esta loja ainda não aceita pagamentos");
  }
  if (mode === "whatsapp" && !org.whatsapp) {
    throw new ApiError(400, "A loja ainda não configurou o WhatsApp para receber pedidos");
  }

  // Preços e regras vêm SEMPRE do banco, nunca do cliente
  const ids = Array.from(new Set(body.items.map((i) => i.product_id)));
  const { data: products, error: pErr } = await admin
    .from("products")
    .select("id, name, price, stock, active, available_colors, available_sizes")
    .eq("organization_id", org.id)
    .in("id", ids);
  dbError(pErr);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const demand = new Map<string, number>();
  const lines: Line[] = body.items.map((item) => {
    const p = byId.get(item.product_id);
    if (!p || !p.active) throw new ApiError(400, "Produto indisponível");
    if (!(p.available_sizes as string[]).includes(item.size)) throw new ApiError(400, "Tamanho indisponível");
    const color = item.customization_data.color;
    const colorNames = (p.available_colors as (string | { name: string })[]).map((c) =>
      typeof c === "string" ? c : c.name
    );
    if (color && !colorNames.includes(color)) throw new ApiError(400, "Cor indisponível");
    demand.set(p.id, (demand.get(p.id) ?? 0) + item.quantity);
    if (demand.get(p.id)! > p.stock) throw new ApiError(400, "Estoque insuficiente");
    return { item, name: p.name as string, price: Number(p.price) };
  });
  const totalCents = lines.reduce((s, l) => s + toCents(l.price) * l.item.quantity, 0);

  const orderRow = {
    organization_id: org.id,
    customer_name: body.customer_name,
    customer_email: body.customer_email,
    total_price: (totalCents / 100).toFixed(2),
    ...(mode === "stripe" ? { payment_status: "unpaid" } : {}),
  };

  // ---------- Modo WhatsApp: salva o pedido e leva o cliente à conversa ----------
  // Não mexe no estoque: o lojista confirma a venda na conversa e ajusta o estoque.
  if (mode === "whatsapp") {
    const { data: order, error } = await admin.from("orders").insert(orderRow).select("id").single();
    dbError(error);
    try {
      const rows = await saveItems(admin, org.id, order!.id, lines);
      return NextResponse.json(
        {
          order_id: order!.id,
          whatsapp_url: whatsappUrl(org.whatsapp!, order!.id, body.customer_name, body.customer_email, lines, rows, totalCents / 100),
        },
        { status: 201 }
      );
    } catch (e) {
      await admin.from("orders").delete().eq("id", order!.id);
      throw e;
    }
  }

  // ---------- Modo Stripe: reserva estoque e abre o pagamento ----------
  if (totalCents < 500) throw new ApiError(400, "Valor mínimo do pedido: R$ 5,00");
  const { data: order, error: oErr } = await admin.from("orders").insert(orderRow).select("id").single();
  dbError(oErr);
  const orderId = order!.id as string;

  const reserved: [string, number][] = [];
  const abort = async (e: unknown): Promise<never> => {
    for (const [id, n] of reserved) await admin.rpc("adjust_stock", { p_id: id, p_delta: n });
    await admin.from("orders").delete().eq("id", orderId); // cascata apaga os itens
    throw e;
  };

  try {
    for (const [productId, qty] of Array.from(demand)) {
      const { data: ok, error } = await admin.rpc("adjust_stock", { p_id: productId, p_delta: -qty });
      dbError(error);
      if (!ok) throw new ApiError(400, "Estoque insuficiente");
      reserved.push([productId, qty]);
    }
    await saveItems(admin, org.id, orderId, lines);

    const fee = Math.round((totalCents * platformFeePercent()) / 100);
    const base = `${appUrl()}/loja/${body.organization_slug}`;
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        customer_email: body.customer_email,
        line_items: lines.map(({ item, name, price }) => ({
          quantity: item.quantity,
          price_data: {
            currency: "brl",
            unit_amount: toCents(price),
            product_data: {
              name: `${name} (${item.size})`,
              description:
                [
                  item.customization_data.name && `Nome: ${item.customization_data.name}`,
                  item.customization_data.number != null && `Nº ${item.customization_data.number}`,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined,
            },
          },
        })),
        payment_intent_data: fee > 0 ? { application_fee_amount: fee } : undefined,
        metadata: { order_id: orderId },
        client_reference_id: orderId,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        success_url: `${base}/checkout/sucesso?order=${orderId}`,
        cancel_url: `${base}/carrinho`,
      },
      { stripeAccount: org.stripe_account_id! }
    );
    if (!session.url) throw new ApiError(502, "Stripe não retornou a URL de pagamento");
    await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", orderId);

    return NextResponse.json({ order_id: orderId, checkout_url: session.url }, { status: 201 });
  } catch (e) {
    return abort(e);
  }
});
