# Windows PowerShell Start Script for NatureCure AI

Write-Host "🚀 Starting NatureCure AI Backend (FastAPI - Port 8000)..." -ForegroundColor Green
$backendPath = Join-Path $PSScriptRoot "..\backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; python -m uvicorn main:app --reload --port 8000"

Start-Sleep -Seconds 2

Write-Host "🚀 Starting NatureCure AI Frontend (Next.js - Port 3000)..." -ForegroundColor Green
$frontendPath = Join-Path $PSScriptRoot "..\frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev"

Write-Host "`n✅ Servers launched in background windows!" -ForegroundColor Cyan
Write-Host "   - Backend API:  http://localhost:8000"
Write-Host "   - Frontend UI:  http://localhost:3000"
