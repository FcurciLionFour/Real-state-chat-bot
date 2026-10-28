# Arquitectura Backend NestJS - Monolito Modular Escalable

## 1. Objetivo

Este documento define la arquitectura recomendada del backend para el proyecto.

La decision es:

- backend principal en NestJS
- arquitectura de monolito modular
- preparada para escalar a miles de usuarios
- preparada para crecer a toda Argentina
- preparada para extraer workers o servicios en el futuro si realmente hace falta

La idea no es construir microservicios desde el dia 1. La idea es construir un backend ordenado que pueda evolucionar sin reescribirse.

---

## 2. Decision principal

## 2.1 Opcion elegida

La recomendacion para este proyecto es:

- monolito modular en NestJS

## 2.2 Por que no microservicios ahora

Microservicios agregan complejidad en:

- despliegue
- debugging
- contratos entre servicios
- observabilidad
- colas
- reintentos
- consistencia entre dominios

Eso tiene sentido cuando:

- hay varios equipos
- hay necesidades fuertes de despliegue independiente
- hay hotspots muy claros
- el producto ya valido su nucleo

Hoy eso no aplica.

## 2.3 Por que monolito modular si escala

Un monolito bien diseñado puede escalar bien si:

- el backend es stateless
- la DB esta bien modelada e indexada
- Redis se usa bien
- hay timeouts y limites
- los modulos estan desacoplados
- los jobs pesados se pueden separar despues

Para este proyecto, eso es suficiente para:

- miles de usuarios
- cobertura nacional
- crecimiento gradual de fuentes

---

## 3. Modelo de arquitectura recomendado

## 3.1 Estructura general

### Capa de API

Expone endpoints HTTP.

### Capa de aplicacion

Orquesta casos de uso.

### Capa de dominio

Contiene tipos y reglas de negocio.

### Capa de infraestructura

Contiene Prisma, OpenAI, Redis, scraping, adapters y JWT.

## 3.2 Regla clave

Los controllers no deben contener logica de negocio.

Los controllers:

- reciben request
- validan input
- llaman caso de uso o servicio de aplicacion
- devuelven respuesta

La logica real vive en servicios y dominio.

---

## 4. Modulos recomendados

## 4.1 `auth`

### Responsabilidad

- registro
- login
- refresh
- logout
- `me`

### Componentes esperados

- `AuthController`
- `AuthService`
- `TokenService`
- `PasswordService`
- `JwtAuthGuard`

---

## 4.2 `users`

### Responsabilidad

- acceso a usuario
- perfil minimo
- preferencias futuras como idioma

### Componentes esperados

- `UsersService`
- `UsersRepository`

---

## 4.3 `conversations`

### Responsabilidad

- crear conversacion
- listar conversaciones
- obtener detalle
- ownership por usuario

### Componentes esperados

- `ConversationsController`
- `ConversationsService`
- `ConversationsRepository`

---

## 4.4 `messages`

### Responsabilidad

- persistencia de mensajes
- lectura de historial

### Componentes esperados

- `MessagesService`
- `MessagesRepository`

---

## 4.5 `search-state`

### Responsabilidad

- leer estado actual
- aplicar merge
- incrementar version
- persistir estado

### Componentes esperados

- `SearchStateService`
- `SearchStateMergeService`
- `SearchStateRepository`

---

## 4.6 `ai`

### Responsabilidad

- construir input al modelo
- llamar OpenAI
- validar schema
- devolver `SearchDecision`

### Componentes esperados

- `AiService`
- `SearchDecisionSchemaValidator`
- `PromptBuilder`

### Regla

Este modulo no decide logica de negocio final. Solo interpreta.

---

## 4.7 `search`

### Responsabilidad

- query builder
- pipeline de busqueda
- dedupe
- ranking
- persistencia de corridas

### Componentes esperados

- `SearchController` si se expone endpoint directo despues
- `SearchService`
- `SearchRunService`
- `QueryBuilderService`
- `DedupeService`
- `RankingService`

### Regla

Es uno de los modulos centrales del producto.

---

## 4.8 `sources`

### Responsabilidad

- discovery
- fetch HTML
- adapters por portal
- normalizacion por fuente

### Componentes esperados

- `DiscoveryService`
- `HtmlFetcherService`
- `SourceAdapterRegistry`
- `ZonapropAdapter`
- `ArgenpropAdapter`
- `ProperatiAdapter`
- `MudafyAdapter`

### Regla

Cada portal entra como adapter, no como logica dispersa por el sistema.

---

## 4.9 `properties`

### Responsabilidad

- acceso a propiedades cacheadas
- detalle de propiedad
- metodos de upsert

### Componentes esperados

- `PropertiesService`
- `PropertiesRepository`

---

## 4.10 `favorites`

### Responsabilidad

- alta de favorito
- baja de favorito
- listado de favoritos

### Componentes esperados

- `FavoritesController`
- `FavoritesService`
- `FavoritesRepository`

---

## 4.11 `cache`

### Responsabilidad

- cache por filtros
- cache de HTML
- helpers sobre Redis

### Componentes esperados

- `CacheService`
- `SearchCacheService`
- `HtmlCacheService`

---

## 4.12 `observability`

### Responsabilidad

- logging estructurado
- request ids
- tiempos por etapa
- errores por fuente

### Componentes esperados

- `LoggerService`
- interceptors
- middleware de request id

---

## 4.13 `config`

### Responsabilidad

- variables de entorno
- validacion de configuracion

### Componentes esperados

- `ConfigModule`
- schema de env

---

