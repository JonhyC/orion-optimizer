<?php
/** Helpers de resposta JSON e leitura de pedido. */

function orion_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function orion_fail(string $message, int $status = 400, string $code = 'error'): never
{
    orion_json(['ok' => false, 'code' => $code, 'error' => $message], $status);
}

function orion_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function orion_require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        orion_fail('Metodo nao permitido.', 405, 'method_not_allowed');
    }
}

function orion_client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/** Le o token do cabecalho Authorization: Bearer <token>. */
function orion_bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';

    // Alguns setups de Apache nao passam Authorization ao PHP.
    if ($header === '' && function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) {
                $header = $v;
                break;
            }
        }
    }

    if (preg_match('/^Bearer\s+(.+)$/i', trim($header), $m)) {
        return trim($m[1]);
    }
    return null;
}
