param(
  [string]$RepoRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptRoot 'common.ps1')

if (-not $RepoRoot) {
  $RepoRoot = Get-RepoRoot -ScriptPath $scriptRoot
}

$RepoRoot = (Resolve-Path $RepoRoot).Path
$packageJsonPath = Join-Path $RepoRoot 'package.json'
$outPath = Join-Path $RepoRoot 'out'

Assert-FileExists -Path $packageJsonPath
$nextConfigPath = $null
foreach ($name in @("next.config.mjs", "next.config.ts", "next.config.js")) {
  $candidate = Join-Path $RepoRoot $name
  if (Test-Path -LiteralPath $candidate) {
    $nextConfigPath = $candidate
    break
  }
}
if (-not $nextConfigPath) {
  throw "Next.js config not found. Expected one of: next.config.mjs, next.config.ts, next.config.js under $RepoRoot"
}
Write-NodeDiagnostics
Ensure-NpmDependencies -WorkingDirectory $RepoRoot

if (Test-Path -LiteralPath $outPath) {
  Remove-Item -LiteralPath $outPath -Recurse -Force
}

$npmCmd = Get-NpmCmd
Invoke-Process -FilePath $npmCmd -ArgumentList @('run', 'build:frontend:static') -WorkingDirectory $RepoRoot
Assert-DirectoryExists -Path $outPath

Write-Host "Frontend static export is ready at $outPath"