## 5. Casos de uso principales

## 5.1 Crear conversacion

### Input

- usuario autenticado

### Output

- `conversationId`
- estado inicial vacio

### Modulos involucrados

- `conversations`
- `search-state`

---

## 5.2 Listar conversaciones

### Input

- usuario autenticado

### Output

- lista de conversaciones ordenada por `updated_at`

### Modulos involucrados

- `conversations`

---

## 5.3 Obtener detalle de conversacion

### Input

- `conversationId`
- usuario autenticado

### Output

- metadata de conversacion
- mensajes
- estado actual
- opcionalmente ultimo `search_run`

### Modulos involucrados

- `conversations`
- `messages`
- `search-state`

---

## 5.4 Enviar mensaje al chat

### Input

- `conversationId`
- `message`
- usuario autenticado

### Output

- respuesta assistant
- estado actualizado
- resultados si hubo busqueda

### Modulos involucrados

- `messages`
- `search-state`
- `ai`
- `search`
- `sources`
- `properties`

### Regla

Este es el caso de uso principal del producto.

---

## 5.5 Guardar favorito

### Input

- usuario autenticado
- `propertyId`

### Output

- favorito creado o idempotencia

### Modulos involucrados

- `favorites`
- `properties`

---

## 5.6 Eliminar favorito

### Modulos involucrados

- `favorites`

---

## 5.7 Listar favoritos

### Modulos involucrados

- `favorites`
- `properties`

---

## 6. Flujo principal del backend

## 6.1 Endpoint central

`POST /conversations/:id/messages`

## 6.2 Flujo recomendado

1. autenticar usuario
2. validar ownership de la conversacion
3. persistir mensaje del usuario
4. obtener `search_state`
5. construir contexto minimo para IA
6. invocar `AiService`
7. validar `SearchDecision`
8. traducir decision a operaciones de merge
9. aplicar merge sobre `search_state`
10. persistir nuevo estado
11. si `requiresClarification`, responder sin buscar
12. si `shouldSearch`, invocar `SearchService`
13. `SearchService` ejecuta:
   - query builder
   - discovery
   - filtro de dominios
   - fetch
   - adapters
   - normalizacion
   - dedupe
   - ranking
   - persistencia de `search_run`
14. persistir mensaje assistant
15. devolver respuesta final

---

## 7. Que logica va en cada capa

## 7.1 Controllers

Solo:

- validacion de request
- llamada al servicio correcto
- mapping de respuesta HTTP

Nunca:

- merge de filtros
- reglas de ranking
- acceso directo complejo a Prisma
- decisiones de negocio grandes

## 7.2 Servicios de aplicacion

Se encargan de:

- orquestar el caso de uso
- coordinar modulos
- manejar transacciones logicas

Ejemplo:

- `ChatApplicationService`
- `CreateConversationService`

## 7.3 Dominio

Se encarga de:

- tipos
- merge rules
- dedupe rules
- ranking rules

## 7.4 Repositories

Se encargan de:

- leer y escribir datos
- abstraer Prisma

No deben contener reglas de negocio complejas.

---

## 8. Servicios importantes recomendados

## 8.1 `ChatApplicationService`

Deberia ser el orquestador principal del flujo conversacional.

### Responsabilidades

- recibir mensaje
- coordinar IA
- coordinar merge de filtros
- decidir busqueda
- coordinar respuesta final

## 8.2 `SearchStateMergeService`

### Responsabilidades

- aplicar operaciones sobre filtros
- resolver contradicciones
- normalizar listas y valores

## 8.3 `SearchService`

### Responsabilidades

- ejecutar busqueda real
- coordinar discovery, adapters, dedupe y ranking

## 8.4 `RankingService`

### Responsabilidades

- calcular score
- construir razones de ranking

## 8.5 `DedupeService`

### Responsabilidades

- eliminar duplicados
- priorizar representacion mas util de un anuncio

---

## 9. Endpoints MVP recomendados

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

## Conversations

- `POST /conversations`
- `GET /conversations`
- `GET /conversations/:id`

## Chat

- `POST /conversations/:id/messages`

## Favorites

- `GET /favorites`
- `POST /favorites`
- `DELETE /favorites/:propertyId`

---

## 10. Que NO hacer en esta etapa

No recomiendo ahora:

- microservicios
- event bus complejo
- separar auth como servicio aparte
- separar scraping como servicio aparte desde el dia 1
- dividir por deploys multiples

Eso agrega complejidad sin resolver hoy el problema principal.

---

## 11. Camino de escalado futuro

## 11.1 Primera etapa

- monolito modular
- una DB principal
- Redis

## 11.2 Segunda etapa

Si aparecen hotspots reales:

- workers para scraping
- workers para refresco de propiedades
- jobs asincronos para reindexado o enrichment

## 11.3 Tercera etapa

Solo si realmente hace falta:

- extraccion de algun modulo a servicio independiente

Ejemplos posibles:

- scraping masivo
- analytics
- recomendaciones avanzadas

## 11.4 Regla

No empezar distribuido. Diseñar para poder distribuir despues.

---

## 12. Conclusion tecnica

La arquitectura correcta para este proyecto es:

- `NestJS monolith modular`
- dominio fuerte
- servicios de aplicacion claros
- repositories sobre Prisma
- Redis como soporte
- posibilidad de extraer workers mas adelante

Esto da:

- escalabilidad suficiente
- velocidad de construccion
- menor complejidad operativa
- mejor mantenimiento para un equipo chico

Es la opcion mas sensata y mas escalable en la practica para esta etapa.
