param(
  [string]$RepoRoot,
  [string]$StageRoot,
  [string]$OutputDir,
  [string]$IsccPath,
  [string]$AppVersion
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
if (-not $OutputDir) {
  $OutputDir = Join-Path $RepoRoot 'deployment\output'
}
if (-not $AppVersion) {
  $AppVersion = Get-AppVersion -RepoRoot $RepoRoot
}

$RepoRoot = (Resolve-Path $RepoRoot).Path
$OutputDir = Ensure-Directory -Path $OutputDir
& (Join-Path $scriptRoot 'stage-deployment.ps1') -RepoRoot $RepoRoot -StageRoot $StageRoot

$resolvedStageRoot = (Resolve-Path $StageRoot).Path
$resolvedIsccPath = Get-IsccPath -PreferredPath $IsccPath
$issPath = Join-Path $RepoRoot 'deployment\installer\KioskAttendanceInstaller.iss'

Invoke-Process -FilePath $resolvedIsccPath -ArgumentList @(
  '/Qp',
  "/DStageDir=$resolvedStageRoot",
  "/DOutputDir=$OutputDir",
  "/DAppVersion=$AppVersion",
  $issPath
) -WorkingDirectory $RepoRoot

Write-Host "Installer EXE generated in $OutputDir"
