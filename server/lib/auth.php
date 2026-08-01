<?php
/** Autenticacao: rate limiting, login, tokens, ligacao a maquina (HWID). */

function orion_is_locked_out(PDO $pdo, string $username, string $ip, array $config): bool
{
    $since = time() - (int) $config['lockout_seconds'];
    $st = $pdo->prepare(
        'SELECT COUNT(*) AS n FROM login_attempts
         WHERE username = ? AND ip = ? AND success = 0 AND created_at > ?'
    );
    $st->execute([$username, $ip, $since]);
    return ((int) $st->fetch()['n']) >= (int) $config['max_attempts'];
}

function orion_record_attempt(PDO $pdo, string $username, string $ip, bool $success): void
{
    $st = $pdo->prepare(
        'INSERT INTO login_attempts (username, ip, success, created_at) VALUES (?, ?, ?, ?)'
    );
    $st->execute([$username, $ip, $success ? 1 : 0, time()]);

    if ($success) {
        $st = $pdo->prepare('DELETE FROM login_attempts WHERE username = ? AND ip = ? AND success = 0');
        $st->execute([$username, $ip]);
    }
}

/**
 * Valida credenciais e devolve o utilizador, ou null.
 *
 * Corre sempre password_verify - mesmo sem utilizador, contra um hash
 * descartavel - para que o tempo de resposta nao revele se a conta existe.
 */
function orion_verify_credentials(PDO $pdo, string $username, string $password): ?array
{
    $st = $pdo->prepare('SELECT * FROM users WHERE username = ?');
    $st->execute([$username]);
    $user = $st->fetch();

    $hash = $user['password_hash']
        ?? '$2y$12$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';

    if (!password_verify($password, $hash) || !$user) {
        return null;
    }
    return $user;
}

/** @return array{ok:bool, reason?:string} */
function orion_check_account(array $user): array
{
    if (($user['status'] ?? '') !== 'active') {
        return ['ok' => false, 'reason' => 'Conta suspensa. Contacta o administrador.'];
    }
    if (!empty($user['expires_at']) && (int) $user['expires_at'] < time()) {
        return ['ok' => false, 'reason' => 'Licenca expirada.'];
    }
    return ['ok' => true];
}

/**
 * Primeiro login liga a licenca a maquina. Depois disso, so essa maquina entra.
 * Desbloqueio e feito pelo administrador (orion-admin.php reset-hwid).
 */
function orion_check_hwid(PDO $pdo, array $user, ?string $hwid, array $config): array
{
    if (empty($config['bind_hwid'])) {
        return ['ok' => true];
    }
    if (!$hwid) {
        return ['ok' => false, 'reason' => 'Identificador de maquina em falta.'];
    }

    if (empty($user['hwid'])) {
        $st = $pdo->prepare('UPDATE users SET hwid = ? WHERE id = ?');
        $st->execute([$hwid, $user['id']]);
        orion_audit($pdo, (int) $user['id'], 'hwid_bound', substr($hwid, 0, 16));
        return ['ok' => true];
    }

    if (!hash_equals($user['hwid'], $hwid)) {
        return ['ok' => false, 'reason' => 'Esta licenca esta ligada a outro computador.'];
    }
    return ['ok' => true];
}

/** Emite um token opaco. Guardamos apenas o SHA-256 - o original nunca fica em BD. */
function orion_issue_token(PDO $pdo, int $userId, array $config): array
{
    $token     = bin2hex(random_bytes(32));
    $expiresAt = time() + (int) $config['token_ttl'];

    $st = $pdo->prepare(
        'INSERT INTO tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)'
    );
    $st->execute([$userId, hash('sha256', $token), $expiresAt, time()]);

    // Limpeza oportunista de tokens caducados.
    $pdo->prepare('DELETE FROM tokens WHERE expires_at < ?')->execute([time()]);

    return ['token' => $token, 'expires_at' => $expiresAt];
}

/** Resolve um token para o utilizador dono, ou null. */
function orion_user_from_token(PDO $pdo, ?string $token): ?array
{
    if (!$token) {
        return null;
    }
    $st = $pdo->prepare(
        'SELECT u.* FROM tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = ? AND t.expires_at > ?'
    );
    $st->execute([hash('sha256', $token), time()]);
    $user = $st->fetch();
    if (!$user) {
        return null;
    }
    return orion_check_account($user)['ok'] ? $user : null;
}

function orion_revoke_token(PDO $pdo, string $token): void
{
    $pdo->prepare('DELETE FROM tokens WHERE token_hash = ?')->execute([hash('sha256', $token)]);
}
