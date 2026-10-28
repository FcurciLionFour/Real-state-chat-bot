# Analisis final del MVP

Fecha: 2026-05-06.

## 1. Resumen ejecutivo

El proyecto esta cerca de poder subirse a un entorno controlado. No esta en una
fase temprana: el core conversacional, la persistencia, el pipeline de busqueda,
la autenticacion, favoritos, historial, admin, blog, carga de propiedades de
propietarios y frontend ya existen.

La conclusion tecnica es:

- MVP funcional local/controlado: si
- listo para demo seria: si, despues de una corrida final con servicios activos
- listo para produccion publica abierta: todavia no

Lo que falta no es una arquitectura grande nueva. Falta cerrar validacion de
entorno, QA manual, smoke live, monitoreo, costos y textos legales minimos.

## 2. Puntaje

| Area | Puntaje | Lectura |
| --- | ---: | --- |
| Arquitectura backend | 9/10 | Modular, deterministica y alineada al principio de backend como fuente de verdad. |
| Dominio de busqueda | 9/10 | `SearchFilters`, `SearchDecision`, merge, ranking, dedupe y auditoria estan bien cubiertos. |
| OpenAI | 9/10 | Structured outputs, fallback seguro y validacion live OK. |
| Busqueda real | 8.5/10 | Pipeline real validado con Argenprop; la fragilidad principal sigue siendo externa. |
| Frontend workspace | 8/10 | Usable y conectado; requiere QA visual/manual final y revisar budgets. |
| Auth/favoritos/historial | 8.5/10 | Flujo real implementado con refresh cookie y access token en memoria. |
| Admin/operacion | 8/10 | Muy bueno para MVP; falta definir observabilidad productiva fuera de consola. |
| Seguridad | 8/10 | Hardening base serio; faltan politicas productivas, CORS final, secretos reales y despliegue HTTPS. |
| Testing automatico | 9/10 | Suite backend, frontend E2E y scraper pasaron con entorno Docker activo. |
| Readiness deploy controlado | 8.5/10 | Local/controlado esta verde; falta staging/deploy real. |
| Readiness produccion publica | 7/10 | Todavia falta monitoreo, legal, costos, runbook y smoke live sostenido. |

Puntaje global actual:

- base tecnica del MVP: 9/10
- completitud funcional del MVP: 8.7/10
- readiness para subida controlada: 8.5/10
- readiness para produccion publica abierta: 7/10

## 3. Lo que hace hoy el sistema

### Usuario final

- puede registrarse e iniciar sesion
- puede crear conversaciones
- puede buscar propiedades por lenguaje natural
- puede refinar filtros en mensajes sucesivos
- puede ver filtros activos
- puede ver resultados trazables a fuente externa
- puede abrir ficha interna
- puede abrir publicacion original
- puede guardar favoritos
- puede retomar chats
- puede ver favoritos
- puede navegar mapa y secciones complementarias

### Backend

- valida auth con access token
- usa refresh token en cookie `HttpOnly`
- mantiene `searchState` por conversacion
- llama OpenAI para interpretar mensajes
- valida salida estructurada con schema estricto
- aplica overrides deterministas para casos criticos
- mergea filtros de forma controlada
- ejecuta busqueda real o retorna vacio si no hay resultados reales
- usa scraper Python cuando esta habilitado
- mantiene fallback legacy de discovery/adapters
- deduplica resultados
- rankea con reglas explicables
- persiste `SearchRun` y razones de ranking
- guarda propiedades en `PropertyCache`
- permite favoritos
- expone admin read models y acciones operativas
- registra logs estructurados con request id y contexto
- aplica rate limits base
- expone health live/ready reducidos

### Servicio Python

- expone `/v1/search`
- soporta adapters para Argenprop, Zonaprop, Mudafy y Properati
- maneja fetch, browser fallback opcional y extraccion por fuente
- puede proteger endpoints internos con token
- debe correrse por Docker en Windows salvo que se valide Python 3 local

### Frontend

- Angular standalone
- rutas publicas y privadas
- workspace de chat con resultados
- rehidratacion despues de enviar mensajes
- guardas de auth/admin
- access token en memoria
- favoritos
- admin
- blog
- mapa
- carga de propiedades por propietario

## 4. Validacion ejecutada en esta auditoria

Primera pasada sin Docker activo:

```powershell
cd backend
npm run build
```

Resultado: OK.

```powershell
cd frontend
npm run build
```

Resultado: OK con warnings de budget SCSS.

