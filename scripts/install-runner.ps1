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
#   Tokens expire after ~1 hour — grab a fresh one if you see "invalid token".
#
# What this does:
#   1. Downloads the latest GitHub Actions runner for Windows x64 into
#      C:\actions-runner-hhwebsite\
#   2. Configures it against RobF75/HHWebsite with labels: self-hosted, windows
#   3. Installs as a Windows service named "actions.runner.RobF75-HHWebsite.<NAME>"
#   4. Starts the service.
#
# After this, push to main on RobF75/HHWebsite will trigger the deploy workflow.
# =============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Token,

    [string]$RunnerName  = "$env:COMPUTERNAME-hhwebsite",
    [string]$InstallPath = "C:\actions-runner-hhwebsite",
    [string]$Repo        = "https://github.com/RobF75/HHWebsite",
    [string]$RunnerVersion = "2.321.0",  # bump as needed
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

Require-Admin

Write-Host "==> Target install path: $InstallPath" -ForegroundColor Cyan
Write-Host "==> Runner name:         $RunnerName"  -ForegroundColor Cyan
Write-Host "==> Repo:                $Repo"        -ForegroundColor Cyan

# 1. Create / clean the install dir
if (Test-Path $InstallPath) {
    if ($Reconfigure) {
        Write-Host "==> -Reconfigure set — removing existing $InstallPath" -ForegroundColor Yellow
        Push-Location $InstallPath
        try {
            if (Test-Path ".\svc.cmd") { .\svc.cmd stop;    .\svc.cmd uninstall } 2>$null
            if (Test-Path ".\config.cmd") { .\config.cmd remove --token $Token } 2>$null
        } finally { Pop-Location }
        Remove-Item -Recurse -Force $InstallPath
    } else {
        Write-Host "==> $InstallPath exists. Re-run with -Reconfigure to wipe + reinstall." -ForegroundColor Yellow
        Write-Host "    Continuing with re-download into the existing folder (will overwrite binaries)."
    }
}
if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath | Out-Null
}

# 2. Download runner
$zip = Join-Path $InstallPath "actions-runner-win-x64-$RunnerVersion.zip"
$url = "https://github.com/actions/runner/releases/download/v$RunnerVersion/actions-runner-win-x64-$RunnerVersion.zip"
Write-Host "==> Downloading runner v$RunnerVersion ..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

# 3. Extract
Write-Host "==> Extracting ..." -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $InstallPath)
Remove-Item $zip

# 4. Configure (idempotent — config.cmd refuses to re-register without remove)
Push-Location $InstallPath
try {
    if (-not (Test-Path ".runner")) {
        Write-Host "==> Configuring runner against $Repo ..." -ForegroundColor Cyan
        .\config.cmd `
            --unattended `
            --url $Repo `
            --token $Token `
            --name $RunnerName `
            --labels "self-hosted,windows" `
            --work "_work" `
            --replace
    } else {
        Write-Host "==> Runner already configured (.runner file exists). Skipping config." -ForegroundColor Yellow
    }

    # 5. Install + start service
    Write-Host "==> Installing Windows service ..." -ForegroundColor Cyan
    .\svc.cmd install
    Write-Host "==> Starting service ..." -ForegroundColor Cyan
    .\svc.cmd start
    Start-Sleep -Seconds 2
    .\svc.cmd status
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "==> Done. Verify the runner appears as 'Idle' here:" -ForegroundColor Green
Write-Host "    $Repo/settings/actions/runners"
