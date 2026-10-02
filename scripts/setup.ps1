<#
.SYNOPSIS
    MeghAI Windows Environment Setup & Verification Script
#>

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " MeghAI Windows-First Personal AI Operating Layer" -ForegroundColor Cyan
Write-Host " Initial Environment Setup & Dependency Verification" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# 1. Verify Node.js
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js detected: $nodeVersion" -ForegroundColor Green
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -lt 20) {
        Write-Warning "MeghAI requires Node.js v20.0.0 or higher. You are using $nodeVersion."
    }
} catch {
    Write-Error "Node.js is not installed or not in PATH. Please install Node.js >= 20."
    exit 1
}

# 2. Verify NPM
try {
    $npmVersion = npm --version
    Write-Host "[OK] NPM detected: $npmVersion" -ForegroundColor Green
} catch {
    Write-Error "NPM is not installed or not in PATH."
    exit 1
}

# 3. Create Local App Data Directories
$AppDataMeghAI = Join-Path $env:LOCALAPPDATA "MeghAI"
$Directories = @(
    (Join-Path $AppDataMeghAI "data"),
    (Join-Path $AppDataMeghAI "browser_sessions"),
    (Join-Path $AppDataMeghAI "audio_cache"),
    (Join-Path $AppDataMeghAI "logs"),
    (Join-Path $AppDataMeghAI "models")
)

Write-Host "Creating local storage paths under $AppDataMeghAI..." -ForegroundColor Yellow
foreach ($dir in $Directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  + Created: $dir" -ForegroundColor Gray
    } else {
        Write-Host "  ✓ Exists: $dir" -ForegroundColor DarkGray
    }
}

# 4. Install Dependencies
Write-Host "Installing monorepo workspace dependencies..." -ForegroundColor Yellow
npm install

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " Setup Complete! You can now start MeghAI with:" -ForegroundColor Green
Write-Host "   npm run dev              (API + Desktop UI)" -ForegroundColor White
Write-Host "   npm run api              (Core API Server)" -ForegroundColor White
Write-Host "   npm run windows-agent    (Privileged Windows Agent)" -ForegroundColor White
Write-Host "   npm run desktop          (Desktop Application UI)" -ForegroundColor White
Write-Host "   npm test                 (Run All Vitest Test Suites)" -ForegroundColor White
Write-Host "======================================================" -ForegroundColor Cyan
