Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  param([string]$ScriptPath)

  return (Resolve-Path (Join-Path $ScriptPath '..\..')).Path
}

function Assert-FileExists {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Required file was not found: $Path"
  }
}

function Assert-DirectoryExists {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    throw "Required directory was not found: $Path"
  }
}

function Ensure-Directory {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }

  return (Resolve-Path -LiteralPath $Path).Path
}

function Ensure-EmptyDirectory {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }

  New-Item -ItemType Directory -Path $Path -Force | Out-Null
  return (Resolve-Path -LiteralPath $Path).Path
}

function Invoke-Robocopy {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [string[]]$ExcludeDirectories = @(),
    [string[]]$ExcludeFiles = @(),
    [switch]$Mirror
  )

  Ensure-Directory -Path $Destination | Out-Null

  $arguments = @($Source, $Destination, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:2', '/W:2')
  if ($Mirror) {
    $arguments += '/MIR'
  }
  foreach ($directory in $ExcludeDirectories) {
    $arguments += '/XD'
    $arguments += $directory
  }
  foreach ($file in $ExcludeFiles) {
    $arguments += '/XF'
    $arguments += $file
  }

  & robocopy @arguments | Out-Null
  if ($LASTEXITCODE -ge 8) {
    throw "Robocopy failed with exit code $LASTEXITCODE while copying '$Source' to '$Destination'."
  }
}

function Invoke-Process {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$ArgumentList = @(),
    [string]$WorkingDirectory = (Get-Location).Path
  )

  $display = if ($ArgumentList.Count -gt 0) { "$FilePath $($ArgumentList -join ' ')" } else { $FilePath }
  Write-Host "> $display"

  Push-Location $WorkingDirectory
  try {
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
      throw "Process '$display' failed with exit code $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }
}

function Get-NodeExe {
  foreach ($candidate in @('node', 'C:\nodejs\node.exe')) {
    $command = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($command) {
      return $command.Source
    }
    if (Test-Path -LiteralPath $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw 'node was not found on PATH. Install Node.js 20+ and retry.'
}

function Get-NpmCmd {
  foreach ($candidate in @('npm.cmd', 'npm', 'C:\nodejs\npm.cmd')) {
    $command = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($command) {
      return $command.Source
    }
    if (Test-Path -LiteralPath $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw 'npm was not found on PATH. Install Node.js 20+ and retry.'
}

function Write-NodeDiagnostics {
  $nodeExe = Get-NodeExe
  $npmCmd = Get-NpmCmd
  $nodeVersion = & $nodeExe -v
  $npmVersion = & $npmCmd -v

  Write-Host "Node: $nodeExe ($nodeVersion)"
  Write-Host "npm:  $npmCmd ($npmVersion)"
}

function Ensure-NpmDependencies {
  param([Parameter(Mandatory = $true)][string]$WorkingDirectory)

  $nodeModulesPath = Join-Path $WorkingDirectory 'node_modules'
  if (Test-Path -LiteralPath $nodeModulesPath -PathType Container) {
    Write-Host "Using existing dependencies in $nodeModulesPath"
    return
  }

  $npmCmd = Get-NpmCmd
  $lockFilePath = Join-Path $WorkingDirectory 'package-lock.json'
  if (Test-Path -LiteralPath $lockFilePath -PathType Leaf) {
    Invoke-Process -FilePath $npmCmd -ArgumentList @('ci') -WorkingDirectory $WorkingDirectory
    return
  }

  Invoke-Process -FilePath $npmCmd -ArgumentList @('install') -WorkingDirectory $WorkingDirectory
}

function Get-IsccPath {
  param([string]$PreferredPath)

  if ($PreferredPath -and (Test-Path -LiteralPath $PreferredPath)) {
    return (Resolve-Path -LiteralPath $PreferredPath).Path
  }

  foreach ($candidate in @(
    $env:ISCC_PATH,
    'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
    'C:\Program Files\Inno Setup 6\ISCC.exe'
  )) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw 'ISCC.exe was not found. Install Inno Setup 6 or pass -IsccPath.'
}

function Write-JsonFile {
  param(
    [Parameter(Mandatory = $true)]$Value,
    [Parameter(Mandatory = $true)][string]$Path,
    [int]$Depth = 20
  )

  $directory = Split-Path -Path $Path -Parent
  if ($directory) {
    Ensure-Directory -Path $directory | Out-Null
  }

  $Value | ConvertTo-Json -Depth $Depth | Set-Content -Path $Path
}

function Get-AppVersion {
  param([Parameter(Mandatory = $true)][string]$RepoRoot)

  $packageJsonPath = Join-Path $RepoRoot 'package.json'
  $packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
  return [string]$packageJson.version
}
