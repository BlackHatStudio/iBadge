$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$port = if ($env:PORT) { [int]$env:PORT } else { 3000 }
$lockPath = Join-Path $projectRoot ".next-runtime\dev\lock"
$nextCommand = Join-Path $projectRoot "node_modules\.bin\next.cmd"

if (-not (Test-Path $nextCommand)) {
  throw "Unable to locate $nextCommand. Run npm install, then try npm run dev again."
}

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1

if (-not $listener -and (Test-Path $lockPath)) {
  Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
}

Push-Location $projectRoot
try {
  & $nextCommand dev --webpack
  $exitCode = $LASTEXITCODE
  if ($null -ne $exitCode -and $exitCode -ne 0) {
    exit $exitCode
  }
} finally {
  Pop-Location
}