import type { SupabaseClient } from "@supabase/supabase-js";

/** Devolve ao estoque os itens de um pedido (pagamento falhou/expirou ou checkout abortado). */
export async function releaseOrderStock(admin: SupabaseClient, orderId: string) {
  const { data: items } = await admin.from("order_items").select("product_id, quantity").eq("order_id", orderId);
  const qty = new Map<string, number>();
  for (const it of items ?? []) {
    if (it.product_id) qty.set(it.product_id, (qty.get(it.product_id) ?? 0) + it.quantity);
  }
  await Promise.all(
    Array.from(qty).map(([id, n]) => admin.rpc("adjust_stock", { p_id: id, p_delta: n }))
  );
}
