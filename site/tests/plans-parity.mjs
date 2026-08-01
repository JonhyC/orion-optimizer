/**
 * Paridade entre backends para os planos.
 *
 *   node tests/plans-parity.mjs        (emulador no 8085, ja com os dados migrados)
 *
 * O objectivo da migracao por dominios e que a troca seja INVISIVEL: a
 * pagina de precos tem de receber exactamente o mesmo, venha do SQLite ou
 * do Firestore. Este teste corre activePlans() das duas maneiras e compara
 * campo a campo. Qualquer divergencia - um booleano onde era 0/1, uma
 * ordem diferente, um null que virou undefined - falha aqui e nao em
 * producao.
 */
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
process.env.GOOGLE_CLOUD_PROJECT = "demo-orion";

const plans = await import("../lib/plans.ts");

// Primeiro o SQLite: sem Firebase configurado, activePlans() cai nesse ramo.
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_SERVICE_ACCOUNT;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const doSqlite = await plans.activePlans();

// Depois o Firestore. O modulo firebase-admin le a variavel no arranque,
// por isso a ordem importa: repor e reimportar num processo limpo daria o
// mesmo, mas assim evita-se o cache de modulos do Node.
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
const doFirestore = await plans.activePlans();

const norm = (list) =>
  list.map((p) =>
    Object.fromEntries(Object.entries(p).sort(([a], [b]) => a.localeCompare(b))),
  );

const a = JSON.stringify(norm(doSqlite), null, 1);
const b = JSON.stringify(norm(doFirestore), null, 1);

console.log(`SQLite   : ${doSqlite.length} planos`);
console.log(`Firestore: ${doFirestore.length} planos`);

if (a === b) {
  console.log("\nIDENTICOS — a troca de backend e invisivel para a pagina de precos.");
  for (const p of doFirestore) {
    console.log(
      `  ${p.code.padEnd(9)} ${(p.price_cents / 100).toFixed(2).padStart(7)} ${p.currency}` +
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
