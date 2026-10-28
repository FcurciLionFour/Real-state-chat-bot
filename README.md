# Real State Chat Bot

MVP de buscador inmobiliario conversacional para Argentina.

Estado actual:

- backend NestJS funcional
- auth, favoritos, historial, admin, blog y propiedades de propietarios reales
- pipeline de busqueda con OpenAI, scraping, dedupe, ranking, cache y observabilidad
- frontend Angular standalone usable
- servicio Python de scraping implementado para correr por Docker

Lectura operativa al 2026-05-06:

- listo para demo seria o entorno controlado despues de una corrida final con servicios activos
- no considerar listo para produccion publica abierta sin completar `docs/go-nogo-mvp.md`
- la suite completa requiere Docker Desktop, Postgres y Redis levantados

## Estructura

- [backend](C:/Users/absti/Desktop/PROYECTOS/Real%20state%20chat%20bot/backend)
- [frontend](C:/Users/absti/Desktop/PROYECTOS/Real%20state%20chat%20bot/frontend)
- [docs](C:/Users/absti/Desktop/PROYECTOS/Real%20state%20chat%20bot/docs)

## Arranque local rapido

1. Levantar Docker con Postgres y Redis.
   Opcional: el mismo `docker-compose` ahora puede levantar tambien `python-scraper`.
2. Verificar `backend/.env`:
   - `FRONTEND_URL=http://localhost:4200`
   - `DATABASE_URL` valida
   - `REDIS_URL` valida
   - `PYTHON_SCRAPER_BASE_URL=http://localhost:8000` si se quiere preparar la integracion
3. Ejecutar:

```powershell
./scripts/start-local.ps1
```

Esto abre dos consolas:

- backend en `http://localhost:3000/api`
- frontend en `http://localhost:4200`

Checks operativos utiles:

- liveness: `GET http://localhost:3000/api/health/live`
- readiness: `GET http://localhost:3000/api/health/ready`
- python scraper live: `GET http://localhost:8000/health/live`
- python scraper ready: `GET http://localhost:8000/health/ready`

`/health/ready` esta reducido por hardening: informa checks generales de DB, Redis y capacidades configuradas sin exponer detalles internos sensibles.

## Validaciones minimas actuales

Backend:

```powershell
cd backend
npm run build
npm test
npm run test:e2e
```

Frontend:

```powershell
cd frontend
npm run build
npm run test:e2e -- user-flow.spec.ts
npm run test:e2e -- admin-flow.spec.ts
```

Nota: si Postgres/Redis no estan levantados, parte de la suite backend va a fallar por entorno.

## Documentos guia

- [agents.md](C:/Users/absti/Desktop/PROYECTOS/Real%20state%20chat%20bot/agents.md)
- [analisis-final-mvp.md](C:/Users/absti/Desktop/PROYECTOS/Real%20state%20chat%20bot/docs/analisis-final-mvp.md)
- [PRUEBAS-CALIDAD-MVP.md](C:/Users/absti/Desktop/PROYECTOS/Real%20state%20chat%20bot/docs/PRUEBAS-CALIDAD-MVP.md)
- [go-nogo-mvp.md](C:/Users/absti/Desktop/PROYECTOS/Real%20state%20chat%20bot/docs/go-nogo-mvp.md)
- [roadmap-implementacion-mvp.md](C:/Users/absti/Desktop/PROYECTOS/Real%20state%20chat%20bot/docs/roadmap-implementacion-mvp.md)
- [contratos-http-mvp.md](C:/Users/absti/Desktop/PROYECTOS/Real%20state%20chat%20bot/docs/contratos-http-mvp.md)
- [seguimiento-implementacion.md](C:/Users/absti/Desktop/PROYECTOS/Real%20state%20chat%20bot/docs/seguimiento-implementacion.md)
- [arquitectura-servicio-python-scraping.md](C:/Users/absti/Desktop/PROYECTOS/Real%20state%20chat%20bot/docs/arquitectura-servicio-python-scraping.md)
