[CmdletBinding()]
param()

# Native Windows 11 deployment menu for ByLucky.
# It manages only docker-compose.dev.yml and the local Node runtime.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectDir = $PSScriptRoot
$ComposeFile = Join-Path $ProjectDir "docker-compose.dev.yml"
$EnvFile = Join-Path $ProjectDir ".env"
$EnvExample = Join-Path $ProjectDir ".env.example"
$RuntimeDir = Join-Path $ProjectDir ".bylucky-runtime"
$LogDir = Join-Path $ProjectDir "logs\production"
$WebPidFile = Join-Path $RuntimeDir "web.pid"
$WorkerPidFile = Join-Path $RuntimeDir "worker.pid"
$WebStdoutLog = Join-Path $LogDir "web.stdout.log"
$WebStderrLog = Join-Path $LogDir "web.stderr.log"
$WorkerStdoutLog = Join-Path $LogDir "worker.stdout.log"
$WorkerStderrLog = Join-Path $LogDir "worker.stderr.log"
$PostgresPort = if ([string]::IsNullOrWhiteSpace($env:POSTGRES_PORT)) { "5433" } else { $env:POSTGRES_PORT }
$ManagedDatabaseUrl = "postgresql://bylucky:bylucky_dev@localhost:$PostgresPort/bylucky"

Set-Location -LiteralPath $ProjectDir

function Write-Section {
  param([Parameter(Mandatory = $true)][string]$Message)

  Write-Host ""
  Write-Host $Message -ForegroundColor Cyan
}

function Stop-WithError {
  param([Parameter(Mandatory = $true)][string]$Message)

  throw [System.InvalidOperationException]::new($Message)
}

function Assert-Command {
  param([Parameter(Mandatory = $true)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Stop-WithError "Required command not found: $Name"
  }
}

function Assert-ProjectFiles {
  foreach ($path in @($ComposeFile, $EnvExample)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
      Stop-WithError "Required project file is missing: $path"
    }
  }
}

function Assert-NodeVersion {
  $majorText = ((& node -p "process.versions.node.split('.')[0]") | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $majorText -notmatch '^\d+$') {
    Stop-WithError "Unable to determine the installed Node.js version."
  }

  $major = [int]$majorText
  if ($major -lt 22 -or $major -ge 23) {
    Stop-WithError "Node.js 22 is required. Current major version: $major"
  }
}

function Get-DockerEngineProbe {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = (& docker info --format "{{.ServerVersion}}" 2>&1 | Out-String).Trim()
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return [PSCustomObject]@{
    Ready = $exitCode -eq 0
    Output = $output
  }
}

function Wait-ForDockerEngine {
  for ($attempt = 1; $attempt -le 60; $attempt++) {
    $probe = Get-DockerEngineProbe
    if ($probe.Ready) {
      return $true
    }
    Start-Sleep -Seconds 2
  }

  return $false
}

function Get-DockerDesktopPath {
  $candidates = @()
  foreach ($basePath in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
    if (-not [string]::IsNullOrWhiteSpace($basePath)) {
      $candidates += Join-Path $basePath "Docker\Docker\Docker Desktop.exe"
    }
  }
  if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    $candidates += Join-Path $env:LOCALAPPDATA "Docker\Docker Desktop.exe"
  }

  return $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}

function Assert-DockerReady {
  & docker compose version *> $null
  if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Docker Compose v2 is unavailable. Install Docker Desktop, then run deploy.ps1 again."
  }

  $probe = Get-DockerEngineProbe
  if ($probe.Ready) {
    return
  }

  if ($probe.Output -match "permission denied") {
    $context = ((& docker context show 2>$null) | Out-String).Trim()
    $message = @(
      "Docker Desktop is running, but Windows denied access to its Docker named pipe.",
      "Quit Docker Desktop from the system tray.",
      "Start Docker Desktop again as the current Windows user, not as Administrator.",
      "If this remains after Docker Desktop is ready, restart Windows and verify: docker info",
      "Current Docker context: $context"
    ) -join [Environment]::NewLine
    Stop-WithError $message
  }

  $desktopPath = Get-DockerDesktopPath
  if ([string]::IsNullOrWhiteSpace($desktopPath)) {
    Stop-WithError "Docker Desktop is not installed. Install Docker Desktop, start it, and verify docker info before running deploy.ps1."
  }

  $response = Read-Host "Docker Desktop is not ready. Start it now and wait for the engine? [Y/n]"
  if ($response -match '^(?i:n|no)$') {
    Stop-WithError "Docker Desktop must be running before ByLucky can use its local PostgreSQL container."
  }

  Start-Process -FilePath $desktopPath
  Write-Host "Waiting up to 120 seconds for Docker Desktop to become ready."
  if (-not (Wait-ForDockerEngine)) {
    Stop-WithError "Docker Desktop did not become ready. Open Docker Desktop and resolve its engine status, then verify docker info."
  }
}

