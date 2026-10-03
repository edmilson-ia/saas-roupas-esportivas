/**
 * Como o pedido é finalizado:
 *  - "whatsapp" (padrão): o pedido é salvo e o cliente é levado ao WhatsApp do lojista.
 *  - "stripe": cobrança online via Stripe Connect (exige a migration 0002 e as chaves do Stripe).
 */
export const checkoutMode = (): "whatsapp" | "stripe" =>
  process.env.CHECKOUT_MODE === "stripe" ? "stripe" : "whatsapp";
