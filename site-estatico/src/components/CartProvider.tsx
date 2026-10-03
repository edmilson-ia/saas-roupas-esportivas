import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Customization } from "@/lib/types";

export type CartItem = {
  key: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  size: string;
  customization_data: Customization;
  customization_image: string; // data URL PNG
};

type Ctx = {
  slug: string;
  items: CartItem[];
  add: (item: Omit<CartItem, "key">) => void;
  remove: (key: string) => void;
  setQuantity: (key: string, q: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<Ctx | null>(null);

export function CartProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const storageKey = `cart:${slug}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // cota do localStorage estourou: o carrinho segue só em memória
    }
  }, [items, loaded, storageKey]);

  const add = useCallback((item: Omit<CartItem, "key">) => {
    setItems((prev) => [...prev, { ...item, key: crypto.randomUUID() }]);
  }, []);
  const remove = useCallback((key: string) => setItems((p) => p.filter((i) => i.key !== key)), []);
  const setQuantity = useCallback(
    (key: string, q: number) =>
      setItems((p) => p.map((i) => (i.key === key ? { ...i, quantity: Math.min(100, Math.max(1, q)) } : i))),
    []
  );
  const clear = useCallback(() => setItems([]), []);

  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ slug, items, add, remove, setQuantity, clear, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart fora do CartProvider");
  return ctx;
}
