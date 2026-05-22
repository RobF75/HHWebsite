# =============================================================================
# Install a GitHub Actions self-hosted runner for RobF75/HHWebsite on this box.
#
# Run as Administrator. Idempotent — re-running will refresh the runner binary
# but won't touch an existing registration unless you pass -Reconfigure.
#
# Usage:
#   .\install-runner.ps1 -Token <REGISTRATION_TOKEN>
#
# Where to get the token:
#   https://github.com/RobF75/HHWebsite/settings/actions/runners/new
#   → copy the value passed to `./config.cmd --token ...` in the snippet.
#   Tokens expire after ~1 hour and are single-use. If you see "invalid token"
#   or HTTP 404, grab a fresh one and re-run with -Reconfigure.
#
# What this does:
#   1. Resolves the LATEST GitHub Actions runner release for Windows x64.
#      (Hardcoded versions go stale and start failing registration with HTTP
#      404 against the current GitHub API — so we always fetch latest.)
#   2. Downloads + extracts into C:\actions-runner-hhwebsite\
#   3. Configures against RobF75/HHWebsite with labels: self-hosted, windows
#   4. Installs as a Windows service and starts it.
#
# After this, push to main on RobF75/HHWebsite triggers the deploy workflow.
# =============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
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
        throw "$context failed with exit code $LASTEXITCODE. See output above. If this was a HTTP 404 from runner-registration, your token has expired or the runner binary is out-of-date — grab a fresh token from $Repo/settings/actions/runners/new and re-run with -Reconfigure."
    }
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
        Write-Host "==> -Reconfigure set — removing existing $InstallPath" -ForegroundColor Yellow
        Push-Location $InstallPath
        try {
            if (Test-Path ".\svc.cmd") {
                Write-Host "    Stopping + uninstalling existing service ..."
                & .\svc.cmd stop 2>$null      | Out-Null
                & .\svc.cmd uninstall 2>$null | Out-Null
            }
            if (Test-Path ".\config.cmd") {
                Write-Host "    Removing existing registration (best-effort) ..."
                & .\config.cmd remove --token $Token 2>$null | Out-Null
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
[System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $InstallPath)
Remove-Item $zip

# Verify the runner files actually arrived.
foreach ($f in @('config.cmd', 'svc.cmd', 'run.cmd')) {
    if (-not (Test-Path (Join-Path $InstallPath $f))) {
        throw "Expected $f not found in $InstallPath after extract. The download may have been incomplete."
    }
}

# 4. Configure (idempotent — config.cmd refuses to re-register without remove)
Push-Location $InstallPath
try {
    if (-not (Test-Path ".runner")) {
        Write-Host "==> Configuring runner against $Repo ..." -ForegroundColor Cyan
        & .\config.cmd `
            --unattended `
            --url $Repo `
            --token $Token `
            --name $RunnerName `
            --labels "self-hosted,windows" `
            --work "_work" `
            --replace
        Check-LastExit "config.cmd"

        if (-not (Test-Path ".runner")) {
            throw "config.cmd reported success but no .runner file exists — registration silently failed. Grab a fresh token and re-run with -Reconfigure."
        }
    } else {
        Write-Host "==> Runner already configured (.runner file exists). Skipping config." -ForegroundColor Yellow
    }

    # 5. Install + start service
    Write-Host "==> Installing Windows service ..." -ForegroundColor Cyan
    & .\svc.cmd install
    Check-LastExit "svc.cmd install"

    Write-Host "==> Starting service ..." -ForegroundColor Cyan
    & .\svc.cmd start
    Check-LastExit "svc.cmd start"

    Start-Sleep -Seconds 2
    & .\svc.cmd status
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "==> Done. Verify the runner appears as 'Idle' here:" -ForegroundColor Green
Write-Host "    $Repo/settings/actions/runners"
