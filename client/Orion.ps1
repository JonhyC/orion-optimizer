<#
.SYNOPSIS
    Orion Optimizer - cliente com menu.

.DESCRIPTION
    Autentica-se no servidor de licencas, recebe o catalogo e aplica os
    tweaks escolhidos, com pre-visualizacao e reversao completa.

.PARAMETER Mode
    Simulate (defeito) escreve num registry falso em disco - nao toca no
    sistema. Real escreve mesmo no Registry do Windows.

    O defeito e Simulate de proposito durante o desenvolvimento. Trocar
    para Real so depois de validado numa maquina virtual.

.EXAMPLE
    .\Orion.ps1
    .\Orion.ps1 -Mode Real -Server http://localhost/orionoptimizer
#>

[CmdletBinding()]
param(
    [string]$Server = 'http://localhost:3400',
    [ValidateSet('Simulate', 'Real')][string]$Mode = 'Simulate',
    [string]$Username
)

$ErrorActionPreference = 'Stop'
$modules = Join-Path $PSScriptRoot 'modules'

# Ordem obrigatoria: Engine depende de Registry e Journal ja carregados.
Import-Module (Join-Path $modules 'OrionRegistry.psm1') -Force -Global
Import-Module (Join-Path $modules 'OrionJournal.psm1')  -Force -Global
Import-Module (Join-Path $modules 'OrionEngine.psm1')   -Force -Global
Import-Module (Join-Path $modules 'OrionApi.psm1')      -Force -Global

$dataDir     = Join-Path $env:LOCALAPPDATA 'OrionOptimizer'
$journalPath = Join-Path $dataDir 'journal.json'
$mockPath    = Join-Path $dataDir 'simulated-registry.json'

if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }

if ($Mode -eq 'Simulate') {
    Set-OrionRegistryMode -Mode Mock -MockPath $mockPath
} else {
    Set-OrionRegistryMode -Mode Real
}
Initialize-OrionJournal -Path $journalPath

$script:Session   = $null
$script:Catalog   = @()
$script:Selected  = @{}
$script:SysProfile = $null
$script:Token     = $null
$script:User      = $null

# ---------------------------------------------------------------- apresentacao

function Write-Rule { param([string]$Color = 'DarkGray')
    Write-Host ('  ' + ('-' * 66)) -ForegroundColor $Color
}

function Show-Banner {
    Clear-Host
    Write-Host ''
    Write-Host '   ___  ____  _____ ___  _   _ ' -ForegroundColor Cyan
    Write-Host '  / _ \|  _ \|_   _/ _ \| \ | |' -ForegroundColor Cyan
    Write-Host ' | | | | |_) | | || | | |  \| |' -ForegroundColor Cyan
    Write-Host ' | |_| |  _ <  | || |_| | |\  |' -ForegroundColor Cyan
    Write-Host '  \___/|_| \_\ |_| \___/|_| \_|  optimizer' -ForegroundColor Cyan
    Write-Host ''

    if ($Mode -eq 'Simulate') {
        Write-Host '  [ MODO SIMULACAO ] nada e escrito no sistema real' -ForegroundColor Black -BackgroundColor Yellow
    } else {
        Write-Host '  [ MODO REAL ] as alteracoes sao aplicadas ao Windows' -ForegroundColor White -BackgroundColor DarkRed
    }
    Write-Host ''
}

function Show-SystemInfo {
    $p = $script:SysProfile
    $admin = 'nao'
    if ($p.isAdmin) { $admin = 'sim' }

    Write-Rule
    $gpuSummary = $p.gpuVendor
    if ($p.gpuVendors -and $p.gpuVendors.Count -gt 0) { $gpuSummary = $p.gpuVendors -join ' + ' }
    $gpuTypeSummary = ''
    if ($p.gpuTypes -and $p.gpuTypes.Count -gt 0) { $gpuTypeSummary = ' (' + ($p.gpuTypes -join ' + ') + ')' }
    Write-Host ("  Sistema : {0} | {1}{2} | {3} GB RAM" -f $p.chassis, $gpuSummary, $gpuTypeSummary, $p.ramGB) -ForegroundColor Gray
    Write-Host ("  Admin   : {0}" -f $admin) -ForegroundColor Gray
    if ($script:User) {
        Write-Host ("  Conta   : {0}" -f $script:User) -ForegroundColor Gray
    }
    Write-Rule
}

