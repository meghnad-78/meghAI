<#
.SYNOPSIS
    MeghAI Clean Script
    Cleans build outputs, dist directories, logs, and caches.
#>

Write-Host "Cleaning MeghAI build artifacts and temporary files..." -ForegroundColor Yellow

$PathsToClean = @(
    "dist",
    "apps\api\dist",
    "apps\desktop\dist",
    "apps\web\dist",
    "apps\windows-agent\dist",
    "packages\*\dist",
    ".turbo",
    "coverage"
)

foreach ($target in $PathsToClean) {
    Get-ChildItem -Path $target -Recurse -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Cleanup completed." -ForegroundColor Green
