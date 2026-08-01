<#
    OrionApi - comunicacao com o servidor de licencas.

    O cliente nao decide se o utilizador tem acesso. Pede o catalogo ao
    servidor; sem token valido nao recebe catalogo e nao ha nada para aplicar.
#>

# PS 5.1 negoceia TLS 1.0 por defeito, que servidores modernos recusam.
[Net.ServicePointManager]::SecurityProtocol =
    [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

<#
    Identificador estavel da maquina, para ligar a licenca a um PC.
    So leitura: MachineGuid, serie da motherboard e ID do processador.
    Nunca sai daqui em claro - o servidor so ve o SHA-256.
#>
function Get-OrionHwid {
    $parts = @()

    try {
        $crypto = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid -ErrorAction Stop
        $parts += $crypto.MachineGuid
    } catch { $parts += 'no-machineguid' }

    try {
        $bb = Get-CimInstance Win32_BaseBoard -ErrorAction Stop
        $parts += "$($bb.SerialNumber)"
    } catch { $parts += 'no-baseboard' }

    try {
        $cpu = Get-CimInstance Win32_Processor -ErrorAction Stop | Select-Object -First 1
        $parts += "$($cpu.ProcessorId)"
    } catch { $parts += 'no-cpu' }

    $raw   = ($parts -join '|')
    $sha   = [Security.Cryptography.SHA256]::Create()
    $bytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($raw))
    $sha.Dispose()

    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

<# Le o corpo JSON de uma resposta de erro. Invoke-RestMethod lanca excecao
   em 4xx/5xx e descarta o corpo, onde esta a nossa mensagem util. #>
function Read-OrionErrorBody {
    param($ErrorRecord)

    $response = $ErrorRecord.Exception.Response
    if (-not $response) { return $null }

    try {
        $stream = $response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $text   = $reader.ReadToEnd()
        $reader.Dispose()
        if ($text) { return $text | ConvertFrom-Json }
    } catch { return $null }

    return $null
}

function Connect-OrionServer {
    param(
        [Parameter(Mandatory)][string]$BaseUrl,
        [Parameter(Mandatory)][string]$Username,
        [Parameter(Mandatory)][securestring]$Password
    )

    # SecureString -> texto so o tempo necessario para montar o pedido.
    $bstr  = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

        $body = @{
            username = $Username
            password = $plain
            hwid     = Get-OrionHwid
        } | ConvertTo-Json -Compress
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    try {
        $r = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/login" `
                               -Body $body -ContentType 'application/json' -TimeoutSec 20
        return @{
            Ok        = $true
            Token     = $r.token
            ExpiresAt = [DateTimeOffset]::FromUnixTimeSeconds($r.expires_at).LocalDateTime
            Username  = $r.user.username
        }
    } catch {
        $err = Read-OrionErrorBody $_
        $msg = 'Nao foi possivel contactar o servidor.'
        if ($err -and $err.error) { $msg = $err.error }
        elseif ($_.Exception.Message)  { $msg = $_.Exception.Message }
        return @{ Ok = $false; Error = $msg }
    } finally {
        $plain = $null
        [GC]::Collect()
    }
}

function Get-OrionRemoteCatalog {
    param(
        [Parameter(Mandatory)][string]$BaseUrl,
        [Parameter(Mandatory)][string]$Token
    )

    try {
        $r = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/catalog" `
                               -Headers @{ Authorization = "Bearer $Token" } -TimeoutSec 20
        return @{ Ok = $true; Tweaks = $r.catalog.tweaks }
    } catch {
        $err = Read-OrionErrorBody $_
        $msg = 'Nao foi possivel obter o catalogo.'
        if ($err -and $err.error) { $msg = $err.error }
        return @{ Ok = $false; Error = $msg }
    }
}

function Disconnect-OrionServer {
    param(
        [Parameter(Mandatory)][string]$BaseUrl,
        [Parameter(Mandatory)][string]$Token
    )
    try {
        Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/logout" `
                          -Headers @{ Authorization = "Bearer $Token" } -TimeoutSec 10 | Out-Null
    } catch { }
}

Export-ModuleMember -Function Get-OrionHwid, Connect-OrionServer,
    Get-OrionRemoteCatalog, Disconnect-OrionServer, Read-OrionErrorBody
