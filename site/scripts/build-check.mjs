#!/usr/bin/env node
/**
 * Build de verificacao, para uma pasta descartavel.
 *
 *   npm run build:check
 *
 * Existe por causa de um erro real: correr `npm run build` enquanto o
 * servidor de producao esta a servir substitui os ficheiros de .next por
 * baixo dele. Os manifestos que o servidor tem em memoria passam a apontar
 * para chunks com hashes que ja nao existem, o browser apanha 404 nos .js
 * e a pagina rebenta com "a client-side exception has occurred" - sem
 * nada no ecra que indique a causa.
 *
 * O next.config.mjs ja le ORION_NEXT_DIST_DIR, que e o mecanismo que o
 * server.mjs usa para separar dev (.next-dev) de producao (.next). Aqui
 * aproveita-se o mesmo: constroi para .next-check e nao toca em nenhum
 * dos dois.
 *
 * Usar isto sempre que se queira SO confirmar que o build passa.
 * O `npm run build` continua a ser o que produz o que vai para producao.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const distDir = ".next-check";
const alvo = path.resolve(process.cwd(), distDir);

const manter = process.argv.includes("--keep");

// Comando numa string unica e nao array: com shell:true, passar argumentos
// separados dispara um aviso de deprecacao do Node (DEP0190), porque em
// modo shell os argumentos sao concatenados sem escape. Aqui nao ha
// entrada de utilizador nenhuma, mas nao vale a pena o ruido.
const r = spawnSync("npx next build", {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, ORION_NEXT_DIST_DIR: distDir },
});

if (!manter) {
  try {
    rmSync(alvo, { recursive: true, force: true });
  } catch {
    console.warn(`[build:check] nao foi possivel remover ${distDir}; podes apaga-lo a mao.`);
  }
}

if (r.status !== 0) {
  console.error("\n[build:check] o build FALHOU.");
  process.exit(r.status ?? 1);
}

console.log(`\n[build:check] build ok. ${manter ? `Output em ${distDir}.` : "Output descartado."}`);
console.log("[build:check] Nem .next nem .next-dev foram tocados.");
