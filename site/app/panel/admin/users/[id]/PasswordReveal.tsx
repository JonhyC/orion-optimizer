"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordReveal({ password }: { password: string | null }) {
  const [visible, setVisible] = useState(false);

  if (!password) {
    return <span className="text-white/30">indisponivel, repoe para gerar uma nova</span>;
  }

  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <span className="break-all font-mono text-[12.5px] text-white/70">
        {visible ? password : "*".repeat(Math.min(password.length, 16))}
      </span>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/10 text-white/45 transition-colors hover:border-white/25 hover:text-white"
        aria-label={visible ? "Esconder password" : "Mostrar password"}
        title={visible ? "Esconder password" : "Mostrar password"}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </span>
  );
}
