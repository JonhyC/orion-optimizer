/**
 * Renderiza paginas autenticadas contra o servidor local.
 *
 *   node tests/render-as-owner.mjs /panel/admin /panel/dashboard
 *
 * Existe porque um 307 nao prova nada: so diz que a rota redireccionou
 * antes de correr o componente. Os erros que interessam - um campo que
 * nao existe, uma query sem indice, um numero errado - so aparecem com a
 * pagina renderizada a serio.
 *
 * A fixture antiga (optimizer-session-fixture.mjs) escrevia o token no
 * SQLite, que a autenticacao ja nao le. Esta cria-o no Firestore e APAGA-O
 * sempre no fim, mesmo que a renderizacao rebente - um token de owner
 * esquecido numa base de dados e uma sessao de administrador aberta.
 */
import { createToken, revokeToken } from "../lib/repo/tokens.ts";
import { listProfiles } from "../lib/repo/users.ts";

const BASE = process.env.ORION_BASE ?? "http://127.0.0.1:3400";
const rotas = process.argv.slice(2);
if (rotas.length === 0) {
  console.error("Uso: node tests/render-as-owner.mjs <rota> [rota...]");
  process.exit(2);
}

const perfis = await listProfiles(500);
const owner = perfis.find((p) => p.role === "owner");
if (!owner) {
  console.error("Nenhum utilizador com role 'owner' no Firestore.");
  process.exit(1);
}

// 5 minutos chega para o teste e limita o estrago se a limpeza falhar.
const { token } = await createToken(owner.id, "web", 300);
let falhas = 0;

try {
  for (const rota of rotas) {
    const inicio = Date.now();
    let estado = "erro";
    let corpo = "";
    try {
      const resposta = await fetch(`${BASE}${rota}`, {
        headers: { cookie: `orion_session=${token}` },
        redirect: "manual",
      });
      estado = String(resposta.status);
      corpo = await resposta.text();
    } catch (erro) {
      corpo = String(erro?.message ?? erro);
    }

    const ms = Date.now() - inicio;
    const ok = estado === "200";
    // O Next devolve 200 com a pagina de erro embutida quando um componente
    // rebenta em streaming, portanto o codigo sozinho nao chega.
    const rebentou = /Application error|__next_error__|Internal Server Error/i.test(corpo);

    if (!ok || rebentou) {
      falhas++;
      console.log(`  [FALHA] ${rota} -> ${estado} em ${ms}ms${rebentou ? " (erro no HTML)" : ""}`);
      const pista = corpo.match(/<h2[^>]*>([^<]{5,160})</)?.[1];
      if (pista) console.log(`          ${pista}`);
    } else {
      console.log(`  [OK]   ${rota} -> 200 em ${ms}ms, ${corpo.length} bytes`);
    }
  }
} finally {
  await revokeToken(token);
  console.log("\nToken de teste removido.");
}

process.exit(falhas > 0 ? 1 : 0);
