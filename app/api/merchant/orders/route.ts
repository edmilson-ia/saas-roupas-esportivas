import { NextResponse } from "next/server";
import { dbError, handle, requireMerchant } from "@/lib/api";
import { checkoutMode } from "@/lib/config";

const STATUSES = ["pending", "in_production", "shipped"];

export const GET = handle(async (req: Request) => {
  const { supabase, orgId } = await requireMerchant();
  const status = new URL(req.url).searchParams.get("status");
  let q = supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("organization_id", orgId)
    .match(checkoutMode() === "stripe" ? { payment_status: "paid" } : {})
    .order("created_at", { ascending: false });
  if (status && STATUSES.includes(status)) q = q.eq("status", status);
  const { data, error } = await q;
  dbError(error);
  return NextResponse.json({ orders: data });
});
