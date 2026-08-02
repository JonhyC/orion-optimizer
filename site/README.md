# Orion Optimizer 2.0 — Site

Site público em Next.js 15 / React 19 / TypeScript / Tailwind, com Framer Motion,
GSAP, Lenis e Three.js.

Vive ao lado do resto do projeto, não o substitui:

| Camada | Onde | O quê |
|---|---|---|
| Site público | `site/` | isto — marketing, planos, conversão |
| Servidor de licenças | `server/` | contas, tokens, entrega do catálogo (PHP) |
| Painel de gestão | `web/` | vendas, gráficos, contas (PHP) |
| Cliente Windows | `client/` | o optimizador em si (PowerShell) |

## Arranque

```bash
npm install --prefix site
```

```bash
npm run dev --prefix site
```

Abre em `http://localhost:3400`.

```bash
npm run build --prefix site
```

## Estrutura

```
app/
  layout.tsx          fontes, metadata, providers globais
  page.tsx            composição das secções
  globals.css         design tokens, vidro, contorno neon
components/
  Nav.tsx
  providers/SmoothScroll.tsx    Lenis
  three/ParticleField.tsx       campo de partículas WebGL
  ui/
    Cursor.tsx                  cursor próprio (ponto + anel)
    PageLoader.tsx              entrada + marca Orion em SVG
    ScrollProgress.tsx
    Spotlight.tsx               foco de luz que segue o rato
    MagneticButton.tsx          botão magnético
    TiltCard.tsx                inclinação 3D + luz por cartão
    Counter.tsx                 contador animado
    Reveal.tsx                  revelação ao scroll
  sections/
    Hero · Features · Comparison · Packages · HowItWorks
    Stats · Reviews · Faq · Cta · Footer
lib/
  data.ts             todo o conteúdo (planos, features, FAQ, reviews)
  utils.ts
```

Para mudar preços, features, perguntas ou testemunhos, mexe só em
[lib/data.ts](lib/data.ts) — nenhum texto está preso dentro dos componentes.

## Duas decisões que valem explicação

**Os contadores começam no valor final, não em zero.** O HTML gerado no servidor
tem de conter o preço verdadeiro; se começasse em zero, o Google e qualquer
visitante sem JavaScript liam que os planos custam `€0.00`. Só depois de montar
no cliente é que o valor recua para poder subir.

**Movimento reduzido desliga tudo.** `prefers-reduced-motion` corta as animações
em CSS e é lido em JS antes de arrancar o Lenis, o cursor próprio, as partículas
e os contadores. Quem tem essa preferência ligada vê o site inteiro parado, sem
perder conteúdo nenhum.

## Por fazer

- Ligar os botões de compra ao checkout (`server/api` + provider de pagamento)
- Páginas `/terms`, `/privacy`, `/refunds` — os links do rodapé já apontam para lá
- Substituir os números de prova social por dados reais antes de publicar
- `assets/logo.png` para favicon e partilhas (og:image)
