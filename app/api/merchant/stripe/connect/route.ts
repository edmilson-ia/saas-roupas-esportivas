import { NextResponse } from "next/server";
import { ApiError, dbError, handle, requireMerchant } from "@/lib/api";
import { createAdmin } from "@/lib/supabase/server";
import { appUrl, getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** Situação da conta Stripe do lojista (sincroniza com o Stripe). */
export const GET = handle(async () => {
  const { supabase, orgId } = await requireMerchant();
  const { data: org, error } = await supabase
    .from("organizations")
    .select("stripe_account_id, stripe_charges_enabled")
    .eq("id", orgId)
    .single();
  dbError(error);
  if (!org?.stripe_account_id) return NextResponse.json({ connected: false, charges_enabled: false });

  const account = await getStripe().accounts.retrieve(org.stripe_account_id);
  if (account.charges_enabled !== org.stripe_charges_enabled) {
    await createAdmin()
      .from("organizations")
      .update({ stripe_charges_enabled: account.charges_enabled })
      .eq("id", orgId);
  }
  return NextResponse.json({
    connected: true,
    charges_enabled: account.charges_enabled,
    details_submitted: account.details_submitted,
  });
});

/** Cria a conta Stripe (se preciso) e devolve o link de cadastro/continuação. */
export const POST = handle(async () => {
  const { supabase, orgId } = await requireMerchant();
  const stripe = getStripe();
  const admin = createAdmin();

  const { data: org, error } = await supabase
    .from("organizations")
    .select("email, stripe_account_id")
    .eq("id", orgId)
    .single();
  dbError(error);
  if (!org) throw new ApiError(404, "Organização não encontrada");

  let accountId = org.stripe_account_id as string | null;
  if (!accountId) {
    const account = await stripe.accounts.create({ type: "standard", country: "BR", email: org.email });
    accountId = account.id;
    const { error: upErr } = await admin.from("organizations").update({ stripe_account_id: accountId }).eq("id", orgId);
    dbError(upErr);
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl()}/dashboard/payments`,
    return_url: `${appUrl()}/dashboard/payments`,
  });
  return NextResponse.json({ url: link.url });
});
