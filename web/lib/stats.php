<?php
/**
 * Agregacoes para o painel.
 *
 * As series diarias sao agrupadas em PHP em vez de SQL: as datas sao
 * timestamps unix e o SQL de datas nao e portavel entre SQLite e MySQL
 * (strftime vs FROM_UNIXTIME). Os volumes aqui nao justificam a diferenca.
 */

function orion_stats_summary(PDO $pdo): array
{
    $now      = time();
    $day      = 86400;
    $since30  = $now - 30 * $day;
    $prev30   = $now - 60 * $day;

    $paid = $pdo->query("SELECT amount_cents, paid_at FROM orders WHERE status = 'paid'")->fetchAll();

    $total = 0;
    $last30 = 0;
    $prior30 = 0;
    foreach ($paid as $o) {
        $total += (int) $o['amount_cents'];
        $at = (int) $o['paid_at'];
        if ($at >= $since30)                        { $last30  += (int) $o['amount_cents']; }
        elseif ($at >= $prev30 && $at < $since30)   { $prior30 += (int) $o['amount_cents']; }
    }

    $delta = null;
    if ($prior30 > 0) {
        $delta = (($last30 - $prior30) / $prior30) * 100;
    }

    $activeLicenses = (int) $pdo->query(
        "SELECT COUNT(*) AS n FROM users
         WHERE role = 'client' AND status = 'active'
           AND (expires_at IS NULL OR expires_at > " . $now . ')'
    )->fetch()['n'];

    $clients = (int) $pdo->query("SELECT COUNT(*) AS n FROM users WHERE role = 'client'")->fetch()['n'];

    $newClients30 = (int) $pdo->query(
        "SELECT COUNT(*) AS n FROM users WHERE role = 'client' AND created_at >= " . $since30
    )->fetch()['n'];

    $ordersByStatus = [];
    foreach ($pdo->query('SELECT status, COUNT(*) AS n FROM orders GROUP BY status')->fetchAll() as $r) {
        $ordersByStatus[$r['status']] = (int) $r['n'];
    }

    $refunded = (int) ($pdo->query(
        "SELECT COALESCE(SUM(amount_cents), 0) AS s FROM orders WHERE status = 'refunded'"
    )->fetch()['s']);

    $paidCount = count($paid);

    return [
        'revenue_total'    => $total,
        'revenue_30'       => $last30,
        'revenue_prev30'   => $prior30,
        'revenue_delta'    => $delta,
        'refunded_total'   => $refunded,
        'orders_paid'      => $paidCount,
        'orders_by_status' => $ordersByStatus,
        'avg_order'        => $paidCount > 0 ? intdiv($total, $paidCount) : 0,
        'active_licenses'  => $activeLicenses,
        'clients_total'    => $clients,
        'clients_new_30'   => $newClients30,
    ];
}

/** @return array<int, array{label:string, date:string, value:int}> */
function orion_daily_series(PDO $pdo, string $what, int $days = 30): array
{
    $buckets = [];
    for ($i = $days - 1; $i >= 0; $i--) {
        $ts = strtotime("-$i days midnight");
        $buckets[date('Y-m-d', $ts)] = 0;
    }
    $from = strtotime(($days - 1) . ' days ago midnight');

    if ($what === 'revenue') {
        $rows = $pdo->prepare("SELECT paid_at AS t, amount_cents AS v FROM orders WHERE status = 'paid' AND paid_at >= ?");
    } elseif ($what === 'signups') {
        $rows = $pdo->prepare("SELECT created_at AS t, 1 AS v FROM users WHERE role = 'client' AND created_at >= ?");
    } else {
        $rows = $pdo->prepare('SELECT created_at AS t, 1 AS v FROM orders WHERE created_at >= ?');
    }
    $rows->execute([$from]);

    foreach ($rows->fetchAll() as $r) {
        $key = date('Y-m-d', (int) $r['t']);
        if (isset($buckets[$key])) {
            $buckets[$key] += (int) $r['v'];
        }
    }

    $out = [];
    foreach ($buckets as $date => $value) {
        $out[] = ['date' => $date, 'label' => date('j M', strtotime($date)), 'value' => $value];
    }
    return $out;
}

/** @return array<int, array{name:string, orders:int, revenue:int}> */
function orion_revenue_by_plan(PDO $pdo): array
{
    $rows = $pdo->query(
        "SELECT p.name AS name, COUNT(o.id) AS orders, COALESCE(SUM(o.amount_cents), 0) AS revenue
         FROM plans p
         LEFT JOIN orders o ON o.plan_id = p.id AND o.status = 'paid'
         GROUP BY p.id, p.name
         ORDER BY revenue DESC"
    )->fetchAll();

    return array_map(fn($r) => [
        'name'    => (string) $r['name'],
        'orders'  => (int) $r['orders'],
        'revenue' => (int) $r['revenue'],
    ], $rows);
}

function orion_recent_orders(PDO $pdo, int $limit = 10): array
{
    $limit = max(1, min(100, $limit));
    return $pdo->query(
        "SELECT o.*, u.username, p.name AS plan_name
         FROM orders o
         JOIN users u ON u.id = o.user_id
         JOIN plans p ON p.id = o.plan_id
         ORDER BY o.created_at DESC LIMIT $limit"
    )->fetchAll();
}
