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
Assert-FileExists -Path (Join-Path $RepoRoot 'next.config.ts')
Write-NodeDiagnostics
Ensure-NpmDependencies -WorkingDirectory $RepoRoot

if (Test-Path -LiteralPath $outPath) {
  Remove-Item -LiteralPath $outPath -Recurse -Force
}

$npmCmd = Get-NpmCmd
Invoke-Process -FilePath $npmCmd -ArgumentList @('run', 'build:frontend:static') -WorkingDirectory $RepoRoot
Assert-DirectoryExists -Path $outPath

Write-Host "Frontend static export is ready at $outPath"
