# Allow KonoPOS on the local network. Idempotent — skips if rules exist, self-elevates once.
$ErrorActionPreference = 'Stop'

$ruleName = 'KonoPOS Web (5173)'
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue |
  Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' }
if ($existing) {
  Write-Host 'KonoPOS firewall rules already configured.'
  exit 0
}

$isAdmin = (
  [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host 'Elevation required — accept the UAC prompt to allow LAN access.'
  Start-Process powershell -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath
  ) -Verb RunAs
  exit 0
}

$rules = @(
  @{ Name = 'KonoPOS Web (5173)'; Port = 5173; Desc = 'KonoPOS web UI — LAN access' },
  @{ Name = 'KonoPOS API (5000)'; Port = 5000; Desc = 'KonoPOS API — LAN access' }
)

foreach ($r in $rules) {
  Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule -ErrorAction SilentlyContinue

  New-NetFirewallRule `
    -DisplayName $r.Name `
    -Description $r.Desc `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $r.Port `
    -Profile Any `
    -Enabled True | Out-Null

  Write-Host "OK: $($r.Name) (TCP $($r.Port), all profiles)"
}

Write-Host ''
Write-Host 'Done. Other devices on the same Wi-Fi can open http://YOUR_IP:5173'
