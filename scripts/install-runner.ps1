# =============================================================================
# Install a GitHub Actions self-hosted runner for RobF75/HHWebsite on this box.
#
# Run as Administrator. Idempotent - re-running will refresh the runner binary
# but won't touch an existing registration unless you pass -Reconfigure.
#
# Usage:
#   First-time setup:
#     .\install-runner.ps1 -Token <REGISTRATION_TOKEN>
#   Re-run on an already configured runner:
#     .\install-runner.ps1
#
# Where to get the token:
#   https://github.com/RobF75/HHWebsite/settings/actions/runners/new
#   -> copy the value passed to `./config.cmd --token ...` in the snippet.
#   Tokens expire after ~1 hour and are single-use. If you see "invalid token"
#   or HTTP 404, grab a fresh one and re-run with -Reconfigure.
#
# What this does:
#   1. Resolves the LATEST GitHub Actions runner release for Windows x64.
#      (Hardcoded versions go stale and start failing registration with HTTP
#      404 against the current GitHub API - so we always fetch latest.)
#   2. Downloads + extracts into C:\actions-runner-hhwebsite\
#   3. Configures against RobF75/HHWebsite with labels: self-hosted, windows
#   4. Installs as a Windows service and starts it.
#
# After this, push to main on RobF75/HHWebsite triggers the deploy workflow.
# =============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$Token,

    [string]$RunnerName  = "$env:COMPUTERNAME-hhwebsite",
    [string]$InstallPath = "C:\actions-runner-hhwebsite",
    [string]$Repo        = "https://github.com/RobF75/HHWebsite",
    # Leave empty to auto-resolve the latest release. Pin only if you need to.
    [string]$RunnerVersion = "",
    [switch]$Reconfigure
)

$ErrorActionPreference = 'Stop'

function Require-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
        throw "This script must be run as Administrator."
    }
}

function Resolve-LatestRunnerVersion {
    Write-Host "==> Resolving latest runner version from GitHub releases ..." -ForegroundColor Cyan
    # Modern TLS for older PowerShell hosts.
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/actions/runner/releases/latest" -UseBasicParsing -Headers @{ "User-Agent" = "factree-runner-install" }
    # Tag is "v2.330.0"; strip the leading "v".
    return $rel.tag_name.TrimStart('v')
}

function Check-LastExit($context) {
    if ($LASTEXITCODE -ne 0) {
        throw "$context failed with exit code $LASTEXITCODE. See output above. If this was a HTTP 404 from runner-registration, your token has expired or the runner binary is out-of-date - grab a fresh token from $Repo/settings/actions/runners/new and re-run with -Reconfigure."
    }
}

function Get-RunnerServiceName {
    param([string]$RunnerRoot)

    $serviceFile = Join-Path $RunnerRoot ".service"
    if (-not (Test-Path $serviceFile)) {
        return $null
    }

    $name = (Get-Content -Path $serviceFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($name)) {
        return $null
    }

    return $name.Trim()
}

function Remove-RunnerService {
    param([string]$ServiceName)

    if ([string]::IsNullOrWhiteSpace($ServiceName)) {
        return
    }

    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($null -eq $svc) {
        return
    }

    if ($svc.Status -ne 'Stopped') {
        Write-Host "    Stopping existing service '$ServiceName' ..."
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }

    Write-Host "    Deleting existing service '$ServiceName' ..."
    & sc.exe delete $ServiceName | Out-Null
}

Require-Admin

if ([string]::IsNullOrWhiteSpace($RunnerVersion)) {
    $RunnerVersion = Resolve-LatestRunnerVersion
}

Write-Host "==> Target install path: $InstallPath" -ForegroundColor Cyan
Write-Host "==> Runner name:         $RunnerName"  -ForegroundColor Cyan
Write-Host "==> Repo:                $Repo"        -ForegroundColor Cyan
Write-Host "==> Runner version:      $RunnerVersion" -ForegroundColor Cyan

# 1. Create / clean the install dir
if (Test-Path $InstallPath) {
    if ($Reconfigure) {
        Write-Host "==> -Reconfigure set - removing existing $InstallPath" -ForegroundColor Yellow
        Push-Location $InstallPath
        try {
            Remove-RunnerService -ServiceName (Get-RunnerServiceName -RunnerRoot $InstallPath)

            if (Test-Path ".\config.cmd") {
                Write-Host "    Removing existing registration (best-effort) ..."
                if ([string]::IsNullOrWhiteSpace($Token)) {
                    & .\config.cmd remove --local 2>$null | Out-Null
                } else {
                    & .\config.cmd remove --token $Token 2>$null | Out-Null
                }
            }
        } finally { Pop-Location }
        Remove-Item -Recurse -Force $InstallPath
    } else {
        Write-Host "==> $InstallPath exists. Re-run with -Reconfigure to wipe + reinstall." -ForegroundColor Yellow
        Write-Host "    Continuing with re-download into the existing folder (overwrites binaries)."
    }
}
if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath | Out-Null
}

