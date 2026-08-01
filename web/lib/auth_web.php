<?php
/**
 * Sessao web, papeis e CSRF.
 *
 * Papeis:
 *   owner     - tudo, incluindo receitas e reembolsos
 *   developer - operacao e contas, sem numeros financeiros
 *   client    - so a propria conta
 */

const ORION_ROLES = ['client', 'developer', 'owner'];

function orion_current_user(PDO $pdo): ?array
{
    if (empty($_SESSION['uid'])) {
        return null;
    }
    $st = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $st->execute([(int) $_SESSION['uid']]);
    $user = $st->fetch();

    // Conta suspensa ou apagada entretanto: a sessao deixa de valer.
    if (!$user || $user['status'] !== 'active') {
        unset($_SESSION['uid']);
        return null;
    }
    return $user;
}

function orion_login_session(array $user): void
{
    session_regenerate_id(true);   // contra fixacao de sessao
    $_SESSION['uid'] = (int) $user['id'];
}

function orion_logout_session(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

function orion_role_at_least(?array $user, string $role): bool
{
    if (!$user) {
        return false;
    }
    $have = array_search($user['role'] ?? 'client', ORION_ROLES, true);
    $need = array_search($role, ORION_ROLES, true);
    return $have !== false && $need !== false && $have >= $need;
}

function orion_require_login(?array $user): array
{
    if (!$user) {
        redirect('login.php?next=' . urlencode($_SERVER['REQUEST_URI'] ?? ''));
    }
    return $user;
}

function orion_require_role(?array $user, string $role): array
{
    $user = orion_require_login($user);
    if (!orion_role_at_least($user, $role)) {
        http_response_code(403);
        exit('403 - sem permissoes para esta area.');
    }
    return $user;
}

// ------------------------------------------------------------------- CSRF

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}

function csrf_check(): void
{
    $sent = (string) ($_POST['csrf'] ?? '');
    if (!hash_equals($_SESSION['csrf'] ?? '', $sent)) {
        http_response_code(419);
        exit('Sessao expirada. Volta atras e tenta de novo.');
    }
}

// ------------------------------------------------------------- validacao

function orion_validate_username(string $u): ?string
{
    if (strlen($u) < 3 || strlen($u) > 32) {
        return 'O nome de utilizador tem de ter entre 3 e 32 caracteres.';
    }
    if (!preg_match('/^[a-zA-Z0-9._-]+$/', $u)) {
        return 'So sao permitidas letras, numeros, ponto, hifen e underscore.';
    }
    return null;
}

function orion_validate_password(string $p): ?string
{
    if (strlen($p) < 10) {
        return 'A password tem de ter pelo menos 10 caracteres.';
    }
    if (!preg_match('/[a-zA-Z]/', $p) || !preg_match('/[0-9]/', $p)) {
        return 'A password tem de conter letras e numeros.';
    }
    return null;
}
