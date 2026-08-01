param(
    [Parameter(Mandatory)][string]$BridgePath,
    [Parameter(Mandatory)][string]$Command,
    [Parameter(Mandatory)][string]$PayloadPath,
    [Parameter(Mandatory)][string]$ResultPath,
    [Parameter(Mandatory)][string]$ModulesPath
)

$arguments = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', ('"{0}"' -f $BridgePath),
    '-Command', $Command,
    '-PayloadPath', ('"{0}"' -f $PayloadPath),
    '-ResultPath', ('"{0}"' -f $ResultPath),
    '-ModulesPath', ('"{0}"' -f $ModulesPath)
)

$process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments -Wait -PassThru
if ($process.ExitCode -ne 0 -and -not (Test-Path -LiteralPath $ResultPath)) {
    throw "A operacao elevada foi cancelada ou terminou com codigo $($process.ExitCode)."
}