# 2. Download runner
$zip = Join-Path $InstallPath "actions-runner-win-x64-$RunnerVersion.zip"
$url = "https://github.com/actions/runner/releases/download/v$RunnerVersion/actions-runner-win-x64-$RunnerVersion.zip"
Write-Host "==> Downloading runner v$RunnerVersion ..." -ForegroundColor Cyan
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

# 3. Extract
Write-Host "==> Extracting ..." -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
$tempExtractDir = Join-Path $InstallPath "_extract_tmp"
try {
    # Prefer overwrite-capable extraction when available.
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $InstallPath, $true)
}
catch {
    if ($_.Exception -is [System.Management.Automation.MethodException]) {
        Write-Host "==> Overwrite extract API not available; using temp extraction fallback ..." -ForegroundColor Yellow
        if (Test-Path $tempExtractDir) {
            Remove-Item -Path $tempExtractDir -Recurse -Force
        }
        New-Item -ItemType Directory -Path $tempExtractDir | Out-Null
        [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $tempExtractDir)
        Get-ChildItem -Path $tempExtractDir -Force | Move-Item -Destination $InstallPath -Force
        Remove-Item -Path $tempExtractDir -Recurse -Force
    }
    else {
        throw
    }
}
Remove-Item $zip

# Some runner archives extract into a single nested folder. If that happened,
# promote its contents to $InstallPath so runner scripts are in the root.
$requiredFiles = @('config.cmd', 'run.cmd')
$allInRoot = $true
foreach ($f in $requiredFiles) {
    if (-not (Test-Path (Join-Path $InstallPath $f))) {
        $allInRoot = $false
        break
    }
}

if (-not $allInRoot) {
    $nestedRunnerRoot = Get-ChildItem -Path $InstallPath -Directory -ErrorAction SilentlyContinue |
        Where-Object {
            (Test-Path (Join-Path $_.FullName 'config.cmd')) -and
            (Test-Path (Join-Path $_.FullName 'run.cmd'))
        } |
        Select-Object -First 1

    if ($null -ne $nestedRunnerRoot) {
        Write-Host "==> Detected nested runner folder '$($nestedRunnerRoot.Name)'; flattening ..." -ForegroundColor Yellow
        Get-ChildItem -Path $nestedRunnerRoot.FullName -Force | Move-Item -Destination $InstallPath -Force
        Remove-Item -Path $nestedRunnerRoot.FullName -Recurse -Force
    }
}

# Verify the runner files actually arrived.
foreach ($f in $requiredFiles) {
    if (-not (Test-Path (Join-Path $InstallPath $f))) {
        throw "Expected $f not found in $InstallPath after extract. Check that the downloaded file is the official actions runner zip for Windows x64."
    }
}

# 4. Configure (idempotent - config.cmd refuses to re-register without remove)
Push-Location $InstallPath
try {
    if (-not (Test-Path ".runner")) {
        if ([string]::IsNullOrWhiteSpace($Token)) {
            throw "A registration token is required for first-time configuration. Re-run with -Token <REGISTRATION_TOKEN>."
        }

        Write-Host "==> Configuring runner against $Repo ..." -ForegroundColor Cyan
        & .\config.cmd `
            --unattended `
            --url $Repo `
            --token $Token `
            --name $RunnerName `
            --labels "self-hosted,windows" `
            --work "_work" `
            --runasservice `
            --replace
        Check-LastExit "config.cmd"

        if (-not (Test-Path ".runner")) {
            throw "config.cmd reported success but no .runner file exists - registration silently failed. Grab a fresh token and re-run with -Reconfigure."
        }
    } else {
        Write-Host "==> Runner already configured (.runner file exists). Skipping config." -ForegroundColor Yellow
    }

    # 5. Ensure + start service
    $serviceName = Get-RunnerServiceName -RunnerRoot $InstallPath
    if ([string]::IsNullOrWhiteSpace($serviceName)) {
        throw "Runner service metadata (.service) was not found. Re-run with -Reconfigure and a fresh -Token so the runner can be configured with --runasservice."
    }

    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($null -eq $existingService) {
        throw "Runner service '$serviceName' is not installed. Re-run with -Reconfigure and a fresh -Token."
    }

    if ($null -ne $existingService -and $existingService.Status -eq 'Running') {
        Write-Host "==> Service '$serviceName' is already running. Skipping start." -ForegroundColor Yellow
    } else {
        Write-Host "==> Starting service '$serviceName' ..." -ForegroundColor Cyan
        Start-Service -Name $serviceName
    }

    Start-Sleep -Seconds 2
    Get-Service -Name $serviceName | Format-Table -AutoSize | Out-Host
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "==> Done. Verify the runner appears as 'Idle' here:" -ForegroundColor Green
Write-Host "    $Repo/settings/actions/runners"
