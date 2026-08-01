<?php
/** Arranque comum a todas as paginas do site. */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../../server/lib/db.php';
require_once __DIR__ . '/schema.php';
require_once __DIR__ . '/auth_web.php';
require_once __DIR__ . '/view.php';
require_once __DIR__ . '/stats.php';
require_once __DIR__ . '/charts.php';
require_once __DIR__ . '/payments.php';

$config = require __DIR__ . '/../../server/config.php';

$pdo = orion_db($config);
orion_web_migrate($pdo);
orion_seed_plans($pdo);

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
        // Ativar quando o site correr em HTTPS:
        'secure'   => !empty($_SERVER['HTTPS']),
    ]);
    session_start();
}

$currentUser = orion_current_user($pdo);

/** Raiz do site, para construir links independentes de onde esta instalado. */
function base_path(): string
{
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return $dir === '' ? '/' : $dir . '/';
}

function money(int $cents, string $currency = 'EUR'): string
{
    $symbols = ['EUR' => '&euro;', 'USD' => '$', 'GBP' => '&pound;'];
    $sym = $symbols[$currency] ?? ($currency . ' ');
    return $sym . number_format($cents / 100, 2, ',', ' ');
}

function e(?string $s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function redirect(string $to): never
{
    header('Location: ' . $to);
    exit;
}
