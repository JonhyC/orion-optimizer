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

  const layer0 = tweaks.filter((t) => t.layer === 0);
  const layer1 = tweaks.filter((t) => t.layer >= 1);
  const integrated = tweaks.filter(
    (t) => !t.conditions?.gpuType?.length || t.conditions.gpuType.includes("integrated"),
  );

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
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                Total
              </div>
              <div className="mt-1.5 text-3xl font-bold tabular-nums text-white">
                {tweaks.length}
              </div>
            </Card>
            <Card>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                Camada 0
              </div>
              <div className="mt-1.5 text-3xl font-bold tabular-nums text-white">
                {layer0.length}
              </div>
              <p className="mt-1 text-[12px] text-white/30">sem admin, so HKCU</p>
            </Card>
            <Card>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                Camada 1
              </div>
              <div className="mt-1.5 text-3xl font-bold tabular-nums text-white">
                {layer1.length}
              </div>
              <p className="mt-1 text-[12px] text-white/30">requer administrador</p>
            </Card>
            <Card>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                Compativeis com iGPU
              </div>
              <div className="mt-1.5 text-3xl font-bold tabular-nums text-white">
                {integrated.length}
              </div>
              <p className="mt-1 text-[12px] text-white/30">universais e integrados</p>
            </Card>
          </div>

          <CatalogManager tweaks={tweaks} rules={forbiddenRules()} />
        </>
      )}
    </>
  );
}