function Assert-Prerequisites {
  Assert-ProjectFiles
  Assert-Command "node"
  Assert-Command "npm"
  Assert-Command "docker"
  Assert-NodeVersion
  Assert-DockerReady
}

function Get-EnvValue {
  param([Parameter(Mandatory = $true)][string]$Key)

  if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
    return $null
  }

  $prefix = "$Key="
  foreach ($line in Get-Content -LiteralPath $EnvFile) {
    if ($line.StartsWith($prefix, [System.StringComparison]::Ordinal)) {
      return $line.Substring($prefix.Length)
    }
  }

  return $null
}

function Set-EnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Key,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $lines = if (Test-Path -LiteralPath $EnvFile -PathType Leaf) {
    @(Get-Content -LiteralPath $EnvFile)
  } else {
    @()
  }
  $escapedKey = [regex]::Escape($Key)
  $found = $false
  $updatedLines = foreach ($line in $lines) {
    if ($line -match "^$escapedKey=") {
      $found = $true
      "$Key=$Value"
    } else {
      $line
    }
  }

  if (-not $found) {
    $updatedLines += "$Key=$Value"
  }

  $temporaryPath = Join-Path $ProjectDir ".env.$([guid]::NewGuid().ToString('N')).tmp"
  $content = ([string]::Join([Environment]::NewLine, [string[]]$updatedLines)) + [Environment]::NewLine
  [System.IO.File]::WriteAllText($temporaryPath, $content, [System.Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporaryPath -Destination $EnvFile -Force
}

function Ensure-EnvFile {
  if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
    Copy-Item -LiteralPath $EnvExample -Destination $EnvFile
  }
}

function Ensure-ManagedDatabaseUrl {
  $existingUrl = Get-EnvValue -Key "DATABASE_URL"
  if ([string]::IsNullOrWhiteSpace($existingUrl) -or $existingUrl.StartsWith("replace-with-", [System.StringComparison]::Ordinal)) {
    Set-EnvValue -Key "DATABASE_URL" -Value $ManagedDatabaseUrl
    return
  }

  if ($existingUrl -ne $ManagedDatabaseUrl) {
    Stop-WithError "deploy.ps1 manages only the PostgreSQL database from docker-compose.dev.yml. DATABASE_URL must be $ManagedDatabaseUrl"
  }
}

function New-SecretValue {
  $secret = ((& node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))") | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($secret)) {
    Stop-WithError "Unable to generate an application secret."
  }

  return $secret
}

function Ensure-Secret {
  param([Parameter(Mandatory = $true)][string]$Key)

  $currentValue = Get-EnvValue -Key $Key
  if (-not [string]::IsNullOrWhiteSpace($currentValue) -and -not $currentValue.StartsWith("replace-with-", [System.StringComparison]::Ordinal)) {
    return
  }

  Set-EnvValue -Key $Key -Value (New-SecretValue)
}

function Ensure-Secrets {
  Ensure-Secret -Key "SESSION_SECRET"
  Ensure-Secret -Key "CODE_HMAC_SECRET"
  Ensure-Secret -Key "CONFIG_ENCRYPTION_KEY"
}

function Test-DependenciesReady {
  foreach ($relativePath in @(
    "node_modules\next\package.json",
    "node_modules\tsx\package.json",
    "node_modules\typescript\package.json"
  )) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectDir $relativePath) -PathType Leaf)) {
      return $false
    }
  }

  return $true
}

