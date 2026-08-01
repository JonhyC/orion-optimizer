<?php
/** Layout partilhado. */

function render_header(string $title, ?array $user = null, string $active = ''): void
{
    $t = e($title);
    echo <<<HTML
<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$t &middot; Orion Optimizer</title>
<link rel="stylesheet" href="assets/app.css">
</head>
<body>
<header class="topbar">
  <a class="brand" href="index.php"><span class="brand-mark">&#9670;</span> Orion</a>
  <nav class="nav">
HTML;

    $link = function (string $href, string $label, string $key) use ($active) {
        $cls = $key === $active ? ' class="on"' : '';
        echo '<a href="' . e($href) . '"' . $cls . '>' . e($label) . '</a>';
    };

    $link('index.php', 'Planos', 'home');

    if ($user) {
        $link('account.php', 'A minha conta', 'account');

        if (orion_role_at_least($user, 'developer')) {
            $link('admin.php', 'Painel', 'admin');
            $link('admin-users.php', 'Contas', 'users');
        }
        if (orion_role_at_least($user, 'owner')) {
            $link('admin-orders.php', 'Vendas', 'orders');
        }

        echo '<span class="who">' . e($user['username'])
           . '<span class="role role-' . e($user['role']) . '">' . e($user['role']) . '</span></span>';
        echo '<a class="ghost" href="logout.php">Sair</a>';
    } else {
        $link('login.php', 'Entrar', 'login');
        echo '<a class="cta" href="register.php">Criar conta</a>';
    }

    echo '</nav></header><main class="wrap">';
}

function render_footer(): void
{
    echo '</main><footer class="foot">Orion Optimizer &middot; '
       . 'Todas as alteracoes ao sistema sao reversiveis.'
       . '</footer><script src="assets/charts.js"></script></body></html>';
}

function flash(string $type, string $message): void
{
    $_SESSION['flash'][] = ['type' => $type, 'message' => $message];
}

function render_flashes(): void
{
    foreach ($_SESSION['flash'] ?? [] as $f) {
        echo '<div class="note note-' . e($f['type']) . '">' . e($f['message']) . '</div>';
    }
    unset($_SESSION['flash']);
}

function render_alert(string $type, string $html): void
{
    echo '<div class="note note-' . e($type) . '">' . $html . '</div>';
}
