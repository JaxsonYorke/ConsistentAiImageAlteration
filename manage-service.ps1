# Manage Node.js Image Alteration Service using Windows Startup Folder
# No external downloads required

param(
    [ValidateSet('on', 'off')]
    [string]$Action
)

# Configuration
$ServiceName = 'ConsistentAiImageAlteration'
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartupFolder = [Environment]::GetFolderPath([Environment+SpecialFolder]::Startup)
$StartupBatchPath = Join-Path $StartupFolder "Start-$ServiceName.bat"
$LauncherBatchPath = Join-Path $ScriptPath "launcher.bat"

# Check if running as admin
function Test-IsAdmin {
    $principal = [System.Security.Principal.WindowsPrincipal][System.Security.Principal.WindowsIdentity]::GetCurrent()
    return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Create the launcher batch file that runs node in background
function Create-LauncherBatch {
    $batchContent = @"
@echo off
cd /d "$ScriptPath"
node index.js
"@
    Set-Content -Path $LauncherBatchPath -Value $batchContent -Encoding ASCII
    Write-Host "[OK] Launcher batch created"
}

# Turn service ON
function Enable-Service {
    Write-Host "Enabling $ServiceName service..."
    
    # Create launcher if it doesn't exist
    if (-not (Test-Path $LauncherBatchPath)) {
        Create-LauncherBatch
    }
    
    # Start it now (no startup folder)
    Write-Host "Starting service..."
    Start-Process cmd -ArgumentList "/c $LauncherBatchPath" -WindowStyle Hidden
    
    Write-Host "[OK] Service started"
}

# Turn service OFF
function Disable-Service {
    Write-Host "Disabling $ServiceName service..."
    
    # Kill running processes
    $processes = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*index.js*" }
    if ($processes) {
        $processes | Stop-Process -Force
        Write-Host "[OK] Service stopped"
    } else {
        Write-Host "No running process found"
    }
}

# Main script
if (-not (Test-IsAdmin)) {
    Write-Host "[FAIL] This script must be run as Administrator"
    Write-Host "Please right-click PowerShell and select 'Run as Administrator'"
    exit 1
}

# If action not specified, prompt user
if (-not $Action) {
    Write-Host ""
    Write-Host "=== $ServiceName Service Manager ===" -ForegroundColor Cyan
    Write-Host ""
    $choice = Read-Host "Turn service [on] or [off]?"
    $Action = $choice.ToLower()
}

if ($Action -eq 'on') {
    Enable-Service
} elseif ($Action -eq 'off') {
    Disable-Service
} else {
    Write-Host "[FAIL] Invalid option. Please use 'on' or 'off'"
    exit 1
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
