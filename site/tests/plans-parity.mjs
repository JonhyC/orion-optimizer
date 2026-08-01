/**
 * Paridade entre backends para os planos.
 *
 *   node tests/plans-parity.mjs        (emulador no 8085, ja com os dados migrados)
 *
 * O objectivo da migracao por dominios e que a troca seja INVISIVEL: a
 * pagina de precos tem de receber exactamente o mesmo, venha do SQLite ou
 * do Firestore. Qualquer divergencia - um booleano onde era 0/1, uma ordem
 * diferente, um null que virou undefined - falha aqui e nao em producao.
 *
 * Cada backend corre no SEU processo. Nao da para trocar dentro do mesmo:
 * o firebase-admin.ts decide se esta em modo emulador no carregamento do
 * modulo, e apagar a variavel de ambiente depois disso nao desfaz a
 * decisao - so parte a ligacao.
 */
import { spawnSync } from "node:child_process";

const DUMP = `
  const { activePlans } = await import("./lib/plans.ts");
  process.stdout.write(JSON.stringify(await activePlans()));
`;

function correr(nome, env) {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", DUMP], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error(`${nome} falhou:\n${(r.stderr || "").split("\n").slice(0, 6).join("\n")}`);
    process.exit(1);
  }
  return JSON.parse(r.stdout);
}

// Sem variaveis de Firebase, activePlans() cai no ramo do SQLite.
const doSqlite = correr("sqlite", {
  FIRESTORE_EMULATOR_HOST: "",
  FIREBASE_SERVICE_ACCOUNT: "",
  GOOGLE_APPLICATION_CREDENTIALS: "",
});

const doFirestore = correr("firestore", {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8085",
  GOOGLE_CLOUD_PROJECT: "demo-orion",
});

const norm = (lista) =>
  lista.map((p) => Object.fromEntries(Object.entries(p).sort(([a], [b]) => a.localeCompare(b))));

const a = JSON.stringify(norm(doSqlite), null, 1);
const b = JSON.stringify(norm(doFirestore), null, 1);

console.log(`SQLite   : ${doSqlite.length} planos`);
console.log(`Firestore: ${doFirestore.length} planos`);

if (a === b) {
  console.log("\nIDENTICOS — a troca de backend e invisivel para a pagina de precos.\n");
  for (const p of doFirestore) {
    console.log(
      `  ${p.code.padEnd(9)} ${(p.price_cents / 100).toFixed(2).padStart(8)} ${p.currency}` +
        `  ${String(p.days).padStart(5)}d  badge_active=${p.badge_active}` +
        `  discount_active=${p.discount_active}  features=${p.features.length}`,
    );
  }
  process.exit(0);
}

console.log("\nDIVERGEM:");
const la = a.split("\n");
const lb = b.split("\n");
for (let i = 0; i < Math.max(la.length, lb.length); i++) {
  if (la[i] !== lb[i]) {
    console.log(`  linha ${i + 1}`);
    console.log(`    sqlite   : ${la[i] ?? "(fim)"}`);
    console.log(`    firestore: ${lb[i] ?? "(fim)"}`);
  }
}
process.exit(1);
