<?php
require __DIR__ . '/_bootstrap.php';

orion_require_method('POST');

$body     = orion_body();
$username = trim((string) ($body['username'] ?? ''));
$password = (string) ($body['password'] ?? '');
$hwid     = isset($body['hwid']) ? trim((string) $body['hwid']) : null;
$ip       = orion_client_ip();

if ($username === '' || $password === '') {
    orion_fail('Utilizador e password sao obrigatorios.', 400, 'missing_credentials');
}

if (orion_is_locked_out($pdo, $username, $ip, $config)) {
    orion_audit($pdo, null, 'login_lockout', $username, $ip);
    orion_fail(
        'Demasiadas tentativas falhadas. Tenta de novo daqui a ' .
        (int) ($config['lockout_seconds'] / 60) . ' minutos.',
        429,
        'locked_out'
    );
}

$user = orion_verify_credentials($pdo, $username, $password);

if (!$user) {
    orion_record_attempt($pdo, $username, $ip, false);
    orion_audit($pdo, null, 'login_failed', $username, $ip);
    // Mensagem generica de proposito: nao dizer se o utilizador existe.
    orion_fail('Credenciais invalidas.', 401, 'invalid_credentials');
}

$account = orion_check_account($user);
if (!$account['ok']) {
    orion_record_attempt($pdo, $username, $ip, false);
    orion_audit($pdo, (int) $user['id'], 'login_denied', $account['reason'], $ip);
    orion_fail($account['reason'], 403, 'account_inactive');
}

$machine = orion_check_hwid($pdo, $user, $hwid, $config);
if (!$machine['ok']) {
    orion_record_attempt($pdo, $username, $ip, false);
    orion_audit($pdo, (int) $user['id'], 'login_hwid_mismatch', $machine['reason'], $ip);
    orion_fail($machine['reason'], 403, 'hwid_mismatch');
}

orion_record_attempt($pdo, $username, $ip, true);
$issued = orion_issue_token($pdo, (int) $user['id'], $config);
orion_audit($pdo, (int) $user['id'], 'login_ok', null, $ip);

orion_json([
    'ok'         => true,
    'token'      => $issued['token'],
    'expires_at' => $issued['expires_at'],
    'user'       => [
        'username'   => $user['username'],
        'expires_at' => $user['expires_at'] !== null ? (int) $user['expires_at'] : null,
    ],
]);