# --------------------------------------------------------------------- login

function Invoke-Login {
    Show-Banner
    Write-Host '  Inicia sessao para receber o catalogo.' -ForegroundColor Gray
    Write-Host "  Servidor: $Server" -ForegroundColor DarkGray
    Write-Host ''

    for ($attempt = 1; $attempt -le 3; $attempt++) {
        if ($Username) {
            $u = $Username
            Write-Host "  Utilizador: $u" -ForegroundColor White
        } else {
            $u = Read-Host '  Utilizador'
        }
        if (-not $u) { return $false }

        $p = Read-Host '  Password' -AsSecureString
        Write-Host ''
        Write-Host '  A autenticar...' -ForegroundColor DarkGray

        $result = Connect-OrionServer -BaseUrl $Server -Username $u -Password $p

        if ($result.Ok) {
            $script:Token = $result.Token
            $script:User  = $result.Username
            Write-Host "  Sessao valida ate $($result.ExpiresAt.ToString('yyyy-MM-dd HH:mm'))." -ForegroundColor Green
            Start-Sleep -Milliseconds 700
            return $true
        }

        Write-Host "  $($result.Error)" -ForegroundColor Red
        Write-Host ''
        $Username = $null
    }

    return $false
}

function Get-Catalog {
    Write-Host '  A obter catalogo...' -ForegroundColor DarkGray
    $r = Get-OrionRemoteCatalog -BaseUrl $Server -Token $script:Token

    if (-not $r.Ok) {
        Write-Host "  $($r.Error)" -ForegroundColor Red
        return $false
    }

    $script:Catalog = @($r.Tweaks)
    Write-Host "  $($script:Catalog.Count) tweaks recebidos." -ForegroundColor Green
    Start-Sleep -Milliseconds 500
    return $true
}

# ------------------------------------------------------------------- tweaks

function Get-EligibleTweaks {
    $out = @()
    foreach ($t in $script:Catalog) {
        $e = Test-OrionEligibility -Tweak $t -SystemProfile $script:SysProfile
        $out += [pscustomobject]@{
            Tweak    = $t
            Eligible = $e.Eligible
            Reason   = $e.Reason
        }
    }
    return $out
}

function Show-TweakList {
    param([switch]$WithSelection)

    $all = Get-EligibleTweaks
    Write-Host ''

    $i = 0
    foreach ($row in $all) {
        $t = $row.Tweak
        $i++

        $mark = '   '
        if ($WithSelection -and $row.Eligible) {
            if ($script:Selected.ContainsKey($t.id)) { $mark = '[x]' } else { $mark = '[ ]' }
        }

        if (-not $row.Eligible) {
            Write-Host ("  {0,2}. {1} {2}" -f $i, $mark, $t.name) -ForegroundColor DarkGray
            Write-Host ("         bloqueado: {0}" -f $row.Reason) -ForegroundColor DarkRed
            continue
        }

        $color = 'White'
        if ($t.layer -ge 1) { $color = 'Yellow' }

        Write-Host ("  {0,2}. {1} {2}" -f $i, $mark, $t.name) -ForegroundColor $color
        Write-Host ("         {0}" -f $t.description) -ForegroundColor DarkGray

        $meta = "         camada $($t.layer) | impacto: $($t.impact) | risco: $($t.risk)"
        if ($t.requiresReboot) { $meta += ' | requer reinicio' }
        Write-Host $meta -ForegroundColor DarkGray
        Write-Host ''
    }

    return $all
}

