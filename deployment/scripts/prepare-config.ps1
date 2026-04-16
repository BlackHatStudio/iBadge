param(
  [Parameter(Mandatory = $true)][string]$SettingsFile,
  [Parameter(Mandatory = $true)][string]$InstallRoot,
  [Parameter(Mandatory = $true)][string]$ProgramDataRoot,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$settings = Get-Content -LiteralPath $SettingsFile -Raw | ConvertFrom-Json
$installRootResolved = (Resolve-Path -LiteralPath $InstallRoot).Path
$programDataResolved = if (Test-Path -LiteralPath $ProgramDataRoot) { (Resolve-Path -LiteralPath $ProgramDataRoot).Path } else { $ProgramDataRoot }

foreach ($path in @(
  $programDataResolved,
  (Join-Path $programDataResolved 'config'),
  (Join-Path $programDataResolved 'logs'),
  (Join-Path $programDataResolved 'logs\api'),
  (Join-Path $programDataResolved 'logs\import'),
  (Join-Path $programDataResolved 'exports'),
  (Join-Path $programDataResolved 'exports\csv'),
  (Join-Path $programDataResolved 'exports\excel'),
  (Join-Path $programDataResolved 'exports\pdf'),
  (Join-Path $programDataResolved 'temp'),
  (Join-Path $programDataResolved 'backup\pre-upgrade')
)) {
  if (-not (Test-Path -LiteralPath $path)) {
    New-Item -ItemType Directory -Path $path -Force | Out-Null
  }
}

$replacementMap = @{
  '__INSTALL_ROOT__' = $installRootResolved
  '__PROGRAM_DATA_ROOT__' = $programDataResolved
  '__API_BASE_URL__' = '/api'
  '__REFERENCE_REFRESH_HOURS__' = [string]$settings.frontend.referenceRefreshHours
  '__QUEUE_RETRY_MINUTES__' = [string]$settings.frontend.queueRetryMinutes
  '__DUPLICATE_WINDOW_SECONDS__' = [string]$settings.frontend.duplicateWindowSeconds
  '__API_PORT__' = [string]$settings.api.listenPort
  '__SERVICE_ID__' = [string]$settings.api.serviceName
  '__SERVICE_NAME__' = [string]$settings.api.displayName
  '__NODE_EXE__' = (Join-Path $installRootResolved 'backend\node\node.exe')
  '__BACKEND_ENTRY__' = (Join-Path $installRootResolved 'backend\dist\src\index.js')
  '__BACKEND_ENV_FILE__' = (Join-Path $programDataResolved 'config\backend.env')
  '__BACKEND_WORKDIR__' = (Join-Path $installRootResolved 'backend')
  '__APP_LOG_ROOT__' = (Join-Path $programDataResolved 'logs\api')
  '__APP_VERSION__' = [string]$settings.application.version
  '__KIOSK_DB_CONNECTION_STRING__' = [string]$settings.database.appConnectionString
  '__SOURCE_DB_CONNECTION_STRING__' = [string]$settings.database.sourceAccessControlConnectionString
  '__JWT_SECRET__' = [string]$settings.security.jwtSecret
  '__ADMIN_PIN_HASH__' = [string]$settings.security.adminPinHash
  '__EXPORT_ROOT__' = (Join-Path $programDataResolved 'exports')
  '__LOG_ROOT__' = (Join-Path $programDataResolved 'logs')
  '__DUPLICATE_WINDOW_SERVER_SECONDS__' = [string]$settings.frontend.duplicateWindowSeconds
  '__IMPORT_INTERVAL_HOURS__' = [string]$settings.imports.intervalHours
}

& (Join-Path $scriptRoot 'render-template.ps1') -TemplatePath (Join-Path $installRootResolved 'config\runtime-config.template.js') -DestinationPath (Join-Path $installRootResolved 'frontend\runtime-config.js') -Replacements $replacementMap -Force:$Force
& (Join-Path $scriptRoot 'render-template.ps1') -TemplatePath (Join-Path $installRootResolved 'config\web.config.template') -DestinationPath (Join-Path $installRootResolved 'frontend\web.config') -Replacements $replacementMap -Force
& (Join-Path $scriptRoot 'render-template.ps1') -TemplatePath (Join-Path $installRootResolved 'config\.env.production.template') -DestinationPath (Join-Path $programDataResolved 'config\backend.env') -Replacements $replacementMap -Force:$Force
& (Join-Path $scriptRoot 'render-template.ps1') -TemplatePath (Join-Path $installRootResolved 'config\appsettings.Production.template.json') -DestinationPath (Join-Path $programDataResolved 'config\appsettings.Production.json') -Replacements $replacementMap -Force:$Force
& (Join-Path $scriptRoot 'render-template.ps1') -TemplatePath (Join-Path $installRootResolved 'config\iBadge.ApiService.xml.template') -DestinationPath (Join-Path $installRootResolved 'backend\service\iBadge.ApiService.xml') -Replacements $replacementMap -Force
