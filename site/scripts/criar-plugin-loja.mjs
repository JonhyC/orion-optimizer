/**
 * Cria o plugin "Loja" - o exemplo base do sistema de plugins.
 *
 *   node --env-file=.env.local --experimental-strip-types \
 *     scripts/criar-plugin-loja.mjs [--confirm]
 *
 * Sem --confirm mostra o manifesto e nao grava nada.
 *
 * Os precos e os links sao EXEMPLOS. Nao ha aqui nenhuma integracao com
 * lojas externas: o Orion mostra o que estiver no manifesto e abre o link
 * no browser. Actualizar precos e trocar o manifesto - a mao, por agora,
 * ou por um script proprio se algum dia valer a pena.
 */
const RAIZ = "file:///C:/Users/jmpco/Desktop/xampp/htdocs/orionoptimizer/site/lib/repo/plugins.ts";
const { savePlugin, allPlugins } = await import(RAIZ);

const confirmar = process.argv.includes("--confirm");

const manifesto = {
  name: "Loja",
  description: "Jogos que já tens e ofertas de lojas externas",
  icon: "shopping-cart",
  // Vazio: todos os que entram na aplicacao veem a loja.
  roles: [],
  active: 1,
  sort_order: 1,
  blocks: [
    {
      kind: "jogos-instalados",
      title: "A tua biblioteca",
      note: "Detetado no teu PC a partir do Steam, Epic, GOG, Xbox e Roblox.",
    },
    {
      kind: "loja",
      title: "Ofertas",
      note: "Comparação entre lojas via IsThereAnyDeal. O botão Ver abre a loja mais barata.",
      // Os precos NAO vivem aqui. O manifesto diz apenas QUE jogos
      // mostrar; a aplicacao pede os precos ao servidor, que os busca ao
      // IsThereAnyDeal e escolhe o mais barato. O campo price fica como
      // rotulo de recurso para versoes antigas da aplicacao.
      items: [
        { name: "Counter-Strike 2", price: "—", url: "https://isthereanydeal.com", match: "counter-strike" },
        { name: "Elden Ring", price: "—", url: "https://isthereanydeal.com", match: "elden ring" },
        { name: "Cyberpunk 2077", price: "—", url: "https://isthereanydeal.com", match: "cyberpunk" },
        { name: "Red Dead Redemption 2", price: "—", url: "https://isthereanydeal.com", match: "red dead" },
        { name: "Hogwarts Legacy", price: "—", url: "https://isthereanydeal.com", match: "hogwarts" },
        { name: "Baldurs Gate 3", price: "—", url: "https://isthereanydeal.com", match: "baldur" },
        { name: "Helldivers 2", price: "—", url: "https://isthereanydeal.com", match: "helldivers" },
        { name: "It Takes Two", price: "—", url: "https://isthereanydeal.com", match: "it takes two" },
      ],
    },
  ],
};

if (!confirmar) {
  console.log(JSON.stringify({ id: "loja", ...manifesto }, null, 2));
  console.log("\nSimulacao. Corre outra vez com --confirm para gravar.");
  process.exit(0);
}

await savePlugin("loja", manifesto);
const existe = (await allPlugins()).find((p) => p.id === "loja");
console.log(existe ? `Plugin "loja" gravado com ${existe.blocks.length} blocos.` : "FALHOU: nao ficou gravado.");
process.exit(existe ? 0 : 1);
