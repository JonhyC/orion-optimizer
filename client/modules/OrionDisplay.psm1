<#
    OrionDisplay - ecras, resolucoes e taxas de atualizacao.

    ATENCAO, e diferente do resto do Orion: mudar modo de video NAO passa
    pelo registry, logo NAO passa pelo journal e o rollback de um clique
    nao o desfaz. Tem rede de seguranca propria, aqui dentro.

    O risco concreto: uma taxa que o monitor nao suporta deixa o ecra
    preto, e a pessoa fica sem ver nada para carregar em "reverter". Por
    isso Set-OrionDisplayMode aplica SEMPRE de forma temporaria primeiro e
    volta atras sozinho, a menos que alguem confirme dentro do prazo - o
    mesmo que o Windows faz quando se muda a resolucao.

    A enumeracao (Get-OrionDisplays) e so leitura e nao tem risco nenhum.
#>

Add-Type -ErrorAction SilentlyContinue -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class OrionDisplayNative {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct DEVMODE {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
        public short dmSpecVersion, dmDriverVersion, dmSize, dmDriverExtra;
        public int dmFields;
        public int dmPositionX, dmPositionY;
        public int dmDisplayOrientation, dmDisplayFixedOutput;
        public short dmColor, dmDuplex, dmYResolution, dmTTOption, dmCollate;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
        public short dmLogPixels;
        public int dmBitsPerPel, dmPelsWidth, dmPelsHeight, dmDisplayFlags, dmDisplayFrequency;
        public int dmICMMethod, dmICMIntent, dmMediaType, dmDitherType, dmReserved1, dmReserved2, dmPanningWidth, dmPanningHeight;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct DISPLAY_DEVICE {
        public int cb;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceString;
        public int StateFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceID;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceKey;
    }

    [DllImport("user32.dll", CharSet = CharSet.Ansi)]
    public static extern bool EnumDisplayDevices(string lpDevice, uint iDevNum, ref DISPLAY_DEVICE lpDisplayDevice, uint dwFlags);

    [DllImport("user32.dll", CharSet = CharSet.Ansi)]
    public static extern bool EnumDisplaySettings(string lpszDeviceName, int iModeNum, ref DEVMODE lpDevMode);

    [DllImport("user32.dll", CharSet = CharSet.Ansi)]
    public static extern int ChangeDisplaySettingsEx(string lpszDeviceName, ref DEVMODE lpDevMode, IntPtr hwnd, uint dwflags, IntPtr lParam);

    public const int ENUM_CURRENT_SETTINGS = -1;
    public const uint CDS_UPDATEREGISTRY = 0x01;
    public const uint CDS_TEST           = 0x02;
    public const uint CDS_FULLSCREEN     = 0x04;   // temporario: nao grava
    public const int  DISP_CHANGE_SUCCESSFUL = 0;
    public const int  DISPLAY_DEVICE_ATTACHED_TO_DESKTOP = 0x01;
    public const int  DISPLAY_DEVICE_PRIMARY_DEVICE = 0x04;

    // Resultado achatado: o PowerShell nao tem de mexer em structs.
    public class Ecra {
        public string Id, Name;
        public bool Primary;
        public int Width, Height, RefreshHz;
        public int[] ModeWidth, ModeHeight, ModeHz;
    }

    /*
     * A enumeracao acontece toda aqui e nao no PowerShell.
     * O campo cb do DISPLAY_DEVICE tem de conter o tamanho da estrutura
     * antes da chamada; quando isso e feito do lado do PowerShell, o
     * valor perde-se ao empacotar e a API devolve ERROR_INVALID_PARAMETER.
     */
    public static Ecra[] Listar() {
        var lista = new System.Collections.Generic.List<Ecra>();
        for (uint i = 0; ; i++) {
            var dev = new DISPLAY_DEVICE();
            dev.cb = Marshal.SizeOf(typeof(DISPLAY_DEVICE));
            if (!EnumDisplayDevices(null, i, ref dev, 0)) break;
            if ((dev.StateFlags & DISPLAY_DEVICE_ATTACHED_TO_DESKTOP) == 0) continue;

            var atual = new DEVMODE();
            atual.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
            if (!EnumDisplaySettings(dev.DeviceName, ENUM_CURRENT_SETTINGS, ref atual)) continue;

            var vistos = new System.Collections.Generic.HashSet<string>();
            var lw = new System.Collections.Generic.List<int>();
            var lh = new System.Collections.Generic.List<int>();
            var lz = new System.Collections.Generic.List<int>();
            for (int m = 0; ; m++) {
                var d = new DEVMODE();
                d.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
                if (!EnumDisplaySettings(dev.DeviceName, m, ref d)) break;
                if (d.dmBitsPerPel < 32) continue;
                string chave = d.dmPelsWidth + "x" + d.dmPelsHeight + "@" + d.dmDisplayFrequency;
                if (!vistos.Add(chave)) continue;
                lw.Add(d.dmPelsWidth); lh.Add(d.dmPelsHeight); lz.Add(d.dmDisplayFrequency);
            }

            lista.Add(new Ecra {
                Id = dev.DeviceName,
                Name = dev.DeviceString,
                Primary = (dev.StateFlags & DISPLAY_DEVICE_PRIMARY_DEVICE) != 0,
                Width = atual.dmPelsWidth, Height = atual.dmPelsHeight, RefreshHz = atual.dmDisplayFrequency,
                ModeWidth = lw.ToArray(), ModeHeight = lh.ToArray(), ModeHz = lz.ToArray()
            });
        }
        return lista.ToArray();
    }
}
'@

function Get-OrionDisplays {
    <# So leitura: ecras ligados, modo atual e modos disponiveis. #>
    $ecras = @()
    foreach ($e in [OrionDisplayNative]::Listar()) {
        $modos = @()
        for ($i = 0; $i -lt $e.ModeWidth.Length; $i++) {
            $modos += [pscustomobject]@{
                width = $e.ModeWidth[$i]; height = $e.ModeHeight[$i]; refreshHz = $e.ModeHz[$i]
            }
        }
        $ecras += [pscustomobject]@{
            id      = $e.Id
            name    = $e.Name
            primary = $e.Primary
            current = [pscustomobject]@{ width = $e.Width; height = $e.Height; refreshHz = $e.RefreshHz }
            modes   = @($modos | Sort-Object -Property @{E='width';D=$true}, @{E='height';D=$true}, @{E='refreshHz';D=$true})
        }
    }
    return $ecras
}

function Test-OrionDisplayMode {
    <#
        Pergunta ao Windows se o modo e aceite, SEM o aplicar. CDS_TEST
        nao toca no ecra - e a primeira defesa antes de arriscar.
    #>
    param(
        [Parameter(Mandatory)][string]$DeviceName,
        [Parameter(Mandatory)][int]$Width,
        [Parameter(Mandatory)][int]$Height,
        [Parameter(Mandatory)][int]$RefreshHz
    )
    $d = New-Object OrionDisplayNative+DEVMODE
    # [int16] e nao [short]: o PowerShell 5.1 nao conhece o alias de C#.
    $d.dmSize = [int16][Runtime.InteropServices.Marshal]::SizeOf([type]'OrionDisplayNative+DEVMODE')
    if (-not [OrionDisplayNative]::EnumDisplaySettings($DeviceName, [OrionDisplayNative]::ENUM_CURRENT_SETTINGS, [ref]$d)) {
        return @{ ok = $false; reason = 'Nao foi possivel ler o modo atual do ecra.' }
    }
    $d.dmPelsWidth = $Width
    $d.dmPelsHeight = $Height
    $d.dmDisplayFrequency = $RefreshHz
    # 0x80000 | 0x100000 | 0x400000 = campos de largura, altura e frequencia
    $d.dmFields = 0x80000 -bor 0x100000 -bor 0x400000

    $r = [OrionDisplayNative]::ChangeDisplaySettingsEx($DeviceName, [ref]$d, [IntPtr]::Zero, [OrionDisplayNative]::CDS_TEST, [IntPtr]::Zero)
    if ($r -eq [OrionDisplayNative]::DISP_CHANGE_SUCCESSFUL) { return @{ ok = $true; reason = '' } }
    return @{ ok = $false; reason = "O Windows recusou este modo (codigo $r)." }
}

Export-ModuleMember -Function Get-OrionDisplays, Test-OrionDisplayMode
