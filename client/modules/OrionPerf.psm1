<#
    OrionPerf - leitura de desempenho do sistema.

    SO LEITURA, como o OrionGames. Nao escreve nada e nao precisa de
    elevacao.

    Usa contadores de desempenho (Get-Counter) e nao WMI para o que WMI
    nao sabe responder. O uso de GPU e o exemplo: o Win32_VideoController
    diz o modelo e a memoria, mas nao tem utilizacao nenhuma - o Gestor de
    Tarefas tira-a de \GPU Engine(*)\Utilization Percentage, que e o que
    se usa aqui.

    Os nomes dos contadores sao LOCALIZADOS no Windows: num sistema em
    portugues chamam-se "\Processador(_Total)\...". Por isso resolvem-se
    pelo indice numerico, que e igual em todos os idiomas.
#>

# Indices dos contadores. Sao estaveis entre versoes do Windows e, ao
# contrario dos nomes, nao mudam com o idioma do sistema.
$script:Indices = @{
    Processador   = 238   # Processor Information
    Memoria       = 4     # Memory
    DiscoFisico   = 234   # PhysicalDisk
    InterfaceRede = 510   # Network Interface
}

$script:CacheNomes = @{}

function Get-OrionCounterName {
    <#
        Traduz um indice de contador para o nome localizado.

        Le de Perflib\CurrentLanguage e nao de Perflib\009. O 009 tem os
        nomes ingleses, mas e OPCIONAL: em Windows instalados noutro
        idioma pode simplesmente nao existir - foi o que aconteceu na
        maquina onde isto foi escrito. O CurrentLanguage existe sempre,
        porque e o que o proprio sistema usa.

        A lista alterna indice, nome, indice, nome. O resultado fica em
        cache: sao milhares de entradas e os nomes nao mudam enquanto o
        sistema esta a correr.
    #>
    param([Parameter(Mandatory)][int]$Index)

    if ($script:CacheNomes.Count -eq 0) {
        foreach ($caminho in @(
            'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Perflib\CurrentLanguage',
            'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Perflib\009'
        )) {
            try {
                $lista = (Get-ItemProperty -Path $caminho -Name 'Counter' -ErrorAction Stop).Counter
                if (-not $lista) { continue }
                for ($i = 0; $i -lt $lista.Length - 1; $i += 2) {
                    $chave = $lista[$i]
                    if (-not $script:CacheNomes.ContainsKey($chave)) {
                        $script:CacheNomes[$chave] = $lista[$i + 1]
                    }
                }
                break
            } catch { }
        }
    }

    $k = "$Index"
    if ($script:CacheNomes.ContainsKey($k)) { return $script:CacheNomes[$k] }
    return $null
}

$script:CacheConjuntos = $null

function Get-OrionCounterSet {
    <#
        Encontra o nome localizado de um conjunto de contadores.

        O registo do Perflib nem sempre esta disponivel - nesta maquina
        nem o CurrentLanguage nem o 009 responderam. Aqui pergunta-se ao
        proprio PowerShell que conjuntos existem e escolhe-se pelo padrao,
        o que funciona em qualquer idioma desde que o padrao o preveja.

        Devolve $null quando nao encontra: quem chama mostra a metrica
        como indisponivel em vez de rebentar.
    #>
    param([Parameter(Mandatory)][string]$Padrao)

    if ($null -eq $script:CacheConjuntos) {
        try {
            $script:CacheConjuntos = @(Get-Counter -ListSet * -ErrorAction Stop |
                Select-Object -ExpandProperty CounterSetName)
        } catch {
            $script:CacheConjuntos = @()
        }
    }
    return ($script:CacheConjuntos | Where-Object { $_ -match $Padrao } | Select-Object -First 1)
}

# Padroes por metrica. Cobrem ingles e as localizacoes latinas mais
# provaveis; o -match e sem distincao de maiusculas.
$script:Padroes = @{
    DiscoFisico   = '^(PhysicalDisk|Disco f.sico|Disque physique|Disco fisico)$'
    InterfaceRede = '^(Network Interface|Interface de rede|Interface r.seau|Interfaz de red)$'
}

function Get-OrionMemory {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    if (-not $os) { return $null }

    $totalKB = [double]$os.TotalVisibleMemorySize
    $livreKB = [double]$os.FreePhysicalMemory
    $usadoKB = $totalKB - $livreKB

    # O total instalado inclui o que esta reservado ao hardware; o
    # "visivel" nao. O Gestor de Tarefas mostra os dois, e a diferenca
    # entre eles e a linha "Reservada ao hardware".
    # O TotalPhysicalMemory do Win32_ComputerSystem JA exclui o que esta
    # reservado ao hardware, portanto usa-lo aqui dava sempre reservada=0.
    # A capacidade real dos modulos vem do Win32_PhysicalMemory.
    $modulos = Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue
    $instaladoBytes = if ($modulos) {
        [double](($modulos | Measure-Object -Property Capacity -Sum).Sum)
    } elseif ($cs) {
        [double]$cs.TotalPhysicalMemory
    } else {
        $totalKB * 1KB
    }

    return @{
        installedBytes = [int64]$instaladoBytes
        totalBytes     = [int64]($totalKB * 1KB)
        usedBytes      = [int64]($usadoKB * 1KB)
        freeBytes      = [int64]($livreKB * 1KB)
        percent        = if ($totalKB -gt 0) { [math]::Round(($usadoKB / $totalKB) * 100, 1) } else { 0 }
        hardwareReservedBytes = [int64]([math]::Max(0, $instaladoBytes - ($totalKB * 1KB)))
    }
}

