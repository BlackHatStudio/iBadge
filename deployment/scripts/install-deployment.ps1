param(
  [Parameter(Mandatory = $true)][string]$SettingsFile,
  [Parameter(Mandatory = $true)][string]$InstallRoot,
  [Parameter(Mandatory = $true)][string]$ProgramDataRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$settings = Get-Content -LiteralPath $SettingsFile -Raw | ConvertFrom-Json

if (-not (Test-Path -LiteralPath $ProgramDataRoot)) {
  New-Item -ItemType Directory -Path $ProgramDataRoot -Force | Out-Null
}

& (Join-Path $scriptRoot 'prepare-config.ps1') -SettingsFile $SettingsFile -InstallRoot $InstallRoot -ProgramDataRoot $ProgramDataRoot
& (Join-Path $scriptRoot 'install-database.ps1') -SettingsFile $SettingsFile -SqlRoot (Join-Path $InstallRoot 'sql')
& (Join-Path $scriptRoot 'create-iis-site.ps1') -SiteName ([string]$settings.iis.siteName) -AppPoolName ([string]$settings.iis.appPoolName) -SitePhysicalPath (Join-Path $InstallRoot 'frontend') -BindingProtocol ([string]$settings.iis.bindingProtocol) -BindingPort ([int]$settings.iis.bindingPort) -HostHeader ([string]$settings.iis.hostHeader) -ApiPort ([int]$settings.api.listenPort) -WebConfigTemplatePath (Join-Path $InstallRoot 'config\web.config.template')
& (Join-Path $scriptRoot 'install-backend-service.ps1') -ServiceName ([string]$settings.api.serviceName) -BackendRoot (Join-Path $InstallRoot 'backend')

if ([bool]$settings.imports.enabled) {
  & (Join-Path $scriptRoot 'create-scheduled-task.ps1') -TaskName ([string]$settings.imports.taskName) -ImportScriptPath (Join-Path $InstallRoot 'scripts\invoke-employee-import.ps1') -SettingsFile $SettingsFile -IntervalHours ([int]$settings.imports.intervalHours)
}

Write-Host 'Deployment configuration completed successfully.'
