import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { createClient } from "@/lib/supabase/server";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Envolve um handler com tratamento de erro padronizado. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        return NextResponse.json(
          { error: "Dados inválidos", details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
          { status: 400 }
        );
      }
      console.error(e);
      return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "JSON inválido");
  }
  return schema.parse(json);
}

/** Exige lojista autenticado; devolve o cliente (com RLS) e o id da organização. */
export async function requireMerchant() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "Não autenticado");
  return { supabase, orgId: data.user.id };
}

export function dbError(error: { message: string } | null) {
  if (error) {
    console.error(error);
    throw new ApiError(400, "Falha ao acessar o banco de dados");
  }
}