function Select-Tweaks {
    while ($true) {
        Show-Banner
        Write-Host '  SELECIONAR TWEAKS' -ForegroundColor Cyan
        Write-Host '  Amarelo = requer administrador. Cinzento = nao aplicavel a este PC.' -ForegroundColor DarkGray

        $all = Show-TweakList -WithSelection

        Write-Rule
        Write-Host "  Selecionados: $($script:Selected.Count)" -ForegroundColor Green
        Write-Host '  Numeros para alternar (ex: 1 3 5)  |  [t] todos  |  [n] nenhum  |  [v] voltar' -ForegroundColor Gray
        $input = Read-Host '  >'

        if ($input -match '^\s*v\s*$') { return }

        if ($input -match '^\s*t\s*$') {
            foreach ($row in $all) {
                if ($row.Eligible) { $script:Selected[$row.Tweak.id] = $row.Tweak }
            }
            continue
        }

        if ($input -match '^\s*n\s*$') {
            $script:Selected = @{}
            continue
        }

        foreach ($tok in ($input -split '[\s,]+' | Where-Object { $_ })) {
            $n = 0
            if (-not [int]::TryParse($tok, [ref]$n)) { continue }
            if ($n -lt 1 -or $n -gt $all.Count) { continue }

            $row = $all[$n - 1]
            if (-not $row.Eligible) { continue }

            if ($script:Selected.ContainsKey($row.Tweak.id)) {
                $script:Selected.Remove($row.Tweak.id)
            } else {
                $script:Selected[$row.Tweak.id] = $row.Tweak
            }
        }
    }
}

