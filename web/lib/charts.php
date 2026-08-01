<?php
/**
 * Graficos em SVG gerado no servidor.
 *
 * Sem bibliotecas nem CDN. As cores vem de variaveis CSS (--series-1, --grid,
 * ...), portanto claro/escuro trocam sem regerar nada.
 *
 * Regras seguidas: uma so escala por eixo (nunca dois eixos y), serie unica
 * dispensa legenda (o titulo nomeia-a), grelha recessiva, marcas finas,
 * extremidade arredondada so no lado dos dados, rotulos diretos seletivos
 * (nunca um numero em cada ponto) e vista de tabela sempre disponivel.
 */

function svg_num(float $n): string
{
    return rtrim(rtrim(number_format($n, 2, '.', ''), '0'), '.');
}

/**
 * Serie unica ao longo do tempo: linha + area.
 *
 * @param array<int, array{label:string, value:int|float, date?:string}> $points
 */
function chart_area(array $points, array $opts = []): string
{
    $w = 720; $h = 240;
    $padL = 56; $padR = 20; $padT = 18; $padB = 30;

    $id       = $opts['id']       ?? 'c' . substr(md5(serialize($points) . mt_rand()), 0, 8);
    $format   = $opts['format']   ?? 'number';   // number | money
    $currency = $opts['currency'] ?? 'EUR';
    $empty    = $opts['empty']    ?? 'Ainda sem dados.';

    if (count($points) < 2) {
        return '<p class="chart-empty">' . e($empty) . '</p>';
    }

    $values = array_map(fn($p) => (float) $p['value'], $points);
    $max    = max($values);
    $niceMax = $max <= 0 ? 1.0 : (float) (10 ** floor(log10($max))) * ceil($max / (10 ** floor(log10($max))));

    $plotW = $w - $padL - $padR;
    $plotH = $h - $padT - $padB;
    $n     = count($points);

    $x = fn(int $i): float => $padL + ($n === 1 ? $plotW / 2 : $plotW * $i / ($n - 1));
    $y = fn(float $v): float => $padT + $plotH - ($niceMax > 0 ? ($v / $niceMax) * $plotH : 0);

    $fmt = function (float $v) use ($format, $currency): string {
        return $format === 'money' ? money((int) round($v), $currency) : (string) (int) $v;
    };

    // --- grelha e eixo y
    $grid = '';
    $ticks = 4;
    for ($t = 0; $t <= $ticks; $t++) {
        $v  = $niceMax * $t / $ticks;
        $yy = $y($v);
        $grid .= '<line class="grid" x1="' . $padL . '" y1="' . svg_num($yy) . '" x2="' . ($w - $padR) . '" y2="' . svg_num($yy) . '"/>';
        $grid .= '<text class="axis" x="' . ($padL - 10) . '" y="' . svg_num($yy + 4) . '" text-anchor="end">'
               . e(strip_tags($fmt($v))) . '</text>';
    }

    // --- caminhos
    $line = '';
    $pts  = [];
    foreach ($points as $i => $p) {
        $px = $x($i); $py = $y((float) $p['value']);
        $line .= ($i === 0 ? 'M' : 'L') . svg_num($px) . ' ' . svg_num($py) . ' ';
        $pts[] = ['x' => round($px, 2), 'y' => round($py, 2),
                  'l' => $p['label'], 'v' => strip_tags($fmt((float) $p['value']))];
    }
    $baseY = $y(0);
    $area  = $line . 'L' . svg_num($x($n - 1)) . ' ' . svg_num($baseY)
           . ' L' . svg_num($x(0)) . ' ' . svg_num($baseY) . ' Z';

    // --- rotulos x: so extremos e meio, para nao colidirem
    $xLabels = '';
    foreach ([0, intdiv($n - 1, 2), $n - 1] as $i) {
        $anchor = $i === 0 ? 'start' : ($i === $n - 1 ? 'end' : 'middle');
        $xLabels .= '<text class="axis" x="' . svg_num($x($i)) . '" y="' . ($h - 8) . '" text-anchor="' . $anchor . '">'
                  . e($points[$i]['label']) . '</text>';
    }

    // --- rotulo direto no ultimo ponto (nunca um numero em cada ponto)
    $lastX = $x($n - 1); $lastY = $y((float) end($values));
    $direct = '<circle class="mark-last" cx="' . svg_num($lastX) . '" cy="' . svg_num($lastY) . '" r="4.5"/>';

    $json = htmlspecialchars(json_encode($pts, JSON_UNESCAPED_UNICODE), ENT_QUOTES);

    $html  = '<figure class="chart" data-chart="area" data-points="' . $json . '">';
    $html .= '<svg viewBox="0 0 ' . $w . ' ' . $h . '" role="img" preserveAspectRatio="xMidYMid meet" aria-label="'
           . e($opts['aria'] ?? 'Grafico de evolucao') . '">';
    $html .= '<defs><linearGradient id="g-' . $id . '" x1="0" y1="0" x2="0" y2="1">'
           . '<stop offset="0%" class="fill-top"/><stop offset="100%" class="fill-bottom"/></linearGradient></defs>';
    $html .= $grid;
    $html .= '<path class="area" d="' . $area . '" fill="url(#g-' . $id . ')"/>';
    $html .= '<path class="line" d="' . trim($line) . '"/>';
    $html .= $direct;
    $html .= '<line class="baseline" x1="' . $padL . '" y1="' . svg_num($baseY) . '" x2="' . ($w - $padR) . '" y2="' . svg_num($baseY) . '"/>';
    $html .= $xLabels;
    $html .= '<g class="crosshair" hidden><line class="cross-line" y1="' . $padT . '" y2="' . svg_num($baseY) . '"/>'
           . '<circle class="cross-dot" r="5"/></g>';
    $html .= '</svg>';
    $html .= '<div class="chart-tip" hidden></div>';
    $html .= '</figure>';

    return $html;
}

