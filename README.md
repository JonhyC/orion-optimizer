# Orion Optimizer

Optimizador de Windows com licenças geridas pelo dono, catálogo servido pelo
servidor e reversão completa de tudo o que altera.

## Arquitetura

Uma linguagem, um servidor, um deploy. O XAMPP não é preciso.

```
site/          Next.js 15 · TypeScript      site público + API de licenças
client/        PowerShell                   o optimizador em si (Windows)
catalog/       tweaks.json                  catálogo (allowlist), nunca servido estático
data/          orion.sqlite                 base de dados (ficheiro único)
tests/         PowerShell                   62 asserções
```

## Arrancar

```bash
npm install --prefix site
```

```bash
npm run dev --prefix site
```

Site em `http://localhost:3400`. A API fica em `/api/*` no mesmo servidor.

## Contas

Não há registo de administradores por HTTP — só linha de comandos. Um endpoint
que cria contas seria a maior superfície de ataque do projeto.

```bash
node site/scripts/admin.ts create ojoao --days=30
```

`create` · `list` · `suspend` · `activate` · `reset-hwid` · `passwd` · `delete` · `audit`

Contas de demonstração já criadas: `dono` / `DonoPass123` (owner) e
`cliente1` / `ClientePass123` (30 dias).

## Painel e login por Discord

`http://localhost:3400/panel/login`

O Discord é a forma de entrar. Os cargos do servidor definem o que cada pessoa
vê — **o cargo mais alto ganha** (ter `owner` e `member` ao mesmo tempo dá owner).

Há **dois eixos independentes**:

| Permissões | Vê |
|---|---|
| `owner` | tudo, incluindo receita e reembolsos |
| `developer` | painel e contas, **sem** números financeiros; pode suspender |
| `staff` | painel e contas; desliga máquinas, não suspende |
| `client` | só a própria conta |

| Plano | |
|---|---|
| `ultimate` / `pro` / `basic` | o que a pessoa comprou |

São separados de propósito: podes ser owner e ter `basic`; um cliente sem
qualquer poder no site pode ter `ultimate`.

Os cargos separadores (`--- high roles ---` e afins) não entram na configuração.

### Configurar

1. Cria uma aplicação em [discord.com/developers/applications](https://discord.com/developers/applications)
2. Em **OAuth2 → Redirects**, adiciona exatamente:
   `http://localhost:3400/api/auth/discord/callback`
3. Liga o **Modo de Programador** no Discord (Definições → Avançado)
4. Copia os IDs: botão direito no servidor e em cada cargo → *Copiar ID*
5. `cp site/.env.local.example site/.env.local` e preenche

Sem `.env.local` o botão do Discord não aparece e o login por password continua
a funcionar — o cliente PowerShell precisa dele de qualquer forma.

### Papel fixado à mão

`set-role` marca a conta como `manual` e o Discord deixa de lhe tocar. Serve de
rede de segurança: perderes um cargo no servidor não te pode tirar o teu próprio
painel.

```bash
node site/scripts/admin.ts set-role ojoao owner
```

## Base de dados

```bash
node site/scripts/admin.ts db
```

É um SQLite normal em `data/orion.sqlite`. Abre-o com
[DB Browser for SQLite](https://sqlitebrowser.org) (gratuito), ou da linha de
comandos:

```bash
node site/scripts/admin.ts sql "SELECT username, role, tier FROM users"
```

Consultas que escrevem exigem `--write`. Um `SELECT` mal escrito não estraga
nada; um `DELETE` sem `WHERE` apaga tudo sem aviso.

## Avaliações

O site não tem testemunhos inventados. Vêm da base de dados e só aparecem
depois de aprovadas:

```bash
node site/scripts/admin.ts review add --author="Nome" --body="..." --rig="RTX 3060" --gain="60 -> 120 FPS"
```

```bash
node site/scripts/admin.ts review approve 1
```

## Cliente Windows

```bash
powershell -ExecutionPolicy Bypass -File client\Orion.ps1
```

Por defeito corre em `-Mode Simulate`: escreve num ficheiro que finge ser o
Registry, não no sistema. `-Mode Real` só depois de validado em máquina virtual.

## Testes

```bash
powershell -ExecutionPolicy Bypass -File tests\Test-OrionEngine.ps1
```

| Suite | Cobre | Asserções |
|---|---|---|
| `Test-OrionEngine.ps1` | motor, journal, rollback (registry falso) | 26 |
| `Test-OrionApi.ps1` | API HTTP, auth, HWID, força bruta | 21 |
| `Test-OrionFlow.ps1` | fluxo cliente↔servidor completo | 15 |

As duas últimas precisam do servidor a correr.

## Princípios de desenho

**Allowlist, não blocklist.** Só existe no programa o que está no catálogo e foi
auditado. Não há caminho de código para desativar serviços, Windows Defender ou
Windows Update — não é uma opção escondida, simplesmente não existe.

**Nada é escrito sem o original estar guardado em disco primeiro.** Se o processo
morrer a meio, o rollback na execução seguinte continua a funcionar.

**Distingue "valor a zero" de "valor ausente".** No rollback, uma chave que não
existia antes é apagada, não posta a zero — é onde a maioria das ferramentas
deste género falha.

**O catálogo só sai com token válido.** Sem sessão o cliente não recebe catálogo,
logo não tem nada para aplicar. Editar o `.ps1` não contorna isso.

## Por fazer

- Ecrãs do painel: conta do cliente, dashboard de vendas, gestão de contas
- Ligar os botões de compra a um processador de pagamentos
- Páginas `/terms`, `/privacy`, `/refunds`
- Substituir os números de prova social do site por dados reais
- HTTPS antes de qualquer publicação (em HTTP a password viaja em claro)
- Validar `-Mode Real` numa máquina virtual (o VirtualBox é gratuito e corre em Windows Home)

## Pastas obsoletas

`server/` e `web/` são a versão PHP anterior, substituída pelo porte para
Next.js. Ficaram para consulta e podem ser apagadas — nada no projeto lhes toca.
A base de dados antiga (`server/data/orion.sqlite`) não tinha contas.
