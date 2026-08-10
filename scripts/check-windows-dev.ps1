$ErrorActionPreference = "Stop"

function Test-Tool {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string[]]$VersionArgs
  )

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    Write-Host "[missing] $Name" -ForegroundColor Red
    return $false
  }

  $version = & $Name @VersionArgs 2>&1 | Select-Object -First 1
  Write-Host "[ok]      $Name - $version" -ForegroundColor Green
  return $true
}

Write-Host "ByLucky Windows 11 development environment" -ForegroundColor Cyan
$checks = @(
  (Test-Tool -Name "git" -VersionArgs @("--version")),
  (Test-Tool -Name "node" -VersionArgs @("--version")),
  (Test-Tool -Name "npm" -VersionArgs @("--version")),
  (Test-Tool -Name "docker" -VersionArgs @("--version"))
)

if (Get-Command wsl -ErrorAction SilentlyContinue) {
  $wslStatus = (wsl --status 2>&1 | Out-String) -replace "`0", ""
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[info]    WSL is available" -ForegroundColor DarkCyan
    Write-Host $wslStatus.Trim()
  } else {
    Write-Host "[optional] WSL status is unavailable; native Windows development remains supported" -ForegroundColor Yellow
  }
} else {
  Write-Host "[optional] WSL 2 is not installed" -ForegroundColor Yellow
}

try {
  docker compose version | Out-Host
  Write-Host "[ok]      Docker Compose is available" -ForegroundColor Green
} catch {
  Write-Host "[missing] Docker Compose or Docker Desktop is not running" -ForegroundColor Red
  $checks += $false
}

$nodeMajor = [int]((& node -p "process.versions.node.split('.')[0]") 2>$null)
if ($nodeMajor -ne 22) {
  Write-Host "[warning] Node.js 22 LTS is required; current major is $nodeMajor" -ForegroundColor Yellow
  $checks += $false
}

if ($checks -contains $false) {
  Write-Host "Environment check failed. See README.md for installation steps." -ForegroundColor Red
  exit 1
}

Write-Host "Environment is ready for ByLucky Phase 1." -ForegroundColor Green
