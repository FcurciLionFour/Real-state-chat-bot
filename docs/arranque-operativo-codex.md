# Arranque Operativo Para Codex o IA

## 1. Objetivo

Este documento deja asentado como debe levantar este proyecto un agente como Codex o cualquier otra IA operando en Windows.

La regla principal es esta:

- usar PowerShell
- no usar `cmd` para el arranque principal
- no asumir Python 3 local en Windows
- levantar frontend y backend en consolas separadas
- levantar `python-scraper` por Docker si no hay runtime Python 3 local validado

---

## 2. Forma correcta de arranque

### 2.1 Requisito previo

Antes de levantar la app, Docker Desktop ya debe estar operativo con los contenedores base disponibles.

Servicios esperados:

- `postgres`
- `redis`
- `python-scraper` si se necesita el servicio Python real

Archivo relevante:

- `backend/docker-compose.yml`

---

## 3. Backend y frontend

La forma canonica de levantar backend y frontend es ejecutar desde la raiz del repo:

```powershell
./scripts/start-local.ps1
```

En sesiones Codex sobre Windows donde la ejecucion directa de scripts este bloqueada
o los procesos hijos se cierren al terminar el comando lanzador, usar este comando
desde la raiz del repo:

```powershell
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

Nota validada el 2026-05-12: ejecutar el script dentro del sandbox puede abrir
consolas que no dejan vivos `backend` y `frontend`. Ejecutarlo fuera del sandbox
con `ExecutionPolicy Bypass` dejo activos `localhost:3000` y `localhost:4200`.

Ese script:

- abre una consola PowerShell para backend
- abre una consola PowerShell para frontend
- arranca backend con `npm run start:dev`
- arranca frontend con `npm start -- --host 127.0.0.1 --port 4200`

No reemplazar este flujo por `cmd`.

Archivo fuente:

- `scripts/start-local.ps1`

---

## 4. Servicio Python

No asumir que Windows local tiene Python 3 listo.

En este repo ya quedo validado que puede existir este escenario:

- `python` apunta a `WindowsApps` y falla
- `py` solo encuentra `Python 2.7`
- `uvicorn` no existe en el PATH

Por lo tanto, para un agente, la forma segura de levantar `python-scraper` es:

```powershell
cd backend
docker compose up -d python-scraper
```

No intentar por defecto:

- `python -m uvicorn ...`
- `uvicorn app.main:app ...`
- comandos basados en `cmd`

Solo usar arranque Python local si antes se valido explicitamente que existe Python 3.11+ con dependencias instaladas.

---

## 5. Healthchecks esperados

Una vez levantado todo, validar:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health/live
Invoke-WebRequest -UseBasicParsing http://localhost:4200
Invoke-WebRequest -UseBasicParsing http://localhost:8000/health/live
```

Endpoints esperados:

- backend: `http://localhost:3000/api`
- frontend: `http://localhost:4200`
- python scraper: `http://localhost:8000`

---

## 6. Problema operativo conocido

Puede ocurrir que backend falle con:

- `EADDRINUSE: address already in use :::3000`

Si pasa eso:

1. no asumir que el script fallo completo
2. verificar si frontend ya quedo arriba
3. verificar si el puerto `3000` sigue ocupado
4. relanzar solo backend en una nueva consola PowerShell

Comando de relanzamiento:

```powershell
$backendPath = Join-Path (Get-Location) 'backend'
$backendCommand = "Set-Location -LiteralPath '$backendPath'; npm run start:dev"
Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', $backendCommand
```

---

## 7. Regla operativa para futuras sesiones

Si un agente tiene que "levantar el proyecto", debe interpretar eso asi:

1. usar PowerShell
2. correr `./scripts/start-local.ps1`; si ExecutionPolicy o el sandbox bloquean los procesos hijos, usar `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File .\scripts\start-local.ps1`
3. levantar `python-scraper` con `docker compose up -d python-scraper` desde `backend`
4. validar healthchecks
5. si backend no responde pero frontend si, revisar conflicto en puerto `3000` y relanzar solo backend

Esta es la secuencia que debe considerarse correcta salvo que el repo cambie explicitamente.