/**
 * Comparacao de magnitude: barras horizontais, uma so cor (o comprimento
 * transporta a magnitude). Rotulo direto no fim de cada barra.
 *
 * @param array<int, array{label:string, value:int|float, note?:string}> $rows
 */
function chart_bars(array $rows, array $opts = []): string
{
    $format   = $opts['format']   ?? 'number';
    $currency = $opts['currency'] ?? 'EUR';

    if (!$rows) {
        return '<p class="chart-empty">' . e($opts['empty'] ?? 'Ainda sem dados.') . '</p>';
    }

    $max = max(array_map(fn($r) => (float) $r['value'], $rows));
    if ($max <= 0) { $max = 1; }

    $fmt = fn(float $v) => $format === 'money' ? money((int) round($v), $currency) : (string) (int) $v;

    $html = '<div class="bars">';
    foreach ($rows as $r) {
        $pct = ((float) $r['value'] / $max) * 100;
        $html .= '<div class="bar-row">';
        $html .= '<div class="bar-label">' . e($r['label']) . '</div>';
        $html .= '<div class="bar-track"><div class="bar-fill" style="width:' . svg_num(max($pct, 0.8)) . '%"></div></div>';
        $html .= '<div class="bar-value">' . $fmt((float) $r['value']) . '</div>';
        $html .= '</div>';
        if (!empty($r['note'])) {
            $html .= '<div class="bar-note">' . e($r['note']) . '</div>';
        }
    }
    $html .= '</div>';
    return $html;
}

/** Linha minima para dentro de um stat tile. Sem eixos nem rotulos. */
function sparkline(array $values, int $w = 120, int $h = 32): string
{
    $values = array_values(array_map('floatval', $values));
    if (count($values) < 2) {
        return '';
    }
    $max = max($values); $min = min($values);
    $span = ($max - $min) ?: 1;
    $n = count($values);

    $d = '';
    foreach ($values as $i => $v) {
        $px = $w * $i / ($n - 1);
        $py = $h - 2 - (($v - $min) / $span) * ($h - 4);
        $d .= ($i === 0 ? 'M' : 'L') . svg_num($px) . ' ' . svg_num($py) . ' ';
    }

    return '<svg class="spark" viewBox="0 0 ' . $w . ' ' . $h . '" aria-hidden="true">'
         . '<path d="' . trim($d) . '"/></svg>';
}

/**
 * Stat tile. $delta em percentagem, ou null para nao mostrar.
 * A seta vem sempre acompanhada do numero e de texto - nunca so a cor.
 */
function stat_tile(string $label, string $value, ?float $delta = null, string $foot = '', array $spark = []): string
{
    $html  = '<div class="tile">';
    $html .= '<div class="tile-label">' . e($label) . '</div>';
    $html .= '<div class="tile-value">' . $value . '</div>';

    if ($delta !== null) {
        $up    = $delta >= 0;
        $cls   = $up ? 'delta-up' : 'delta-down';
        $arrow = $up ? '&#9650;' : '&#9660;';
        $html .= '<div class="tile-delta ' . $cls . '">' . $arrow . ' '
               . number_format(abs($delta), 1, ',', ' ') . '%'
               . '<span class="delta-ctx"> vs 30 dias antes</span></div>';
    }

    if ($spark) {
        $html .= sparkline($spark);
    }
    if ($foot !== '') {
        $html .= '<div class="tile-foot">' . e($foot) . '</div>';
    }
    $html .= '</div>';
    return $html;
}

/** Vista de tabela: obrigatoria sempre que um grafico e mostrado. */
function chart_table(array $rows, array $headers, string $summary = 'Ver dados em tabela'): string
{
    $html  = '<details class="chart-table"><summary>' . e($summary) . '</summary>';
    $html .= '<table><thead><tr>';
    foreach ($headers as $h) {
        $html .= '<th>' . e($h) . '</th>';
    }
    $html .= '</tr></thead><tbody>';
    foreach ($rows as $r) {
        $html .= '<tr>';
        foreach ($r as $cell) {
            $html .= '<td>' . $cell . '</td>';
        }
        $html .= '</tr>';
    }
    $html .= '</tbody></table></details>';
    return $html;
}
