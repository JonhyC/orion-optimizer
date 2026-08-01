<#
    OrionJournal - registo transacional do estado ANTES de cada alteracao.

    Regra de ouro: nada e escrito sem que o valor original esteja
    persistido em disco primeiro. Se o processo morrer a meio, o journal
    no disco chega para reverter tudo na proxima execucao.
#>

$script:JournalPath = $null
$script:Session     = $null

function Initialize-OrionJournal {
    param([Parameter(Mandatory)][string]$Path)
    $script:JournalPath = $Path
    $dir = Split-Path $Path -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
}

function Start-OrionSession {
    param([string]$Note = '')
    $script:Session = [ordered]@{
        sessionId = [guid]::NewGuid().ToString()
        startedAt = (Get-Date).ToString('o')
        note      = $Note
        status    = 'pending'   # pending -> confirmed (watchdog reverte 'pending' orfaos)
        entries   = @()
    }
    return $script:Session.sessionId
}

<# Guarda o estado original de um valor. Idempotente: se o mesmo valor ja
   foi registado nesta sessao, nao sobrescreve (senao o segundo registo
   guardaria o valor JA alterado e o rollback ficaria errado). #>
function Save-OrionOriginal {
    param(
        [Parameter(Mandatory)][string]$TweakId,
        [Parameter(Mandatory)][string]$Hive,
        [Parameter(Mandatory)][string]$Key,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][hashtable]$Original
    )

    if ($null -eq $script:Session) { throw 'Nenhuma sessao de journal iniciada.' }

    foreach ($e in $script:Session.entries) {
        if ($e.hive -eq $Hive -and $e.key -eq $Key -and $e.name -eq $Name) { return }
    }

    $script:Session.entries += [ordered]@{
        tweakId       = $TweakId
        hive          = $Hive
        key           = $Key
        name          = $Name
        existed       = $Original.Exists
        originalValue = $Original.Value
        originalKind  = $Original.Kind
        recordedAt    = (Get-Date).ToString('o')
    }

    Write-OrionJournal
}

function Write-OrionJournal {
    if (-not $script:JournalPath -or $null -eq $script:Session) { return }

    $all = @(Get-OrionSessions)

    # O -and $_.sessionId descarta lixo: sem ele, qualquer objeto malformado
    # no ficheiro passava o filtro ($null -ne <guid>) e acumulava-se.
    $all = @($all | Where-Object { $_.sessionId -and $_.sessionId -ne $script:Session.sessionId })
    $all += [pscustomobject]$script:Session

    # -InputObject e obrigatorio. Em PS 5.1, ",$all | ConvertTo-Json" embrulha
    # o array num objeto {"value":[...],"Count":n} em vez de o serializar.
    ConvertTo-Json -InputObject $all -Depth 20 | Out-File $script:JournalPath -Encoding utf8
}

function Complete-OrionSession {
    if ($null -eq $script:Session) { return }
    $script:Session.status = 'confirmed'
    Write-OrionJournal
}

function Get-OrionSessions {
    if (-not $script:JournalPath -or -not (Test-Path $script:JournalPath)) { return @() }
    $raw = Get-Content $script:JournalPath -Raw
    if (-not $raw.Trim()) { return @() }
    # Atribuir primeiro evita que o pipeline do PS 5.1 trate o array JSON como
    # um unico objeto enumeravel e crie um array dentro de outro array.
    $parsed = ConvertFrom-Json -InputObject $raw
    $sessions = @()
    foreach ($item in @($parsed)) {
        if ($item.sessionId) { $sessions += $item }
    }
    return $sessions
}

function Get-OrionCurrentSession { return $script:Session }

function Set-OrionSessionStatus {
    param(
        [Parameter(Mandatory)][string]$SessionId,
        [Parameter(Mandatory)][ValidateSet('pending', 'confirmed', 'rolled_back')][string]$Status
    )
    $all = @(Get-OrionSessions)
    $found = $false
    foreach ($session in $all) {
        if ($session.sessionId -eq $SessionId) {
            $session.status = $Status
            $found = $true
        }
    }
    if ($found) {
        ConvertTo-Json -InputObject $all -Depth 20 | Out-File $script:JournalPath -Encoding utf8
    }
}

Export-ModuleMember -Function Initialize-OrionJournal, Start-OrionSession,
    Save-OrionOriginal, Complete-OrionSession, Get-OrionSessions,
    Get-OrionCurrentSession, Write-OrionJournal, Set-OrionSessionStatus
