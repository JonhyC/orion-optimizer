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
      note: "Preços indicativos de lojas externas. Confirma sempre na loja antes de comprar.",
      items: [
        { name: "Counter-Strike 2", price: "Grátis", url: "https://store.steampowered.com/app/730/", store: "Steam", match: "counter-strike" },
        { name: "Elden Ring", price: "desde 34,99 €", url: "https://www.allkeyshop.com/blog/buy-elden-ring-cd-key-compare-prices/", store: "AllKeyShop", match: "elden ring" },
        { name: "Cyberpunk 2077", price: "desde 19,99 €", url: "https://www.allkeyshop.com/blog/buy-cyberpunk-2077-cd-key-compare-prices/", store: "AllKeyShop", match: "cyberpunk" },
        { name: "Red Dead Redemption 2", price: "desde 17,99 €", url: "https://www.allkeyshop.com/blog/buy-red-dead-redemption-2-cd-key-compare-prices/", store: "AllKeyShop", match: "red dead" },
        { name: "EA SPORTS FC 25", price: "desde 24,99 €", url: "https://www.allkeyshop.com/blog/buy-ea-sports-fc-25-cd-key-compare-prices/", store: "AllKeyShop", match: "fc 25" },
        { name: "Hogwarts Legacy", price: "desde 21,99 €", url: "https://www.allkeyshop.com/blog/buy-hogwarts-legacy-cd-key-compare-prices/", store: "AllKeyShop", match: "hogwarts" },
      ],
    },
    {
      kind: "ligacao",
      label: "Ver todos os jogos no AllKeyShop",
      url: "https://www.allkeyshop.com/blog/",
      note: "Abre no teu browser. O Orion não processa nenhuma compra.",
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
