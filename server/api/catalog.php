<?php
/**
 * Entrega do catalogo, so com token valido.
 *
 * Este e o ponto que torna o login real: sem sessao valida o cliente nao
 * recebe catalogo nenhum, logo nao tem nada para aplicar. Uma verificacao
 * feita do lado do cliente ("posso continuar?") seria contornavel editando
 * uma linha do .ps1.
 */

require __DIR__ . '/_bootstrap.php';

orion_require_method('GET');

$token = orion_bearer_token();
$user  = orion_user_from_token($pdo, $token);

if (!$user) {
    orion_fail('Sessao invalida ou expirada. Faz login outra vez.', 401, 'invalid_token');
}

$path = $config['catalog_path'];
if (!is_file($path)) {
    error_log('[orion] catalogo em falta: ' . $path);
    orion_fail('Catalogo indisponivel.', 503, 'catalog_unavailable');
}

$catalog = json_decode((string) file_get_contents($path), true);
if (!is_array($catalog) || !isset($catalog['tweaks'])) {
    error_log('[orion] catalogo malformado: ' . $path);
    orion_fail('Catalogo malformado.', 500, 'catalog_invalid');
}

orion_audit($pdo, (int) $user['id'], 'catalog_served', count($catalog['tweaks']) . ' tweaks', orion_client_ip());

orion_json([
    'ok'      => true,
    'catalog' => $catalog,
]);
