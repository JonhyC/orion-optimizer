<?php
/**
 * Pagamentos.
 *
 * REGRA ABSOLUTA: dados de cartao nunca passam por este servidor. Nao existe
 * aqui - nem deve vir a existir - um formulario que peca numero de cartao,
 * validade ou CVC. O fluxo correto e sempre redirecionar para a pagina do
 * processador (Stripe Checkout, por exemplo), que recolhe os dados no dominio
 * dele e devolve o cliente com uma referencia. Assim o risco de PCI-DSS fica
 * do lado de quem tem estrutura para o suportar.
 *
 * Providers:
 *   simulated - desenvolvimento. Marca a encomenda como paga sem qualquer
 *               dado de pagamento. Nunca deve ficar ativo em producao.
 *   stripe    - producao. Cria uma Checkout Session e redireciona.
 *               Precisa das chaves em config.local.php. NAO FOI TESTADO
 *               contra a API real: nao ha chaves neste ambiente.
 */

function orion_payment_provider(array $config): string
{
    return $config['payment_provider'] ?? 'simulated';
}

function orion_provider_is_live(array $config): bool
{
    return orion_payment_provider($config) !== 'simulated';
}

function orion_get_plan(PDO $pdo, int $planId): ?array
{
    $st = $pdo->prepare('SELECT * FROM plans WHERE id = ? AND active = 1');
    $st->execute([$planId]);
    return $st->fetch() ?: null;
}

function orion_create_order(PDO $pdo, array $user, array $plan, string $provider): int
{
    $st = $pdo->prepare(
        'INSERT INTO orders (user_id, plan_id, amount_cents, currency, status, provider, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $st->execute([
        (int) $user['id'],
        (int) $plan['id'],
        (int) $plan['price_cents'],
        $plan['currency'],
        'pending',
        $provider,
        time(),
    ]);
    return (int) $pdo->lastInsertId();
}

function orion_get_order(PDO $pdo, int $id): ?array
{
    $st = $pdo->prepare(
        'SELECT o.*, p.name AS plan_name, p.days AS plan_days, u.username
         FROM orders o
         JOIN plans p ON p.id = o.plan_id
         JOIN users u ON u.id = o.user_id
         WHERE o.id = ?'
    );
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

/**
 * Confirma o pagamento e estende a licenca.
 *
 * Se a licenca ainda esta valida, o tempo comprado soma-se ao que resta;
 * caso contrario conta a partir de agora. Idempotente: uma encomenda ja
 * paga nao volta a estender nada, mesmo que o callback chegue duas vezes.
 */
function orion_mark_paid(PDO $pdo, int $orderId, ?string $providerRef = null): bool
{
    $order = orion_get_order($pdo, $orderId);
    if (!$order || $order['status'] === 'paid') {
        return false;
    }

    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('UPDATE orders SET status = ?, paid_at = ?, provider_ref = ? WHERE id = ? AND status = ?');
        $st->execute(['paid', time(), $providerRef, $orderId, 'pending']);

        if ($st->rowCount() === 0) {
            $pdo->rollBack();
            return false;
        }

        $st = $pdo->prepare('SELECT expires_at FROM users WHERE id = ?');
        $st->execute([(int) $order['user_id']]);
        $current = $st->fetch()['expires_at'] ?? null;

        $base = ($current !== null && (int) $current > time()) ? (int) $current : time();
        $new  = $base + ((int) $order['plan_days'] * 86400);

        $pdo->prepare('UPDATE users SET expires_at = ? WHERE id = ?')
            ->execute([$new, (int) $order['user_id']]);

        orion_audit($pdo, (int) $order['user_id'], 'order_paid',
            'encomenda #' . $orderId . ' - ' . $order['plan_name']);

        $pdo->commit();
        return true;
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[orion] mark_paid: ' . $e->getMessage());
        return false;
    }
}

/** Reembolso: marca a encomenda e retira o tempo que ela tinha dado. */
function orion_refund_order(PDO $pdo, int $orderId): bool
{
    $order = orion_get_order($pdo, $orderId);
    if (!$order || $order['status'] !== 'paid') {
        return false;
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE orders SET status = ?, refunded_at = ? WHERE id = ?')
            ->execute(['refunded', time(), $orderId]);

        $st = $pdo->prepare('SELECT expires_at FROM users WHERE id = ?');
        $st->execute([(int) $order['user_id']]);
        $current = $st->fetch()['expires_at'] ?? null;

        if ($current !== null) {
            $reduced = (int) $current - ((int) $order['plan_days'] * 86400);
            $pdo->prepare('UPDATE users SET expires_at = ? WHERE id = ?')
                ->execute([max($reduced, time()), (int) $order['user_id']]);
        }

        orion_audit($pdo, (int) $order['user_id'], 'order_refunded', 'encomenda #' . $orderId);
        $pdo->commit();
        return true;
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[orion] refund: ' . $e->getMessage());
        return false;
    }
}

/**
 * Cria a sessao de pagamento no Stripe e devolve o URL para onde redirecionar.
 *
 * NAO TESTADO: sem chaves de API neste ambiente nao ha forma de o exercitar.
 * A forma do pedido segue a API Checkout Sessions. Validar em modo de teste
 * do Stripe antes de confiar nisto.
 */
function orion_stripe_checkout_url(array $config, array $order, array $plan, string $successUrl, string $cancelUrl): ?string
{
    $key = $config['stripe_secret_key'] ?? null;
    if (!$key || !function_exists('curl_init')) {
        return null;
    }

    $payload = http_build_query([
        'mode'                                       => 'payment',
        'success_url'                                => $successUrl,
        'cancel_url'                                 => $cancelUrl,
        'client_reference_id'                        => (string) $order['id'],
        'line_items[0][quantity]'                    => 1,
        'line_items[0][price_data][currency]'        => strtolower($plan['currency']),
        'line_items[0][price_data][unit_amount]'     => (int) $plan['price_cents'],
        'line_items[0][price_data][product_data][name]' => 'Orion Optimizer - ' . $plan['name'],
    ]);

    $ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $key],
    ]);
    $body   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status !== 200 || !$body) {
        error_log('[orion] stripe checkout falhou: HTTP ' . $status);
        return null;
    }

    $data = json_decode((string) $body, true);
    return $data['url'] ?? null;
}

function orion_status_label(string $status): array
{
    return match ($status) {
        'paid'     => ['Pago',      'good'],
        'pending'  => ['Pendente',  'warning'],
        'refunded' => ['Reembolsado','serious'],
        'failed'   => ['Falhou',    'critical'],
        default    => [$status,     'neutral'],
    };
}
