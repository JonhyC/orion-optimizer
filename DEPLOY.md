# Deploy do Orion

## A regra que explica tudo o resto

Um deploy nao altera a maquina que esta a correr: constroi uma maquina
nova a partir do repositorio e deita a antiga fora. Tudo o que a aplicacao
tiver escrito na maquina antiga desaparece com ela.

Por isso:

- **No repositorio:** so codigo, aquilo que passa pelo git.
- **No volume (`/data`):** tudo o que a aplicacao escreve enquanto corre.

Tres coisas caem no segundo grupo:

| O que | Onde | Variavel |
|---|---|---|
| Base de dados | `/data/orion.sqlite` | `ORION_DATA_DIR` |
| Catalogo de tweaks | `/data/tweaks.json` | `ORION_CATALOG_PATH` |
| Capas dos planos | `/data/uploads/plans/` | segue `ORION_DATA_DIR` |

As duas primeiras variaveis ja vem definidas no `Dockerfile`. Nao e preciso
mexer nelas, so montar o volume em `/data`.

## Passos no Railway

1. **New Project → Deploy from GitHub repo** e escolher `orion-optimizer`.
   O `railway.json` manda usar o `Dockerfile`, portanto nao ha nada a
   configurar no builder.

2. **Adicionar um volume** montado em `/data`. Fazer isto ANTES do primeiro
   arranque a serio: sem volume a aplicacao arranca na mesma, mas perde
   tudo no deploy seguinte.

3. **Variaveis de ambiente** (Settings → Variables). As de Discord estao
   descritas em `site/.env.local.example`:

   ```
   APP_URL=https://<o-teu-dominio>
   DISCORD_CLIENT_ID=
   DISCORD_CLIENT_SECRET=
   DISCORD_GUILD_ID=
   DISCORD_ROLE_OWNER=
   DISCORD_ROLE_DEVELOPER=
   DISCORD_ROLE_STAFF=
   DISCORD_ROLE_MEMBER=
   DISCORD_TIER_ULTIMATE=
   DISCORD_TIER_PRO=
   DISCORD_TIER_BASIC=
   CRON_SECRET=<string aleatoria longa>
   ```

   O `CRON_SECRET` nao e opcional: sem ele o `server.mjs` desliga a
   expiracao automatica de planos e escreve um aviso no log.

4. **No portal do Discord**, registar o redirect
   `https://<o-teu-dominio>/api/auth/discord/callback`. Tem de bater certo
   com o `APP_URL`, ate na barra final.

5. **Carregar a base de dados atual** para o volume, em
   `/data/orion.sqlite`. Sem este passo arranca uma vazia e nao existe
   conta de administrador nenhuma - e o `scripts/admin.ts` corre na tua
   maquina, contra a tua base de dados local, nao contra a de producao.

6. **Desligar a Vercel.** Enquanto os dois projetos estiverem ligados ao
   mesmo repositorio, cada push faz deploy para ambos, cada um com a sua
   base de dados. Dois sites, duas verdades.

## O catalogo depois do primeiro arranque

No primeiro arranque, se `/data/tweaks.json` nao existir, o
`docker-entrypoint.sh` copia para la o `catalog/tweaks.json` do
repositorio.

**A partir dai o ficheiro do volume manda.** As edicoes feitas no painel
ficam nele e sobrevivem aos deploys. Em troca, acrescentar tweaks ao
`catalog/tweaks.json` no git deixa de ter efeito em producao - o
repositorio passa a ser semente e copia de seguranca, nao a versao viva.

Se algum dia precisares de forcar o catalogo do repositorio, apaga
`/data/tweaks.json` e reinicia: o entrypoint volta a semear.

## Copias de seguranca

```bash
node scripts/backup.mjs
```

Faz `VACUUM INTO` (copia consistente sem parar a aplicacao, ao contrario
de copiar o ficheiro a mao, que em modo WAL pode apanhar uma escrita a
meio), verifica a integridade da copia, guarda o catalogo ao lado e mantem
as 14 mais recentes.

Vale a pena por em `cron` diario no Railway.

**A parte que falta e tua.** O script escreve em `/data/backups`, ou seja,
no mesmo volume que esta a proteger. Isso chega para recuperar de apagar
uma conta por engano ou de uma migracao que corra mal, mas **nao protege
contra o volume morrer**. Para isso a copia tem de sair da maquina - S3,
Backblaze, ou descarregar periodicamente. Enquanto isso nao estiver feito,
ha um unico ponto de falha.

Testar o restauro de vez em quando. Uma copia que nunca foi aberta nao e
uma copia de seguranca.

## O instalador

O `Orion-Optimizer-Setup.exe` esta no `.gitignore` (103 MB, acima do
limite do GitHub), portanto nao vai no repositorio nem na imagem. Como
esta, `/downloads/...exe` responde 404 em producao.

Duas saidas: publicar como asset de GitHub Release e apontar o site para
la, ou colocar o ficheiro no volume e servi-lo por uma rota, como se fez
com as capas dos planos.

## Limites conhecidos

- **Uma instancia so.** O SQLite em modo WAL nao aceita escritores de
  processos diferentes. Nao escalar em horizontal.
- **Imagens sem CDN**, servidas pelo processo Node. Com meia duzia de
  capas nao se nota.
