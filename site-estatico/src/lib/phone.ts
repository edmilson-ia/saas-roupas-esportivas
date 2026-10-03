/** "(21) 98658-0480" -> "5521986580480". null = vazio; "invalid" = fora do padrão brasileiro. */
export function normalizePhone(raw: string): string | null | "invalid" {
  let d = raw.replace(/\D/g, "");
  if (d === "") return null;
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return /^55\d{10,11}$/.test(d) ? d : "invalid";
}

/** "5521986580480" -> "(21) 98658-0480" (se não reconhecer, devolve como veio). */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const m = phone.replace(/\D/g, "").match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : phone;
}
