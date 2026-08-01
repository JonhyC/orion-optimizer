#!/usr/bin/env node
/**
 * Copia de seguranca da base de dados Orion.
 *
 *   node scripts/backup.mjs [destino]
 *
 * Usa VACUUM INTO, nao uma copia do ficheiro. A diferenca importa: o
 * SQLite em modo WAL guarda escritas recentes num ficheiro -wal separado,
 * portanto copiar so o .sqlite com o servidor a correr da uma copia a que
 * faltam as ultimas transaccoes - ou corrompida a meio de uma escrita.
 * O VACUUM INTO produz um ficheiro consistente sem parar a aplicacao.
 *
 * Guarda tambem o catalogo, que vive no volume e nao no repositorio.
 *
 * ATENCAO: isto escreve no MESMO volume. Uma copia ao lado do original nao
 * protege contra o volume morrer - protege contra apagar uma conta por
 * engano ou uma migracao correr mal. Para protecao a serio, o ficheiro tem
 * de sair da maquina (ver DEPLOY.md).
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.ORION_DATA_DIR ?? path.join(process.cwd(), "data");
const dbPath = process.env.ORION_DB_PATH ?? path.join(dataDir, "orion.sqlite");
const catalogPath = process.env.ORION_CATALOG_PATH ?? path.join(process.cwd(), "catalog", "tweaks.json");
const outDir = process.argv[2] ?? path.join(dataDir, "backups");

if (!fs.existsSync(dbPath)) {
  console.error(`[backup] base de dados nao encontrada: ${dbPath}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

// Nome ordenavel e sem caracteres que o Windows recuse.
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const target = path.join(outDir, `orion-${stamp}.sqlite`);

const db = new DatabaseSync(dbPath, { readOnly: true });
try {
  // O caminho vai numa string SQL: as plicas tem de ser duplicadas.
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
} finally {
  db.close();
}

// Verificar que a copia abre e tem conteudo. Uma copia que nunca foi
// aberta nao e uma copia de seguranca, e um ficheiro.
const check = new DatabaseSync(target, { readOnly: true });
const { n } = check.prepare("SELECT COUNT(*) AS n FROM users").get();
const integrity = check.prepare("PRAGMA integrity_check").get();
check.close();

const ok = Object.values(integrity)[0] === "ok";
const size = (fs.statSync(target).size / 1024).toFixed(0);

if (fs.existsSync(catalogPath)) {
  fs.copyFileSync(catalogPath, path.join(outDir, `tweaks-${stamp}.json`));
}

console.log(`[backup] ${target}`);
console.log(`[backup] ${size} KB · ${n} utilizadores · integridade: ${ok ? "ok" : "FALHOU"}`);

// Manter as 14 mais recentes. Sem isto o volume enche-se em silencio e a
// aplicacao morre por falta de espaco - uma forma parva de perder tudo.
const antigas = fs
  .readdirSync(outDir)
  .filter((f) => /^orion-.*\.sqlite$/.test(f))
  .sort()
  .slice(0, -14);
for (const f of antigas) {
  fs.unlinkSync(path.join(outDir, f));
  const gemea = path.join(outDir, f.replace(/^orion-/, "tweaks-").replace(/\.sqlite$/, ".json"));
  if (fs.existsSync(gemea)) fs.unlinkSync(gemea);
}
if (antigas.length) console.log(`[backup] ${antigas.length} copias antigas removidas`);

process.exit(ok ? 0 : 1);
