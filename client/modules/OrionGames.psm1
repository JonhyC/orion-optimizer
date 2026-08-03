<#
    OrionGames - descobre jogos instalados.

    SO LEITURA. Este modulo nunca escreve nada, em lado nenhum: le
    manifestos das lojas e chaves de registo de instalacao. Pode correr
    sem privilegios e sem risco.

    Le as lojas em vez de varrer o disco. Procurar .exe pelo disco todo
    demoraria minutos, encontraria desinstaladores e updaters, e falharia
    a dizer a que jogo cada um pertence. Os manifestos das lojas ja tem o
    nome, a pasta e o tamanho corretos.
#>

function Get-OrionSteamLibraries {
    <# Devolve as pastas de biblioteca do Steam, incluindo as de outros discos. #>
    $libraries = @()

    $steamPath = $null
    foreach ($key in @('HKCU:\Software\Valve\Steam', 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam')) {
        $item = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
        if ($item.SteamPath)    { $steamPath = $item.SteamPath; break }
        if ($item.InstallPath)  { $steamPath = $item.InstallPath; break }
    }
    if (-not $steamPath) { return $libraries }

    $steamPath = $steamPath -replace '/', '\'
    $libraries += (Join-Path $steamPath 'steamapps')

    # libraryfolders.vdf lista as bibliotecas noutros discos. E formato
    # KeyValues da Valve; so precisamos das linhas "path".
    $vdf = Join-Path $steamPath 'steamapps\libraryfolders.vdf'
    if (Test-Path -LiteralPath $vdf) {
        foreach ($line in Get-Content -LiteralPath $vdf -ErrorAction SilentlyContinue) {
            if ($line -match '"path"\s+"(.+?)"') {
                $p = $Matches[1] -replace '\\\\', '\'
                $apps = Join-Path $p 'steamapps'
                if ((Test-Path -LiteralPath $apps) -and ($libraries -notcontains $apps)) {
                    $libraries += $apps
                }
            }
        }
    }
    return $libraries
}

# Entradas que o Steam instala como se fossem jogos mas nao sao: runtimes
# e redistribuiveis que aparecem em qualquer biblioteca. Filtrar por appid
# e nao por nome, porque o nome muda com o idioma do cliente.
$script:SteamNaoJogos = @(
    '228980',   # Steamworks Common Redistributables
    '1070560',  # Steam Linux Runtime
    '1391110',  # Steam Linux Runtime - Soldier
    '1628350',  # Steam Linux Runtime - Sniper
    '1493710'   # Proton Experimental
)

function Get-OrionSteamGames {
    $jogos = @()
    foreach ($lib in Get-OrionSteamLibraries) {
        $manifests = Get-ChildItem -LiteralPath $lib -Filter 'appmanifest_*.acf' -File -ErrorAction SilentlyContinue
        foreach ($m in $manifests) {
            $texto = Get-Content -LiteralPath $m.FullName -Raw -ErrorAction SilentlyContinue
            if (-not $texto) { continue }

            $appid = if ($texto -match '"appid"\s+"(\d+)"') { $Matches[1] } else { $null }
            $nome  = if ($texto -match '"name"\s+"(.+?)"') { $Matches[1] } else { $null }
            $dir   = if ($texto -match '"installdir"\s+"(.+?)"') { $Matches[1] } else { $null }
            $bytes = if ($texto -match '"SizeOnDisk"\s+"(\d+)"') { [int64]$Matches[1] } else { 0 }
            if (-not $appid -or -not $nome) { continue }
            if ($script:SteamNaoJogos -contains $appid) { continue }

            $caminho = if ($dir) { Join-Path $lib "common\$dir" } else { $null }
            # Um manifesto pode sobreviver a pasta: o Steam nem sempre o
            # apaga quando o jogo e removido a mao.
            if ($caminho -and -not (Test-Path -LiteralPath $caminho)) { continue }

            $jogos += [pscustomobject]@{
                id          = "steam:$appid"
                name        = $nome
                platform    = 'Steam'
                installPath = $caminho
                sizeBytes   = $bytes
                launchUri   = "steam://rungameid/$appid"
            }
        }
    }
    return $jogos
}

function Get-OrionEpicGames {
    $jogos = @()
    $dir = Join-Path $env:ProgramData 'Epic\EpicGamesLauncher\Data\Manifests'
    if (-not (Test-Path -LiteralPath $dir)) { return $jogos }

    foreach ($item in Get-ChildItem -LiteralPath $dir -Filter '*.item' -File -ErrorAction SilentlyContinue) {
        try {
            $m = Get-Content -LiteralPath $item.FullName -Raw | ConvertFrom-Json
        } catch { continue }
        if (-not $m.DisplayName) { continue }
        # Os DLC aparecem como manifestos proprios e nao sao jogos.
        if ($m.AppCategories -and ($m.AppCategories -notcontains 'games')) { continue }
        if ($m.InstallLocation -and -not (Test-Path -LiteralPath $m.InstallLocation)) { continue }

        $jogos += [pscustomobject]@{
            id          = "epic:$($m.AppName)"
            name        = $m.DisplayName
            platform    = 'Epic Games'
            installPath = $m.InstallLocation
            sizeBytes   = if ($m.InstallSize) { [int64]$m.InstallSize } else { 0 }
            launchUri   = "com.epicgames.launcher://apps/$($m.AppName)?action=launch"
        }
    }
    return $jogos
}

function Get-OrionGogGames {
    $jogos = @()
    foreach ($raiz in @('HKLM:\SOFTWARE\WOW6432Node\GOG.com\Games', 'HKLM:\SOFTWARE\GOG.com\Games')) {
        if (-not (Test-Path -LiteralPath $raiz)) { continue }
        foreach ($chave in Get-ChildItem -LiteralPath $raiz -ErrorAction SilentlyContinue) {
            $g = Get-ItemProperty -Path $chave.PSPath -ErrorAction SilentlyContinue
            if (-not $g.gameName) { continue }
            if ($g.path -and -not (Test-Path -LiteralPath $g.path)) { continue }
            $jogos += [pscustomobject]@{
                id          = "gog:$($g.gameID)"
                name        = $g.gameName
                platform    = 'GOG'
                installPath = $g.path
                sizeBytes   = 0
                launchUri   = $null
            }
        }
    }
    return $jogos
}

function Get-OrionXboxGames {
    <#
        Jogos da Microsoft Store / Game Pass. Ha dois formatos relevantes:
        pacotes Appx em WindowsApps e instalacoes da Xbox app em
        X:\XboxGames. O segundo nao aparece como Appx (Fortnite e Forza
        sao exemplos), por isso ambas as fontes sao lidas.
    #>
    $jogos = @()
    $pacotes = Get-AppxPackage -ErrorAction SilentlyContinue |
        Where-Object { $_.SignatureKind -eq 'Store' -and $_.IsFramework -eq $false }

    foreach ($p in $pacotes) {
        # WindowsApps e protegido de proposito. Este cmdlet le o manifesto
        # registado sem exigir permissao de leitura sobre a pasta do jogo.
        try { $xml = [xml](Get-AppxPackageManifest -Package $p.PackageFullName -ErrorAction Stop).OuterXml } catch { continue }

        # A extensao do manifesto identifica jogos Store/Game Pass sem trazer
        # aplicacoes normais como a Calculadora para a biblioteca.
        $ehJogo = $xml.OuterXml -match 'windows\.(game|xboxLive)'
        if (-not $ehJogo) { continue }

        $nome = $p.Name
        try {
            $dn = $xml.Package.Properties.DisplayName
            if ($dn -and $dn -notmatch '^ms-resource') { $nome = $dn }
        } catch { }

        $jogos += [pscustomobject]@{
            id          = "xbox:$($p.PackageFamilyName)"
            name        = $nome
            platform    = 'Xbox / Store'
            installPath = $p.InstallLocation
            sizeBytes   = 0
            launchUri   = "shell:appsFolder\$($p.PackageFamilyName)!App"
        }
    }

    # A Xbox app pode instalar jogos em qualquer disco (C:\XboxGames,
    # D:\XboxGames, ...). Estas pastas nao sao pacotes Appx e ficavam
    # invisiveis com a deteccao anterior.
    $bibliotecas = @(Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.Root 'XboxGames' } |
        Where-Object { Test-Path -LiteralPath $_ })
    foreach ($biblioteca in $bibliotecas) {
        foreach ($pasta in Get-ChildItem -LiteralPath $biblioteca -Directory -Force -ErrorAction SilentlyContinue) {
            # GameSave guarda apenas dados dos jogos. Uma instalacao Xbox tem
            # sempre a pasta Content ao lado dos metadados .xvc/.xsp.
            $conteudo = Join-Path $pasta.FullName 'Content'
            if (-not (Test-Path -LiteralPath $conteudo)) { continue }

            $jogos += [pscustomobject]@{
                id          = "xbox-library:$($pasta.FullName.ToLowerInvariant())"
                name        = $pasta.Name
                platform    = 'Xbox / PC Game Pass'
                installPath = $pasta.FullName
                sizeBytes   = 0
                launchUri   = $null
            }
        }
    }
    return @($jogos | Sort-Object -Property id -Unique)
}

