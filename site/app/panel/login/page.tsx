import { redirect } from "next/navigation";
import { discordConfig, discordSetupStatus } from "@/lib/discord";
import { currentUser } from "@/lib/session";
import { OrionGlyph } from "@/components/ui/PageLoader";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  discord_off: "O login por Discord ainda nao esta configurado neste servidor.",
  bad_request: "Pedido incompleto vindo do Discord. Tenta outra vez.",
  bad_state: "A sessao de login expirou ou nao corresponde. Tenta outra vez.",
  exchange_failed: "O Discord recusou a troca de codigo. Confirma o Client Secret e o Redirect URI.",
  identity_failed: "Nao foi possivel ler a tua conta no Discord.",
  not_member: "Tens de pertencer ao servidor Discord do Orion para entrar.",
  suspended: "Esta conta esta suspensa.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Quem ja tem sessao nao tem nada que fazer aqui - por exemplo ao clicar
  // no "Sign in" que o rodape mostra sempre.
  if (await currentUser()) redirect("/panel");

  const discordEnabled = discordConfig() !== null;
  const setup = discordSetupStatus();

  return (
    <div className="mx-auto max-w-sm pt-16">
      <div className="mb-9 flex flex-col items-center text-center">
        <OrionGlyph className="h-16 w-16" />
        <h1 className="mt-5 text-xl font-bold tracking-tight text-white">Painel Orion</h1>
        <p className="mt-1.5 text-[13.5px] text-white/35">
          O login é feito pelo Discord.
        </p>
      </div>

      {error && ERRORS[error] && (
        <div className="mb-5 rounded-xl border border-[var(--critical)]/35 bg-[var(--critical)]/10 px-4 py-3 text-[13px] text-[#ff9a9a]">
          {ERRORS[error]}
        </div>
      )}

      <LoginForm discordEnabled={discordEnabled} missing={setup.missing} />
    </div>
  );
}
