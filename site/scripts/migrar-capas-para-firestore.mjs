/**
 * Move as capas dos planos do disco para o Firestore.
 *
 *   node --env-file=.env.local --experimental-strip-types \
 *     scripts/migrar-capas-para-firestore.mjs [--confirm]
 *
 * Sem --confirm mostra o que faria e nao escreve nada.
 *
 * Porque existe: as capas eram gravadas com fs.writeFile numa pasta do
 * volume. Na Vercel o sistema de ficheiros e efemero, portanto a imagem
 * desaparecia no deploy seguinte e o cartao do plano ficava vazio. Agora
 * vivem no Firestore, e os planos ja criados precisam de ser levados.
 *
 * NAO apaga os ficheiros locais: se algo correr mal, o original continua
 * la para se repetir a migracao.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const RAIZ = "file:///C:/Users/jmpco/Desktop/xampp/htdocs/orionoptimizer/site/lib/";
const { allPlans, updatePlan } = await import(`${RAIZ}repo/plans.ts`);
const { guardarCapa, MAX_BYTES } = await import(`${RAIZ}repo/plan-covers.ts`);
const { planCoversDir } = await import(`${RAIZ}storage-paths.ts`);

const confirmar = process.argv.includes("--confirm");

const MIMES = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".avif": "image/avif",
};

/** Formato antigo: id com extensao. O novo nao tem ponto nenhum. */
const ANTIGO = /^\/uploads\/plans\/([A-Za-z0-9._-]+\.[a-z]+)$/;

const planos = await allPlans();
let migrados = 0;
let ignorados = 0;
let falhas = 0;

for (const plano of planos) {
  const m = plano.cover_url ? ANTIGO.exec(plano.cover_url) : null;
  if (!m) {
    console.log(`  ${plano.code.padEnd(12)} ignorado (${plano.cover_url ?? "sem capa"})`);
    ignorados++;
    continue;
  }

  const ficheiro = m[1];
  const mime = MIMES[path.extname(ficheiro).toLowerCase()];
  if (!mime) {
    console.log(`  ${plano.code.padEnd(12)} FALHA: extensao desconhecida (${ficheiro})`);
    falhas++;
    continue;
  }

  try {
    const bytes = await readFile(path.join(planCoversDir, ficheiro));
    if (bytes.byteLength > MAX_BYTES) {
      console.log(
        `  ${plano.code.padEnd(12)} FALHA: ${Math.round(bytes.byteLength / 1024)} KB excede o limite de ${Math.round(MAX_BYTES / 1024)} KB`,
      );
      falhas++;
      continue;
    }

    if (!confirmar) {
      console.log(`  ${plano.code.padEnd(12)} migraria ${Math.round(bytes.byteLength / 1024)} KB (${mime})`);
      migrados++;
      continue;
    }

    const id = await guardarCapa(bytes, mime);
    await updatePlan(plano.id, { cover_url: `/uploads/plans/${id}` });
    console.log(`  ${plano.code.padEnd(12)} OK -> ${id} (${Math.round(bytes.byteLength / 1024)} KB)`);
    migrados++;
  } catch (erro) {
    console.log(`  ${plano.code.padEnd(12)} FALHA: ${erro?.message ?? erro}`);
    falhas++;
  }
}

console.log(
  `\n${confirmar ? "Migrados" : "Migrariam"}: ${migrados}   Ignorados: ${ignorados}   Falhas: ${falhas}`,
);
if (!confirmar) console.log("Simulacao. Corre outra vez com --confirm para gravar.");
process.exit(falhas > 0 ? 1 : 0);
