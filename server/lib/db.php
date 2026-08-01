<?php
/**
 * Ligacao PDO + criacao do esquema.
 *
 * O esquema e gerado em codigo em vez de .sql para funcionar tanto em
 * SQLite (desenvolvimento) como em MySQL (producao) sem ficheiros separados.
 */

function orion_db(array $config): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if (str_starts_with($config['dsn'], 'sqlite:')) {
        $file = substr($config['dsn'], 7);
        $dir  = dirname($file);
        if (!is_dir($dir)) {
            mkdir($dir, 0700, true);
        }
    }

    $pdo = new PDO($config['dsn'], $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA foreign_keys = ON');
    }

    orion_migrate($pdo);
    return $pdo;
}

function orion_migrate(PDO $pdo): void
{
    $sqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
    $pk     = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
    $txt    = $sqlite ? 'TEXT' : 'VARCHAR(255)';

    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id            $pk,
        username      $txt NOT NULL UNIQUE,
        password_hash $txt NOT NULL,
        status        $txt NOT NULL DEFAULT 'active',
        hwid          $txt NULL,
        expires_at    INTEGER NULL,
        created_at    INTEGER NOT NULL
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS tokens (
        id         $pk,
        user_id    INTEGER NOT NULL,
        token_hash $txt NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS login_attempts (
        id         $pk,
        username   $txt NOT NULL,
        ip         $txt NOT NULL,
        success    INTEGER NOT NULL,
        created_at INTEGER NOT NULL
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS audit_log (
        id         $pk,
        user_id    INTEGER NULL,
        action     $txt NOT NULL,
        detail     TEXT NULL,
        ip         $txt NULL,
        created_at INTEGER NOT NULL
    )");

    // MySQL nao aceita CREATE INDEX IF NOT EXISTS antes do 8.0.29; ignorar duplicados.
    foreach ([
        'CREATE INDEX idx_tokens_hash ON tokens (token_hash)',
        'CREATE INDEX idx_attempts_user ON login_attempts (username, created_at)',
    ] as $sql) {
        try { $pdo->exec($sql); } catch (PDOException) { /* ja existe */ }
    }
}

function orion_audit(PDO $pdo, ?int $userId, string $action, ?string $detail = null, ?string $ip = null): void
{
    $st = $pdo->prepare(
        'INSERT INTO audit_log (user_id, action, detail, ip, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    $st->execute([$userId, $action, $detail, $ip, time()]);
}
