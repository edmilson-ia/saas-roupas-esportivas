import { NextResponse } from "next/server";
import { z } from "zod";
import { dbError, handle, parseBody, requireMerchant } from "@/lib/api";

const schema = z.object({
  // aceita "(11) 99999-8888"; guarda só dígitos com DDI 55
  whatsapp: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .transform((v) => (v.length === 10 || v.length === 11 ? `55${v}` : v))
    .refine((v) => v === "" || /^\d{12,13}$/.test(v), "Número de WhatsApp inválido (use DDD + número)"),
});

export const GET = handle(async () => {
  const { supabase, orgId } = await requireMerchant();
  const { data, error } = await supabase.from("organizations").select("name, slug, whatsapp").eq("id", orgId).single();
  dbError(error);
  return NextResponse.json({ settings: data });
});

export const PATCH = handle(async (req: Request) => {
  const { supabase, orgId } = await requireMerchant();
  const { whatsapp } = await parseBody(req, schema);
  const { error } = await supabase
    .from("organizations")
    .update({ whatsapp: whatsapp || null })
    .eq("id", orgId);
  dbError(error);
  return NextResponse.json({ whatsapp: whatsapp || null });
});
