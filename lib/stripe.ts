import Stripe from "stripe";
import { ApiError } from "@/lib/api";

let client: Stripe | null = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new ApiError(500, "Stripe não configurado (STRIPE_SECRET_KEY)");
  return (client ??= new Stripe(process.env.STRIPE_SECRET_KEY));
}

/** URL pública do app, usada nos redirecionamentos do Stripe. */
export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Taxa da plataforma sobre cada venda, em % (0 = sem taxa). */
export function platformFeePercent() {
  const n = Number(process.env.PLATFORM_FEE_PERCENT ?? 0);
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : 0;
}

export const toCents = (v: number) => Math.round(v * 100);
