param(
  [Parameter(Mandatory = $true)][string]$SiteName,
  [Parameter(Mandatory = $true)][string]$AppPoolName,
  [Parameter(Mandatory = $true)][string]$SitePhysicalPath,
  [ValidateSet('http', 'https')][string]$BindingProtocol = 'http',
  [int]$BindingPort = 80,
  [string]$HostHeader = '',
  [int]$ApiPort = 4100,
  [string]$WebConfigTemplatePath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module WebAdministration

if (-not (Test-Path -LiteralPath $SitePhysicalPath)) {
  throw "Frontend path '$SitePhysicalPath' does not exist."
}

if (-not (Test-Path IIS:\AppPools\$AppPoolName)) {
  New-WebAppPool -Name $AppPoolName | Out-Null
}
Set-ItemProperty IIS:\AppPools\$AppPoolName -Name managedRuntimeVersion -Value ''
Set-ItemProperty IIS:\AppPools\$AppPoolName -Name managedPipelineMode -Value 0
Set-ItemProperty IIS:\AppPools\$AppPoolName -Name processModel.identityType -Value 4

$bindingInformation = "*:{0}:{1}" -f $BindingPort, $HostHeader
if (Test-Path IIS:\Sites\$SiteName) {
  Set-ItemProperty IIS:\Sites\$SiteName -Name physicalPath -Value $SitePhysicalPath
  Set-ItemProperty IIS:\Sites\$SiteName -Name applicationPool -Value $AppPoolName

  $existingBinding = Get-WebBinding -Name $SiteName -Protocol $BindingProtocol | Where-Object { $_.bindingInformation -eq $bindingInformation }
  if (-not $existingBinding) {
    New-WebBinding -Name $SiteName -Protocol $BindingProtocol -Port $BindingPort -HostHeader $HostHeader | Out-Null
  }
}
else {
  New-Website -Name $SiteName -Port $BindingPort -HostHeader $HostHeader -PhysicalPath $SitePhysicalPath -ApplicationPool $AppPoolName -Force | Out-Null
}

$appcmd = Join-Path $env:WINDIR 'System32\inetsrv\appcmd.exe'
if (Test-Path -LiteralPath $appcmd) {
  & $appcmd set config -section:system.webServer/proxy /enabled:"True" /preserveHostHeader:"True" /reverseRewriteHostInResponseHeaders:"False" /commit:apphost | Out-Null
}

if ($WebConfigTemplatePath -and (Test-Path -LiteralPath $WebConfigTemplatePath)) {
  $rendered = (Get-Content -LiteralPath $WebConfigTemplatePath -Raw).Replace('__API_PORT__', [string]$ApiPort)
  Set-Content -Path (Join-Path $SitePhysicalPath 'web.config') -Value $rendered
}

Write-Host "IIS site '$SiteName' is configured at '$SitePhysicalPath'."

