"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "../actions";

/**
 * O Discord e o login. Nao ha registo: a conta nasce no primeiro acesso e os
 * cargos do servidor decidem o que a pessoa ve.
 *
 * O formulario de password fica atras de um link discreto no fundo. Nao e
 * uma segunda forma de registo - e a porta de emergencia para quando o OAuth
 * do Discord estiver em baixo, e as credenciais que o cliente PowerShell usa.
 */
export default function LoginForm({
  discordEnabled,
  missing,
  deployed = false,
}: {
  discordEnabled: boolean;
  missing: string[];
  /** Em producao nao ha .env.local: as variaveis vem do painel do alojamento. */
  deployed?: boolean;
}) {
  const [state, formAction] = useActionState(loginAction, null as { error?: string } | null);
  const [showFallback, setShowFallback] = useState(false);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-7">
      {discordEnabled ? (
        <>
          <a
            href="/api/auth/discord"
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#5865F2] py-4 text-[15px] font-semibold text-white shadow-lg shadow-[#5865F2]/25 transition-all hover:bg-[#4752c4] hover:shadow-[#5865F2]/40"
          >
            <DiscordMark />
            Entrar com Discord
          </a>

          <p className="mt-4 text-center text-[12.5px] leading-relaxed text-white/35">
            Não precisas de criar conta. A tua conta Discord é a conta —
            os cargos que tens no servidor são as permissões que tens aqui.
          </p>
        </>
      ) : (
        <>
          <div
            aria-disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl bg-[#5865F2]/20 py-4 text-[15px] font-semibold text-white/35"
          >
            <DiscordMark />
            Entrar com Discord
          </div>

          <div className="mt-5 rounded-xl border border-[var(--warning)]/25 bg-[var(--warning)]/[0.06] px-4 py-3.5">
            <p className="text-[12.5px] font-semibold text-[var(--warning)]">
              Falta a aplicação Discord
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">
              {deployed ? (
                <>
                  Define estas variáveis no painel do alojamento, em{" "}
                  <span className="text-white/65">Environment Variables</span>, e
                  faz um deploy novo:
                </>
              ) : (
                <>
                  Cria a aplicação em discord.com/developers/applications e
                  preenche em <code className="text-white/65">site/.env.local</code>:
                </>
              )}
            </p>
            <ul className="mt-2.5 space-y-1">
              {missing.map((k) => (
                <li key={k} className="font-mono text-[11.5px] text-[var(--warning)]">
                  {k}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11.5px] leading-relaxed text-white/30">
              {deployed ? (
                <>
                  O <code className="text-white/45">.env.local</code> fica de fora
                  do git de propósito — leva o client secret e o token do bot.
                  Num servidor, os valores vêm sempre das variáveis de ambiente.
                </>
              ) : (
                <>
                  Para confirmar depois:{" "}
                  <code className="text-white/45">node scripts/admin.ts check-discord</code>
                </>
              )}
            </p>
          </div>
        </>
      )}

      <div className="mt-7 border-t border-white/[0.06] pt-5">
        {!showFallback ? (
          <button
            type="button"
            onClick={() => setShowFallback(true)}
            className="mx-auto block text-[12px] text-white/25 transition-colors hover:text-white/55"
          >
            Discord em baixo? Entrar com password
          </button>
        ) : (
          <form action={formAction}>
            <p className="mb-4 text-[11.5px] leading-relaxed text-white/30">
              Acesso de emergência. Estas são as credenciais do cliente Windows,
              não uma forma de criar conta.
            </p>

            {state?.error && (
              <div className="mb-4 rounded-xl border border-[var(--critical)]/35 bg-[var(--critical)]/10 px-4 py-3 text-[13px] text-[#ff9a9a]">
                {state.error}
              </div>
            )}

            <label htmlFor="username" className="block text-[12.5px] font-medium text-white/50">
              Utilizador
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3.5 py-2.5 text-[14px] text-white outline-none transition-colors focus:border-[var(--chart-1)]"
            />

            <label htmlFor="password" className="mt-4 block text-[12.5px] font-medium text-white/50">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3.5 py-2.5 text-[14px] text-white outline-none transition-colors focus:border-[var(--chart-1)]"
            />

            <SubmitButton />
          </form>
        )}
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 w-full rounded-lg border border-white/10 bg-[var(--panel-surface-2)] py-2.5 text-[13.5px] font-semibold text-white/75 transition-colors hover:border-white/25 hover:text-white disabled:opacity-50"
    >
      {pending ? "A entrar…" : "Entrar"}
    </button>
  );
}

function DiscordMark() {
  return (
    <svg width="21" height="21" viewBox="0 0 127 96" fill="currentColor" aria-hidden>
      <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z" />
    </svg>
  );
}
