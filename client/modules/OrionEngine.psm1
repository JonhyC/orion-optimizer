<#
    OrionEngine - carrega o catalogo, filtra por hardware/permissoes,
    aplica e reverte.

    Modelo allowlist: so existe o que esta no catalogo. Nao ha caminho
    de codigo para desativar servicos nem tocar em Defender/Update.
#>

# Depende de OrionRegistry e OrionJournal, que TEM de ser importados antes
# deste modulo (ver Orion.ps1 / tests). Nao os importamos aqui de proposito:
# um Import-Module aninhado criaria uma segunda instancia do modulo, com
# estado ($script:Mode, $script:Session) separado do resto do programa.

function Get-OrionCatalog {
    param([Parameter(Mandatory)][string]$Path)
    $cat = Get-Content $Path -Raw | ConvertFrom-Json
    return $cat.tweaks
}

function Get-OrionSystemProfile {
    $profile = @{
        isAdmin   = $false
        chassis   = 'desktop'
        gpuVendor = 'unknown'
        gpuVendors = @()
        gpuTypes   = @()
        gpuNames   = @()
        ramGB     = 0
    }

    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $pr = New-Object Security.Principal.WindowsPrincipal($id)
    $profile.isAdmin = $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

    # Se existe bateria, e portatil. Mais fiavel que ChassisTypes.
    $battery = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue
    if ($battery) { $profile.chassis = 'laptop' }

    $gpus = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)
    foreach ($gpu in $gpus) {
        $name = [string]$gpu.Name
        if (-not $name) { continue }

        $profile.gpuNames += $name
        $vendor = 'unknown'
        if     ($name -match 'NVIDIA')       { $vendor = 'NVIDIA' }
        elseif ($name -match 'AMD|Radeon')   { $vendor = 'AMD' }
        elseif ($name -match 'Intel')        { $vendor = 'Intel' }
        if ($vendor -ne 'unknown' -and $profile.gpuVendors -notcontains $vendor) {
            $profile.gpuVendors += $vendor
        }

        $type = 'unknown'
        if ($vendor -eq 'NVIDIA') {
            $type = 'dedicated'
        } elseif ($vendor -eq 'Intel') {
            # Arc A/B com numero de modelo e dedicada; Arc sem esse modelo
            # inclui a grafica integrada dos processadores Core Ultra.
            $type = if ($name -match 'Arc.*\b[AB]\d{3}\b') { 'dedicated' } else { 'integrated' }
        } elseif ($vendor -eq 'AMD') {
            $integratedAmd = $name -match 'Radeon\(TM\) Graphics|Radeon Graphics|Vega \d+ Graphics|\b(660M|680M|760M|780M|8060S)\b'
            $type = if ($integratedAmd) { 'integrated' } else { 'dedicated' }
        }
        if ($type -ne 'unknown' -and $profile.gpuTypes -notcontains $type) {
            $profile.gpuTypes += $type
        }
    }
    if ($profile.gpuVendors.Count -gt 0) { $profile.gpuVendor = $profile.gpuVendors[0] }

    $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    if ($cs) { $profile.ramGB = [math]::Round($cs.TotalPhysicalMemory / 1GB, 0) }

    return $profile
}

<# Devolve @{ Eligible = $bool; Reason = <string> } #>
function Test-OrionEligibility {
    param(
        [Parameter(Mandatory)]$Tweak,
        [Parameter(Mandatory)][hashtable]$SystemProfile
    )

    if ($Tweak.layer -ge 1 -and -not $SystemProfile.isAdmin) {
        return @{ Eligible = $false; Reason = 'requer privilegios de administrador' }
    }

    $c = $Tweak.conditions
    if ($c) {
        if ($c.PSObject.Properties.Name -contains 'chassis' -and $c.chassis) {
            if ($c.chassis -notcontains $SystemProfile.chassis) {
                return @{ Eligible = $false; Reason = "nao aplicavel a $($SystemProfile.chassis)" }
            }
        }
        if ($c.PSObject.Properties.Name -contains 'gpuVendor' -and $c.gpuVendor) {
            $systemVendors = @($SystemProfile.gpuVendors)
            if ($systemVendors.Count -eq 0 -and $SystemProfile.gpuVendor) {
                $systemVendors = @($SystemProfile.gpuVendor)
            }
            if (@($c.gpuVendor | Where-Object { $systemVendors -contains $_ }).Count -eq 0) {
                return @{ Eligible = $false; Reason = "fabricante da GPU nao suportado por este tweak" }
            }
        }
        if ($c.PSObject.Properties.Name -contains 'gpuType' -and $c.gpuType) {
            $systemTypes = @($SystemProfile.gpuTypes)
            if (@($c.gpuType | Where-Object { $systemTypes -contains $_ }).Count -eq 0) {
                return @{ Eligible = $false; Reason = "tipo de GPU nao suportado por este tweak" }
            }
        }
    }

    return @{ Eligible = $true; Reason = '' }
}

<#
    Aplica um tweak. Com -DryRun nao escreve nada e nao regista journal:
    devolve so o plano de alteracoes para pre-visualizacao.
#>
function Invoke-OrionTweak {
    param(
        [Parameter(Mandatory)]$Tweak,
        [switch]$DryRun
    )

    $plan = @()

    foreach ($a in $Tweak.actions) {
        $current = Get-OrionRegistryValue -Hive $a.hive -Key $a.key -Name $a.name

        $before = '(nao existe)'
        if ($current.Exists) { $before = "$($current.Value)" }

        $plan += [pscustomobject]@{
            TweakId = $Tweak.id
            Path    = "$($a.hive)\$($a.key)"
            Name    = $a.name
            Before  = $before
            After   = "$($a.value)"
            Changed = -not ($current.Exists -and "$($current.Value)" -eq "$($a.value)")
        }

        if ($DryRun) { continue }

        # Journal PRIMEIRO, escrita depois. Nunca ao contrario.
        Save-OrionOriginal -TweakId $Tweak.id -Hive $a.hive -Key $a.key -Name $a.name -Original $current
        Set-OrionRegistryValue -Hive $a.hive -Key $a.key -Name $a.name -Kind $a.kind -Value $a.value
    }

    return $plan
}

<#
    Reverte uma sessao. Percorre as entradas ao contrario para desfazer
    pela ordem inversa da aplicacao.
#>
function Invoke-OrionRollback {
    param([Parameter(Mandatory)]$Session)

    $result = @()
    $entries = @($Session.entries)
    [array]::Reverse($entries)

    foreach ($e in $entries) {
        if ($e.existed) {
            Set-OrionRegistryValue -Hive $e.hive -Key $e.key -Name $e.name `
                                   -Kind $e.originalKind -Value $e.originalValue
            $action = "reposto para $($e.originalValue)"
        } else {
            # Nao existia antes -> tem de ser APAGADO, nao posto a zero.
            Remove-OrionRegistryValue -Hive $e.hive -Key $e.key -Name $e.name
            $action = 'valor removido (nao existia antes)'
        }

        $result += [pscustomobject]@{
            TweakId = $e.tweakId
            Path    = "$($e.hive)\$($e.key)"
            Name    = $e.name
            Action  = $action
        }
    }

    return $result
}

Export-ModuleMember -Function Get-OrionCatalog, Get-OrionSystemProfile,
    Test-OrionEligibility, Invoke-OrionTweak, Invoke-OrionRollback
