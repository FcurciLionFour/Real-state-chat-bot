# Go / No-Go MVP

Fecha: 2026-05-06.

Este documento define la decision de salida. Debe completarse antes de subir.

## 1. Estado actual

Decision actual: `NO-GO para produccion publica abierta`.

Decision actual: `GO tecnico para demo o entorno controlado`.

Condiciones pendientes para subir a staging/beta cerrada:

- variables de deploy revisadas
- CORS/cookies/HTTPS definidos para dominio real
- monitoreo/logs definidos
- backup/rollback definidos
- disclaimer/legal minimo definido

## 2. Checklist Go

### Codigo

- [x] `backend npm run build` OK
- [x] `backend npm test` OK
- [x] `backend npm run test:e2e` OK
- [x] `backend npm run test:openai` OK con key real
- [x] `frontend npm run build` OK
- [x] `frontend user-flow E2E` OK
- [x] `frontend admin-flow E2E` OK
- [x] `python-scraper` tests OK en Docker

### Entorno

- [x] Docker Desktop activo
- [x] Postgres activo
- [x] Redis activo
- [x] scraper activo si se valida busqueda real
- [x] migraciones aplicadas localmente/al dia
- [ ] `.env` productivo sin placeholders
- [ ] secretos fuertes
- [ ] `FRONTEND_URL` correcto
- [ ] CORS cerrado al dominio real
- [ ] cookies seguras bajo HTTPS

### Producto

- [x] registro/login/logout OK
- [x] refresh OK
- [x] crear conversacion OK
- [x] enviar mensaje OK
- [x] modificar filtros OK
- [x] resultados reales o vacio honesto OK
- [x] favoritos OK
- [x] historial OK
- [x] abrir publicacion original cubierto por UI/flujo de ficha disponible
- [x] admin overview OK
- [x] invalidar cache OK

### Datos

- [x] no aparece `mock-source` en smoke live
- [x] no aparece `example.com` en smoke live
- [x] alquiler ARS no muestra USD como match en smoke live
- [x] alquiler 800k no supera 950k ARS si hay precio informado en smoke live
- [x] `monoambiente o 2 ambientes` no muestra 3 ambientes en resultados rankeados del smoke live
- [ ] resultados sin precio se diferencian claramente
- [ ] fuente y fecha de extraccion visibles

### Operacion

- [ ] logs accesibles en entorno destino
- [ ] healthchecks configurados
- [ ] rollback definido
- [ ] backups DB definidos
- [ ] limites de uso definidos
- [ ] costo estimado por busqueda
- [ ] responsable de monitoreo definido

### Legal/comercial

- [ ] disclaimer de datos de terceros
- [ ] terminos basicos
- [ ] privacidad basica
- [ ] aclaracion de disponibilidad/precio sujeto a fuente
- [ ] politica de contacto/favoritos

## 3. Deudas aceptables para demo controlada

Estas deudas no bloquean una demo cerrada:

- warnings de budget SCSS si la UX se ve bien
- una sola fuente principal activa
- geocoding local/limitado
- owner properties en beta
- blog/admin con polish pendiente
- sin alertas productivas completas

## 4. Deudas no aceptables para subir publicamente

Estas bloquean produccion publica:

- tests principales sin correr con servicios activos
- mocks visibles en busqueda live
- secretos debiles o placeholders
- cookies inseguras en HTTPS
- scraper expuesto sin proteccion
- CORS abierto innecesariamente
- links externos rotos
- falta total de disclaimer/legal
- sin estrategia de logs y rollback

## 5. Decision recomendada

Recomendacion actual:

1. No agregar features grandes nuevas.
2. Subir primero a staging/controlado.
3. Repetir la matriz en ese entorno.
4. Probar con usuarios internos.
5. Medir latencia, calidad de resultados y costos.
6. Completar legal/monitoring/rollback.
7. Recien despues abrir publico gradualmente.
