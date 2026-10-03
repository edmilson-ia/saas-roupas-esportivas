import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, dbError, handle, parseBody, requireMerchant } from "@/lib/api";
import { orderStatusSchema } from "@/lib/validation";

export const PATCH = handle(async (req: Request, { params }: { params: { id: string } }) => {
  if (!z.uuid().safeParse(params.id).success) throw new ApiError(400, "ID inválido");
  const { supabase, orgId } = await requireMerchant();
  const { status } = await parseBody(req, orderStatusSchema);
  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .select()
    .maybeSingle();
  dbError(error);
  if (!data) throw new ApiError(404, "Pedido não encontrado");
  return NextResponse.json({ order: data });
});
