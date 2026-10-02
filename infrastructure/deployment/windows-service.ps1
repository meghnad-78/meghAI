<#
.SYNOPSIS
    MeghAI Windows Background Service Deployment Script
    Installs and registers MeghAI API and Windows Privileged Agent as resilient Windows Services.
.DESCRIPTION
    Uses NSSM (Non-Sucking Service Manager) or sc.exe to register MeghAI services to run on boot.
#>

param(
    [string]$Action = "status", # "install", "start", "stop", "restart", "uninstall", "status"
    [string]$NodePath = "node.exe",
    [string]$AppRoot = "$PSScriptRoot\..\.."
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " MeghAI Windows Service Manager" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$ResolvedRoot = (Resolve-Path $AppRoot).Path
$ApiScript = "$ResolvedRoot\apps\api\dist\index.js"
$AgentScript = "$ResolvedRoot\apps\windows-agent\dist\index.js"

function Check-Admin {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

switch ($Action.ToLower()) {
    "status" {
        Write-Host "Checking MeghAI Service Status..." -ForegroundColor Yellow
        Get-Service -Name "MeghAI-API", "MeghAI-WindowsAgent" -ErrorAction SilentlyContinue | Format-Table -Property Name, DisplayName, Status
    }

    "install" {
        if (-not (Check-Admin)) {
            Write-Error "Administrator privileges required to install Windows Services. Run PowerShell as Administrator."
            return
        }

        Write-Host "Building project production artifacts..." -ForegroundColor Green
        npm run build

        Write-Host "Installing MeghAI-API Service..." -ForegroundColor Green
        sc.exe create "MeghAI-API" binPath= "$NodePath `"$ApiScript`"" start= auto DisplayName= "MeghAI Core API Service"

        Write-Host "Installing MeghAI-WindowsAgent Service..." -ForegroundColor Green
        sc.exe create "MeghAI-WindowsAgent" binPath= "$NodePath `"$AgentScript`"" start= auto DisplayName= "MeghAI Windows Privileged Agent"

        Write-Host "Services installed successfully." -ForegroundColor Green
    }

    "start" {
        Write-Host "Starting MeghAI Services..." -ForegroundColor Green
        Start-Service -Name "MeghAI-API" -ErrorAction SilentlyContinue
        Start-Service -Name "MeghAI-WindowsAgent" -ErrorAction SilentlyContinue
        Write-Host "Services started." -ForegroundColor Green
    }

    "stop" {
        Write-Host "Stopping MeghAI Services..." -ForegroundColor Yellow
        Stop-Service -Name "MeghAI-API" -ErrorAction SilentlyContinue
        Stop-Service -Name "MeghAI-WindowsAgent" -ErrorAction SilentlyContinue
        Write-Host "Services stopped." -ForegroundColor Yellow
    }

    "uninstall" {
        if (-not (Check-Admin)) {
            Write-Error "Administrator privileges required to uninstall Windows Services. Run PowerShell as Administrator."
            return
        }
        Stop-Service -Name "MeghAI-API" -ErrorAction SilentlyContinue
        Stop-Service -Name "MeghAI-WindowsAgent" -ErrorAction SilentlyContinue
        sc.exe delete "MeghAI-API"
        sc.exe delete "MeghAI-WindowsAgent"
        Write-Host "Services uninstalled successfully." -ForegroundColor Yellow
    }

    default {
        Write-Host "Usage: .\windows-service.ps1 -Action [install|start|stop|restart|uninstall|status]" -ForegroundColor Cyan
    }
}
