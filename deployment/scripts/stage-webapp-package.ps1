param(
  [string]$RepoRoot,
  [string]$StageRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptRoot 'common.ps1')

if (-not $RepoRoot) {
  $RepoRoot = Get-RepoRoot -ScriptPath $scriptRoot
}
if (-not $StageRoot) {
  $StageRoot = Join-Path $RepoRoot 'deployment\staging\webapp-package'
}

$RepoRoot = (Resolve-Path $RepoRoot).Path
$standaloneRoot = Join-Path $RepoRoot '.next\standalone'
$staticRoot = Join-Path $RepoRoot '.next\static'
$publicRoot = Join-Path $RepoRoot 'public'

Assert-DirectoryExists -Path $standaloneRoot
Assert-DirectoryExists -Path $staticRoot
Assert-DirectoryExists -Path $publicRoot
Write-NodeDiagnostics

$StageRoot = Ensure-EmptyDirectory -Path $StageRoot
$appStagePath = Ensure-EmptyDirectory -Path (Join-Path $StageRoot 'app')
$configStagePath = Ensure-EmptyDirectory -Path (Join-Path $StageRoot 'config')
$scriptsStagePath = Ensure-EmptyDirectory -Path (Join-Path $StageRoot 'scripts')

Invoke-Robocopy -Source $standaloneRoot -Destination $appStagePath
Invoke-Robocopy -Source $staticRoot -Destination (Join-Path $appStagePath '.next\static')
Invoke-Robocopy -Source $publicRoot -Destination (Join-Path $appStagePath 'public')

$nodeExe = Get-NodeExe
Ensure-Directory -Path (Join-Path $appStagePath 'node') | Out-Null
Copy-Item -LiteralPath $nodeExe -Destination (Join-Path $appStagePath 'node\node.exe') -Force

$serviceDir = Ensure-Directory -Path (Join-Path $appStagePath 'service')
& (Join-Path $scriptRoot 'ensure-winsw.ps1') -DestinationPath (Join-Path $serviceDir 'iBadge.WebApp.exe')

Copy-Item -LiteralPath (Join-Path $RepoRoot 'deployment\config\runtime-config.template.js') -Destination (Join-Path $configStagePath 'runtime-config.template.js') -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot 'deployment\config\webapp.web.config.template') -Destination (Join-Path $configStagePath 'web.config.template') -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot 'deployment\config\run-webapp.template.cmd') -Destination (Join-Path $configStagePath 'run-webapp.template.cmd') -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot 'deployment\config\iBadge.WebApp.xml.template') -Destination (Join-Path $configStagePath 'iBadge.WebApp.xml.template') -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot 'deployment\config\webapp.server.env.template') -Destination (Join-Path $configStagePath 'webapp.server.env.template') -Force

$settingsTemplate = Get-Content -LiteralPath (Join-Path $RepoRoot 'deployment\config\webapp.deploy.settings.template.json') -Raw
$settingsTemplate = $settingsTemplate.Replace('__APP_VERSION__', (Get-AppVersion -RepoRoot $RepoRoot))
Set-Content -Path (Join-Path $configStagePath 'deploy.settings.template.json') -Value $settingsTemplate

Copy-Item -LiteralPath (Join-Path $RepoRoot 'deployment\scripts\install-web-package.ps1') -Destination (Join-Path $scriptsStagePath 'install-web-package.ps1') -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot 'deployment\config\webapp-package.README.txt') -Destination (Join-Path $StageRoot 'README.txt') -Force

$manifest = [ordered]@{
  stagedAtUtc = [DateTime]::UtcNow.ToString('o')
  repoRoot = $RepoRoot
  stageRoot = $StageRoot
  version = Get-AppVersion -RepoRoot $RepoRoot
  standaloneRoot = $standaloneRoot
}
Write-JsonFile -Value $manifest -Path (Join-Path $StageRoot 'deployment-manifest.json')

Write-Host "Webapp deployment artifacts assembled at $StageRoot"