function Get-OrionCpu {
    $cpu = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
    $carga = $null
    try {
        # LoadPercentage do WMI e uma media grosseira, mas nao precisa de
        # duas amostras como o Get-Counter e responde de imediato.
        $carga = [double]$cpu.LoadPercentage
    } catch { }

    return @{
        name        = if ($cpu) { ($cpu.Name -replace '\s+', ' ').Trim() } else { 'Desconhecido' }
        cores       = if ($cpu) { [int]$cpu.NumberOfCores } else { 0 }
        threads     = if ($cpu) { [int]$cpu.NumberOfLogicalProcessors } else { 0 }
        baseClockMhz = if ($cpu) { [int]$cpu.MaxClockSpeed } else { 0 }
        currentMhz  = if ($cpu) { [int]$cpu.CurrentClockSpeed } else { 0 }
        percent     = if ($null -ne $carga) { [math]::Round($carga, 1) } else { $null }
    }
}

function Get-OrionGpuUsage {
    <#
        Utilizacao de GPU somada por engine. O Windows expoe um contador
        por engine (3D, Copy, VideoDecode...); o Gestor de Tarefas mostra
        o maximo entre elas, nao a soma, senao passaria dos 100%.
    #>
    $adaptadores = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | ForEach-Object {
        @{
            name          = $_.Name
            driverVersion = $_.DriverVersion
            memoryBytes   = if ($_.AdapterRAM -gt 0) { [int64]$_.AdapterRAM } else { $null }
        }
    })

    $percent = $null
    try {
        $amostras = (Get-Counter '\GPU Engine(*)\Utilization Percentage' -ErrorAction Stop).CounterSamples
        $porEngine = @{}
        foreach ($a in $amostras) {
            if ($a.InstanceName -match 'engtype_(\w+)') {
                $tipo = $Matches[1]
                if (-not $porEngine.ContainsKey($tipo)) { $porEngine[$tipo] = 0 }
                $porEngine[$tipo] += [double]$a.CookedValue
            }
        }
        if ($porEngine.Count -gt 0) {
            $percent = [math]::Round(($porEngine.Values | Measure-Object -Maximum).Maximum, 1)
            if ($percent -gt 100) { $percent = 100 }
        }
    } catch { }

    return @{ adapters = $adaptadores; percent = $percent }
}

function Get-OrionDisks {
    $discos = @()
    foreach ($d in Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction SilentlyContinue) {
        $discos += @{
            drive      = $d.DeviceID
            label      = $d.VolumeName
            totalBytes = [int64]$d.Size
            freeBytes  = [int64]$d.FreeSpace
            usedBytes  = [int64]($d.Size - $d.FreeSpace)
            percent    = if ($d.Size -gt 0) { [math]::Round((($d.Size - $d.FreeSpace) / $d.Size) * 100, 1) } else { 0 }
        }
    }

    $atividade = $null
    try {
        $nome = Get-OrionCounterSet -Padrao $script:Padroes.DiscoFisico
        if ($nome) {
            # O contador de tempo tambem tem nome localizado, por isso
            # pede-se o conjunto inteiro da instancia _Total e escolhe-se
            # o que termina em "Time"/"Tempo".
            $todos = (Get-Counter -ListSet $nome -ErrorAction Stop).PathsWithInstances
            $alvo = $todos | Where-Object { $_ -match '\(_Total\)' -and $_ -match 'Disk Time|Tempo de Disco' } |
                Select-Object -First 1
            if ($alvo) {
                $c = Get-Counter $alvo -ErrorAction Stop
                $atividade = [math]::Round([math]::Min(100, $c.CounterSamples[0].CookedValue), 1)
            }
        }
    } catch { }

    return @{ volumes = $discos; activityPercent = $atividade }
}

function Get-OrionNetwork {
    $envio = $null
    $recepcao = $null
    try {
        $nome = Get-OrionCounterSet -Padrao $script:Padroes.InterfaceRede
        if ($nome) {
            $caminhos = (Get-Counter -ListSet $nome -ErrorAction Stop).PathsWithInstances
            $envioP = @($caminhos | Where-Object { $_ -match 'Bytes Sent/sec|Bytes Enviados/s' })
            $recepP = @($caminhos | Where-Object { $_ -match 'Bytes Received/sec|Bytes Recebidos/s' })
            # Ignorar loopback e interfaces virtuais: inflacionam o total
            # com trafego que nunca sai da maquina.
            $filtrar = { $_ -notmatch 'loopback|isatap|teredo|pseudo' }
            $envioP = @($envioP | Where-Object $filtrar)
            $recepP = @($recepP | Where-Object $filtrar)

            if ($envioP.Count) {
                $envio = [int64](((Get-Counter $envioP -ErrorAction Stop).CounterSamples |
                    Measure-Object CookedValue -Sum).Sum)
            }
            if ($recepP.Count) {
                $recepcao = [int64](((Get-Counter $recepP -ErrorAction Stop).CounterSamples |
                    Measure-Object CookedValue -Sum).Sum)
            }
        }
    } catch { }

    return @{ sentBytesPerSec = $envio; receivedBytesPerSec = $recepcao }
}

function Get-OrionPerformance {
    <#
        Instantaneo unico. A aplicacao chama isto repetidamente para
        desenhar os graficos; cada chamada e independente e nenhuma
        guarda estado.
    #>
    return @{
        timestamp = [int64][double]::Parse((Get-Date -UFormat %s))
        cpu       = Get-OrionCpu
        memory    = Get-OrionMemory
        gpu       = Get-OrionGpuUsage
        disk      = Get-OrionDisks
        network   = Get-OrionNetwork
    }
}

Export-ModuleMember -Function Get-OrionPerformance, Get-OrionCpu, Get-OrionMemory,
    Get-OrionGpuUsage, Get-OrionDisks, Get-OrionNetwork, Get-OrionCounterName,
    Get-OrionCounterSet
