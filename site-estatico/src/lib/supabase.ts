import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  // Aparece no console se o build foi feito sem o .env.local
  console.error("Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.example)");
}

// Somente a chave pública (anon): a segurança vem do RLS e das funções do banco.
export const supabase = createClient(url ?? "http://invalido.local", key ?? "invalida", {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** Mensagem amigável para erros do Supabase/PostgREST. */
export function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Erro inesperado";
}
