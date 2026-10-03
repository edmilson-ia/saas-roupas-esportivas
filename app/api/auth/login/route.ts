import { NextResponse } from "next/server";
import { ApiError, handle, parseBody } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

export const POST = handle(async (req: Request) => {
  const { email, password } = await parseBody(req, loginSchema);
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new ApiError(401, "E-mail ou senha inválidos");
  return NextResponse.json({ user_id: data.user.id });
});
