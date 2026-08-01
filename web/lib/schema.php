<?php
/**
 * Esquema da parte web (planos, encomendas, papeis).
 *
 * Partilha a base de dados com o servidor de licencas: a conta que o cliente
 * cria aqui e a mesma com que faz login no cliente PowerShell. Comprar um
 * plano estende o expires_at que a API ja consulta.
 */

function orion_web_migrate(PDO $pdo): void
{
    $sqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
    $pk     = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
    $txt    = $sqlite ? 'TEXT' : 'VARCHAR(255)';

    // Colunas novas na tabela de utilizadores ja existente.
    foreach ([
        "ALTER TABLE users ADD COLUMN role $txt NOT NULL DEFAULT 'client'",
        "ALTER TABLE users ADD COLUMN email $txt NULL",
    ] as $sql) {
        try { $pdo->exec($sql); } catch (PDOException) { /* ja existe */ }
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS plans (
        id          $pk,
        code        $txt NOT NULL UNIQUE,
        name        $txt NOT NULL,
        description TEXT NULL,
        price_cents INTEGER NOT NULL,
        currency    $txt NOT NULL DEFAULT 'EUR',
        days        INTEGER NOT NULL,
        active      INTEGER NOT NULL DEFAULT 1,
        sort_order  INTEGER NOT NULL DEFAULT 0
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS orders (
        id           $pk,
        user_id      INTEGER NOT NULL,
        plan_id      INTEGER NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency     $txt NOT NULL DEFAULT 'EUR',
        status       $txt NOT NULL DEFAULT 'pending',
        provider     $txt NOT NULL DEFAULT 'simulated',
        provider_ref $txt NULL,
        created_at   INTEGER NOT NULL,
        paid_at      INTEGER NULL,
        refunded_at  INTEGER NULL
    )");

    foreach ([
        'CREATE INDEX idx_orders_user ON orders (user_id)',
        'CREATE INDEX idx_orders_status ON orders (status, created_at)',
    ] as $sql) {
        try { $pdo->exec($sql); } catch (PDOException) { /* ja existe */ }
    }
}

/** Planos por defeito. Idempotente. */
function orion_seed_plans(PDO $pdo): void
{
    $plans = [
        ['mensal',   'Mensal',    'Acesso completo durante 30 dias.',                    499,  30, 1],
        ['anual',    'Anual',     'Doze meses de acesso. Equivale a 3,33 EUR por mes.',  3999, 365, 2],
        ['vitalicio','Vitalicio', 'Acesso permanente e todas as atualizacoes futuras.',  7999, 36500, 3],
    ];

    $st = $pdo->prepare('SELECT id FROM plans WHERE code = ?');
    $in = $pdo->prepare(
        'INSERT INTO plans (code, name, description, price_cents, currency, days, active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
    );

    foreach ($plans as [$code, $name, $desc, $price, $days, $sort]) {
        $st->execute([$code]);
        if (!$st->fetch()) {
            $in->execute([$code, $name, $desc, $price, 'EUR', $days, $sort]);
        }
    }
}
