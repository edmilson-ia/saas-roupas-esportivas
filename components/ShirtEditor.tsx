"use client";
import { useEffect, useImperativeHandle, useRef, useState, type MutableRefObject, type Ref } from "react";
import { Canvas, FabricImage, FabricText } from "fabric";
import { normalizeColors, type ColorOption, type Customization, type Product } from "@/lib/types";

const SIZE = 500;
// Fontes do Google carregadas em app/layout.tsx; as demais são do sistema
const FONTS = [
  "Bebas Neue", "Anton", "Oswald", "Teko", "Russo One", "Black Ops One", "Graduate", "Permanent Marker",
  "Impact", "Arial", "Georgia", "Courier New", "Verdana",
];

const TEXT_COLORS = [
  { name: "Branco", hex: "#ffffff" },
  { name: "Preto", hex: "#000000" },
  { name: "Vermelho", hex: "#dc2626" },
  { name: "Azul", hex: "#2563eb" },
  { name: "Azul-marinho", hex: "#1e3a8a" },
  { name: "Verde", hex: "#16a34a" },
  { name: "Amarelo", hex: "#facc15" },
  { name: "Laranja", hex: "#f97316" },
  { name: "Dourado", hex: "#d4a017" },
  { name: "Prata", hex: "#c0c0c0" },
  { name: "Rosa", hex: "#ec4899" },
  { name: "Roxo", hex: "#7c3aed" },
];

export type EditorHandle = {
  /** Exporta frente + costas lado a lado em um PNG (data URL) e os dados da customização. */
  exportDesign: () => { image: string; data: Customization };
};

type Props = {
  baseImageUrl: string | null;
  colors: Product["available_colors"];
  editorRef?: Ref<EditorHandle>;
};

type Side = "front" | "back";

/** Cor CSS válida para mostrar a bolinha; senão o botão mostra só o nome. */
const isCssColor = (v: string) => typeof CSS !== "undefined" && CSS.supports("color", v);

/** Coloca a foto da camisa no fundo do canvas, trocando a anterior. */
function loadShirt(c: Canvas, ref: MutableRefObject<FabricImage | null>, url: string | null) {
  let cancelled = false;
  if (ref.current) {
    c.remove(ref.current);
    ref.current = null;
  }
  if (url) {
    FabricImage.fromURL(url, { crossOrigin: "anonymous" })
      .then((img) => {
        if (cancelled) return;
        if (ref.current) c.remove(ref.current);
        img.set({ selectable: false, evented: false });
        img.scale(Math.min(SIZE / (img.width ?? SIZE), SIZE / (img.height ?? SIZE)));
        c.add(img);
        c.centerObject(img);
        c.sendObjectToBack(img);
        ref.current = img;
        c.requestRenderAll();
      })
      .catch(() => {});
  }
  c.requestRenderAll();
  return () => {
    cancelled = true;
  };
}

