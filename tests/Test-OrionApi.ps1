<#
    Testes de integracao da API de licencas (Next.js).

    Mesmas asserções que existiam contra a versao PHP: se o porte manteve o
    comportamento, isto passa na integra.

    Pre-requisito: npm run dev --prefix site  (porta 3400)
#>

param(
    [string]$BaseUrl = 'http://127.0.0.1:3400',
    [string]$SiteDir = (Join-Path (Split-Path $PSScriptRoot -Parent) 'site')
)

$ErrorActionPreference = 'Continue'

$script:NPass = 0
$script:NFail = 0

function Assert {
    param([string]$Name, [bool]$Condition, [string]$Detail = '')
    if ($Condition) {
        $script:NPass++
        Write-Host "  [OK]   $Name" -ForegroundColor Green
    } else {
        $script:NFail++
        Write-Host "  [FALHA] $Name" -ForegroundColor Red
        if ($Detail) { Write-Host "         $Detail" -ForegroundColor DarkYellow }
    }
}

function Invoke-Admin {
    param([string[]]$Arguments)
    Push-Location $SiteDir
    try { & node 'scripts/admin.ts' @Arguments 2>&1 | Out-Null }
    finally { Pop-Location }
}

<# Devolve @{ Status; Body } sem lancar excecao em 4xx/5xx. #>
function Invoke-Api {
    param(
        [string]$Method = 'GET',
        [string]$Path,
        $Body = $null,
        [string]$Token = $null
    )

    $params = @{
        Method      = $Method
        Uri         = "$BaseUrl$Path"
        TimeoutSec  = 20
        ErrorAction = 'Stop'
    }
    if ($Body)  { $params.Body = ($Body | ConvertTo-Json -Compress); $params.ContentType = 'application/json' }
    if ($Token) { $params.Headers = @{ Authorization = "Bearer $Token" } }

    try {
        $r = Invoke-WebRequest @params -UseBasicParsing
        return @{ Status = [int]$r.StatusCode; Body = ($r.Content | ConvertFrom-Json) }
    } catch {
        $resp = $_.Exception.Response
        if (-not $resp) { return @{ Status = 0; Body = $null; Error = $_.Exception.Message } }

        $status = [int]$resp.StatusCode
        $text   = ''
        try {
            $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $text   = $reader.ReadToEnd()
            $reader.Dispose()
        } catch { }

        $parsed = $null
        if ($text) { try { $parsed = $text | ConvertFrom-Json } catch { } }
        return @{ Status = $status; Body = $parsed; Raw = $text }
    }
}

function Reset-User {
    param([string]$User, [string]$Password)
    Invoke-Admin @('delete', $User)
    Invoke-Admin @('create', $User, "--pass=$Password")
}

Write-Host "`n=== SERVIDOR: $BaseUrl ===" -ForegroundColor Cyan

$ping = Invoke-Api -Method POST -Path '/api/login' -Body @{ username = ''; password = '' }
if ($ping.Status -eq 0) {
    Write-Host "  Servidor inacessivel: $($ping.Error)" -ForegroundColor Red
    Write-Host "  Arranca com: npm run dev --prefix site" -ForegroundColor DarkGray
    exit 1
}

$hwidA = 'a' * 64
$hwidB = 'b' * 64

# --- 1. validacao de entrada ------------------------------------------------
Write-Host "`n=== 1. Validacao de entrada ===" -ForegroundColor Cyan
Assert 'Login sem credenciais devolve 400' ($ping.Status -eq 400) "status: $($ping.Status)"

$r = Invoke-Api -Method GET -Path '/api/login'
Assert 'GET no login devolve 405' ($r.Status -eq 405) "status: $($r.Status)"

# --- 2. credenciais ---------------------------------------------------------
Write-Host "`n=== 2. Credenciais ===" -ForegroundColor Cyan
Reset-User -User 'apitest' -Password 'SenhaCorreta123'

$r = Invoke-Api -Method POST -Path '/api/login' `
     -Body @{ username = 'apitest'; password = 'SenhaErrada'; hwid = $hwidA }
Assert 'Password errada devolve 401' ($r.Status -eq 401) "status: $($r.Status)"

$r2 = Invoke-Api -Method POST -Path '/api/login' `
      -Body @{ username = 'naoexiste'; password = 'x'; hwid = $hwidA }
Assert 'Utilizador inexistente devolve o mesmo erro (nao revela existencia)' `
    ($r2.Status -eq 401 -and $r2.Body.code -eq $r.Body.code) `
    "existente: $($r.Body.code) / inexistente: $($r2.Body.code)"

$login = Invoke-Api -Method POST -Path '/api/login' `
         -Body @{ username = 'apitest'; password = 'SenhaCorreta123'; hwid = $hwidA }
Assert 'Login correto devolve 200 e token' `
    ($login.Status -eq 200 -and $login.Body.token) "status: $($login.Status)"
Assert 'Token tem 64 caracteres hex' ($login.Body.token -match '^[0-9a-f]{64}$')

$token = $login.Body.token

