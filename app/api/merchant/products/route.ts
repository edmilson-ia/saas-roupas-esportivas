import { NextResponse } from "next/server";
import { dbError, handle, parseBody, requireMerchant } from "@/lib/api";
import { productSchema } from "@/lib/validation";

export const GET = handle(async () => {
  const { supabase, orgId } = await requireMerchant();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  dbError(error);
  return NextResponse.json({ products: data });
});

export const POST = handle(async (req: Request) => {
  const { supabase, orgId } = await requireMerchant();
  const body = await parseBody(req, productSchema);
  const { data, error } = await supabase
    .from("products")
    .insert({ ...body, organization_id: orgId })
    .select()
    .single();
  dbError(error);
  return NextResponse.json({ product: data }, { status: 201 });
});
