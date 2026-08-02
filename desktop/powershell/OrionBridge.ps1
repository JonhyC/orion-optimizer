param(
    [Parameter(Mandatory)][ValidateSet('profile','eligibility','preview','apply','sessions','rollback','games','performance','displays')][string]$Command,
    [Parameter(Mandatory)][string]$PayloadPath,
    [Parameter(Mandatory)][string]$ResultPath,
    [Parameter(Mandatory)][string]$ModulesPath
)

$ErrorActionPreference = 'Stop'

function Write-Result {
    param([bool]$Ok, $Data, [string]$ErrorMessage = '')
    $result = if ($Ok) {
        @{ ok = $true; data = $Data }
    } else {
        @{ ok = $false; error = $ErrorMessage }
    }
    $result | ConvertTo-Json -Depth 30 | Out-File -LiteralPath $ResultPath -Encoding utf8
}

try {
    Import-Module (Join-Path $ModulesPath 'OrionRegistry.psm1') -Force -Global
    Import-Module (Join-Path $ModulesPath 'OrionJournal.psm1') -Force -Global
    Import-Module (Join-Path $ModulesPath 'OrionEngine.psm1') -Force -Global
    Import-Module (Join-Path $ModulesPath 'OrionApi.psm1') -Force -Global
    # Jogos, desempenho e ecras sao so de leitura e nao dependem do motor
    # de tweaks. Se algum faltar, o resto do bridge continua a funcionar.
    foreach ($opcional in @('OrionGames.psm1', 'OrionPerf.psm1', 'OrionDisplay.psm1')) {
        $caminho = Join-Path $ModulesPath $opcional
        if (Test-Path -LiteralPath $caminho) { Import-Module $caminho -Force -Global }
    }

    $payload = Get-Content -LiteralPath $PayloadPath -Raw | ConvertFrom-Json
    $dataDir = if ($payload.dataDir) { [string]$payload.dataDir } else { Join-Path $env:LOCALAPPDATA 'OrionOptimizer' }
    $journalPath = Join-Path $dataDir 'journal.json'
    $mockPath = Join-Path $dataDir 'desktop-simulated-registry.json'
    if (-not (Test-Path -LiteralPath $dataDir)) {
        New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    }
    Initialize-OrionJournal -Path $journalPath

    switch ($Command) {
        'profile' {
            $profile = Get-OrionSystemProfile
            $profile.hwid = Get-OrionHwid
            Write-Result $true $profile
        }
        'eligibility' {
            $profile = @{}
            foreach ($property in $payload.profile.PSObject.Properties) {
                $profile[$property.Name] = $property.Value
            }
            $result = @{}
            foreach ($tweak in @($payload.tweaks)) {
                $check = Test-OrionEligibility -Tweak $tweak -SystemProfile $profile
                $result[$tweak.id] = @{ eligible = $check.Eligible; reason = $check.Reason }
            }
            Write-Result $true $result
        }
        'preview' {
            Set-OrionRegistryMode -Mode $(if ($payload.mode -eq 'Real') { 'Real' } else { 'Mock' }) -MockPath $mockPath
            Start-OrionSession -Note "desktop-preview:$($payload.tweak.id)" | Out-Null
            $plan = @(Invoke-OrionTweak -Tweak $payload.tweak -DryRun)
            Write-Result $true $plan
        }
        'apply' {
            Set-OrionRegistryMode -Mode $(if ($payload.mode -eq 'Real') { 'Real' } else { 'Mock' }) -MockPath $mockPath
            $sessionId = Start-OrionSession -Note "desktop:$($payload.tweak.id)"
            $plan = @(Invoke-OrionTweak -Tweak $payload.tweak)
            Complete-OrionSession
            Write-Result $true @{ sessionId = $sessionId; changes = $plan }
        }
        'sessions' {
            $sessions = @(Get-OrionSessions | Sort-Object startedAt -Descending)
            # O embrulho impede o PowerShell 5.1 de transformar uma lista com
            # uma unica sessao num objeto solto durante ConvertTo-Json.
            Write-Result $true @{ items = $sessions }
        }
        'games' {
            # So leitura: nao passa pelo journal porque nao ha nada para
            # reverter. Nunca precisa de elevacao.
            Write-Result $true (Get-OrionGames)
        }
        'performance' {
            Write-Result $true (Get-OrionPerformance)
        }
        'displays' {
            Write-Result $true @{ items = @(Get-OrionDisplays) }
        }
        'rollback' {
            Set-OrionRegistryMode -Mode $(if ($payload.mode -eq 'Real') { 'Real' } else { 'Mock' }) -MockPath $mockPath
            $changes = @(Invoke-OrionRollback -Session $payload.session)
            Set-OrionSessionStatus -SessionId $payload.session.sessionId -Status 'rolled_back'
            Write-Result $true $changes
        }
    }
} catch {
    Write-Result $false $null $_.Exception.Message
}
