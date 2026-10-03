import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(list) {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // chamado de Server Component: o middleware renova a sessão
          }
        },
      },
    }
  );
}

/** Cliente com service role: só em Route Handlers, após validar a entrada. */
export function createAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      // Next 14 cacheia fetch por padrão; dados da loja precisam ser sempre frescos
      global: { fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }) },
    }
  );
}
