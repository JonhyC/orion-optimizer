import { requireRole } from "@/lib/session";
import { forbiddenRules, readCatalog } from "@/lib/catalog";
import { Card } from "@/components/panel/Pieces";
import CatalogManager from "./CatalogManager";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  await requireRole("developer");

  let tweaks: Awaited<ReturnType<typeof readCatalog>>["tweaks"] = [];
  let error: string | null = null;

  try {
    tweaks = readCatalog().tweaks;
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-white">Catalogo de optimizacoes</h1>
      <p className="mt-1.5 text-[14px] text-white/40">
        O que o cliente Windows pode aplicar. Servido so a quem tem sessao valida.
      </p>

      {error ? (
        <Card className="mt-8">
          <p className="text-[13.5px] text-[var(--critical)]">
            Nao foi possivel ler o catalogo: {error}
          </p>
        </Card>
      ) : (
        <CatalogManager tweaks={tweaks} rules={forbiddenRules()} />
      )}
    </>
  );
}