export default function ShirtEditor({ baseImageUrl, colors: rawColors, editorRef }: Props) {
  const colors: ColorOption[] = normalizeColors(rawColors);
  const frontEl = useRef<HTMLCanvasElement>(null);
  const backEl = useRef<HTMLCanvasElement>(null);
  const front = useRef<Canvas | null>(null);
  const back = useRef<Canvas | null>(null);
  const frontShirt = useRef<FabricImage | null>(null);
  const backShirt = useRef<FabricImage | null>(null);
  const nameObj = useRef<FabricText | null>(null);
  const numObj = useRef<FabricText | null>(null);
  const logoObj = useRef<FabricImage | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [side, setSide] = useState<Side>("back");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [font, setFont] = useState(FONTS[0]);
  const [textColor, setTextColor] = useState("#ffffff");
  const [color, setColor] = useState(colors[0]?.name ?? "");
  const [hasLogo, setHasLogo] = useState(false);

  const current = colors.find((c) => c.name === color);
  const frontUrl = current?.image_url ?? baseImageUrl;
  const backUrl = current?.back_image_url ?? null;

  // Cria os dois canvases (frente: brasão; costas: nome e número)
  useEffect(() => {
    if (!frontEl.current || !backEl.current) return;
    const f = new Canvas(frontEl.current, { width: SIZE, height: SIZE, backgroundColor: "#f1f5f9" });
    const b = new Canvas(backEl.current, { width: SIZE, height: SIZE, backgroundColor: "#f1f5f9" });
    front.current = f;
    back.current = b;
    nameObj.current = new FabricText("", { left: SIZE / 2, top: 92, originX: "center", fontSize: 40, fontWeight: "bold" });
    numObj.current = new FabricText("", { left: SIZE / 2, top: 190, originX: "center", fontSize: 140, fontWeight: "bold" });
    b.add(nameObj.current, numObj.current);
    return () => {
      f.dispose();
      b.dispose();
      front.current = back.current = frontShirt.current = backShirt.current = null;
      nameObj.current = numObj.current = logoObj.current = null;
    };
  }, []);

  // Em telas estreitas, reduz só o tamanho exibido (CSS); o PNG exportado continua 500x500
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => {
      const px = `${Math.min(SIZE, el.clientWidth)}px`;
      for (const c of [front.current, back.current]) c?.setDimensions({ width: px, height: px }, { cssOnly: true });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => (front.current ? loadShirt(front.current, frontShirt, frontUrl) : undefined), [frontUrl]);
  useEffect(() => (back.current ? loadShirt(back.current, backShirt, backUrl) : undefined), [backUrl]);

  useEffect(() => {
    let cancelled = false;
    const apply = () => {
      for (const o of [nameObj.current, numObj.current]) {
        o?.set({ fontFamily: font, fill: textColor });
        o?.initDimensions(); // recalcula a largura com a fonte já carregada
      }
      nameObj.current?.set({ text: name.toUpperCase() });
      numObj.current?.set({ text: number });
      back.current?.requestRenderAll();
    };
    apply();
    // fontes do Google chegam depois: redesenha quando carregarem
    document.fonts
      ?.load(`bold 40px "${font}"`)
      .then(() => !cancelled && apply())
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [name, number, font, textColor]);

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const c = front.current;
    if (!file || !c) return;
    if (!file.type.startsWith("image/") || file.size > 3_000_000) {
      alert("Escolha uma imagem de até 3 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const img = await FabricImage.fromURL(String(reader.result));
      if (logoObj.current) c.remove(logoObj.current);
      img.scaleToWidth(80);
      img.set({ left: 300, top: 170 });
      c.add(img);
      logoObj.current = img;
      setHasLogo(true);
      c.requestRenderAll();
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    if (logoObj.current && front.current) {
      front.current.remove(logoObj.current);
      logoObj.current = null;
      setHasLogo(false);
    }
  }

  useImperativeHandle(editorRef, () => ({
    exportDesign() {
      const f = front.current!;
      const b = back.current!;
      f.discardActiveObject();
      b.discardActiveObject();
      f.renderAll();
      b.renderAll();
      // frente à esquerda, costas à direita
      const out = document.createElement("canvas");
      out.width = SIZE * 2;
      out.height = SIZE;
      const ctx = out.getContext("2d")!;
      ctx.drawImage(f.toCanvasElement(1), 0, 0);
      ctx.drawImage(b.toCanvasElement(1), SIZE, 0);
      const n = parseInt(number, 10);
      return {
        image: out.toDataURL("image/png"),
        data: {
          name: name || undefined,
          number: Number.isInteger(n) && n >= 1 && n <= 99 ? n : undefined,
          color: color || undefined,
          font,
          has_logo: hasLogo || undefined,
        },
      };
    },
  }));

  const tab = (s: Side, label: string) => (
    <button
      type="button"
      onClick={() => setSide(s)}
      className={`rounded-t-md px-5 py-2 text-sm font-semibold ${side === s ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {tab("front", "Frente")}
        {tab("back", "Costas")}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[500px_1fr]">
        <div ref={wrapRef} className="w-full min-w-0">
          <div className={side === "front" ? "" : "hidden"}>
            <canvas ref={frontEl} className="max-w-full rounded border" />
          </div>
          <div className={side === "back" ? "" : "hidden"}>
            <canvas ref={backEl} className="max-w-full rounded border" />
            {!backUrl && <p className="mt-1 text-xs text-amber-600">Esta cor ainda não tem foto das costas.</p>}
          </div>
        </div>
        <div className="space-y-3">
          {colors.length > 0 && (
            <div>
              <label className="label">Cor da camisa{color && `: ${color}`}</label>
              <div className="flex flex-wrap gap-3">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setColor(c.name)}
                    className="flex w-20 flex-col items-center gap-1 text-xs"
                  >
                    <span
                      className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded border-2 bg-slate-100 ${color === c.name ? "border-brand-600 ring-2 ring-brand-300" : "border-slate-300"}`}
                      style={!c.image_url && isCssColor(c.name) ? { backgroundColor: c.name } : undefined}
                    >
                      {c.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image_url} alt={c.name} className="h-full w-full object-contain" />
                      )}
                    </span>
                    <span className={color === c.name ? "font-semibold text-brand-700" : "text-slate-600"}>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {side === "back" ? (
            <>
              <p className="text-xs text-slate-500">Nome e número ficam nas costas da camisa. Arraste no canvas para ajustar.</p>
              <div>
                <label className="label">Nome (máx. 20)</label>
                <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Número (1–99)</label>
                <input
                  value={number}
                  inputMode="numeric"
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                    setNumber(v === "0" ? "" : v);
                  }}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Fonte: {font}</label>
                <div className="grid grid-cols-3 gap-2">
                  {FONTS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFont(f)}
                      title={f}
                      style={{ fontFamily: `"${f}", sans-serif` }}
                      className={`truncate rounded border px-2 py-2 text-base ${font === f ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-slate-300 bg-white hover:bg-slate-50"}`}
                    >
                      {name ? name.slice(0, 8) : "Aa 10"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Cor das letras: {TEXT_COLORS.find((c) => c.hex === textColor)?.name ?? textColor}</label>
                <div className="flex flex-wrap gap-3">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setTextColor(c.hex)}
                      className="flex w-14 flex-col items-center gap-1 text-[11px]"
                    >
                      <span
                        className={`h-9 w-9 rounded-full border-2 ${textColor === c.hex ? "border-brand-600 ring-2 ring-brand-300" : "border-slate-300"}`}
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className={textColor === c.hex ? "font-semibold text-brand-700" : "text-slate-600"}>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="label">Logo / brasão (arraste no canvas para posicionar)</label>
              <input type="file" accept="image/*" onChange={onLogo} className="input" />
              {hasLogo && (
                <button type="button" onClick={removeLogo} className="mt-1 text-xs text-red-600">
                  Remover logo
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
