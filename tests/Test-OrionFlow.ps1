<#
    Fluxo completo cliente <-> servidor, sem interface.

    Exercita o que o menu faz por baixo (login, catalogo, elegibilidade,
    pre-visualizacao, aplicacao, rollback) chamando as funcoes diretamente.
    Nao limpa o ecra nem espera input.

    Registry em modo Mock: nada e escrito no sistema.
#>

param(
    [string]$BaseUrl = 'http://127.0.0.1:3400',
    [string]$User    = 'flowtest',
    [string]$Pass    = 'FlowPass123',
    [string]$WorkDir = (Join-Path $env:TEMP 'orion-flowtest')
)

$ErrorActionPreference = 'Continue'
$root    = Split-Path $PSScriptRoot -Parent
$modules = Join-Path $root 'client\modules'

Import-Module (Join-Path $modules 'OrionRegistry.psm1') -Force -Global
Import-Module (Join-Path $modules 'OrionJournal.psm1')  -Force -Global
Import-Module (Join-Path $modules 'OrionEngine.psm1')   -Force -Global
Import-Module (Join-Path $modules 'OrionApi.psm1')      -Force -Global

# Nao chamar estes contadores $Pass/$Fail: colidiriam com o parametro -Pass,
# que e a mesma variavel no ambito do script (e tipada [string], portanto
# $script:Pass = 0 guardaria "0" e destruiria a password).
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

if (Test-Path $WorkDir) { Remove-Item $WorkDir -Recurse -Force }
New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null

Set-OrionRegistryMode -Mode Mock -MockPath (Join-Path $WorkDir 'fake-registry.json')
Initialize-OrionJournal -Path (Join-Path $WorkDir 'journal.json')

Write-Host "`n=== 1. Identificacao da maquina ===" -ForegroundColor Cyan
$hwid = Get-OrionHwid
Assert 'HWID gerado' ($hwid -match '^[0-9a-f]{64}$') "hwid: $hwid"
Assert 'HWID e estavel entre chamadas' ($hwid -eq (Get-OrionHwid))

Write-Host "`n=== 2. Login ===" -ForegroundColor Cyan
$sec = ConvertTo-SecureString $Pass -AsPlainText -Force

$bad = Connect-OrionServer -BaseUrl $BaseUrl -Username $User -Password (ConvertTo-SecureString 'errada' -AsPlainText -Force)
Assert 'Password errada rejeitada com mensagem util' `
    ((-not $bad.Ok) -and $bad.Error) "erro: $($bad.Error)"

$conn = Connect-OrionServer -BaseUrl $BaseUrl -Username $User -Password $sec
Assert 'Login valido' ($conn.Ok) "erro: $($conn.Error)"
if (-not $conn.Ok) {
    Write-Host "`n  Sem sessao - o resto do fluxo nao pode correr." -ForegroundColor Red
    exit 1
}
Assert 'Validade da sessao no futuro' ($conn.ExpiresAt -gt (Get-Date))

Write-Host "`n=== 3. Catalogo servido pelo servidor ===" -ForegroundColor Cyan
$cat = Get-OrionRemoteCatalog -BaseUrl $BaseUrl -Token $conn.Token
Assert 'Catalogo recebido' ($cat.Ok) "erro: $($cat.Error)"
$tweaks = @($cat.Tweaks)
Assert 'Catalogo tem tweaks' ($tweaks.Count -gt 0) "tweaks: $($tweaks.Count)"

$bogus = Get-OrionRemoteCatalog -BaseUrl $BaseUrl -Token ('0' * 64)
Assert 'Token forjado nao recebe catalogo' (-not $bogus.Ok)

Write-Host "`n=== 4. Elegibilidade neste PC ===" -ForegroundColor Cyan
$sys = Get-OrionSystemProfile
Write-Host ("  chassis={0} gpu={1} ram={2}GB admin={3}" -f $sys.chassis, $sys.gpuVendor, $sys.ramGB, $sys.isAdmin) -ForegroundColor DarkGray

$eligible = @($tweaks | Where-Object { (Test-OrionEligibility -Tweak $_ -SystemProfile $sys).Eligible })
$blocked  = @($tweaks | Where-Object { -not (Test-OrionEligibility -Tweak $_ -SystemProfile $sys).Eligible })
Assert 'Ha tweaks elegiveis' ($eligible.Count -gt 0) "elegiveis: $($eligible.Count)"
Write-Host ("  elegiveis: {0} | bloqueados: {1}" -f $eligible.Count, $blocked.Count) -ForegroundColor DarkGray

Write-Host "`n=== 5. Pre-visualizacao ===" -ForegroundColor Cyan
$before = Get-OrionMockSnapshot
Start-OrionSession -Note 'flow preview' | Out-Null
$plan = @()
foreach ($t in $eligible) { $plan += Invoke-OrionTweak -Tweak $t -DryRun }
Assert 'Plano gerado' ($plan.Count -gt 0) "linhas: $($plan.Count)"
Assert 'Pre-visualizacao nao escreveu nada' ((Get-OrionMockSnapshot) -eq $before)

Write-Host "`n=== 6. Aplicacao (registry falso) ===" -ForegroundColor Cyan
Start-OrionSession -Note 'flow apply' | Out-Null
foreach ($t in $eligible) { Invoke-OrionTweak -Tweak $t | Out-Null }
$session = Get-OrionCurrentSession
Assert 'Estado mudou' ((Get-OrionMockSnapshot) -ne $before)
Assert 'Journal cobre todas as accoes' `
    ($session.entries.Count -eq ($eligible.actions.Count)) `
    "journal: $($session.entries.Count) / accoes: $($eligible.actions.Count)"

Write-Host "`n=== 7. Rollback ===" -ForegroundColor Cyan
Invoke-OrionRollback -Session $session | Out-Null
Assert 'Estado reposto exatamente' ((Get-OrionMockSnapshot) -eq $before) `
    "antes: $before`n         depois: $(Get-OrionMockSnapshot)"

Write-Host "`n=== 8. Logout ===" -ForegroundColor Cyan
Disconnect-OrionServer -BaseUrl $BaseUrl -Token $conn.Token
$after = Get-OrionRemoteCatalog -BaseUrl $BaseUrl -Token $conn.Token
Assert 'Apos logout o token deixa de servir catalogo' (-not $after.Ok)

Write-Host "`n=== RESUMO ===" -ForegroundColor Cyan
Write-Host ("Passou: {0}   Falhou: {1}" -f $script:NPass, $script:NFail) `
    -ForegroundColor $(if ($script:NFail -eq 0) { 'Green' } else { 'Red' })
Write-Host "Registry real tocado: NAO.`n"

if ($script:NFail -gt 0) { exit 1 }
