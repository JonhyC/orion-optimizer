<?php
/**
 * Configuracao do servidor de licencas Orion.
 *
 * Em producao: copiar para config.local.php e ajustar. config.local.php,
 * se existir, tem prioridade e nao deve ir para controlo de versoes.
 */

$config = [
    // Desenvolvimento: SQLite, zero configuracao.
    // Producao com XAMPP/MySQL: 'mysql:host=127.0.0.1;dbname=orion;charset=utf8mb4'
    'dsn'     => 'sqlite:' . __DIR__ . '/data/orion.sqlite',
    'db_user' => null,
    'db_pass' => null,

    // Validade do token de sessao (segundos). 12 horas.
    'token_ttl' => 43200,

    // Bloqueio de forca bruta no login.
    'max_attempts'     => 5,
    'lockout_seconds'  => 900,

    // Liga a licenca a uma maquina no primeiro login. Impede partilha de contas.
    'bind_hwid' => true,

    // O catalogo NUNCA e servido como ficheiro estatico. So por /api/catalog.php,
    // e so com token valido.
    'catalog_path' => __DIR__ . '/../catalog/tweaks.json',
];

$local = __DIR__ . '/config.local.php';
if (is_file($local)) {
    $config = array_merge($config, require $local);
}

return $config;
