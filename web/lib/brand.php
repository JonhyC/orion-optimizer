<?php
/**
 * Marca Orion em SVG inline.
 *
 * Inline e nao <img> de proposito: so assim o CSS da pagina consegue animar
 * as partes (anel, cometa, brilho) e reagir a prefers-reduced-motion.
 *
 * O PNG original, se existir em assets/logo.png, e usado para favicon e
 * partilhas - onde vetor nao serve.
 */

function orion_logo_mark(int $size = 96, string $class = ''): string
{
    $uid = 'l' . substr(md5((string) mt_rand()), 0, 6);
    $cls = trim('orion-mark ' . $class);

    return <<<SVG
<svg class="$cls" width="$size" height="$size" viewBox="0 0 200 200" role="img" aria-label="Orion Optimizer">
  <defs>
    <linearGradient id="metal-$uid" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%"   stop-color="#ffffff"/>
      <stop offset="38%"  stop-color="#cfd8e3"/>
      <stop offset="55%"  stop-color="#8d9bb0"/>
      <stop offset="78%"  stop-color="#e8eef6"/>
      <stop offset="100%" stop-color="#9aa7b8"/>
    </linearGradient>
    <linearGradient id="ring-$uid" x1="0" y1="0" x2="1" y2="0.3">
      <stop offset="0%"   stop-color="#0a3f8f" stop-opacity=".2"/>
      <stop offset="35%"  stop-color="#2a9dff"/>
      <stop offset="65%"  stop-color="#7fd0ff"/>
      <stop offset="100%" stop-color="#0a3f8f" stop-opacity=".2"/>
    </linearGradient>
    <radialGradient id="core-$uid" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%"   stop-color="#1b6fd0" stop-opacity=".45"/>
      <stop offset="70%"  stop-color="#0a1a3a" stop-opacity=".15"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow-$uid" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- halo pulsante -->
  <circle class="mk-halo" cx="100" cy="100" r="78" fill="url(#core-$uid)"/>

  <!-- arco HUD exterior, rotacao lenta -->
  <g class="mk-hud">
    <circle cx="100" cy="100" r="92" fill="none" stroke="#2a9dff" stroke-opacity=".35"
            stroke-width="1.5" stroke-dasharray="46 12 4 12" stroke-linecap="round"/>
    <circle cx="100" cy="100" r="84" fill="none" stroke="#2a9dff" stroke-opacity=".18"
            stroke-width="1" stroke-dasharray="3 9"/>
  </g>

  <!-- anel planetario, inclinado -->
  <g transform="rotate(-22 100 100)">
    <ellipse class="mk-ring" cx="100" cy="104" rx="86" ry="26"
             fill="none" stroke="url(#ring-$uid)" stroke-width="5" filter="url(#glow-$uid)"/>
    <ellipse class="mk-ring-thin" cx="100" cy="104" rx="78" ry="21"
             fill="none" stroke="#7fd0ff" stroke-opacity=".5" stroke-width="1.5"/>
  </g>

  <!-- o "O": anel metalico com abertura -->
  <circle class="mk-o" cx="100" cy="96" r="42" fill="none"
          stroke="url(#metal-$uid)" stroke-width="20" stroke-linecap="round"
          stroke-dasharray="205 59" transform="rotate(-52 100 96)"/>

  <!-- cometa que fecha o O -->
  <path class="mk-comet" d="M150 44 L104 104 L120 96 Z" fill="url(#metal-$uid)"/>
  <path class="mk-comet-tail" d="M150 44 L163 31" stroke="#7fd0ff" stroke-width="3"
        stroke-linecap="round" filter="url(#glow-$uid)"/>

  <!-- faisca em orbita -->
  <circle class="mk-spark" r="3.5" fill="#bfe6ff" filter="url(#glow-$uid)"/>

  <!-- estrela -->
  <path class="mk-star" d="M100 12 L103 26 L117 29 L103 32 L100 46 L97 32 L83 29 L97 26 Z"
        fill="#ffffff"/>
</svg>
SVG;
}

/** Lockup completo: marca + palavra + assinatura. */
function orion_lockup(int $size = 120): string
{
    $mark = orion_logo_mark($size);
    return <<<HTML
<div class="lockup">
  $mark
  <div class="lockup-text">
    <div class="wordmark">ORION</div>
    <div class="wordmark-sub">OPTIMIZER</div>
    <div class="tagline">
      <span>OTIMIZA.</span> <span class="accent">MELHORA.</span> <span>DOMINA.</span>
    </div>
  </div>
</div>
HTML;
}

/** Campo de estrelas decorativo do hero. Determinista para nao saltar entre carregamentos. */
function orion_starfield(int $count = 60): string
{
    mt_srand(20260731);
    $out = '<div class="starfield" aria-hidden="true">';
    for ($i = 0; $i < $count; $i++) {
        $x     = mt_rand(0, 1000) / 10;
        $y     = mt_rand(0, 1000) / 10;
        $s     = mt_rand(8, 22) / 10;
        $delay = mt_rand(0, 6000) / 1000;
        $dur   = mt_rand(2500, 6000) / 1000;
        $out  .= '<i style="left:' . $x . '%;top:' . $y . '%;width:' . $s . 'px;height:' . $s
               . 'px;animation-delay:' . $delay . 's;animation-duration:' . $dur . 's"></i>';
    }
    mt_srand();
    return $out . '</div>';
}

function orion_has_raster_logo(): bool
{
    return is_file(__DIR__ . '/../assets/logo.png');
}
