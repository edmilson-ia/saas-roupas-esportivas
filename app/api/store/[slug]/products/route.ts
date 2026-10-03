import { NextResponse } from "next/server";
import { ApiError, dbError, handle } from "@/lib/api";
import { createAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: { params: { slug: string } }) => {
  const admin = createAdmin();
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, slug, whatsapp")
    .eq("slug", params.slug)
    .maybeSingle();
  dbError(orgErr);
  if (!org) throw new ApiError(404, "Loja não encontrada");

  const { data, error } = await admin
    .from("products")
    .select("id, name, description, base_image_url, available_colors, available_sizes, price")
    .eq("organization_id", org.id)
    .eq("active", true)
    .gt("stock", 0)
    .order("created_at", { ascending: false });
  dbError(error);
  return NextResponse.json({ store: { name: org.name, slug: org.slug, whatsapp: org.whatsapp }, products: data });
});
