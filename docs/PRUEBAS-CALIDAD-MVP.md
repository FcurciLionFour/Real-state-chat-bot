# Pruebas de calidad MVP

Fecha: 2026-05-06.

Este documento define la matriz de QA para declarar el MVP listo para demo o
subida controlada. Incluye pruebas automaticas, pruebas manuales funcionales,
calidad de datos, seguridad basica y escenarios de falla.

## 1. Preparacion

Requisitos:

- Docker Desktop activo
- Postgres y Redis levantados
- backend con `.env` real o de staging
- frontend apuntando al backend correcto
- scraper Python levantado si se valida busqueda real
- `SEARCH_MOCK_FALLBACK_ENABLED=false` para pruebas live
- `OPENAI_MOCK_MODE=false` para pruebas live de OpenAI

Arranque:

```powershell
cd backend
docker compose up -d
npx prisma migrate deploy
cd ..
./scripts/start-local.ps1
```

Healthchecks:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health/live
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health/ready
Invoke-WebRequest -UseBasicParsing http://localhost:4200
Invoke-WebRequest -UseBasicParsing http://localhost:8000/health/live
```

## 2. Pruebas automaticas obligatorias

Backend:

```powershell
cd backend
npm run build
npm test
npm run test:e2e
npm run test:health
npm run test:hardening
npm run test:rbac
npm run test:admin
npm run test:admin:actions
```

OpenAI live:

```powershell
cd backend
npm run test:openai
```

Frontend:

```powershell
cd frontend
npm run build
npm run test:e2e -- user-flow.spec.ts
npm run test:e2e -- admin-flow.spec.ts
```

Python scraper:

```powershell
cd backend
docker compose exec python-scraper python -m unittest discover -s tests -v
```

Resultado requerido:

- todos los comandos obligatorios deben pasar
- warnings de SCSS pueden aceptarse para subida controlada si quedan anotados
- cualquier fallo de auth, chat, favoritos, admin o scraper bloquea release

## 3. Smoke principal de usuario

### Caso U1 - Registro y primer chat

Pasos:

1. abrir `/register`
2. crear usuario nuevo
3. verificar redireccion a `/search`
4. enviar: `Quiero comprar un monoambiente en Palermo con balcon hasta 140000 USD`

Esperado:

- se crea conversacion
- URL cambia a `/app/chats/:id`
- aparece mensaje assistant
- `searchState.operation=BUY`
- `locations` contiene `Palermo`
- `priceMax=140000`
- `currency=USD`
- se muestran resultados reales o estado vacio honesto
- no aparece `mock-source`
- no aparece `example.com`

### Caso U2 - Refinamiento

Mensaje:

```text
Manteneme Palermo pero bajame el tope a 120000 USD
```

Esperado:

- conserva operacion, tipo y zona
- cambia tope a 120000
- genera nueva busqueda
- historial queda con 4 mensajes
- resultados se rehidratan al recargar

### Caso U3 - Alquiler ARS con presupuesto

Mensaje:

```text
Busco alquiler en Palermo cerca del Alto Palermo hasta 800k al mes, monoambiente o 2 ambientes
```

Esperado:

- `operation=RENT`
- `currency=ARS`
- `priceMax=800000`
- `roomsAnyOf=[1,2]`
- `rooms=null`
- se agrega `geoConstraints` para Alto Palermo
- no pasan resultados en USD con precio informado
- no pasan alquileres por encima de 950000 ARS
- no aparece 3 ambientes si el resultado informa ambientes
- resultados sin precio quedan debajo de resultados compatibles

### Caso U4 - Cambio de zona

Mensaje:

```text
Mejor que sea en Belgrano
```

Esperado:

- reemplaza `locations` por `Belgrano`
- no mantiene Palermo salvo que el usuario lo pida explicitamente
- dispara busqueda si el estado ya tiene operacion suficiente

### Caso U5 - Quitar presupuesto

Mensaje:

```text
Sacame el tope, busquemos sin limite de presupuesto
```

Esperado:

- limpia `priceMin`
- limpia `priceMax`
- limpia `currency` si no se provee nuevo precio
- mantiene zona y operacion
- busca de nuevo

## 4. Favoritos e historial

### Caso F1 - Guardar favorito

Pasos:

1. ejecutar busqueda con resultados
2. click en favorito sobre primera propiedad
3. ir a `/app/favorites`

Esperado:

- propiedad aparece en favoritos
- se ve precio/fuente/ubicacion
- no se duplica si se guarda dos veces

### Caso F2 - Rehidratar chat

Pasos:

1. abrir `/app/chats`
2. entrar a una conversacion vieja
3. recargar navegador

Esperado:

- mensajes siguen visibles
- filtros activos siguen visibles
- `lastSearchResults` se muestra si existe
- no se pierden favoritos

## 5. Publicacion original

### Caso P1 - Link externo

Pasos:

1. abrir ficha interna de un resultado
2. click en `Abrir publicacion original`

Esperado:

- abre `sourceUrl` real en nueva pestana
- dominio corresponde a la fuente visible
- no usa `example.com`
- no usa URL vacia

## 6. Admin

### Caso A1 - Acceso admin

Pasos:

1. login como usuario comun
2. intentar `/app/admin`
3. promover usuario a admin local o usar admin existente
4. volver a `/app/admin`

Esperado:

- usuario comun no entra
- admin entra
- overview carga
- metricas cargan
- listados de usuarios, conversaciones, search runs y propiedades cargan

### Caso A2 - Invalidar cache

Pasos:

1. abrir admin
2. click en invalidar cache

Esperado:

- feedback visible
- no rompe si Redis no esta disponible
- si Redis esta disponible, informa claves afectadas o cero claves

### Caso A3 - Owner submitted properties

Pasos:

1. cargar propiedad como owner/admin
2. enviarla a revision
3. aprobar desde admin
4. buscar una zona compatible

Esperado:

- propiedad aprobada puede entrar como resultado propio
- propiedad pendiente/rechazada no entra a busqueda publica

## 7. Seguridad basica

### Caso S1 - Sesion

Esperado:

- access token no se persiste en `localStorage`
- refresh token via cookie `HttpOnly`
- logout invalida refresh
- refresh despues de logout devuelve `401`

### Caso S2 - Headers

Validar:

- no aparece `x-powered-by`
- hay `x-request-id`
- hay headers anti-cache en respuestas API
- payloads invalidos reciben `400`

### Caso S3 - Rate limits

Validar:

- auth tiene rate limit
- chat tiene rate limit
- admin read/write tiene rate limit
- si Redis no esta disponible, el sistema degrada sin caer completo

## 8. Calidad de datos

Para cada busqueda real revisar al menos 5 resultados:

- titulo legible
- fuente visible
- `sourceUrl` abre
- operacion correcta
- moneda correcta
- precio compatible
- barrio/ciudad razonables
- ambientes compatibles si se informan
- imagen carga o fallback se ve bien
- `Precio no informado` no parece match perfecto

Casos obligatorios:

- compra USD Palermo
- alquiler ARS Palermo
- alquiler cerca de Alto Palermo
- cambio a Belgrano
- busqueda sin resultados
- resultado sin precio

## 9. Fallas esperadas

### OpenAI caido o sin key

Esperado:

- no inventa propiedades
- usa fallback seguro
- si no puede interpretar, pide aclaracion

### Scraper caido

Esperado:

- no muestra mocks si mocks estan apagados
- puede mostrar owner-submitted si existen
- informa estado vacio o falla controlada
- logs tienen request id

### Redis caido

Esperado:

- backend sigue respondiendo
- cache/rate limit degradan de forma controlada
- readiness marca Redis como degradado/opcional

## 10. Criterio de aprobacion

Para demo seria:

- builds OK
- backend tests OK con servicios activos
- frontend E2E user/admin OK
- smoke live principal OK
- no mocks visibles
- links externos OK

Para subida controlada:

- todo lo anterior
- variables reales revisadas
- HTTPS/cookies/CORS correctos
- runbook listo
- monitoreo minimo definido
- costos y limites decididos

Para produccion publica abierta:

- todo lo anterior
- terminos/privacidad/disclaimer publicados
- alertas operativas
- backups DB
- rollback probado
- prueba live sostenida con varias busquedas

