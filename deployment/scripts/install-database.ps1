param(
  [Parameter(Mandatory = $true)][string]$SettingsFile,
  [Parameter(Mandatory = $true)][string]$SqlRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Data

function Split-SqlBatches {
  param([string]$SqlText)

  $pattern = '(?im)^\s*GO\s*(?:--.*)?$'
  return [regex]::Split($SqlText, $pattern) | Where-Object { $_.Trim().Length -gt 0 }
}

function Invoke-SqlBatchFile {
  param(
    [string]$ConnectionString,
    [string]$FilePath,
    [hashtable]$Tokens
  )

  Write-Host "Executing SQL script $FilePath"
  $sqlText = Get-Content -LiteralPath $FilePath -Raw
  foreach ($key in $Tokens.Keys) {
    $sqlText = $sqlText.Replace($key, [string]$Tokens[$key])
  }

  $connection = New-Object System.Data.SqlClient.SqlConnection $ConnectionString
  $connection.Open()
  try {
    foreach ($batch in (Split-SqlBatches -SqlText $sqlText)) {
      $command = $connection.CreateCommand()
      $command.CommandText = $batch
      $command.CommandTimeout = 180
      [void]$command.ExecuteNonQuery()
    }
  }
  finally {
    $connection.Close()
  }
}

$settings = Get-Content -LiteralPath $SettingsFile -Raw | ConvertFrom-Json
if (-not [bool]$settings.database.installDatabase) {
  Write-Host 'Database installation is disabled in deploy settings.'
  return
}

$tokens = @{
  '$(DatabaseName)' = [string]$settings.database.databaseName
  '__SET_ADMIN_PIN_HASH__' = [string]$settings.security.adminPinHash
  '__SET_JWT_SECRET__' = [string]$settings.security.jwtSecret
}

Invoke-SqlBatchFile -ConnectionString ([string]$settings.database.adminConnectionString) -FilePath (Join-Path $SqlRoot '001_create_database.sql') -Tokens $tokens
Invoke-SqlBatchFile -ConnectionString ([string]$settings.database.appConnectionString) -FilePath (Join-Path $SqlRoot '002_create_tables.sql') -Tokens $tokens
Invoke-SqlBatchFile -ConnectionString ([string]$settings.database.appConnectionString) -FilePath (Join-Path $SqlRoot '003_seed_initial_data.sql') -Tokens $tokens
Invoke-SqlBatchFile -ConnectionString ([string]$settings.database.appConnectionString) -FilePath (Join-Path $SqlRoot '004_indexes_and_constraints.sql') -Tokens $tokens

Write-Host 'Database scripts completed successfully.'
