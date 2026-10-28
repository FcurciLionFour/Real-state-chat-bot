$root = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $root 'backend'
$frontendPath = Join-Path $root 'frontend'

$backendCommand = "Set-Location -LiteralPath '$backendPath'; npm run start:dev"
$frontendCommand = "Set-Location -LiteralPath '$frontendPath'; npm start -- --host 127.0.0.1 --port 4200"

Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', $backendCommand
Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', $frontendCommand

Write-Host 'Backend:  http://localhost:3000/api'
Write-Host 'Frontend: http://localhost:4200'
Write-Host 'Se abrieron dos consolas separadas para desarrollo local.'
