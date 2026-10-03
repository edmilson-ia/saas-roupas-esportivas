/** Cada cor tem sua própria foto da camisa. Dados antigos eram só texto. */
export type ColorOption = { name: string; image_url: string | null; back_image_url?: string | null };

export function normalizeColors(colors: (string | ColorOption)[] | null | undefined): ColorOption[] {
  return (colors ?? []).map((c) => (typeof c === "string" ? { name: c, image_url: null } : c));
}

export type Product = {
  id: string;
  organization_id?: string;
  name: string;
  description: string | null;
  base_image_url: string | null;
  available_colors: (string | ColorOption)[];
  available_sizes: string[];
  price: number | string;
  stock?: number;
  active?: boolean;
  /** posição na vitrine (1 = primeiro); definida pelo lojista no painel */
  ordem?: number | null;
};

export type Customization = {
  name?: string;
  number?: number;
  color?: string;
  font?: string;
  has_logo?: boolean;
};

export type OrderItem = {
  id: string;
  product_id: string | null;
  quantity: number;
  size: string;
  customization_data: Customization;
  customization_image_url: string | null;
  price: number | string;
};

export type Order = {
  id: string;
  customer_name: string;
  customer_email?: string | null; // pedidos antigos; os novos guardam o WhatsApp
  customer_phone?: string | null;
  status: "pending" | "in_production" | "shipped";
  total_price: number | string;
  created_at: string;
  order_items: OrderItem[];
};

export const STATUS_LABEL: Record<Order["status"], string> = {
  pending: "Novo",
  in_production: "Em produção",
  shipped: "Enviado",
};

export const brl = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
