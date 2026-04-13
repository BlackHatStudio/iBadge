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
  $StageRoot = Join-Path $RepoRoot 'deployment\staging\package'
}

$RepoRoot = (Resolve-Path $RepoRoot).Path
$frontendOutPath = Join-Path $RepoRoot 'out'
$serverRoot = Join-Path $RepoRoot 'server'
$serverDistPath = Join-Path $serverRoot 'dist'
$backendStagePath = Join-Path $StageRoot 'backend'

Assert-DirectoryExists -Path $frontendOutPath
Assert-DirectoryExists -Path $serverDistPath
Assert-FileExists -Path (Join-Path $serverRoot 'package.json')
Assert-FileExists -Path (Join-Path $serverRoot 'package-lock.json')
Write-NodeDiagnostics

$StageRoot = Ensure-EmptyDirectory -Path $StageRoot
Invoke-Robocopy -Source $frontendOutPath -Destination (Join-Path $StageRoot 'frontend')

$backendStagePath = Ensure-EmptyDirectory -Path $backendStagePath
Copy-Item -LiteralPath (Join-Path $serverRoot 'package.json') -Destination (Join-Path $backendStagePath 'package.json') -Force
Copy-Item -LiteralPath (Join-Path $serverRoot 'package-lock.json') -Destination (Join-Path $backendStagePath 'package-lock.json') -Force
Invoke-Robocopy -Source $serverDistPath -Destination (Join-Path $backendStagePath 'dist')

$npmCmd = Get-NpmCmd
Invoke-Process -FilePath $npmCmd -ArgumentList @('ci', '--omit=dev') -WorkingDirectory $backendStagePath

$nodeExe = Get-NodeExe
Ensure-Directory -Path (Join-Path $backendStagePath 'node') | Out-Null
Copy-Item -LiteralPath $nodeExe -Destination (Join-Path $backendStagePath 'node\node.exe') -Force

$serviceDir = Ensure-Directory -Path (Join-Path $backendStagePath 'service')
& (Join-Path $scriptRoot 'ensure-winsw.ps1') -DestinationPath (Join-Path $serviceDir 'iBadge.ApiService.exe')

Invoke-Robocopy -Source (Join-Path $RepoRoot 'deployment\sql') -Destination (Join-Path $StageRoot 'sql')
Invoke-Robocopy -Source (Join-Path $RepoRoot 'deployment\config') -Destination (Join-Path $StageRoot 'config')
Invoke-Robocopy -Source (Join-Path $RepoRoot 'deployment\scripts') -Destination (Join-Path $StageRoot 'scripts') -ExcludeFiles @('publish-all.ps1')
Invoke-Robocopy -Source (Join-Path $RepoRoot 'deployment\installer') -Destination (Join-Path $StageRoot 'installer')

$manifest = [ordered]@{
  stagedAtUtc = [DateTime]::UtcNow.ToString('o')
  repoRoot = $RepoRoot
  stageRoot = $StageRoot
  version = Get-AppVersion -RepoRoot $RepoRoot
  frontendOutPath = $frontendOutPath
  serverDistPath = $serverDistPath
}
Write-JsonFile -Value $manifest -Path (Join-Path $StageRoot 'deployment-manifest.json')

Write-Host "Deployment artifacts assembled at $StageRoot"
