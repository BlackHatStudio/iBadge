param(
  [Parameter(Mandatory = $true)][string]$ServiceName,
  [Parameter(Mandatory = $true)][string]$BackendRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$serviceExe = Join-Path $BackendRoot 'service\iBadge.ApiService.exe'
$serviceXml = Join-Path $BackendRoot 'service\iBadge.ApiService.xml'

if (-not (Test-Path -LiteralPath $serviceExe)) {
  throw "WinSW executable not found at $serviceExe"
}
if (-not (Test-Path -LiteralPath $serviceXml)) {
  throw "WinSW configuration not found at $serviceXml"
}

$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
  try {
    & $serviceExe stop | Out-Null
  }
  catch {
  }

  Start-Sleep -Seconds 2

  try {
    & $serviceExe uninstall | Out-Null
  }
  catch {
  }
}

& $serviceExe install | Out-Null
& $serviceExe start | Out-Null
Write-Host "Service '$ServiceName' is installed and started."
