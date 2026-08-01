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

export function ensureDatabaseDirectory(): void {
  try {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "unknown";
    console.error(`[orion] database directory unavailable (${code})`);
    throw new Error(
      "Nao foi possivel preparar o armazenamento da aplicacao. Configura ORION_DATA_DIR com uma pasta gravavel.",
    );
  }
}
