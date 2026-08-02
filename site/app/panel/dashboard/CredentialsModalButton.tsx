"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound, X } from "lucide-react";

export default function CredentialsModalButton({
  username,
  password,
  hasPassword,
}: {
  username: string;
  password: string | null;
  hasPassword: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState<"username" | "password" | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function copy(value: string, field: "username" | "password") {
    await navigator.clipboard.writeText(value);
    setCopied(field);
    window.setTimeout(() => setCopied(null), 1200);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[var(--chart-1)]/25 bg-[var(--chart-1)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--chart-1)] transition-colors hover:bg-[var(--chart-1)]/18"
      >
        Ver credenciais
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Credenciais do Orion Optimizer"
            className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--chart-1)]/25 bg-[var(--panel-surface)] shadow-2xl shadow-black/60"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] bg-black/20 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--chart-1)]">Cliente Windows</p>
                <h2 className="mt-1 text-[17px] font-bold text-white">Credenciais da aplicacao</h2>
                <p className="mt-1 text-[12.5px] text-white/35">Usa estes dados para entrar no Orion Optimizer 2.0.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </header>

            <div className="p-5">
              {hasPassword && password ? (
                <div className="space-y-3">
                  <CredentialRow label="Utilizador" value={username} copied={copied === "username"} onCopy={() => copy(username, "username")} />
                  <div className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/35">Password</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setVisible((current) => !current)}
                          className="grid h-8 w-8 place-items-center rounded-md text-white/45 hover:bg-white/[0.06] hover:text-white"
                          aria-label={visible ? "Esconder password" : "Mostrar password"}
                        >
                          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copy(password, "password")}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-[11px] font-semibold text-white/60 hover:border-[var(--chart-1)] hover:text-white"
                        >
                          <Copy size={13} />
                          {copied === "password" ? "Copiada" : "Copiar"}
                        </button>
                      </div>
                    </div>
                    <code className="block break-all rounded-md bg-black/35 px-3 py-2 font-mono text-[13px] text-white">
                      {visible ? password : "*".repeat(Math.min(password.length, 18))}
                    </code>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-[var(--warning)]/25 bg-[var(--warning)]/[0.07] p-4">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--warning)]">
                    <KeyRound size={15} />
                    Password indisponivel
                  </div>
                  <p className="mt-2 text-[12.5px] leading-5 text-white/45">
                    Esta conta tem hash guardado, mas a password em claro nao esta disponivel. Gera uma nova na pagina A minha conta para voltar a copia-la.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function CredentialRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/35">{label}</span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-[11px] font-semibold text-white/60 hover:border-[var(--chart-1)] hover:text-white"
        >
          <Copy size={13} />
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <code className="block break-all rounded-md bg-black/35 px-3 py-2 font-mono text-[13px] text-white">{value}</code>
    </div>
  );
}
