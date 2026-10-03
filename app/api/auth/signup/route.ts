import { NextResponse } from "next/server";
import { ApiError, handle, parseBody } from "@/lib/api";
import { signupSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

export const POST = handle(async (req: Request) => {
  const { name, email, password } = await parseBody(req, signupSchema);
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw new ApiError(400, error.message);
  // Sem sessão = projeto exige confirmação de e-mail
  return NextResponse.json(
    { user_id: data.user?.id, needs_email_confirmation: !data.session },
    { status: 201 }
  );
});
