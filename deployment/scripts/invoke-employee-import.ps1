param(
  [Parameter(Mandatory = $true)][string]$SettingsFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$settings = Get-Content -LiteralPath $SettingsFile -Raw | ConvertFrom-Json
$apiPort = [int]$settings.api.listenPort
$apiUrl = "http://127.0.0.1:$apiPort/api/employee-import/run"
$programDataRoot = [string]$settings.paths.programDataRoot
$logRoot = Join-Path $programDataRoot 'logs\import'
if (-not (Test-Path -LiteralPath $logRoot)) {
  New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
}

$logFile = Join-Path $logRoot ("employee-import-{0}.log" -f (Get-Date -Format 'yyyyMMdd'))
$timestamp = Get-Date -Format o

try {
  $response = Invoke-RestMethod -Method Post -Uri $apiUrl -TimeoutSec 120
  Add-Content -Path $logFile -Value "$timestamp SUCCESS $($response | ConvertTo-Json -Compress)"
}
catch {
  Add-Content -Path $logFile -Value "$timestamp ERROR $($_.Exception.Message)"
  throw
}
