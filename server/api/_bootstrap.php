<?php
/** Arranque comum a todos os endpoints. */

declare(strict_types=1);

// Nunca mostrar erros PHP ao cliente: revelam caminhos e estrutura interna.
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../lib/http.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/auth.php';

$config = require __DIR__ . '/../config.php';

set_exception_handler(function (Throwable $e): void {
    error_log('[orion] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    orion_fail('Erro interno do servidor.', 500, 'internal_error');
});

try {
    $pdo = orion_db($config);
} catch (Throwable $e) {
    error_log('[orion] DB: ' . $e->getMessage());
    orion_fail('Base de dados indisponivel.', 503, 'db_unavailable');
}
