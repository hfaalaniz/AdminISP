# AdminISP - Script de inicio
# Inicia backend, frontend y web en ventanas separadas

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Iniciando AdminISP..." -ForegroundColor Cyan

# Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; npm run dev" -WindowStyle Normal

# Frontend (panel admin)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev" -WindowStyle Normal

# Web (landing publica)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\web'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "Servicios iniciados en ventanas separadas:" -ForegroundColor Green
Write-Host "  Backend   ->  http://localhost:3000" -ForegroundColor Yellow
Write-Host "  Frontend  ->  http://localhost:5173" -ForegroundColor Yellow
Write-Host "  Web       ->  http://localhost:5174" -ForegroundColor Yellow



