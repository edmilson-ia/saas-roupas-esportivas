import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, dbError, handle, parseBody, requireMerchant } from "@/lib/api";
import { productUpdateSchema } from "@/lib/validation";

type Ctx = { params: { id: string } };

function checkId(id: string) {
  if (!z.uuid().safeParse(id).success) throw new ApiError(400, "ID inválido");
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  checkId(params.id);
  const { supabase, orgId } = await requireMerchant();
  const body = await parseBody(req, productUpdateSchema);
  const { data, error } = await supabase
    .from("products")
    .update(body)
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .select()
    .maybeSingle();
  dbError(error);
  if (!data) throw new ApiError(404, "Produto não encontrado");
  return NextResponse.json({ product: data });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  checkId(params.id);
  const { supabase, orgId } = await requireMerchant();
  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .select("id");
  dbError(error);
  if (!data?.length) throw new ApiError(404, "Produto não encontrado");
  return NextResponse.json({ ok: true });
});
