import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export const POST = handle(async () => {
  await createClient().auth.signOut();
  return NextResponse.json({ ok: true });
});
