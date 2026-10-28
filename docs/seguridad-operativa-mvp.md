# Seguridad Operativa MVP

## 1. Objetivo

Este documento define las decisiones de seguridad operativa del MVP.

No busca convertir el sistema en una plataforma ultra enterprise desde el dia 1, pero si fijar una base profesional para:

- autenticacion
- autorizacion
- validacion de inputs
- proteccion de endpoints
- sanitizacion de integraciones externas
- manejo seguro de secretos

---

## 2. Principio general

La seguridad del MVP debe ser:

- suficiente para produccion controlada
- simple de operar
- coherente con un backend escalable

No conviene dejar seguridad "para despues", especialmente en:

- auth
- rate limiting
- scraping
- manejo de tokens

---

## 3. Autenticacion

## 3.1 Modelo elegido

- access token JWT de corta vida
- refresh token en cookie HttpOnly
- refresh token persistido hasheado en DB

## 3.2 Reglas

- no guardar refresh token plano
- invalidar refresh token en logout
- permitir rotacion futura de refresh token

## 3.3 Recomendacion de expiracion

### Access token

- corto

### Refresh token

- mas largo

### Regla

No hace falta cerrar el numero exacto ahora, pero el principio es:

- access breve para reducir riesgo
- refresh mas largo para UX

---

## 4. Autorizacion

## 4.1 Regla

Todo acceso a recursos de usuario debe validar ownership.

## 4.2 Casos clave

- una conversacion solo la puede leer su duenio
- un favorito solo lo puede crear/eliminar su duenio
- un `search_state` solo existe dentro de una conversacion del usuario

## 4.3 Regla tecnica

Nunca confiar en `conversationId` o `propertyId` sin verificar que el usuario autenticado puede operar sobre ese recurso.

---

## 5. Passwords

## 5.1 Regla

Las passwords deben guardarse hasheadas.

## 5.2 Algoritmo recomendado

- Argon2 preferido
- bcrypt aceptable si hay una razon concreta

## 5.3 Regla adicional

- no loguear passwords
- no devolver detalles sobre cual parte del login fallo

---

## 6. Cookies y tokens

## 6.1 Cookie del refresh token

La cookie debe ser:

- `HttpOnly`
- `Secure` en produccion
- `SameSite` segun estrategia de frontend/backend

## 6.2 Access token

El access token puede viajar en header `Authorization: Bearer`.

## 6.3 Regla

No guardar refresh token en localStorage.

---

## 7. Rate limiting

## 7.1 Objetivo

Reducir abuso y proteger costo operativo.

## 7.2 Endpoints que deben tener rate limiting fuerte

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /conversations/:id/messages`

## 7.3 Implementacion recomendada

- Redis como backing store

## 7.4 Regla

No hace falta solo por IP.

Conviene combinar segun endpoint:

- IP
- usuario autenticado
- ventana temporal

---

## 8. Validacion de inputs

## 8.1 Regla

Todo input externo debe validarse con DTOs y schema claros.

## 8.2 Casos principales

- register/login
- crear conversacion
- enviar mensaje
- crear/eliminar favorito

## 8.3 Reglas especificas

- strings con longitud maxima
- emails validos
- UUIDs validos
- no permitir campos desconocidos cuando no correspondan

## 8.4 Regla de mensajes de chat

Conviene limitar:

- longitud maxima del mensaje
- mensajes vacios o solo espacios

---

## 9. Sanitizacion de integraciones externas

## 9.1 Riesgo

El sistema va a consumir URLs y HTML externos.

## 9.2 Reglas obligatorias

- aceptar solo HTTP/HTTPS
- validar dominio contra allowlist
- normalizar URL antes de fetch
- no seguir dominios arbitrarios encontrados en discovery

## 9.3 Regla de scraping

El sistema no debe permitir que un usuario fuerce fetch a cualquier URL externa.

### Importante

La decision de que URL fetchear sale del pipeline controlado, no del usuario final.

---

## 10. OpenAI y claves externas

## 10.1 Reglas

- las API keys viven en variables de entorno
- nunca se hardcodean
- nunca se envian al frontend
- nunca se loguean

## 10.2 Integraciones sensibles

- OpenAI
- discovery API
- base de datos
- Redis

---

## 11. Logs y datos sensibles

## 11.1 Regla

Los logs deben ayudar a depurar, pero no exponer secretos.

## 11.2 No loguear

- passwords
- refresh tokens
- access tokens completos
- secrets
- cookies sensibles

## 11.3 Recomendacion

Si hace falta loguear algo de auth para debugging, usar valores truncados o hashes.

---

## 12. Manejo de errores

## 12.1 Regla

Los errores hacia frontend deben ser seguros y controlados.

## 12.2 No devolver

- stack traces
- SQL errors crudos
- payloads internos de terceros
- detalles de infraestructura

## 12.3 Si una fuente externa falla

El usuario recibe un mensaje claro, no el detalle tecnico exacto.

---

## 13. CORS y frontend/backend

## 13.1 Regla

No abrir CORS global a cualquier origen en produccion.

## 13.2 Recomendacion

Whitelist de origanes del frontend oficial.

## 13.3 Si se usan cookies

Configurar bien:

- `credentials`
- origenes permitidos
- `SameSite`

---

## 14. Seguridad de base de datos

## 14.1 Reglas

- credenciales en env vars
- usuario de DB con permisos adecuados
- backups habilitados en produccion
- no exponer DB a internet sin control

## 14.2 Regla de Prisma

No usar Prisma directo desde controllers.

### Motivo

Reduce fugas de acceso y ayuda a centralizar validaciones.

---

## 15. Seguridad de Redis

## 15.1 Reglas

- no exponer Redis abierto publicamente
- credenciales si aplica
- no guardar verdad del negocio como unica fuente

## 15.2 Motivo

Redis es infraestructura de soporte, no base principal.

---

## 16. Abuse control del chat

## 16.1 Riesgo

El endpoint conversacional puede disparar:

- costo de OpenAI
- costo de discovery
- scraping

## 16.2 Reglas recomendadas

- rate limiting
- longitud maxima de mensaje
- timeouts
- limites por corrida
- cache por filtros cuando tenga sentido

## 16.3 Regla

No dejar que un mensaje dispare un pipeline sin limites.

---

## 17. Seguridad de favorites y recursos internos

## 17.1 Regla

El usuario solo puede favoritear propiedades existentes en `properties_cache`.

## 17.2 Regla adicional

No aceptar payloads inventados de propiedades desde frontend para crear favoritos.

---

## 18. Checklist minima de seguridad MVP

Antes de considerar el MVP listo para uso real, deberia cumplirse:

1. password hashing activo
2. JWT access + refresh cookie funcionando
3. refresh token hasheado en DB
4. ownership checks en recursos
5. DTO validation global
6. rate limiting en auth y chat
7. allowlist estricta de dominios
8. CORS limitado
9. logs sin secretos
10. secrets en env vars

---

## 19. Decisiones cerradas con este documento

- auth profesional con access token + refresh cookie
- ownership obligatorio en recursos
- Argon2 recomendado para passwords
- rate limiting obligatorio en auth y chat
- no fetch a URLs arbitrarias
- secrets solo en env vars
- errores sanitizados
- CORS restringido
- Redis y DB no expuestos sin control

---

## 20. Proximo paso

Con seguridad operativa definida, los siguientes bloques recomendables son:

1. observabilidad
2. roadmap final de implementacion

Despues de eso, la etapa de especificacion previa a codigo queda practicamente cerrada.
