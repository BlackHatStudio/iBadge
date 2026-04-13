param(
  [string]$RepoRoot,
  [string]$IsccPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $RepoRoot) {
  $RepoRoot = (Resolve-Path (Join-Path $scriptRoot '..\..')).Path
}

& (Join-Path $scriptRoot 'publish-frontend.ps1') -RepoRoot $RepoRoot
& (Join-Path $scriptRoot 'publish-api.ps1') -RepoRoot $RepoRoot
& (Join-Path $scriptRoot 'build-installer.ps1') -RepoRoot $RepoRoot -IsccPath $IsccPath
