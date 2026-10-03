"use client";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Botão "Instalar app": só aparece quando o navegador oferece a instalação (Chrome/Edge/Android). */
export default function InstallButton({ className = "" }: { className?: string }) {
  const [ev, setEv] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEv(e as InstallEvent);
    };
    const onInstalled = () => setEv(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!ev) return null;
  return (
    <button
      className={className}
      onClick={async () => {
        await ev.prompt();
        setEv(null);
      }}
    >
      Instalar app
    </button>
  );
}
