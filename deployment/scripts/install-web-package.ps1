param(
  [string]$SettingsFile,
  [string]$PackageRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$packageSettingsFile = Join-Path $PSScriptRoot '..\config\deploy.settings.template.json'
$existingServerSettingsFile = Join-Path $env:ProgramData 'iBadge\config\deploy.settings.json'

function Resolve-SettingsFile {
  param([string]$RequestedSettingsFile)

  $candidates = @()
  if ($RequestedSettingsFile) {
    $candidates += $RequestedSettingsFile
  }
  $candidates += $existingServerSettingsFile
  $candidates += $packageSettingsFile

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw "No deployment settings file was found. Checked: $($candidates -join ', ')"
}

$SettingsFile = Resolve-SettingsFile -RequestedSettingsFile $SettingsFile
$settings = Get-Content -LiteralPath $SettingsFile -Raw | ConvertFrom-Json
$appRoot = Join-Path $PackageRoot 'app'
$serverRoot = Join-Path $appRoot 'server'

$replacements = @{
  '__API_BASE_URL__' = [string]$settings.runtime.apiBaseUrl
  '__REFERENCE_REFRESH_HOURS__' = [string]$settings.runtime.referenceRefreshHours
  '__QUEUE_RETRY_MINUTES__' = [string]$settings.runtime.queueRetryMinutes
  '__DUPLICATE_WINDOW_SECONDS__' = [string]$settings.runtime.duplicateWindowSeconds
  '__APP_PORT__' = [string]$settings.app.listenPort
  '__SERVICE_ID__' = [string]$settings.app.serviceName
  '__SERVICE_NAME__' = [string]$settings.app.displayName
  '__NODE_EXE__' = (Join-Path $appRoot 'node\node.exe')
  '__APP_ROOT__' = $appRoot
  '__DB_SERVER__' = [string]$settings.database.server
  '__DB_NAME__' = [string]$settings.database.databaseName
  '__DB_USER__' = [string]$settings.database.username
  '__DB_PASSWORD__' = [string]$settings.database.password
}

function Render-Template([string]$templatePath, [string]$destinationPath) {
  $content = Get-Content -LiteralPath $templatePath -Raw
  foreach ($key in $replacements.Keys) {
    $content = $content.Replace($key, [string]$replacements[$key])
  }
  Set-Content -Path $destinationPath -Value $content
}

if (-not (Test-Path -LiteralPath $serverRoot)) {
  New-Item -ItemType Directory -Path $serverRoot -Force | Out-Null
}

Write-Host "Using deployment settings from $SettingsFile"

Render-Template (Join-Path $PackageRoot 'config\runtime-config.template.js') (Join-Path $appRoot 'public\runtime-config.js')
Render-Template (Join-Path $PackageRoot 'config\webapp.web.config.template') (Join-Path $appRoot 'web.config')
Render-Template (Join-Path $PackageRoot 'config\run-webapp.template.cmd') (Join-Path $appRoot 'run-webapp.cmd')
Render-Template (Join-Path $PackageRoot 'config\iBadge.WebApp.xml.template') (Join-Path $appRoot 'service\iBadge.WebApp.xml')
Render-Template (Join-Path $PackageRoot 'config\webapp.server.env.template') (Join-Path $serverRoot '.env')

$serviceName = [string]$settings.app.serviceName
$serviceWrapper = Join-Path $appRoot 'service\iBadge.WebApp.exe'
if (-not (Test-Path -LiteralPath $serviceWrapper)) {
  throw "Missing service wrapper: $serviceWrapper"
}

$logsPath = Join-Path $appRoot 'service\logs'
if (-not (Test-Path -LiteralPath $logsPath)) {
  New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
}

$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existingService) {
  & $serviceWrapper stop | Out-Null
  Start-Sleep -Seconds 2
  & $serviceWrapper uninstall | Out-Null
  Start-Sleep -Seconds 2
}

& $serviceWrapper install | Out-Null
& $serviceWrapper start | Out-Null

Write-Host 'iBadge web package updated successfully.'
