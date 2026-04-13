param(
  [Parameter(Mandatory = $true)][string]$TemplatePath,
  [Parameter(Mandatory = $true)][string]$DestinationPath,
  [Parameter(Mandatory = $true)][hashtable]$Replacements,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ((Test-Path -LiteralPath $DestinationPath) -and -not $Force) {
  Write-Host "Preserving existing file $DestinationPath"
  return
}

$content = Get-Content -LiteralPath $TemplatePath -Raw
foreach ($key in $Replacements.Keys) {
  $content = $content.Replace($key, [string]$Replacements[$key])
}

$destinationDirectory = Split-Path -Path $DestinationPath -Parent
if ($destinationDirectory -and -not (Test-Path -LiteralPath $destinationDirectory)) {
  New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
}

Set-Content -Path $DestinationPath -Value $content
Write-Host "Rendered $DestinationPath"