function Show-Preview {
    Show-Banner
    Write-Host '  PRE-VISUALIZACAO' -ForegroundColor Cyan
    Write-Host '  Nada foi escrito. Isto e exatamente o que seria alterado.' -ForegroundColor DarkGray
    Write-Host ''

    if ($script:Selected.Count -eq 0) {
        Write-Host '  Nenhum tweak selecionado.' -ForegroundColor Yellow
        Write-Host ''
        Read-Host '  Enter para voltar' | Out-Null
        return $null
    }

    Start-OrionSession -Note 'preview' | Out-Null

    $plan = @()
    foreach ($t in $script:Selected.Values) {
        $plan += Invoke-OrionTweak -Tweak $t -DryRun
    }

    $plan | Format-Table `
        @{ L = 'Chave';  E = { $_.Path -replace '^HK(CU|LM)\\', '' }; Width = 42 },
        @{ L = 'Valor';  E = { $_.Name };   Width = 22 },
        @{ L = 'Antes';  E = { $_.Before }; Width = 14 },
        @{ L = 'Depois'; E = { $_.After };  Width = 12 } -Wrap |
        Out-String | Write-Host

    $changed = @($plan | Where-Object { $_.Changed }).Count
    Write-Rule
    Write-Host ("  {0} alteracoes, das quais {1} mudam mesmo alguma coisa." -f $plan.Count, $changed) -ForegroundColor Gray

    $reboot = @($script:Selected.Values | Where-Object { $_.requiresReboot })
    if ($reboot.Count -gt 0) {
        Write-Host "  $($reboot.Count) tweaks so produzem efeito depois de reiniciar." -ForegroundColor Yellow
    }
    Write-Rule

    return $plan
}

function New-SafetyRestorePoint {
    if ($Mode -ne 'Real') { return $true }

    Write-Host '  A criar ponto de restauro do sistema...' -ForegroundColor Gray
    try {
        Checkpoint-Computer -Description 'Orion Optimizer' -RestorePointType MODIFY_SETTINGS -ErrorAction Stop
        Write-Host '  Ponto de restauro criado.' -ForegroundColor Green
        return $true
    } catch {
        Write-Host '  Nao foi possivel criar o ponto de restauro.' -ForegroundColor Yellow
        Write-Host "  ($($_.Exception.Message))" -ForegroundColor DarkGray
        Write-Host '  O Restauro do Sistema pode estar desativado, ou falta elevacao.' -ForegroundColor DarkGray
        Write-Host ''
        $go = Read-Host '  Continuar mesmo assim? (escreve SIM)'
        return ($go -eq 'SIM')
    }
}

function Invoke-Apply {
    $plan = Show-Preview
    if ($null -eq $plan) { return }

    Write-Host ''
    if ($Mode -eq 'Real') {
        Write-Host '  Isto vai alterar o teu Windows.' -ForegroundColor Yellow
    } else {
        Write-Host '  Modo simulacao: as escritas vao para um ficheiro, nao para o Registry.' -ForegroundColor Yellow
    }

    $confirm = Read-Host '  Escreve APLICAR para confirmar (ou Enter para cancelar)'
    if ($confirm -ne 'APLICAR') {
        Write-Host '  Cancelado.' -ForegroundColor Gray
        Start-Sleep -Milliseconds 800
        return
    }

    if (-not (New-SafetyRestorePoint)) {
        Write-Host '  Cancelado.' -ForegroundColor Gray
        Start-Sleep -Milliseconds 800
        return
    }

    # Sessao nova - a do preview nao escreveu nada e nao serve para reverter.
    $sessionId = Start-OrionSession -Note "aplicacao ($Mode)"
    $script:Session = Get-OrionCurrentSession

    Write-Host ''
    foreach ($t in $script:Selected.Values) {
        Write-Host ("  aplicar  {0}" -f $t.name) -ForegroundColor DarkGray
        try {
            Invoke-OrionTweak -Tweak $t | Out-Null
        } catch {
            Write-Host ("           falhou: {0}" -f $_.Exception.Message) -ForegroundColor Red
        }
    }

    $script:Session = Get-OrionCurrentSession
    Write-Host ''
    Write-Host "  Aplicado. Sessao $($sessionId.Substring(0,8)) registada." -ForegroundColor Green
    Write-Rule
    Write-Host '  Confirma que o sistema esta a funcionar bem.' -ForegroundColor Gray
    Write-Host '  Se nao confirmares, a sessao fica marcada como pendente e o Orion' -ForegroundColor Gray
    Write-Host '  propoe reverte-la no proximo arranque.' -ForegroundColor Gray
    Write-Host ''

    $ok = Read-Host '  Esta tudo bem? (s/n)'
    if ($ok -match '^[sSyY]') {
        Complete-OrionSession
        Write-Host '  Sessao confirmada.' -ForegroundColor Green
    } else {
        Write-Host '  A reverter...' -ForegroundColor Yellow
        Invoke-OrionRollback -Session $script:Session | Out-Null
        Complete-OrionSession
        Write-Host '  Revertido.' -ForegroundColor Green
    }

    Read-Host '  Enter para continuar' | Out-Null
}

function Invoke-RollbackMenu {
    Show-Banner
    Write-Host '  REVERTER' -ForegroundColor Cyan
    Write-Host ''

    $sessions = @(Get-OrionSessions | Where-Object { $_.entries -and @($_.entries).Count -gt 0 })
    if ($sessions.Count -eq 0) {
        Write-Host '  Nao ha nada para reverter.' -ForegroundColor Gray
        Write-Host ''
        Read-Host '  Enter para voltar' | Out-Null
        return
    }

    $sessions = @($sessions | Sort-Object startedAt -Descending)

    $i = 0
    foreach ($s in $sessions) {
        $i++
        $when = [datetime]::Parse($s.startedAt).ToString('yyyy-MM-dd HH:mm')
        $tag  = ''
        if ($s.status -ne 'confirmed') { $tag = '  [PENDENTE]' }
        Write-Host ("  {0,2}. {1}  {2,3} alteracoes  {3}{4}" -f `
            $i, $when, @($s.entries).Count, $s.note, $tag) -ForegroundColor White
    }

    Write-Host ''
    Write-Rule
    $pick = Read-Host '  Numero da sessao a reverter (Enter para voltar)'
    if (-not $pick) { return }

    $n = 0
    if (-not [int]::TryParse($pick, [ref]$n) -or $n -lt 1 -or $n -gt $sessions.Count) {
        return
    }

    $target = $sessions[$n - 1]
    Write-Host ''
    Write-Host "  Vai repor $(@($target.entries).Count) valores ao estado original." -ForegroundColor Yellow
    $confirm = Read-Host '  Escreve REVERTER para confirmar'
    if ($confirm -ne 'REVERTER') { return }

    $result = Invoke-OrionRollback -Session $target
    Write-Host ''
    foreach ($r in $result) {
        Write-Host ("  {0} -> {1}" -f $r.Name, $r.Action) -ForegroundColor DarkGray
    }
    Write-Host ''
    Write-Host "  $($result.Count) valores repostos." -ForegroundColor Green
    Read-Host '  Enter para continuar' | Out-Null
}

