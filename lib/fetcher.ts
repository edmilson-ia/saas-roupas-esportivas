/** fetch JSON que lança Error com a mensagem da API em caso de falha. */
export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const details = Array.isArray(json.details)
      ? ": " + json.details.map((d: { path: string; message: string }) => `${d.path} ${d.message}`).join("; ")
      : "";
    throw new Error((json.error ?? "Erro inesperado") + details);
  }
  return json as T;
}