function Get-OrionRobloxGames {
    <#
        Roblox.

        Nao vem de nenhuma loja: instala-se sozinho em
        %LOCALAPPDATA%\Roblox\Versions\version-<hash>, e o Player e o Studio
        sao instalacoes separadas, cada uma com a sua pasta.

        A pasta Versions guarda TAMBEM as versoes antigas - neste PC havia
        cinco. Listar a pasta daria o mesmo jogo repetido cinco vezes, com
        quatro entradas que ja nao arrancam. Por isso a fonte principal e o
        registo de desinstalacao, que aponta sempre para a versao em uso.

        So se varre a pasta quando o registo nao tem nada, e mesmo ai fica
        so a versao com o executavel mais recente.
    #>
    $jogos = @()

    # O DisplayName traz o nome da conta Windows ("Roblox Player for joao"),
    # que nao tem nada que fazer na biblioteca de jogos. Fica o nome do
    # produto, deduzido do executavel que la esta.
    $executaveis = [ordered]@{
        'RobloxPlayerBeta.exe' = 'Roblox'
        'RobloxStudioBeta.exe' = 'Roblox Studio'
    }

    $encontrados = @{}

    foreach ($raiz in @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
    )) {
        foreach ($chave in Get-ChildItem -Path $raiz -ErrorAction SilentlyContinue) {
            $info = Get-ItemProperty -Path $chave.PSPath -ErrorAction SilentlyContinue
            if (-not $info -or $info.DisplayName -notmatch '^Roblox') { continue }

            $local = $info.InstallLocation
            if (-not $local -or -not (Test-Path -LiteralPath $local)) { continue }

            foreach ($exe in $executaveis.Keys) {
                if (-not (Test-Path -LiteralPath (Join-Path $local $exe))) { continue }
                $encontrados[$executaveis[$exe]] = $local
            }
        }
    }

    # Sem registo utilizavel, procura-se na pasta - mas so a versao mais
    # recente de cada executavel.
    if ($encontrados.Count -eq 0) {
        $versoes = Join-Path $env:LOCALAPPDATA 'Roblox\Versions'
        if (Test-Path -LiteralPath $versoes) {
            foreach ($exe in $executaveis.Keys) {
                $mais = Get-ChildItem -LiteralPath $versoes -Directory -ErrorAction SilentlyContinue |
                    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName $exe) } |
                    Sort-Object -Property LastWriteTime -Descending |
                    Select-Object -First 1
                if ($mais) { $encontrados[$executaveis[$exe]] = $mais.FullName }
            }
        }
    }

    foreach ($nome in $encontrados.Keys) {
        $caminho = $encontrados[$nome]

        $bytes = 0
        try {
            $bytes = [int64]((Get-ChildItem -LiteralPath $caminho -Recurse -File -Force -ErrorAction SilentlyContinue |
                Measure-Object -Property Length -Sum).Sum)
        } catch { $bytes = 0 }

        $jogos += [pscustomobject]@{
            id          = "roblox:$($nome.ToLowerInvariant() -replace '\s+', '-')"
            name        = $nome
            platform    = 'Roblox'
            installPath = $caminho
            sizeBytes   = $bytes
            launchUri   = $null
        }
    }

    return @($jogos | Sort-Object -Property id -Unique)
}

function Get-OrionGames {
    <#
        Junta todas as lojas. Cada uma falha de forma independente: um
        Steam mal instalado nao pode esconder os jogos da Epic.
    #>
    $todos = @()
    $fontes = [ordered]@{
        Steam  = { Get-OrionSteamGames }
        Epic   = { Get-OrionEpicGames }
        GOG    = { Get-OrionGogGames }
        Xbox   = { Get-OrionXboxGames }
        Roblox = { Get-OrionRobloxGames }
    }
    $avisos = @()

    foreach ($nome in $fontes.Keys) {
        try {
            $todos += @(& $fontes[$nome])
        } catch {
            $avisos += "$nome : $($_.Exception.Message)"
        }
    }

    $ordenados = @($todos | Sort-Object -Property name)
    return @{ items = $ordenados; warnings = $avisos }
}

Export-ModuleMember -Function Get-OrionGames, Get-OrionSteamGames, Get-OrionEpicGames,
    Get-OrionRobloxGames,
    Get-OrionGogGames, Get-OrionXboxGames, Get-OrionSteamLibraries