# --- 3. entrega do catalogo -------------------------------------------------
Write-Host "`n=== 3. Entrega do catalogo ===" -ForegroundColor Cyan

$r = Invoke-Api -Method GET -Path '/api/catalog'
Assert 'Catalogo SEM token devolve 401' ($r.Status -eq 401) "status: $($r.Status)"

$r = Invoke-Api -Method GET -Path '/api/catalog' -Token ('f' * 64)
Assert 'Catalogo com token invalido devolve 401' ($r.Status -eq 401) "status: $($r.Status)"

$cat = Invoke-Api -Method GET -Path '/api/catalog' -Token $token
Assert 'Catalogo com token valido devolve 200' ($cat.Status -eq 200) "status: $($cat.Status)"
Assert 'Catalogo traz os tweaks' (@($cat.Body.catalog.tweaks).Count -gt 0) `
    "tweaks: $(@($cat.Body.catalog.tweaks).Count)"

# --- 4. ligacao a maquina (HWID) -------------------------------------------
Write-Host "`n=== 4. Ligacao a maquina ===" -ForegroundColor Cyan

$r = Invoke-Api -Method POST -Path '/api/login' `
     -Body @{ username = 'apitest'; password = 'SenhaCorreta123'; hwid = $hwidB }
Assert 'Outra maquina e recusada (403)' ($r.Status -eq 403) "status: $($r.Status)"
Assert 'Erro identifica o motivo' ($r.Body.code -eq 'hwid_mismatch') "code: $($r.Body.code)"

Invoke-Admin @('reset-hwid', 'apitest')
$r = Invoke-Api -Method POST -Path '/api/login' `
     -Body @{ username = 'apitest'; password = 'SenhaCorreta123'; hwid = $hwidB }
Assert 'Apos reset-hwid a nova maquina entra' ($r.Status -eq 200) "status: $($r.Status)"

# --- 5. suspensao -----------------------------------------------------------
Write-Host "`n=== 5. Suspensao de conta ===" -ForegroundColor Cyan
$liveToken = $r.Body.token

Invoke-Admin @('suspend', 'apitest')

$r = Invoke-Api -Method GET -Path '/api/catalog' -Token $liveToken
Assert 'Suspender invalida os tokens em uso' ($r.Status -eq 401) "status: $($r.Status)"

$r = Invoke-Api -Method POST -Path '/api/login' `
     -Body @{ username = 'apitest'; password = 'SenhaCorreta123'; hwid = $hwidB }
Assert 'Conta suspensa nao faz login (403)' ($r.Status -eq 403) "status: $($r.Status)"

Invoke-Admin @('activate', 'apitest')
$r = Invoke-Api -Method POST -Path '/api/login' `
     -Body @{ username = 'apitest'; password = 'SenhaCorreta123'; hwid = $hwidB }
Assert 'Reativar volta a permitir login' ($r.Status -eq 200) "status: $($r.Status)"

# --- 6. logout --------------------------------------------------------------
Write-Host "`n=== 6. Logout ===" -ForegroundColor Cyan
$t2 = $r.Body.token
$r = Invoke-Api -Method POST -Path '/api/logout' -Token $t2
Assert 'Logout devolve 200' ($r.Status -eq 200) "status: $($r.Status)"

$r = Invoke-Api -Method GET -Path '/api/catalog' -Token $t2
Assert 'Token revogado ja nao serve catalogo' ($r.Status -eq 401) "status: $($r.Status)"

# --- 7. forca bruta ---------------------------------------------------------
Write-Host "`n=== 7. Protecao contra forca bruta ===" -ForegroundColor Cyan
Reset-User -User 'brutetest' -Password 'SenhaCorreta123'

$statuses = @()
for ($i = 1; $i -le 7; $i++) {
    $a = Invoke-Api -Method POST -Path '/api/login' `
         -Body @{ username = 'brutetest'; password = "errada$i"; hwid = $hwidA }
    $statuses += $a.Status
}

Assert 'Primeiras tentativas devolvem 401' ($statuses[0] -eq 401 -and $statuses[1] -eq 401)
Assert 'Apos 5 falhas passa a 429 (bloqueado)' ($statuses[-1] -eq 429) `
    "sequencia: $($statuses -join ', ')"

$r = Invoke-Api -Method POST -Path '/api/login' `
     -Body @{ username = 'brutetest'; password = 'SenhaCorreta123'; hwid = $hwidA }
Assert 'Bloqueio aplica-se mesmo com a password certa' ($r.Status -eq 429) "status: $($r.Status)"

# --- 8. limpeza -------------------------------------------------------------
Invoke-Admin @('delete', 'apitest')
Invoke-Admin @('delete', 'brutetest')

Write-Host "`n=== RESUMO ===" -ForegroundColor Cyan
Write-Host ("Passou: {0}   Falhou: {1}" -f $script:NPass, $script:NFail) `
    -ForegroundColor $(if ($script:NFail -eq 0) { 'Green' } else { 'Red' })
Write-Host ''

if ($script:NFail -gt 0) { exit 1 }
