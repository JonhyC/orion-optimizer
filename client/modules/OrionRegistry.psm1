<#
    OrionRegistry - camada de acesso ao Registry com dois backends.

    Modo 'Real'  : escreve mesmo no Registry do Windows.
    Modo 'Mock'  : escreve num ficheiro JSON que finge ser o Registry.
                   Usado nos testes - nao toca no sistema.

    O resto do motor nunca fala com o Registry diretamente. So por aqui.
#>

$script:Mode      = 'Mock'
$script:MockPath  = $null
$script:MockStore = @{}

function Set-OrionRegistryMode {
    param(
        [ValidateSet('Real', 'Mock')][string]$Mode,
        [string]$MockPath
    )
    $script:Mode = $Mode
    if ($Mode -eq 'Mock') {
        $script:MockPath = $MockPath
        if ($MockPath -and (Test-Path $MockPath)) {
            $script:MockStore = ConvertTo-OrionHashtable (Get-Content $MockPath -Raw | ConvertFrom-Json)
        } else {
            $script:MockStore = @{}
        }
    }
}

function Get-OrionRegistryMode { return $script:Mode }

# ConvertFrom-Json devolve PSCustomObject em PS 5.1 (nao ha -AsHashtable).
function ConvertTo-OrionHashtable {
    param($InputObject)
    if ($null -eq $InputObject) { return $null }
    if ($InputObject -is [System.Management.Automation.PSCustomObject]) {
        $ht = @{}
        foreach ($p in $InputObject.PSObject.Properties) {
            $ht[$p.Name] = ConvertTo-OrionHashtable $p.Value
        }
        return $ht
    }
    return $InputObject
}

function Save-OrionMockStore {
    if ($script:Mode -eq 'Mock' -and $script:MockPath) {
        $dir = Split-Path $script:MockPath -Parent
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        $script:MockStore | ConvertTo-Json -Depth 20 | Out-File $script:MockPath -Encoding utf8
    }
}

function Get-OrionMockSnapshot {
    return ($script:MockStore | ConvertTo-Json -Depth 20 -Compress)
}

function Get-OrionHiveRoot {
    param([string]$Hive)
    switch ($Hive) {
        'HKCU' { return [Microsoft.Win32.Registry]::CurrentUser }
        'HKLM' { return [Microsoft.Win32.Registry]::LocalMachine }
        default { throw "Hive nao suportada: $Hive" }
    }
}

<#
    Devolve @{ Exists = $bool; Value = <valor>; Kind = <string> }.
    Exists=$false significa que o VALOR nao existia - e o caso que a
    maioria dos optimizers falha ao reverter (repoem 0 em vez de apagar).
#>
function Get-OrionRegistryValue {
    param(
        [Parameter(Mandatory)][string]$Hive,
        [Parameter(Mandatory)][string]$Key,
        [Parameter(Mandatory)][string]$Name
    )

    if ($script:Mode -eq 'Mock') {
        $full = "$Hive\$Key"
        if ($script:MockStore.ContainsKey($full) -and $script:MockStore[$full].ContainsKey($Name)) {
            $entry = $script:MockStore[$full][$Name]
            return @{ Exists = $true; Value = $entry['value']; Kind = $entry['kind'] }
        }
        return @{ Exists = $false; Value = $null; Kind = $null }
    }

    $root = Get-OrionHiveRoot $Hive
    $sub  = $root.OpenSubKey($Key, $false)
    if ($null -eq $sub) { return @{ Exists = $false; Value = $null; Kind = $null } }
    try {
        $names = $sub.GetValueNames()
        if ($names -notcontains $Name) { return @{ Exists = $false; Value = $null; Kind = $null } }
        return @{
            Exists = $true
            Value  = $sub.GetValue($Name)
            Kind   = $sub.GetValueKind($Name).ToString()
        }
    } finally { $sub.Close() }
}

function Set-OrionRegistryValue {
    param(
        [Parameter(Mandatory)][string]$Hive,
        [Parameter(Mandatory)][string]$Key,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Kind,
        [Parameter(Mandatory)]$Value
    )

    if ($script:Mode -eq 'Mock') {
        $full = "$Hive\$Key"
        if (-not $script:MockStore.ContainsKey($full)) { $script:MockStore[$full] = @{} }
        $script:MockStore[$full][$Name] = @{ kind = $Kind; value = $Value }
        Save-OrionMockStore
        return
    }

    $root = Get-OrionHiveRoot $Hive
    $sub  = $root.CreateSubKey($Key, $true)
    if ($null -eq $sub) { throw "Nao foi possivel abrir/criar $Hive\$Key" }
    try {
        $native = $Value
        if ($Kind -eq 'DWord') {
            # DWord e int32 com sinal. Valores como 0xFFFFFFFF vem do JSON
            # como 4294967295 e rebentam sem esta conversao.
            $native = [BitConverter]::ToInt32([BitConverter]::GetBytes([uint32]$Value), 0)
        }
        $sub.SetValue($Name, $native, [Microsoft.Win32.RegistryValueKind]::$Kind)
    } finally { $sub.Close() }
}

function Remove-OrionRegistryValue {
    param(
        [Parameter(Mandatory)][string]$Hive,
        [Parameter(Mandatory)][string]$Key,
        [Parameter(Mandatory)][string]$Name
    )

    if ($script:Mode -eq 'Mock') {
        $full = "$Hive\$Key"
        if ($script:MockStore.ContainsKey($full)) {
            $script:MockStore[$full].Remove($Name)
            if ($script:MockStore[$full].Count -eq 0) { $script:MockStore.Remove($full) }
            Save-OrionMockStore
        }
        return
    }

    $root = Get-OrionHiveRoot $Hive
    $sub  = $root.OpenSubKey($Key, $true)
    if ($null -eq $sub) { return }
    try { $sub.DeleteValue($Name, $false) } finally { $sub.Close() }
}

Export-ModuleMember -Function Set-OrionRegistryMode, Get-OrionRegistryMode,
    Get-OrionRegistryValue, Set-OrionRegistryValue, Remove-OrionRegistryValue,
    Get-OrionMockSnapshot, ConvertTo-OrionHashtable
