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
$serverRoot = Join-Path $RepoRoot 'server'
$serverPackageJsonPath = Join-Path $serverRoot 'package.json'
$serverDistPath = Join-Path $serverRoot 'dist'

Assert-FileExists -Path $serverPackageJsonPath
Write-NodeDiagnostics
Ensure-NpmDependencies -WorkingDirectory $serverRoot

if (Test-Path -LiteralPath $serverDistPath) {
  Remove-Item -LiteralPath $serverDistPath -Recurse -Force
}

$npmCmd = Get-NpmCmd
Invoke-Process -FilePath $npmCmd -ArgumentList @('run', 'build') -WorkingDirectory $serverRoot
Assert-DirectoryExists -Path $serverDistPath
Assert-FileExists -Path (Join-Path $serverDistPath 'src\index.js')

Write-Host "API build is ready at $serverDistPath"
