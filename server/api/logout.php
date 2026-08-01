<?php
require __DIR__ . '/_bootstrap.php';

orion_require_method('POST');

$token = orion_bearer_token();
if ($token) {
    $user = orion_user_from_token($pdo, $token);
    orion_revoke_token($pdo, $token);
    if ($user) {
        orion_audit($pdo, (int) $user['id'], 'logout', null, orion_client_ip());
    }
}

// Sempre ok: revogar um token ja invalido nao e um erro.
orion_json(['ok' => true]);
