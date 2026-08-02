$ErrorActionPreference = 'Stop'
$desktop = Split-Path $PSScriptRoot -Parent
$root = Split-Path $desktop -Parent
$bridge = Join-Path $desktop 'powershell\OrionBridge.ps1'
$modules = Join-Path $root 'client\modules'
$catalog = Get-Content (Join-Path $root 'catalog\tweaks.json') -Raw | ConvertFrom-Json
$work = Join-Path $env:TEMP 'orion-desktop-bridge-test'

if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Path $work | Out-Null

function Invoke-BridgeTest {
    param([string]$Command, $Payload)
    $inputPath = Join-Path $work "$Command.input.json"
    $outputPath = Join-Path $work "$Command.output.json"
    $Payload | Add-Member -NotePropertyName dataDir -NotePropertyValue $work -Force
    $Payload | Add-Member -NotePropertyName mode -NotePropertyValue 'Mock' -Force
    $Payload | ConvertTo-Json -Depth 30 | Out-File $inputPath -Encoding utf8
    & powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File $bridge `
        -Command $Command -PayloadPath $inputPath -ResultPath $outputPath -ModulesPath $modules
    $result = Get-Content $outputPath -Raw | ConvertFrom-Json
    if (-not $result.ok) { throw $result.error }
    return $result.data
}

try {
    $profile = Invoke-BridgeTest profile ([pscustomobject]@{})
    if (-not $profile.hwid) { throw 'Perfil sem HWID.' }

    $eligibility = Invoke-BridgeTest eligibility ([pscustomobject]@{
        tweaks = $catalog.tweaks
        profile = $profile
    })
    if (-not $eligibility.'ux.menu-delay'.eligible) { throw 'Tweak base devia ser compativel.' }

    $tweak = $catalog.tweaks | Where-Object id -eq 'ux.menu-delay'
    $preview = @(Invoke-BridgeTest preview ([pscustomobject]@{ tweak = $tweak }))
    if ($preview.Count -ne 1) { throw 'Preview devia devolver uma alteracao.' }

    $applied = Invoke-BridgeTest apply ([pscustomobject]@{ tweak = $tweak })
    if (-not $applied.sessionId) { throw 'Aplicacao sem sessionId.' }

    $sessionData = Invoke-BridgeTest sessions ([pscustomobject]@{})
    $sessions = if ($sessionData.items.value) { @($sessionData.items.value) } else { @($sessionData.items) }
    $session = $sessions | Where-Object sessionId -eq $applied.sessionId
    if (-not $session -or $session.status -ne 'confirmed') {
        throw "Sessao nao foi confirmada: $($sessions | ConvertTo-Json -Depth 8 -Compress)"
    }

    [void](Invoke-BridgeTest rollback ([pscustomobject]@{ session = $session }))
    $afterData = Invoke-BridgeTest sessions ([pscustomobject]@{})
    $afterItems = if ($afterData.items.value) { @($afterData.items.value) } else { @($afterData.items) }
    $after = $afterItems | Where-Object sessionId -eq $applied.sessionId
    if ($after.status -ne 'rolled_back') { throw 'Rollback nao ficou persistido.' }

    Write-Host 'Desktop bridge: profile, eligibility, preview, apply e rollback OK'
} finally {
    if (Test-Path $work) { Remove-Item $work -Recurse -Force }
}
