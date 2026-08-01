<#
    Banco de ensaio do motor Orion.

    Corre INTEIRAMENTE em modo Mock: o "Registry" e um ficheiro JSON
    numa pasta temporaria. Nao toca no Registry real, nem em servicos,
    nem em ficheiros de sistema. Pode correr sem privilegios.
#>

param(
    [string]$WorkDir = (Join-Path $env:TEMP 'orion-testbed')
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

Import-Module (Join-Path $root 'client\modules\OrionRegistry.psm1') -Force -Global
Import-Module (Join-Path $root 'client\modules\OrionJournal.psm1')  -Force -Global
Import-Module (Join-Path $root 'client\modules\OrionEngine.psm1')   -Force -Global

$script:Pass = 0
$script:Fail = 0

function Assert {
    param([string]$Name, [bool]$Condition, [string]$Detail = '')
    if ($Condition) {
        $script:Pass++
        Write-Host ("  [OK]   " + $Name) -ForegroundColor Green
    } else {
        $script:Fail++
        Write-Host ("  [FALHA] " + $Name) -ForegroundColor Red
        if ($Detail) { Write-Host ("         " + $Detail) -ForegroundColor DarkYellow }
    }
}

# --- preparar bancada limpa -------------------------------------------------
if (Test-Path $WorkDir) { Remove-Item $WorkDir -Recurse -Force }
New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null

$mockPath    = Join-Path $WorkDir 'fake-registry.json'
$journalPath = Join-Path $WorkDir 'journal.json'
$catalogPath = Join-Path $root 'catalog\tweaks.json'

Write-Host "`n=== BANCADA ===" -ForegroundColor Cyan
Write-Host "Registry falso : $mockPath"
Write-Host "Journal        : $journalPath"
Write-Host "Modo           : Mock (nenhuma escrita no sistema real)"

# Semear um valor pre-existente. Serve para distinguir os dois casos de
# rollback: repor um valor antigo vs apagar um valor que nao existia.
$seed = @{
    'HKCU\Control Panel\Desktop' = @{
        'MenuShowDelay' = @{ kind = 'String'; value = '400' }
    }
}
$seed | ConvertTo-Json -Depth 10 | Out-File $mockPath -Encoding utf8

Set-OrionRegistryMode -Mode Mock -MockPath $mockPath
Initialize-OrionJournal -Path $journalPath

$catalog = Get-OrionCatalog -Path $catalogPath
$sysReal = Get-OrionSystemProfile

Write-Host "`n=== SISTEMA DETETADO (so leitura) ===" -ForegroundColor Cyan
Write-Host ("Admin: {0} | Chassis: {1} | GPU: {2} | RAM: {3} GB" -f `
    $sysReal.isAdmin, $sysReal.chassis, $sysReal.gpuVendor, $sysReal.ramGB)

$stateBefore = Get-OrionMockSnapshot

# --- 1. catalogo ------------------------------------------------------------
Write-Host "`n=== 1. Catalogo ===" -ForegroundColor Cyan
Assert 'Catalogo carrega' ($catalog.Count -gt 0) "tweaks: $($catalog.Count)"
Assert 'Todos os tweaks tem id, layer e actions' `
    (($catalog | Where-Object { -not $_.id -or $null -eq $_.layer -or -not $_.actions }).Count -eq 0)
Assert 'Nenhum tweak toca em servicos, Defender ou Update' `
    (($catalog | Where-Object { $_.actions.key -match 'Defender|WindowsUpdate|^SYSTEM\\CurrentControlSet\\Services' }).Count -eq 0)

# --- 2. elegibilidade -------------------------------------------------------
Write-Host "`n=== 2. Filtro de elegibilidade ===" -ForegroundColor Cyan

$asLaptopNoAdmin = @{ isAdmin = $false; chassis = 'laptop'; gpuVendor = 'NVIDIA'; ramGB = 16 }
$asDesktopAdmin  = @{ isAdmin = $true;  chassis = 'desktop'; gpuVendor = 'NVIDIA'; ramGB = 32 }

$l1 = $catalog | Where-Object { $_.id -eq 'net.throttling-index' }
Assert 'Tweak de camada 1 bloqueado sem admin' `
    (-not (Test-OrionEligibility -Tweak $l1 -SystemProfile $asLaptopNoAdmin).Eligible)
Assert 'Tweak de camada 1 permitido com admin' `
    ((Test-OrionEligibility -Tweak $l1 -SystemProfile $asDesktopAdmin).Eligible)

$park = $catalog | Where-Object { $_.id -eq 'power.high-performance-bias' }
Assert 'Tweak so-desktop bloqueado em portatil' `
    (-not (Test-OrionEligibility -Tweak $park -SystemProfile @{ isAdmin=$true; chassis='laptop'; gpuVendor='NVIDIA'; ramGB=16 }).Eligible)

$hags = $catalog | Where-Object { $_.id -eq 'gpu.hags' }
Assert 'HAGS bloqueado em GPU Intel' `
    (-not (Test-OrionEligibility -Tweak $hags -SystemProfile @{ isAdmin=$true; chassis='desktop'; gpuVendor='Intel'; ramGB=16 }).Eligible)

$integratedOnly = [pscustomobject]@{
    layer = 0
    conditions = [pscustomobject]@{ gpuType = @('integrated') }
}
$dedicatedProfile = @{ isAdmin=$true; chassis='desktop'; gpuVendor='NVIDIA'; gpuVendors=@('NVIDIA'); gpuTypes=@('dedicated'); ramGB=16 }
$hybridProfile = @{ isAdmin=$true; chassis='laptop'; gpuVendor='Intel'; gpuVendors=@('Intel','NVIDIA'); gpuTypes=@('integrated','dedicated'); ramGB=16 }
Assert 'Tweak de graficos integrados bloqueado numa GPU dedicada' `
    (-not (Test-OrionEligibility -Tweak $integratedOnly -SystemProfile $dedicatedProfile).Eligible)
Assert 'Tweak de graficos integrados permitido num portatil hibrido' `
    ((Test-OrionEligibility -Tweak $integratedOnly -SystemProfile $hybridProfile).Eligible)
Assert 'Filtro por fabricante reconhece todas as GPUs de um sistema hibrido' `
    ((Test-OrionEligibility -Tweak $hags -SystemProfile $hybridProfile).Eligible)

$layer0 = @($catalog | Where-Object { $_.layer -eq 0 })
$blocked0 = @($layer0 | Where-Object { -not (Test-OrionEligibility -Tweak $_ -SystemProfile $asLaptopNoAdmin).Eligible })
Assert 'Todos os tweaks de camada 0 correm sem admin' ($blocked0.Count -eq 0)

# --- 3. dry-run -------------------------------------------------------------
Write-Host "`n=== 3. Pre-visualizacao (dry-run) ===" -ForegroundColor Cyan
Start-OrionSession -Note 'dry-run' | Out-Null

$plan = @()
foreach ($t in $layer0) { $plan += Invoke-OrionTweak -Tweak $t -DryRun }

Assert 'Dry-run produz plano' ($plan.Count -gt 0) "linhas: $($plan.Count)"
Assert 'Dry-run NAO escreveu nada' ((Get-OrionMockSnapshot) -eq $stateBefore)
Assert 'Dry-run NAO criou entradas no journal' `
    ((Get-OrionCurrentSession).entries.Count -eq 0)

Write-Host "`nPlano (primeiras 6 linhas):" -ForegroundColor DarkGray
$plan | Select-Object -First 6 | Format-Table TweakId, Name, Before, After -AutoSize | Out-String | Write-Host

# --- 4. aplicar -------------------------------------------------------------
Write-Host "=== 4. Aplicacao real (no registry falso) ===" -ForegroundColor Cyan
$sessionId = Start-OrionSession -Note 'teste de aplicacao'

$applied = 0
foreach ($t in $layer0) {
    Invoke-OrionTweak -Tweak $t | Out-Null
    $applied++
}

$session = Get-OrionCurrentSession
Assert 'Tweaks aplicados' ($applied -eq $layer0.Count) "$applied de $($layer0.Count)"
Assert 'Journal registou todas as alteracoes' `
    ($session.entries.Count -eq ($layer0.actions.Count)) `
    "journal: $($session.entries.Count), accoes: $($layer0.actions.Count)"

$menu = Get-OrionRegistryValue -Hive 'HKCU' -Key 'Control Panel\Desktop' -Name 'MenuShowDelay'
Assert 'Valor foi mesmo alterado' ($menu.Value -eq '0') "valor: $($menu.Value)"

$dvr = Get-OrionRegistryValue -Hive 'HKCU' -Key 'System\GameConfigStore' -Name 'GameDVR_Enabled'
Assert 'Chave nova foi criada' ($dvr.Exists -and $dvr.Value -eq 0)

# --- 5. fidelidade do journal ----------------------------------------------
Write-Host "`n=== 5. Fidelidade do journal ===" -ForegroundColor Cyan

$menuEntry = $session.entries | Where-Object { $_.name -eq 'MenuShowDelay' }
Assert 'Valor pre-existente guardado como existed=true' ($menuEntry.existed -eq $true)
Assert 'Valor original correto (400)' ($menuEntry.originalValue -eq '400') "guardado: $($menuEntry.originalValue)"

$dvrEntry = $session.entries | Where-Object { $_.name -eq 'GameDVR_Enabled' }
Assert 'Valor inexistente guardado como existed=false' ($dvrEntry.existed -eq $false)

Assert 'Journal persistido em disco' (Test-Path $journalPath)
Assert 'Sessao marcada pending ate confirmacao' `
    (((Get-OrionSessions) | Where-Object { $_.sessionId -eq $sessionId }).status -eq 'pending')

# --- 6. rollback ------------------------------------------------------------
Write-Host "`n=== 6. Rollback ===" -ForegroundColor Cyan
$rolled = Invoke-OrionRollback -Session $session
Assert 'Rollback processou todas as entradas' ($rolled.Count -eq $session.entries.Count)

$menuAfter = Get-OrionRegistryValue -Hive 'HKCU' -Key 'Control Panel\Desktop' -Name 'MenuShowDelay'
Assert 'Valor pre-existente reposto em 400' ($menuAfter.Value -eq '400') "valor: $($menuAfter.Value)"

$dvrAfter = Get-OrionRegistryValue -Hive 'HKCU' -Key 'System\GameConfigStore' -Name 'GameDVR_Enabled'
Assert 'Valor criado foi APAGADO, nao posto a zero' (-not $dvrAfter.Exists) `
    "existe=$($dvrAfter.Exists) valor=$($dvrAfter.Value)"

$stateAfter = Get-OrionMockSnapshot
Assert 'Estado final identico ao inicial (byte a byte)' ($stateAfter -eq $stateBefore) `
    "antes: $stateBefore`n         depois: $stateAfter"

# --- 7. idempotencia --------------------------------------------------------
Write-Host "`n=== 7. Idempotencia ===" -ForegroundColor Cyan
Start-OrionSession -Note 'dupla aplicacao' | Out-Null
$t = $catalog | Where-Object { $_.id -eq 'ux.menu-delay' }
Invoke-OrionTweak -Tweak $t | Out-Null
Invoke-OrionTweak -Tweak $t | Out-Null
$s2 = Get-OrionCurrentSession
Assert 'Aplicar duas vezes nao corrompe o original guardado' `
    (($s2.entries | Where-Object { $_.name -eq 'MenuShowDelay' }).originalValue -eq '400')
Invoke-OrionRollback -Session $s2 | Out-Null
Assert 'Rollback apos dupla aplicacao repoe o original' `
    ((Get-OrionMockSnapshot) -eq $stateBefore)

# --- resumo -----------------------------------------------------------------
Write-Host "`n=== RESUMO ===" -ForegroundColor Cyan
Write-Host ("Passou: {0}   Falhou: {1}" -f $script:Pass, $script:Fail) `
    -ForegroundColor $(if ($script:Fail -eq 0) { 'Green' } else { 'Red' })
Write-Host "Registry real tocado: NAO. Servicos tocados: NAO.`n"

if ($script:Fail -gt 0) { exit 1 }
