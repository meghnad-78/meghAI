<#
.SYNOPSIS
    MeghAI Complete Stack Launcher (PowerShell)
    Launches API Server, Windows Agent, Desktop UI, and Web Companion.
#>

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " Starting MeghAI Personal AI Operating Layer..." -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

npm run dev:all
