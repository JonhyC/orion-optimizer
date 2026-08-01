<?php
/**
 * Administracao de contas - SO por linha de comandos.
 *
 * Nao existe painel de administracao web de proposito: um endpoint HTTP que
 * cria contas e a maior superficie de ataque que este projeto poderia ter.
 *
 *   php server/admin/orion-admin.php create <user> [--days=30] [--pass=xxx]
 *   php server/admin/orion-admin.php list
 *   php server/admin/orion-admin.php suspend <user>
 *   php server/admin/orion-admin.php activate <user>
 *   php server/admin/orion-admin.php reset-hwid <user>
 *   php server/admin/orion-admin.php passwd <user> [--pass=xxx]
 *   php server/admin/orion-admin.php delete <user>
 *   php server/admin/orion-admin.php audit [--limit=20]
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Esta ferramenta so corre por linha de comandos.');
}

require_once __DIR__ . '/../lib/db.php';

$config = require __DIR__ . '/../config.php';
$pdo    = orion_db($config);

$args = $argv;
array_shift($args);

$flags = [];
$positional = [];
foreach ($args as $a) {
    if (preg_match('/^--([a-z\-]+)(?:=(.*))?$/i', $a, $m)) {
        $flags[$m[1]] = $m[2] ?? true;
    } else {
        $positional[] = $a;
    }
}

$command = $positional[0] ?? 'help';
$target  = $positional[1] ?? null;

function out(string $s): void { echo $s . PHP_EOL; }

function need_user(?string $u): string
{
    if (!$u) {
        out('Falta o nome de utilizador.');
        exit(1);
    }
    return $u;
}

function find_user(PDO $pdo, string $username): array
{
    $st = $pdo->prepare('SELECT * FROM users WHERE username = ?');
    $st->execute([$username]);
    $user = $st->fetch();
    if (!$user) {
        out("Utilizador '$username' nao existe.");
        exit(1);
    }
    return $user;
}

/** Password legivel mas com entropia suficiente (~72 bits). */
function gen_password(int $len = 14): string
{
    $alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $out = '';
    for ($i = 0; $i < $len; $i++) {
        $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return $out;
}

switch ($command) {

    case 'create':
        $username = need_user($target);

        $st = $pdo->prepare('SELECT id FROM users WHERE username = ?');
        $st->execute([$username]);
        if ($st->fetch()) {
            out("Utilizador '$username' ja existe.");
            exit(1);
        }

        $password = is_string($flags['pass'] ?? null) ? $flags['pass'] : gen_password();
        $days     = isset($flags['days']) ? (int) $flags['days'] : 0;
        $expires  = $days > 0 ? time() + ($days * 86400) : null;

        $st = $pdo->prepare(
            'INSERT INTO users (username, password_hash, status, hwid, expires_at, created_at)
             VALUES (?, ?, ?, NULL, ?, ?)'
        );
        $st->execute([
            $username,
            password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]),
            'active',
            $expires,
            time(),
        ]);

        orion_audit($pdo, (int) $pdo->lastInsertId(), 'admin_create', $username);

        out('');
        out('  Conta criada');
        out('  ------------------------------------');
        out('  Utilizador : ' . $username);
        out('  Password   : ' . $password);
        out('  Validade   : ' . ($expires ? date('Y-m-d H:i', $expires) : 'sem limite'));
        out('  Maquina    : sera ligada no primeiro login');
        out('');
        out('  A password NAO fica recuperavel - so o hash e guardado.');
        out('  Copia-a agora.');
        out('');
        break;

    case 'list':
        $rows = $pdo->query('SELECT * FROM users ORDER BY created_at DESC')->fetchAll();
        if (!$rows) {
            out('Sem contas.');
            break;
        }
        out('');
        printf("  %-20s %-10s %-18s %-8s%s", 'UTILIZADOR', 'ESTADO', 'VALIDADE', 'MAQUINA', PHP_EOL);
        out('  ' . str_repeat('-', 62));
        foreach ($rows as $r) {
            $exp = $r['expires_at'] ? date('Y-m-d', (int) $r['expires_at']) : 'sem limite';
            if ($r['expires_at'] && (int) $r['expires_at'] < time()) {
                $exp .= ' (expirada)';
            }
            printf(
                "  %-20s %-10s %-18s %-8s%s",
                $r['username'],
                $r['status'],
                $exp,
                $r['hwid'] ? substr($r['hwid'], 0, 8) : '-',
                PHP_EOL
            );
        }
        out('');
        break;

    case 'suspend':
    case 'activate':
        $username = need_user($target);
        $user     = find_user($pdo, $username);
        $status   = $command === 'suspend' ? 'suspended' : 'active';

        $pdo->prepare('UPDATE users SET status = ? WHERE id = ?')->execute([$status, $user['id']]);

        // Suspender tem de matar as sessoes abertas, senao o token continua a servir catalogo.
        if ($status === 'suspended') {
            $pdo->prepare('DELETE FROM tokens WHERE user_id = ?')->execute([$user['id']]);
        }

        orion_audit($pdo, (int) $user['id'], 'admin_' . $command, $username);
        out("'$username' -> $status" . ($status === 'suspended' ? ' (sessoes terminadas)' : ''));
        break;

    case 'reset-hwid':
        $username = need_user($target);
        $user     = find_user($pdo, $username);
        $pdo->prepare('UPDATE users SET hwid = NULL WHERE id = ?')->execute([$user['id']]);
        orion_audit($pdo, (int) $user['id'], 'admin_reset_hwid', $username);
        out("Maquina desligada de '$username'. O proximo login liga uma nova.");
        break;

    case 'passwd':
        $username = need_user($target);
        $user     = find_user($pdo, $username);
        $password = is_string($flags['pass'] ?? null) ? $flags['pass'] : gen_password();

        $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
            ->execute([password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]), $user['id']]);
        $pdo->prepare('DELETE FROM tokens WHERE user_id = ?')->execute([$user['id']]);

        orion_audit($pdo, (int) $user['id'], 'admin_passwd', $username);
        out("Nova password de '$username': $password");
        break;

    case 'delete':
        $username = need_user($target);
        $user     = find_user($pdo, $username);
        $pdo->prepare('DELETE FROM tokens WHERE user_id = ?')->execute([$user['id']]);
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$user['id']]);
        orion_audit($pdo, null, 'admin_delete', $username);
        out("'$username' apagado.");
        break;

    case 'audit':
        $limit = isset($flags['limit']) ? max(1, (int) $flags['limit']) : 20;
        $rows  = $pdo->query(
            "SELECT a.*, u.username FROM audit_log a
             LEFT JOIN users u ON u.id = a.user_id
             ORDER BY a.id DESC LIMIT $limit"
        )->fetchAll();
        out('');
        foreach (array_reverse($rows) as $r) {
            printf(
                "  %s  %-22s %-14s %s%s",
                date('Y-m-d H:i:s', (int) $r['created_at']),
                $r['action'],
                $r['username'] ?? '-',
                $r['detail'] ?? '',
                PHP_EOL
            );
        }
        out('');
        break;

    default:
        out('');
        out('  Orion Optimizer - administracao de contas');
        out('');
        out('    create <user> [--days=30] [--pass=xxx]   criar conta');
        out('    list                                     listar contas');
        out('    suspend <user>                           suspender (mata sessoes)');
        out('    activate <user>                          reativar');
        out('    reset-hwid <user>                        desligar da maquina atual');
        out('    passwd <user> [--pass=xxx]               nova password');
        out('    delete <user>                            apagar conta');
        out('    audit [--limit=20]                       ultimos eventos');
        out('');
}
