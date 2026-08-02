import { optimizerRelease, updateStatus } from "@/lib/optimizer-release";
import { fail, ok } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verificacao de actualizacoes.
 *
 *   GET /api/updates/check?version=1.0.5
 *
 * PUBLICA de proposito. Uma versao antiga pode estar a falhar o login
 * precisamente por causa do defeito que a actualizacao corrige - exigir
 * sessao aqui prenderia essas pessoas na versao partida, que e o oposto
 * do que uma rota de actualizacoes serve.
 *
 * Nao expoe nada reservado: o instalador ja e descarregavel por quem
 * tiver o link, e o manifesto so diz versao, tamanho e o que mudou.
 */
export async function GET(req: Request) {
  const pedido = new URL(req.url).searchParams.get("version");

  let release;
  try {
    release = optimizerRelease();
  } catch (error) {
    console.error("[orion] manifesto de versao invalido:", error);
    return fail("Manifesto de versao indisponivel.", 503, "release_unavailable");
  }

  const status = updateStatus(release, pedido);

  return ok({
    version: release.version,
    downloadPath: release.downloadPath,
    sha256: release.sha256,
    sizeBytes: release.sizeBytes ?? null,
    releasedAt: release.releasedAt ?? null,
    notes: release.notes ?? [],
    installed: status.installed,
    outdated: status.outdated,
    // Quem estiver abaixo do minSupported deve actualizar antes de
    // continuar: a versao dele tem um defeito que nao pode ficar em uso.
    mandatory: status.mandatory,
    minSupported: release.minSupported ?? null,
  });
}
