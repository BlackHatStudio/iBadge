param(
  [string]$DestinationPath,
  [string]$DownloadUrl = 'https://github.com/winsw/winsw/releases/latest/download/WinSW-x64.exe',
  [string]$FallbackSourcePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $DestinationPath) {
  throw 'DestinationPath is required.'
}

$destinationDirectory = Split-Path -Parent $DestinationPath
if (-not (Test-Path -LiteralPath $destinationDirectory)) {
  New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
}

if (-not $FallbackSourcePath) {
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
  $FallbackSourcePath = Join-Path $repoRoot 'deployment\output\iBadge-iis-package\app\service\iBadge.WebApp.exe'
}

if (-not (Test-Path -LiteralPath $DestinationPath)) {
  if ($FallbackSourcePath -and (Test-Path -LiteralPath $FallbackSourcePath -PathType Leaf)) {
    Write-Host "Copying WinSW from $FallbackSourcePath"
    Copy-Item -LiteralPath $FallbackSourcePath -Destination $DestinationPath -Force
    return
  }

  Write-Host "Downloading WinSW to $DestinationPath"
  Invoke-WebRequest -Uri $DownloadUrl -OutFile $DestinationPath
}
else {
  Write-Host "WinSW already present at $DestinationPath"
}
