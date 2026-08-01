import fs from "node:fs";
import path from "node:path";

const localDataDir = path.resolve(process.cwd(), "..", "data");
const vercelDataDir = path.join("/tmp", "orion-data");
const configuredDataDir = process.env.ORION_DATA_DIR?.trim();
const configuredDatabasePath = process.env.ORION_DB_PATH?.trim();

export const dataDir = path.resolve(
  configuredDataDir || (process.env.VERCEL ? vercelDataDir : localDataDir),
);

// ORION_DB_PATH is retained for backwards compatibility. New deployments
// should configure the directory through ORION_DATA_DIR.
export const databasePath = configuredDatabasePath
  ? path.resolve(configuredDatabasePath)
  : path.join(dataDir, "orion.sqlite");

/**
 * Capas dos planos.
 *
 * Vivem no volume, nao em public/. Ficheiros escritos em public/ so
 * sobrevivem ate ao proximo deploy, porque o contentor e reconstruido do
 * repositorio - e as capas sao carregadas pelo painel, nunca passam pelo
 * git. Como saem de public/, deixam de ser servidas pelo Next: quem as
 * entrega e app/uploads/plans/[filename]/route.ts.
 *
 * O URL publico (/uploads/plans/<ficheiro>) NAO muda, para que os
 * cover_url ja gravados na base de dados continuem validos.
 */
export const planCoversDir = path.join(dataDir, "uploads", "plans");

/** Prefixo do URL publico. Tem de bater certo com a rota que os serve. */
export const PLAN_COVER_URL_PREFIX = "/uploads/plans";

function ensureDirectory(dir: string, what: string): void {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "unknown";
    console.error(`[orion] ${what} directory unavailable (${code})`);
    throw new Error(
      "Nao foi possivel preparar o armazenamento da aplicacao. Configura ORION_DATA_DIR com uma pasta gravavel.",
    );
  }
}

export function ensureDatabaseDirectory(): void {
  ensureDirectory(path.dirname(databasePath), "database");
}

export function ensurePlanCoversDirectory(): void {
  ensureDirectory(planCoversDir, "plan covers");
}