```powershell
cd backend
npm test
```

Resultado: parcial. Pasaron tests unitarios y de servicios hasta el bloque
admin rate-limit. La suite fallo cuando intento usar endpoints con Prisma y
Redis porque Postgres/Redis no estaban levantados.

Fallo observado:

- Postgres no disponible en `127.0.0.1:5432`
- Redis no disponible en `127.0.0.1:6379`
- `docker compose ps` no pudo conectar con Docker Desktop

```powershell
cd python-scraper-service
python --version
```

Resultado: Python local no usable en Windows. Esto coincide con la regla
operativa de usar Docker.

Revalidacion con Docker activo:

```powershell
cd backend
docker compose ps
npx prisma migrate status
npm run build
npm test
npm run test:e2e
npm run test:openai
npm run test:phase8:http
```

Resultado:

- contenedores `postgres`, `redis` y `python-scraper` arriba
- migraciones al dia
- build backend OK
- suite backend completa OK
- E2E backend OK
- OpenAI live OK
- correlacion HTTP OK

```powershell
cd frontend
npm run build
npm run test:e2e -- user-flow.spec.ts
npm run test:e2e -- admin-flow.spec.ts
```

Resultado:

- build frontend OK con warnings de budget SCSS
- user flow OK despues de actualizar selectores fragiles al layout actual
- admin flow OK

```powershell
cd backend
docker compose exec -T python-scraper python -m unittest discover -s tests -v
```

Resultado:

- 31 tests del scraper OK
- `/v1/capabilities` OK

Smoke live de producto:

- mensaje: `Busco alquiler en Palermo cerca del Alto Palermo hasta 800k al mes, monoambiente o 2 ambientes`
- OpenAI interpreto `operation=RENT`, `currency=ARS`, `priceMax=800000`, `roomsAnyOf=[1,2]`
- backend uso `argenprop`
- devolvio 3 resultados reales
- precios devueltos: ARS 650000, ARS 700000, ARS 850000
- todos dentro de la tolerancia de alquiler ARS
- no aparecieron mocks

## 5. Fortalezas reales

- Arquitectura consistente con "IA como interfaz, backend como verdad".
- `SearchState` es el centro real del producto.
- OpenAI no escribe DB ni decide ranking.
- El contrato `SearchDecision` esta validado y tiene fallback seguro.
- Ranking ya trata moneda, presupuesto y ambientes como filtros esenciales.
- `roomsAnyOf` ya resuelve "monoambiente o 2 ambientes".
- Resultados conservan fuente, URL, payloads y ranking.
- Auth dejo de persistir access token en `localStorage`.
- Refresh token usa cookie `HttpOnly`.
- Admin esta por encima de un MVP comun.
- Observabilidad tiene request id y eventos estructurados.
- Test suite amplia para dominio, auth, search, cache, hardening, admin y e2e.
- Frontend esta conectado al backend real y no es solo maqueta.

## 6. Gaps finales

### Bloqueantes de release controlado

1. Variables de entorno reales revisadas.
2. CORS/cookies/HTTPS ajustados al dominio real.
3. Runbook minimo de arranque, rollback y monitoreo.
4. Checklist legal minimo.

Ya cerrados localmente:

- validacion con Docker activo
- suite backend completa
- E2E frontend user/admin
- OpenAI live
- scraper real
- smoke live con mocks apagados

### Gaps importantes

- No hay repo git detectado en la raiz ni subcarpetas durante esta auditoria.
- Frontend build tiene warnings de budget en `workspace` y `map`.
- Docker Desktop no estaba activo durante la auditoria.
- Falta validacion productiva de costos por busqueda.
- Falta documento legal minimo de datos de terceros y privacidad.
- Falta decidir que features extra entran al MVP publico: blog, mapa y owner properties.
- Falta definir monitoreo real fuera de logs locales.

### Riesgos externos

- cambios de HTML en portales
- bloqueos anti-bot
- latencia de scraping
- costos OpenAI
- calidad variable de anuncios
- resultados incompletos o sin precio

## 7. Recomendacion de cierre

Secuencia recomendada:

1. Preparar variables reales de staging/deploy.
2. Validar CORS/cookies/HTTPS con dominio real.
3. Definir monitoreo, backups y rollback.
4. Completar textos legales minimos.
5. Ejecutar nuevamente la matriz en staging.
6. Completar `docs/go-nogo-mvp.md`.

Con la corrida local actual, el MVP queda tecnicamente listo para una subida
controlada a staging/beta cerrada.
