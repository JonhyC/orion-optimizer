import fs from "node:fs";
import path from "node:path";

/**
 * Carrega o .env.local para os scripts de linha de comandos.
 *
 * O Next faz isto sozinho para o site, mas o `node scripts/admin.ts` corre
 * fora dele. Sem esta funcao, definir ORION_DB_PATH no .env.local fazia o
 * site e o CLI apontarem para bases de dados diferentes sem qualquer aviso.
 *
 * Nunca sobrepoe variaveis ja definidas no ambiente - quem exporta a mao
 * quer isso mesmo.
 */
export function loadEnvLocal(dir = process.cwd()): void {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;

    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;

      const eq = line.indexOf("=");
      if (eq === -1) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();

      // Aspas a envolver o valor sao delimitadores, nao conteudo.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

/** Mostra so as pontas de um segredo, para confirmar sem o revelar. */
export function maskSecret(value: string | undefined): string {
  if (!value) return "(vazio)";
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}${"*".repeat(Math.min(value.length - 8, 20))}${value.slice(-4)}`;
}
