param(
    [string]$InstallerPath = '',
    [Parameter(Mandatory)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$scriptDirectory = Split-Path -Parent $PSCommandPath
if (-not $InstallerPath) { $InstallerPath = Join-Path $scriptDirectory '..\release\Orion Optimizer Setup 1.1.5.exe' }

function Protect-Resource([string]$Value) {
    if ($Value -match '^webfile:') { return ($Value -replace '\?.*$', '?<redacted>') }
    return $Value
}

function Get-InstallerEvidence([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        return @{ exists = $false; status = 'missing_or_quarantined'; signature = $null; sha256 = $null }
    }
    try {
        $signature = Get-AuthenticodeSignature -FilePath $Path -ErrorAction Stop
        $hash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()
        return @{
            exists = $true
            status = 'available'
            signature = @{
                status = [string]$signature.Status
                statusMessage = [string]$signature.StatusMessage
                subject = [string]$signature.SignerCertificate.Subject
                thumbprint = [string]$signature.SignerCertificate.Thumbprint
            }
            sha256 = $hash
        }
    } catch {
        return @{ exists = $true; status = 'blocked_by_antivirus'; signature = $null; sha256 = $null; error = $_.Exception.Message }
    }
}

$resolvedInstaller = Resolve-Path -LiteralPath $InstallerPath -ErrorAction SilentlyContinue
$installer = Get-InstallerEvidence $(if ($resolvedInstaller) { $resolvedInstaller.Path } else { $InstallerPath })
$needle = [IO.Path]::GetFileName($InstallerPath)
$detections = @()
try {
    $detections = @(Get-MpThreatDetection -ErrorAction Stop |
        Where-Object { $_.Resources -join "`n" -match [regex]::Escape($needle) } |
        ForEach-Object {
            @{
                threatName = [string]$_.ThreatName
                actionSuccess = [bool]$_.ActionSuccess
                threatStatus = [int]$_.ThreatStatusID
                initialDetectionTime = $_.InitialDetectionTime.ToUniversalTime().ToString('o')
                lastStatusChangeTime = $_.LastThreatStatusChangeTime.ToUniversalTime().ToString('o')
                resources = @($_.Resources | ForEach-Object { Protect-Resource ([string]$_) })
            }
        })
} catch {
    $detections = @(@{ error = "Defender history unavailable: $($_.Exception.Message)" })
}

$threats = @()
try {
    $threats = @(Get-MpThreat -ErrorAction Stop | ForEach-Object {
        @{
            threatName = [string]$_.ThreatName
            severity = [int]$_.SeverityID
            category = [int]$_.CategoryID
            executed = [bool]$_.DidThreatExecute
        }
    })
} catch {
    $threats = @(@{ error = "Defender threat catalogue unavailable: $($_.Exception.Message)" })
}

$package = Get-Content -LiteralPath (Join-Path $scriptDirectory '..\package.json') -Raw | ConvertFrom-Json
$gitCommit = (& git -C (Join-Path $scriptDirectory '..\..') rev-parse HEAD 2>$null).Trim()
$report = @{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    product = 'Orion Optimizer'
    version = [string]$package.version
    gitCommit = $gitCommit
    installer = $installer
    defender = @{ detections = $detections; threats = $threats }
    conclusion = 'This report records local evidence only. A Defender false-positive determination requires Microsoft analysis.'
}

$directory = Split-Path -Parent $OutputPath
if ($directory -and -not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
$report | ConvertTo-Json -Depth 10 | Out-File -LiteralPath $OutputPath -Encoding utf8
