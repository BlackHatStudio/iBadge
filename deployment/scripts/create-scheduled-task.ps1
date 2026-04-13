param(
  [Parameter(Mandatory = $true)][string]$TaskName,
  [Parameter(Mandatory = $true)][string]$ImportScriptPath,
  [Parameter(Mandatory = $true)][string]$SettingsFile,
  [int]$IntervalHours = 1,
  [string]$Description = 'Runs the iBadge employee import workflow.'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$interval = '{0:00}:00' -f $IntervalHours
$taskCommand = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{0}" -SettingsFile "{1}"' -f $ImportScriptPath, $SettingsFile
$startTime = '00:00'

& schtasks.exe /Create /F /SC HOURLY /MO $IntervalHours /TN $TaskName /TR $taskCommand /RU SYSTEM /ST $startTime | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Unable to create scheduled task '$TaskName'."
}

Write-Host "Scheduled task '$TaskName' is configured."
