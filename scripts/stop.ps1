# Windows PowerShell Stop Script for NatureCure AI

Write-Host "🛑 Stopping NatureCure AI Server Processes..." -ForegroundColor Yellow

# Kill processes listening on port 8000 (Backend)
$port8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($port8000) {
    $pids = $port8000.OwningProcess | Select-Object -Unique
    foreach ($pid_to_kill in $pids) {
        Write-Host "Killing Backend process PID: $pid_to_kill (Port 8000)"
        Stop-Process -Id $pid_to_kill -Force -ErrorAction SilentlyContinue
    }
}

# Kill processes listening on port 3000 (Frontend)
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    $pids = $port3000.OwningProcess | Select-Object -Unique
    foreach ($pid_to_kill in $pids) {
        Write-Host "Killing Frontend process PID: $pid_to_kill (Port 3000)"
        Stop-Process -Id $pid_to_kill -Force -ErrorAction SilentlyContinue
    }
}

# General cleanup for python uvicorn and node processes
Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*uvicorn*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*next*" } | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "✅ All NatureCure AI servers stopped successfully." -ForegroundColor Green