function Test-PendingSessions {
    $pending = @(Get-OrionSessions | Where-Object {
        $_.status -ne 'confirmed' -and $_.entries -and @($_.entries).Count -gt 0
    })
    if ($pending.Count -eq 0) { return }

    Write-Host ''
    Write-Host '  Ha uma sessao anterior que nunca foi confirmada.' -ForegroundColor Yellow
    Write-Host '  Normalmente significa que o Orion foi fechado a meio ou algo correu mal.' -ForegroundColor DarkGray
    Write-Host ''
    $go = Read-Host '  Reverter agora? (s/n)'
    if ($go -notmatch '^[sSyY]') { return }

    foreach ($s in $pending) {
        Invoke-OrionRollback -Session $s | Out-Null
    }
    Write-Host '  Revertido.' -ForegroundColor Green
    Start-Sleep -Milliseconds 900
}

# ----------------------------------------------------------------- menu raiz

function Show-MainMenu {
    while ($true) {
        Show-Banner
        Show-SystemInfo
        Write-Host ''
        Write-Host "  [1]  Ver tweaks disponiveis" -ForegroundColor White
        Write-Host "  [2]  Selecionar tweaks              ($($script:Selected.Count) escolhidos)" -ForegroundColor White
        Write-Host "  [3]  Pre-visualizar alteracoes" -ForegroundColor White
        Write-Host "  [4]  Aplicar" -ForegroundColor White
        Write-Host "  [5]  Reverter uma sessao anterior" -ForegroundColor White
        Write-Host ''
        Write-Host "  [0]  Sair" -ForegroundColor DarkGray
        Write-Host ''

        switch (Read-Host '  >') {
            '1' {
                Show-Banner
                Write-Host '  TWEAKS DISPONIVEIS' -ForegroundColor Cyan
                Show-TweakList | Out-Null
                Read-Host '  Enter para voltar' | Out-Null
            }
            '2' { Select-Tweaks }
            '3' { Show-Preview | Out-Null; Read-Host '  Enter para voltar' | Out-Null }
            '4' { Invoke-Apply }
            '5' { Invoke-RollbackMenu }
            '0' { return }
        }
    }
}

# ------------------------------------------------------------------ arranque

try {
    if (-not (Invoke-Login)) {
        Write-Host ''
        Write-Host '  Sem sessao valida. A sair.' -ForegroundColor Red
        exit 1
    }

    if (-not (Get-Catalog)) { exit 1 }

    $script:SysProfile = Get-OrionSystemProfile

    if ($Mode -eq 'Real' -and -not $script:SysProfile.isAdmin) {
        Write-Host ''
        Write-Host '  Sem privilegios de administrador: so os tweaks de camada 0' -ForegroundColor Yellow
        Write-Host '  ficam disponiveis. Reabre como administrador para os restantes.' -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }

    Test-PendingSessions
    Show-MainMenu
}
finally {
    if ($script:Token) {
        Disconnect-OrionServer -BaseUrl $Server -Token $script:Token
    }
    Write-Host ''
    Write-Host '  Ate a proxima.' -ForegroundColor Cyan
    Write-Host ''
}