function Ensure-Dependencies {
  $installedLock = Join-Path $ProjectDir "node_modules\.package-lock.json"
  if (Test-DependenciesReady) {
    if ((Test-Path -LiteralPath $installedLock -PathType Leaf) -and ((Get-Item -LiteralPath $ProjectDir\package-lock.json).LastWriteTimeUtc -gt (Get-Item -LiteralPath $installedLock).LastWriteTimeUtc)) {
      Stop-WithError "package-lock.json is newer than node_modules. Stop local Node/Next processes, run npm ci, then run deploy.ps1 again."
    }

    Write-Host "Using the existing Node dependencies."
    return
  }

  Write-Host "Node dependencies are missing or incomplete. Installing from package-lock.json."
  & npm ci
  if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Could not install Node dependencies. Stop any running ByLucky development server or worker first, then run deploy.ps1 again."
  }
}

function Read-PlainTextSecureString {
  param([Parameter(Mandatory = $true)][System.Security.SecureString]$SecureValue)

  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Get-PasswordHash {
  param([Parameter(Mandatory = $true)][string]$PlainText)

  $nodePath = (Get-Command node -ErrorAction Stop).Source
  $nodeCode = "import { readFileSync } from 'node:fs'; import { hashAdminPassword } from './src/server/auth/password.ts'; process.stdout.write(await hashAdminPassword(readFileSync(0, 'utf8')));"
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $nodePath
  $startInfo.Arguments = "--conditions=react-server --import tsx --input-type=module -e `"$nodeCode`""
  $startInfo.WorkingDirectory = $ProjectDir
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  if (-not $process.Start()) {
    Stop-WithError "Unable to start the password hashing process."
  }

  $process.StandardInput.Write($PlainText)
  $process.StandardInput.Close()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()

  if ($process.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($stdout)) {
    Stop-WithError "Unable to generate the administrator password hash. $stderr"
  }

  return $stdout.Trim()
}

function Set-AdministratorCredentials {
  $username = $null
  do {
    $username = Read-Host "Administrator username"
    if ($username -notmatch '^[A-Za-z0-9_.@-]{1,128}$') {
      Write-Host "Use 1-128 letters, numbers, dots, underscores, @, or hyphens." -ForegroundColor Yellow
    }
  } while ($username -notmatch '^[A-Za-z0-9_.@-]{1,128}$')

  while ($true) {
    $password = Read-PlainTextSecureString -SecureValue (Read-Host "Administrator password (at least 12 characters)" -AsSecureString)
    $confirmation = Read-PlainTextSecureString -SecureValue (Read-Host "Confirm administrator password" -AsSecureString)
    try {
      if ($password -ne $confirmation) {
        Write-Host "Passwords do not match." -ForegroundColor Yellow
        continue
      }
      if ($password.Length -lt 12 -or $password.Length -gt 1024) {
        Write-Host "Password must contain 12-1024 characters." -ForegroundColor Yellow
        continue
      }

      $passwordHash = Get-PasswordHash -PlainText $password
      Set-EnvValue -Key "ADMIN_USERNAME" -Value $username
      Set-EnvValue -Key "ADMIN_PASSWORD_HASH" -Value $passwordHash
      return
    } finally {
      $password = $null
      $confirmation = $null
      $passwordHash = $null
    }
  }
}

function Set-ApplicationUrl {
  $existingUrl = Get-EnvValue -Key "APP_URL"
  if ([string]::IsNullOrWhiteSpace($existingUrl) -or $existingUrl.StartsWith("replace-with-", [System.StringComparison]::Ordinal)) {
    $existingUrl = "http://localhost:3000"
  }

  do {
    $requestedUrl = Read-Host "Public application URL [$existingUrl]"
    if ([string]::IsNullOrWhiteSpace($requestedUrl)) {
      $requestedUrl = $existingUrl
    }
    if ($requestedUrl -notmatch '^https?://\S+$') {
      Write-Host "APP_URL must begin with http:// or https:// and contain no spaces." -ForegroundColor Yellow
    }
  } while ($requestedUrl -notmatch '^https?://\S+$')

  Set-EnvValue -Key "APP_URL" -Value $requestedUrl
}

function Wait-ForDatabase {
  for ($attempt = 1; $attempt -le 30; $attempt++) {
    & docker compose -f $ComposeFile exec -T db pg_isready -U bylucky -d bylucky *> $null
    if ($LASTEXITCODE -eq 0) {
      return
    }
    Start-Sleep -Seconds 2
  }

  Stop-WithError "PostgreSQL did not become ready within 60 seconds."
}

function Start-Database {
  & docker compose -f $ComposeFile up -d db
  if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Unable to start the ByLucky PostgreSQL container."
  }
  Wait-ForDatabase
}

function Get-RecordedProcess {
  param([Parameter(Mandatory = $true)][string]$PidFile)

  if (-not (Test-Path -LiteralPath $PidFile -PathType Leaf)) {
    return $null
  }

  $pidText = (Get-Content -LiteralPath $PidFile -Raw).Trim()
  $processId = 0
  if (-not [int]::TryParse($pidText, [ref]$processId)) {
    Remove-Item -LiteralPath $PidFile -Force
    return $null
  }

  return Get-Process -Id $processId -ErrorAction SilentlyContinue
}

function Stop-RecordedProcess {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$PidFile,
    [Parameter(Mandatory = $true)][string]$ExpectedFragment
  )

  $process = Get-RecordedProcess -PidFile $PidFile
  if ($null -eq $process) {
    return
  }

  try {
    $processDetails = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $($process.Id)" -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace($processDetails.CommandLine) -or $processDetails.CommandLine -notlike "*$ExpectedFragment*") {
      Stop-WithError "Will not stop $Label (PID $($process.Id)) because it does not match the recorded ByLucky command."
    }
    Stop-Process -Id $process.Id -ErrorAction Stop
    $process.WaitForExit(15000) | Out-Null
  } catch {
    Stop-WithError "Unable to stop $Label (PID $($process.Id)). $($_.Exception.Message)"
  } finally {
    if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
      Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    }
  }
}

function Stop-Runtime {
  Stop-RecordedProcess -Label "ByLucky web server" -PidFile $WebPidFile -ExpectedFragment "node_modules\next\dist\bin\next"
  Stop-RecordedProcess -Label "ByLucky worker" -PidFile $WorkerPidFile -ExpectedFragment "dist-worker\index.cjs"
}

function Assert-ProductionPortIsAvailable {
  $listeners = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
  if ($listeners.Count -gt 0) {
    $processIds = ($listeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ", "
    Stop-WithError "Port 3000 is already in use by PID $processIds. Stop npm run dev or the other local server before starting the production runtime."
  }
}

function Show-LogTail {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (Test-Path -LiteralPath $Path -PathType Leaf) {
    Get-Content -LiteralPath $Path -Tail 30 | Write-Host
  }
}

function Start-ProcessWithProductionEnvironment {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$ArgumentList,
    [Parameter(Mandatory = $true)][string]$StdoutLog,
    [Parameter(Mandatory = $true)][string]$StderrLog
  )

  $previousNodeEnvironment = $env:NODE_ENV
  $env:NODE_ENV = "production"
  try {
    return Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $ProjectDir -RedirectStandardOutput $StdoutLog -RedirectStandardError $StderrLog -WindowStyle Hidden -PassThru
  } finally {
    if ($null -eq $previousNodeEnvironment) {
      Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
    } else {
      $env:NODE_ENV = $previousNodeEnvironment
    }
  }
}

function Start-Runtime {
  New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
  Stop-Runtime
  Assert-ProductionPortIsAvailable

  $nextEntry = Join-Path $ProjectDir "node_modules\next\dist\bin\next"
  $workerEntry = Join-Path $ProjectDir "dist-worker\index.cjs"
  $nodeCommand = (Get-Command node -ErrorAction Stop).Source
  if (-not (Test-Path -LiteralPath $nextEntry -PathType Leaf)) {
    Stop-WithError "Missing Next.js entry point. Run npm ci first."
  }
  if (-not (Test-Path -LiteralPath $workerEntry -PathType Leaf)) {
    Stop-WithError "Missing Worker build. Run npm run worker:build first."
  }

  $webProcess = Start-ProcessWithProductionEnvironment -FilePath $nodeCommand -ArgumentList @($nextEntry, "start") -StdoutLog $WebStdoutLog -StderrLog $WebStderrLog
  Set-Content -LiteralPath $WebPidFile -Value $webProcess.Id -NoNewline

  $workerProcess = Start-ProcessWithProductionEnvironment -FilePath $nodeCommand -ArgumentList @("--conditions=react-server", $workerEntry) -StdoutLog $WorkerStdoutLog -StderrLog $WorkerStderrLog
  Set-Content -LiteralPath $WorkerPidFile -Value $workerProcess.Id -NoNewline

  Start-Sleep -Seconds 2
  if (-not (Get-Process -Id $webProcess.Id -ErrorAction SilentlyContinue)) {
    Show-LogTail -Path $WebStdoutLog
    Show-LogTail -Path $WebStderrLog
    Stop-WithError "The web server did not start."
  }
  if (-not (Get-Process -Id $workerProcess.Id -ErrorAction SilentlyContinue)) {
    Show-LogTail -Path $WorkerStdoutLog
    Show-LogTail -Path $WorkerStderrLog
    Stop-RecordedProcess -Label "ByLucky web server" -PidFile $WebPidFile -ExpectedFragment "node_modules\next\dist\bin\next"
    Stop-WithError "The worker did not start."
  }

  Write-Section "ByLucky is running. Web PID: $($webProcess.Id). Worker PID: $($workerProcess.Id)."
  Write-Host "Logs: $LogDir"
}

function Invoke-FirstDeployment {
  Assert-Prerequisites
  Ensure-Dependencies
  Ensure-EnvFile
  Ensure-ManagedDatabaseUrl
  Ensure-Secrets
  Set-ApplicationUrl
  Set-AdministratorCredentials
  Start-Database
  $env:NODE_ENV = "production"
  & npm run db:migrate
  if ($LASTEXITCODE -ne 0) { Stop-WithError "Database migration failed." }
  & npm run worker:build
  if ($LASTEXITCODE -ne 0) { Stop-WithError "Worker build failed." }
  & npm run build
  if ($LASTEXITCODE -ne 0) { Stop-WithError "Production build failed." }
  Start-Runtime
}

function Invoke-ChangeAdministratorCredentials {
  Assert-Prerequisites
  Ensure-Dependencies
  Ensure-EnvFile
  Ensure-ManagedDatabaseUrl
  Set-AdministratorCredentials

  if ((Test-Path -LiteralPath $WebPidFile) -or (Test-Path -LiteralPath $WorkerPidFile)) {
    Start-Runtime
    Write-Section "Administrator credentials were updated and the local runtime was restarted."
  } else {
    Write-Section "Administrator credentials were updated. Run option 1 to start the local runtime."
  }
}

function Invoke-ClearDataAndRedeploy {
  Assert-Prerequisites
  Ensure-Dependencies
  Ensure-EnvFile
  Ensure-ManagedDatabaseUrl

  Write-Host ""
  Write-Host "This deletes only the PostgreSQL volume declared by docker-compose.dev.yml." -ForegroundColor Yellow
  Write-Host "Source files, logs, and .env secrets are kept. This cannot be undone." -ForegroundColor Yellow
  $confirmation = Read-Host "Type ERASE to delete all ByLucky database data and redeploy"
  if ($confirmation -cne "ERASE") {
    Write-Host "Canceled."
    return
  }

  Stop-Runtime
  & docker compose -f $ComposeFile down --volumes --remove-orphans
  if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Unable to remove the ByLucky PostgreSQL volume."
  }
  if (Test-Path -LiteralPath $RuntimeDir) {
    Remove-Item -LiteralPath $RuntimeDir -Recurse -Force
  }
  Invoke-FirstDeployment
}

function Show-Menu {
  Write-Host ""
  Write-Host "ByLucky Windows 11 deployment menu" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "1. First deployment (requires administrator username and password)"
  Write-Host "2. Change administrator username and password"
  Write-Host "3. Delete all ByLucky database data, then redeploy"
  Write-Host "0. Exit"
}

while ($true) {
  Show-Menu
  $selection = Read-Host "Choose an action"
  try {
    switch ($selection) {
      "1" { Invoke-FirstDeployment }
      "2" { Invoke-ChangeAdministratorCredentials }
      "3" { Invoke-ClearDataAndRedeploy }
      "0" { Write-Host "Exited."; exit 0 }
      default { Write-Host "Please enter 1, 2, 3, or 0." -ForegroundColor Yellow }
    }
  } catch {
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
  }
}
