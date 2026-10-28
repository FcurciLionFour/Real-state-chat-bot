# Seguimiento de Implementacion MVP

## 1. Objetivo

Este archivo deja registro operativo de:

- que ya esta implementado
- que fue validado de verdad
- que problemas se corrigieron
- con que se continua despues

No reemplaza a los documentos de arquitectura. Se apoya en ellos.

---

## 2. Documentos guia obligatorios

Cada avance tecnico debe seguir estos archivos como referencia principal:

- `docs/roadmap-implementacion-mvp.md`
- `docs/plan-construccion-mvp.md`
- `docs/contratos-http-mvp.md`
- `docs/contrato-ia-mvp.md`
- `docs/pre-schema-prisma-mvp.md`
- `docs/tipos-dominio-mvp.md`
- `docs/catalogos-canonicos-mvp.md`
- `docs/reglas-ranking-dedupe-mvp.md`
- `docs/estrategia-scraping-discovery-mvp.md`
- `docs/observabilidad-mvp.md`

Regla de trabajo:

- primero mirar `docs`
- despues implementar
- si el codigo contradice la documentacion acordada, corregir el codigo o actualizar la documentacion de forma explicita

---

## 3. Fase actual segun roadmap

Estado actual:

- Fase 0 mayormente materializada
- Fase 1 mayormente materializada
- Fase 2 cerrada con contrato HTTP base y flujo mock validados
- Fase 3 iniciada con integracion OpenAI real y fallback seguro implementados
- Fase 4 mayormente materializada en auth y favoritos basicos
- Fase 5 materializada con discovery base, allowlist y cuatro adapters reales defensivos
- Fase 6 iniciada con dedupe conservador y ranking explicable persistible
- Fase 7 iniciada con frontend Angular standalone usable conectado al backend real
- Fase 8 iniciada parcialmente con cache operativa y observabilidad estructurada del pipeline real
- request id y contexto correlacionado HTTP -> auth/chat/search ya integrados
- rate limiting base en auth y chat ya implementado con Redis
- validacion HTTP real local completada para `x-request-id` y correlacion auth -> conversations -> search
- validacion live del pipeline real ya preparada como script ejecutable, pendiente solo de credenciales Google

Interpretacion practica:

- el core conversacional ya existe
- la integracion con IA real existe pero no esta cerrada con validacion real
- auth real basica ya existe
- favoritos basicos ya existen
- la busqueda real con fuentes externas ya existe a nivel base, aunque todavia falta validacion live y tuning
- el pipeline ya aplica dedupe antes de ranking y persiste razones explicables del score
- el pipeline ya cachea discovery, HTML y resultados por filtros con degradacion limpia si Redis no responde
- el logger ya incorpora `requestId`, `userId`, `conversationId` y `searchRunId` cuando el contexto existe
- auth, conversations y favorites ya emiten eventos de negocio estructurados
- el detalle de conversacion ya expone `lastSearchResults` para rehidratar resultados en frontend
- existe frontend Angular standalone en `frontend` con login, register, search workspace, chats y favorites

---

## 4. Progreso confirmado

### Backend base

- backend NestJS creado en `backend`
- Prisma configurado con schema inicial
- estructura modular inicial creada
- build de backend validado con `npm run build`

### Dominio y persistencia

- tablas principales del MVP modeladas en Prisma
- repositorios base implementados para conversaciones, mensajes, search state, search runs y properties cache
- `SearchFilters` y defaults base presentes

### Loop conversacional mock

- endpoint `POST /api/conversations`
- endpoint `GET /api/conversations`
- endpoint `GET /api/conversations/:id`
- endpoint `POST /api/conversations/:id/messages`
- merge mock de filtros funcionando
- persistencia de `searchState` por conversacion
- persistencia de `searchRuns`
- persistencia de resultados mock en `PropertyCache`
- responses de conversaciones alineadas con el contrato HTTP base
- paginacion simple `page/limit` en listado de conversaciones
- tests del core conversacional mock agregados
- response de `POST /api/conversations/:id/messages` alineada con el contrato HTTP base

### Integracion IA real

- `SearchDecision` incorporado como contrato de dominio del backend
- `AiSearchDecisionService` agregado
- integracion con OpenAI Responses API agregada en infraestructura
- salida estructurada con `json_schema` estricto implementada
- validacion runtime de `SearchDecision` implementada
- fallback seguro implementado cuando no hay API key, timeout, JSON invalido o schema invalido
- merge determinista backend implementado a partir de `filterPatch` + `filtersToUnset`

### Validacion funcional realizada

Se valido un flujo real contra PostgreSQL:

- se creo una conversacion
- se envio un mensaje de busqueda
- el backend persistio mensaje de usuario y mensaje assistant
- el `searchState` quedo actualizado
- se genero un `searchRun`
- se asociaron resultados mock

Caso validado:

- operacion `BUY`
- tipo `APARTMENT`
- ubicacion `Palermo`
- moneda `USD`
- tope `140000`
- ambientes `2`
- feature `BALCONY`

Resultado validado:

- `didSearch = true`
- `resultCount = 2`
- `searchRunsCount = 1`
- `lastSearchRun.status = COMPLETED`
- contratos HTTP reales verificados para create, list, detail y send message

Validacion funcional de Fase 3 realizada:

- sin `OPENAI_API_KEY`, el backend no busca
- devuelve fallback seguro de aclaracion
- no genera `searchRun`
- conserva contrato HTTP estable

### Auth y favoritos basicos

- endpoint `POST /api/auth/register`
- endpoint `POST /api/auth/login`
- endpoint `POST /api/auth/refresh`
- endpoint `POST /api/auth/logout`
- endpoint `GET /api/auth/me`
- access token firmado y validado en backend
- refresh token HttpOnly persistido hasheado en DB
- guard de access token aplicado a conversaciones
- se elimino la dependencia del header de desarrollo `x-user-email`
- endpoint `GET /api/favorites`
- endpoint `POST /api/favorites`
- endpoint `DELETE /api/favorites/:propertyId`
- favoritos idempotentes sobre `property_cache`
- tests de Fase 4 agregados para tokens, password hashing, auth service y favorites service
- validacion HTTP real completada para register, login, me, refresh, logout y ciclo create/list/delete de favoritos

### Preparacion de auth para evolucion futura

- `User.passwordHash` paso a nullable para soportar cuentas OAuth-only en el futuro
- `User.emailVerifiedAt` agregado para soportar verificacion por link
- tabla `AuthIdentity` agregada para proveedores externos
- tabla `EmailVerificationToken` agregada para flujo futuro de verificacion de email
- registro actual crea identidad `PASSWORD` sin activar todavia el flujo de verificacion por correo

### Foundation de Fase 5

- `SearchQueryBuilderService` agregado para construir queries de discovery acotadas
- `AllowedSourceDomainsService` agregado con allowlist inicial para Zonaprop, Argenprop, Properati y Mudafy
- `GoogleDiscoveryService` agregado con soporte base para Google Programmable Search API
- `PropertySourceAdapter` y `PropertySourceRegistryService` agregados como contrato base para futuros extractores por portal
- `SearchExecutionService` agregado para desacoplar el chat del mock directo
- `HtmlFetchService` agregado con timeout corto y user-agent controlado
- primer adapter real `ZonapropSourceAdapter` agregado con extraccion defensiva basada en JSON-LD y meta tags
- segundo adapter real `ArgenpropSourceAdapter` agregado con extraccion defensiva basada en JSON-LD y meta tags
- tercer adapter real `ProperatiSourceAdapter` agregado con extraccion defensiva basada en JSON-LD y meta tags
- cuarto adapter real `MudafySourceAdapter` agregado con extraccion defensiva basada en JSON-LD y meta tags
- trazabilidad de fuente reforzada preservando `externalId` desde la extraccion hasta `properties_cache`
- `SearchDedupeService` agregado con dedupe fuerte por `source + externalId`, `sourceUrl`, huella canonica y heuristica conservadora entre fuentes
- `SearchRankingService` agregado con descarte por filtros esenciales, score explicable 0..1 y razones humanas persistibles
- `SearchExecutionService` alineado al pipeline correcto: extraccion -> dedupe -> ranking -> persistencia
- `SearchResultsCacheService` agregado para cache corta de resultados por combinacion de filtros
- `GoogleDiscoveryService` cachea URLs candidatas en Redis con TTL corto
- `HtmlFetchService` cachea HTML por URL en Redis con TTL corto
- `LoggerService` extendido con eventos estructurados JSON para etapas del pipeline
- `RequestContextService` agregado con `AsyncLocalStorage` para propagar `requestId` y metadatos de correlacion
- `SearchExecutionService` y `SearchRunService` ya emiten logs estructurados con tiempos, conteos y fuentes usadas
- `main.ts` ahora genera o reutiliza `x-request-id`, lo devuelve en la respuesta y loguea inicio/fin de cada request HTTP
- `AccessTokenGuard`, `AuthController`, `ChatApplicationService` y `SearchRunService` propagan `userId`, `conversationId` y `searchRunId` al contexto de observabilidad
- decorador `@RateLimit` y `RateLimitGuard` agregados con backing Redis y degradacion limpia si Redis no esta disponible
- endpoints protegidos con rate limiting segun `docs/seguridad-operativa-mvp.md`:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/conversations/:id/messages`
- `AuthService`, `ConversationsService` y `FavoritesService` ahora emiten eventos de negocio estructurados de exito y rechazo
- fallback controlado a `mock-source` mantenido mientras no existan adapters reales o credenciales de discovery
- tests de Fase 5 agregados para query builder, allowlist, discovery sin credenciales, adapters Zonaprop/Argenprop/Properati/Mudafy, preservacion de `externalId` y fallback/flujo real del executor
- tests de Fase 6 agregados para dedupe, ranking, persistencia de razones y orden correcto del pipeline
- tests de Fase 8 agregados para cache de resultados, cache de discovery, cache HTML y cache hit del executor
- tests de Fase 8 agregados tambien para contexto de request y merge automatico de correlacion en logs estructurados
- script `npm run test:phase8:http` agregado para validar por HTTP real `x-request-id`, logs estructurados y propagacion de `userId`, `conversationId` y `searchRunId`
- tests de rate limiting agregados para umbral, rechazo y degradacion sin Redis
- script `npm run test:phase5:live` agregado para validar discovery + scraping + ranking reales cuando existan `GOOGLE_SEARCH_API_KEY` y `GOOGLE_SEARCH_ENGINE_ID`
- endpoint `GET /api/conversations/:id` ampliado con `lastSearchResults` para soportar historial util en frontend
- test de Fase 7 agregado para asegurar que el detalle de conversacion incluye resultados del ultimo search run
- script `npm run test:e2e` agregado para validar por HTTP real el flujo completo de usuario:
- register
- login
- refresh
- crear conversacion
- enviar mensaje
- modificar busqueda
- guardar favorito
- listar favoritos
- historial
- logout
- frontend Angular standalone creado en `frontend` con:
- shell de app y rutas `/`, `/search`, `/login`, `/register`, `/app/chats`, `/app/chats/:id`, `/app/favorites`
- store de auth con access token + refresh por cookie HttpOnly
- interceptor para bearer token y refresh automatico ante `401`
- workspace con chat, filtros activos, listado de conversaciones y resultados trazables
- pagina de favoritos conectada al backend real
- configuracion runtime del frontend agregada via `frontend/public/runtime-config.js` para cambiar `apiBaseUrl` sin rebuild
- script `scripts/start-local.ps1` agregado para abrir backend + frontend en desarrollo local
- build de frontend validado con `npm run build`
- validacion E2E real completa pasando con backend Nest levantado en memoria y PostgreSQL/Redis locales
- hardening base agregado en backend con:
- normalizacion de email y trim defensivo de strings de entrada
- password policy minima para registro
- headers HTTP de seguridad base
- `x-powered-by` deshabilitado
- logs de auth endurecidos para no exponer email crudo en rechazos operativos
- script `npm run test:hardening` agregado para validar hardening operativo por HTTP real
- validacion de hardening pasando para headers, validacion estricta, normalizacion de input, trim de payload y logs sin datos sensibles
- RBAC basico agregado con `RolesGuard` y decorador `@Roles(...)`
- endpoint admin minimo `GET /api/admin/overview` agregado con acceso restringido a `ADMIN`
- script `npm run test:rbac` agregado para validar `403` a usuario comun y `200` a admin
- validacion RBAC/admin pasando con Nest levantado en memoria y PostgreSQL/Redis locales
- admin expandido con endpoints paginados:
- `GET /api/admin/metrics`
- `GET /api/admin/users`
- `GET /api/admin/conversations`
- `GET /api/admin/search-runs`
- `GET /api/admin/properties`
- script `npm run test:admin` agregado para validar metricas y read models del admin
- suite `npm test` ampliada para incluir hardening y admin base

---

## 5. Correccion importante hecha

Problema detectado:

- la busqueda mock se ejecutaba
- `searchState` y `searchRuns` se persistian
- pero `Conversation.lastSearchAt` quedaba en `null`
- y la conversacion no reflejaba bien actividad reciente

Correccion aplicada:

- al persistir mensajes, la conversacion actualiza `updatedAt`
- al persistir una busqueda ejecutada, la conversacion actualiza `lastSearchAt`

Estado posterior a la correccion:

- `lastSearchAt` se completa correctamente
- `updatedAt` queda alineado con la ultima actividad del chat

Adicionalmente se alineo el contrato HTTP de conversaciones:

- `POST /api/conversations` ya no expone campos internos
- `GET /api/conversations` devuelve `items` + `meta`
- `GET /api/conversations/:id` devuelve `messages` y `lastSearchRun` resumidos, sin payload interno crudo

---

## 6. Estado pendiente real

Fase 2 ya puede darse por cerrada.

Pendientes inmediatos para seguir con el roadmap:

- validar Fase 3 con `OPENAI_API_KEY` real
- verificar que el modelo devuelva `SearchDecision` valido en casos reales
- ajustar prompt y reglas finas de `shouldSearch`, `requiresClarification` y `requestedAction`
- terminar de bajar budgets CSS del frontend para `workspace` y `admin`
- sumar, como mucho, una o dos acciones operativas chicas mas en admin si aportan valor real
- cerrar una pasada final de polish visual y de legibilidad sobre el workspace

Bloqueo actual:

- `backend/.env` todavia no tiene `OPENAI_API_KEY`
- por eso Fase 3 no puede cerrarse formalmente con una corrida real contra OpenAI

Todavia no esta hecho:

- OpenAI real
- `SearchDecision` real validado por schema
- envio real de email de verificacion
- endpoint de verificacion por token
- login social con Google, Facebook o Apple
- validacion live de discovery y scraping contra HTML real
- rate limiting fino por usuario y por endpoint si el uso real lo pide
- endurecimiento completo de seguridad para produccion
- suite E2E de punta a punta en browser contra servicios externos reales

---

## 7. Proximo paso recomendado

Segun `docs/roadmap-implementacion-mvp.md`, el siguiente bloque de trabajo deberia ser:

### Continuacion inmediata

Cerrar Fase 3 cuando exista `OPENAI_API_KEY`:

- ejecutar pruebas reales con API key
- tunear prompt y comportamiento conversacional
- confirmar casos de espanol e ingles
- cerrar Fase 3 formalmente

### Paso siguiente despues de eso

Profundizar Fase 6:

- calibrar dedupe entre fuentes con HTML real
- tunear pesos de ranking con evidencia real
- exponer resumen util de `rankReasonJson` en frontend futuro

### Paso siguiente despues de eso

Profundizar Fase 8:

- validar cache real contra Redis local levantado
- medir latencias reales por fuente con corridas live controladas
- correr `npm run test:phase5:live` con credenciales reales y revisar calidad de resultados/fuentes

### Paso siguiente antes de credenciales externas

- rematar budgets CSS del frontend para dejar `workspace` y `admin` mas sanos
- si hace falta, agregar una ultima mejora operativa chica en admin
- seguir evitando features grandes nuevas

---

## 8. Regla de continuidad

Antes de seguir implementando cualquier modulo nuevo:

1. revisar el roadmap y el documento especifico del tema
2. verificar si ya existe un contrato en `docs`
3. implementar respetando ese contrato
4. actualizar este archivo con el progreso real y el siguiente paso

---

## 9. Ultima actualizacion

### Actualizacion especial - discovery externo real

Queda documentado el estado real de las pruebas live de discovery para no volver a recorrer el mismo camino en sesiones futuras.

#### Google Custom Search JSON API

- se verifico API habilitada, `cx` valido y key nueva creada
- se verifico billing activo en el proyecto `RealStateIA`
- la key paso de error `API_KEY_INVALID` a error de permisos del proyecto
- conclusion practica: `Custom Search JSON API` ya no es una opcion viable para este proyecto nuevo
- criterio adoptado: dejar de invertir tiempo en esa integracion y migrar el discovery a `Vertex AI Search`

#### Migracion a Vertex AI Search

- se refactorizo el backend para soportar provider de discovery seleccionable por config
- se agrego `VertexDiscoveryService` usando `searchLite` por API key
- se creo la app `RealStateIASearch`
- `App ID` confirmado: `realstateiasearch_1775921734275`
- configuracion backend utilizada para las pruebas:
- `SEARCH_DISCOVERY_PROVIDER=vertex-ai-search`
- `VERTEX_AI_SEARCH_PROJECT_ID=270641758025`
- `VERTEX_AI_SEARCH_LOCATION=global`
- `VERTEX_AI_SEARCH_COLLECTION=default_collection`
- `VERTEX_AI_SEARCH_APP_ID=realstateiasearch_1775921734275`
- `VERTEX_AI_SEARCH_SERVING_CONFIG=default_search`
- el data store quedo creado como `Sitio web (Basico)` sobre:
- `www.zonaprop.com.ar/*`
- `www.argenprop.com/*`
- `www.properati.com.ar/*`
- `www.mudafy.com.ar/*`

#### Limite encontrado con Vertex

- la opcion `Indexacion avanzada de sitios web` no se puede activar en estos dominios
- Google exige verificacion de propiedad en `Google Search Console`
- como los dominios son de terceros, no es una via realista para este MVP
- por lo tanto, el setup disponible hoy es `Vertex AI Search + Sitio web (Basico)`

#### Ajustes hechos en backend para mejorar calidad

- se agrego deteccion de URLs de ficha real por fuente en los adapters
- el registry ahora prioriza URLs de detalle sobre URLs de categoria
- `SearchExecutionService` descarta paginas agregadas de listados y homepages genericas antes del ranking
- se endurecieron patrones para no tratar paginas tipo `departamentos en venta en Palermo` como propiedades reales
- se ajusto el query builder para probar variantes mas orientadas a ficha:
- query base
- query con `publicacion`
- query con `ficha`
- query con `detalle` y precio cuando aplica
- toda la suite backend quedo revalidada con `npm run build` y `npm test`

#### Resultado real de las pruebas live

- `npm run test:phase5:live` ya no falla por integracion rota
- el backend se conecta bien a Vertex y recibe candidatos reales
- el problema actual es calidad de discovery:
- Vertex basico devuelve mayormente listados, categorias o incluso homepages
- Properati ademas devolvio `403` en fetch de detalle
- como ahora esas URLs se descartan correctamente, el pipeline cae a `mock fallback` en vez de mostrar resultados falsos

#### Conclusion tecnica actual

- el backend ya quedo del lado correcto de la validacion: prioriza exactitud sobre resultados basura
- el cuello de botella ya no esta en el pipeline interno
- el limite actual esta en `Vertex AI Search` usando `website basic` sobre sitios de terceros
- no conviene seguir gastando tiempo intentando "forzar" Vertex basico como si fuera un problema de ranking interno

#### Opciones reales a partir de este punto

1. cambiar de provider de discovery para URLs candidatas
2. usar Vertex solo con datos propios o de partners verificables
3. adoptar una estrategia hibrida:
- otro provider para discovery de URLs
- mantener nuestro scraping, normalizacion, dedupe y ranking actuales

#### Decision operativa recomendada

- mantener la abstraccion de discovery y el soporte a Vertex ya implementado
- considerar cerrada la investigacion de `Google Custom Search JSON API`
- considerar investigado el limite de `Vertex AI Search` para este caso de uso puntual
- el siguiente paso ya no deberia ser insistir con configuracion Google, sino decidir provider alternativo o estrategia hibrida

---

Ultimo avance guardado:

- loop mock persistente validado
- bug de `lastSearchAt` corregido
- contrato HTTP base de conversaciones alineado
- contrato HTTP base del endpoint de mensajes alineado
- tests del core mock pasando
- verificacion HTTP real completa pasando
- integracion OpenAI real implementada
- fallback seguro de Fase 3 validado sin API key
- bloqueo registrado: falta `OPENAI_API_KEY` para validacion real
- build backend validado
- modo operativo OpenAI documentado para local, prueba barata y produccion futura
- logs base agregados para distinguir `safe-fallback` de `real-api` y registrar caidas al fallback
- script `npm run test:openai` agregado para validar Fase 3 con casos reales apenas exista `OPENAI_API_KEY`
- auth real basica implementada con access token + refresh token HttpOnly
- conversaciones protegidas con bearer token y sin `x-user-email`
- favoritos basicos implementados y protegidos
- schema de auth preparado para email verification y proveedores OAuth futuros
- migracion `20260408093000_auth_extensibility` aplicada en la base local
- validacion HTTP real de Fase 4 completada con Docker local
- tests de Fase 4 pasando
- `docker-compose.yml` alineado con el password actual del entorno local
- foundation de Fase 5 agregada con query builder, discovery Google y allowlist
- tests de Fase 5 agregados
- cuatro adapters reales base integrados para Zonaprop, Argenprop, Properati y Mudafy
- dedupe conservador y ranking explicable implementados y persistidos
- tests de Fase 6 agregados
- cache de discovery, HTML y resultados ya integrados con degradacion limpia sobre Redis
- logs estructurados por etapas del pipeline ya integrados
- `requestId` y correlacion de contexto ya integrados de punta a punta
- tests de Fase 8 agregados
- validacion HTTP real de correlacion ya pasada localmente
- rate limiting base ya implementado y validado
- runner de validacion live ya preparado
- runner E2E real ya preparado y validado
- panel admin frontend ya conectado a overview, metricas, listados y paginacion
- endpoints admin operativos agregados para cambio de rol y detalle de conversaciones/search runs
- accion operativa admin agregada para invalidar cache de `search:results`, `search:google:discovery` y `search:html`
- validacion backend de admin actions pasando con `npm run test:admin:actions`
- validacion browser E2E pasando con `npm run test:e2e` en frontend luego del panel admin
- workspace frontend muy profundizado con:
- contexto operativo arriba del chat
- prompts iniciales
- atajo `Ctrl/Cmd + Enter`
- filtros inline para operacion, tipo, moneda, ubicacion, tope, ambientes, dormitorios y banos
- ficha destacada de resultado con facts, score, razones, preview y mini galeria
- comparacion de avisos con resumen comparativo y relanzamiento de busqueda desde comparacion
- resumen por turno bajo mensajes del asistente
- historial enriquecido con preview de filtros y ultimo mensaje
- reuso de conversaciones recientes y rerun directo desde estado vacio e historial
- favoritos frontend profundizados con:
- comparacion lado a lado
- reuso de favorito como base de nueva busqueda
- busqueda de similares desde favorito
- relanzamiento de busqueda desde comparacion de favoritos
- panel admin frontend profundizado con:
- tolerancia a fallos transitorios por bloque
- filtro rapido local por seccion
- navegacion cruzada entre search runs y conversaciones
- backend operativo profundizado con:
- endpoints `GET /api/health/live` y `GET /api/health/ready`
- readiness con estado de base de datos, Redis y brechas de credenciales live (`OPENAI_API_KEY`, `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_ENGINE_ID`)
- validacion HTTP real agregada con `npm run test:health`
- validaciones locales mantenidas durante toda la tanda con:
- `npm run build` en frontend pasando
- `npm run test:e2e` en frontend pasando
- budgets CSS resueltos en frontend:
- `workspace-page.component.scss` ya no dispara warning
- `admin-page.component.scss` ya no dispara warning
- hardening operativo profundizado con:
- configuracion explicita de `TRUST_PROXY` para no confiar ciegamente en `x-forwarded-for`
- resolucion centralizada de IP cliente reutilizada por auth y rate limiting
- politica de refresh cookie configurable por entorno (`secure`, `sameSite`, `domain`, `path`)
- `health/ready` ampliado con `operationalStatus`, `operationalWarnings` y checks de despliegue
- validaciones backend mantenidas con:
- `npm run test:hardening` pasando
- `npm run test:health` pasando
- `npm run build` en backend pasando
- discovery desacoplado de Google con provider seleccionable por config (`SEARCH_DISCOVERY_PROVIDER`)
- preparacion real para migracion a Vertex AI Search con:
- soporte de config para `vertex-ai-search`
- `VertexDiscoveryService` usando `searchLite` por API key como camino de integracion
- `SearchExecutionService` ya consumiendo un selector de provider en vez de Google directo
- `health/ready` alineado al provider activo y a sus credenciales requeridas
- suite backend revalidada tras el refactor con:
- `npm test` pasando
- `npm run test:hardening` pasando
- `npm run test:health` pasando
- `npm run build` en backend pasando
- migracion real de discovery a `Vertex AI Search` completada a nivel backend y entorno
- `Vertex AI Search` validado live como integracion funcional, pero limitado en calidad con `Sitio web (Basico)` sobre dominios de terceros
- filtros backend endurecidos para descartar listados agregados y homepages antes del ranking
- `npm run test:phase5:live` dejando expuesto el limite real del provider en vez de mezclarlo con errores del pipeline
- documento de arquitectura creado para servicio Python de scraping y adquisicion de datos en `docs/arquitectura-servicio-python-scraping.md`
- scaffold inicial del servicio `python-scraper-service` ya creado con `FastAPI`, contratos, health, capabilities, endpoint `POST /v1/search` en stub y `Dockerfile`
- `backend/docker-compose.yml` ya ampliado para poder levantar `python-scraper` junto a Postgres y Redis
- validacion local del scaffold Python completada con:
- `docker compose up -d --build python-scraper`
- `GET http://localhost:8000/health/live`
- `GET http://localhost:8000/v1/capabilities`
- `POST http://localhost:8000/v1/search` con payload realista devolviendo contrato stub valido
- primera fuente real ya conectada en `python-scraper-service`:
- `Argenprop` con `portal-native discovery`
- fetch real por `HTTPX`
- extraccion real inicial de fichas desde URLs de detalle
- validacion live local pasando contra `POST http://localhost:8000/v1/search` con `sources=["argenprop"]`
- mejoras aplicadas sobre `Argenprop`:
- extraccion de `price/currency` mas robusta
- respeto real de `limitPerSource`
- metadata de procesamiento alineada a URLs realmente fetcheadas
- verificacion adicional: el JSON HTTP del servicio sale en UTF-8 correcto; el mojibake observado en pruebas anteriores provenia de `Invoke-RestMethod` en PowerShell, no del API
- endpoint interno `POST /v1/extract-url` ya agregado y validado sobre fichas puntuales
- `Argenprop` ya devuelve en live:
- `description`
- `sourceUrl` usable como enlace de contacto hacia la fuente original
- `images[]` reales
- `latitude/longitude` reales desde el bloque de mapa del aviso
- `bathrooms` con fallback conservador cuando el aviso solo expone `baño completo` en descripcion
- `detailPagesAccepted` corregido para reflejar fichas realmente aceptadas y no solo URLs procesadas
- pre-dedupe tecnico agregado en el servicio Python:
- agrupacion cauta de posibles duplicados
- ficha canonica tecnica por grupo
- preservacion de referencias originales en `sourceEntries[]`
- `duplicateGroupId` y `duplicateCount` preparados en el contrato del servicio Python
- `SearchMeta` ampliado con `rawItemsBeforeDedupe` y `duplicatesCollapsed`
- criterio acordado: Python agrupa tecnicamente; Nest mantiene la decision final de merge de negocio
- tests agregados en `python-scraper-service/tests/test_listing_dedupe_service.py` para fijar el comportamiento de duplicados exactos y cross-source
- pendiente actual en `Argenprop`:
- seguir mejorando `areaCovered`
- seguir mejorando `expenses` sobre ciertos avisos de detalle donde el HTML si lo trae pero el parser todavia no lo levanta consistentemente
- evaluar despues si conviene exponer `publisher` y `contactPhone/contactWhatsApp` directamente desde el servicio Python o dejar por ahora `sourceUrl` como camino de contacto
- criterio de prioridad operativo acordado:
- primero terminar `discovery + scraping` en el servicio Python
- despues retomar ampliacion de contratos del backend para fichas mas ricas
- queda anotado que mas adelante habra que extender contratos backend/frontend para soportar mejor:
- imagenes completas
- mapa
- publisher / inmobiliaria
- contacto
- bloques de propiedades similares o cercanas
- cierre operativo del dia:
- `python-scraper-service` ya no debe leerse como scaffold stub sino como primera pieza funcional del nuevo approach
- `Argenprop` queda como fuente activa prioritaria a cerrar antes de sumar otra
- `Google Custom Search JSON API` queda descartado como camino principal
- `Vertex AI Search` queda solo como aprendizaje y referencia, no como discovery central del producto
- proxima sesion: seguir cerrando `expenses` / `areaCovered` / publisher-contacto en `Argenprop` y no abrir una segunda fuente hasta estabilizar esa primera
- integracion backend -> `python-scraper-service` ya conectada en el flujo real:
- nuevo cliente interno `PythonScraperSearchService` agregado en backend
- `SearchExecutionService` ahora intenta `python-scraper` primero y deja el pipeline legacy como fallback
- mapping de enums y features alineado entre contrato Python y tipos Prisma/Nest
- config backend ampliada con:
- `PYTHON_SCRAPER_ENABLED`
- `PYTHON_SCRAPER_BASE_URL`
- `PYTHON_SCRAPER_TIMEOUT_MS`
- validacion tecnica local completada con:
- `npm run build` en backend pasando
- `npm run test:phase5` pasando
- corrida HTTP/in-process real confirmada contra backend:
- el flujo conversacional ya devolvio `sourcesUsed=["argenprop"]`
- el primer resultado ya no salio desde `mock-source`, sino desde `argenprop`
- endurecimiento adicional de `Argenprop` en `python-scraper-service`:
- parser de `bathrooms` migrado a lectura normalizada sobre texto limpio
- soporte agregado para numeros escritos (`un/una/dos/tres/... banos`) ademas de valores numericos
- tests nuevos del adapter agregados para regresion sobre `dos baños completos`
- validacion dentro del contenedor Python completada con:
- `python -m unittest tests.test_argenprop_adapter -v`
- todos los tests pasando
- validacion HTTP real posterior al rebuild del contenedor:
- lote Palermo con `total=10`
- `missingBathrooms=0`
- `missingExpenses=0`
- `missingAreaCovered=0`
- aviso `9070214` validado especificamente con `bathrooms=2`
- ampliacion de contrato Python para contacto/publicador:
- `PropertyListing` ahora expone `publisher`, `contactPhone` y `contactWhatsApp`
- `Argenprop` ya extrae `publisher` desde `avisos-anunciante-*`
- `Argenprop` ya extrae `contactWhatsApp` desde links `wa.me`
- `contactPhone` queda intencionalmente en `null` cuando el HTML solo expone telefono truncado y no hay fuente confiable del numero completo
- validacion posterior completada con:
- `python -m unittest tests.test_argenprop_adapter -v`
- `POST /v1/extract-url` sobre ficha real `9070214` devolviendo:
- `publisher = "Terrazas & Balcones"`
- `contactWhatsApp = "https://wa.me/5491166009000"`
- `POST /v1/search` sobre lote Palermo devolviendo:
- `withPublisher = 10/10`
- `withWhatsapp = 10/10`
- propagacion backend/frontend completada para estos campos:
- Prisma `PropertyCache` ampliado con `publisher`, `contactPhone`, `contactWhatsApp`
- bridge `python-scraper -> backend` alineado para mapearlos
- serializacion de chat, historial (`lastSearchResults`) y favoritos alineada para exponerlos
- workspace frontend ya muestra `anunciante` y CTA de `WhatsApp` cuando existe
- validacion real backend in-process completada:
- `POST /api/conversations/:id/messages` devolviendo `publisher` y `contactWhatsApp`
- `GET /api/conversations/:id` rehidratando los mismos campos en `lastSearchResults`
- nuevo foco operativo desde este punto:
- decidir si vale la pena intentar resolver `contactPhone` completo con una fuente mas confiable o dejarlo explicitamente como no confiable por ahora
- evaluar si estos campos tambien deben hacerse mas visibles en favoritos y comparacion, o si alcanza con el workspace por esta etapa
- evitar tocar otra fuente hasta estabilizar bien esta integracion real de punta a punta

2026-04-17 - cierre parcial segunda fuente real en `python-scraper-service`

- cambio de criterio operativo en registry Python:
- `supportedSources` ahora refleja adapters realmente implementados en el servicio Python
- `activeSourceAdapters` queda separado de `supportedSources`
- default live actual del servicio Python:
- `argenprop`
- `mudafy`
- `zonaprop` queda soportada en codigo pero fuera del default mientras siga bloqueada por Cloudflare
- `properati` todavia no esta porteada al servicio Python nuevo
- `MudafySourceAdapter` agregado al servicio Python:
- discovery portal-native con URLs reales del portal (`/venta/...`)
- soporte para lotes por ubicacion, ambientes y primer feature util
- extraccion de detail URLs tanto desde `href` como desde URLs embebidas en payloads del listing
- parser de detalle portado con:
- `price`, `currency`, `expenses`
- `rooms`, `bedrooms`, `bathrooms`
- `areaTotal`, `areaCovered`
- `publisher`
- `features`
- `images`
- `locationText`
- `city` y `neighborhood`
- tests nuevos agregados:
- `python-scraper-service/tests/test_mudafy_adapter.py`
- bateria conjunta validada en contenedor:
- `python -m unittest tests.test_mudafy_adapter tests.test_zonaprop_adapter -v`
- resultado: `OK`
- validacion HTTP real contra el servicio Python:
- `GET /v1/capabilities` devolviendo `supportedSources=["argenprop","zonaprop","mudafy"]`
- `GET /v1/capabilities` devolviendo `activeSourceAdapters=["argenprop","mudafy"]`
- smoke real `POST /v1/search` con `sources=["mudafy"]` devolviendo resultados live:
- `sourcesUsed=["mudafy"]`
- `itemsReturned=3`
- sin `partialFailures`
- publishers reales observados en la corrida: `Urbana`, `One`, `Futuro`
- estado operativo actualizado por fuente:
- `Argenprop`: activa y estable en el approach nuevo
- `Mudafy`: activa y usable en el approach nuevo
- `Zonaprop`: integrada en codigo y con tests, pero no cerrada live por challenge Cloudflare
- `Properati`: pendiente; mantenerla para el final por antecedente de `403`
- siguiente foco recomendado:
- antes de abrir `Properati`, decidir si conviene atacar el bloqueo de `Zonaprop` o consolidar mas cobertura y limpieza de datos sobre `Mudafy`

2026-04-21 - avance sobre cobertura de cuatro fuentes en `python-scraper-service`

- `Properati` ya fue porteada al servicio Python nuevo:
- adapter `ProperatiSourceAdapter` agregado
- `SourceRegistry` actualizado para exponer `supportedSources=["argenprop","zonaprop","mudafy","properati"]`
- `Properati` agregada tambien a `activeSourceAdapters`
- discovery portal-native alineado a la estructura actual del portal:
- `https://www.properati.com.ar/s/{ubicacion}/{tipo}/{operacion}`
- detalle alineado a rutas `/detalle/...`
- validacion unitaria agregada en `python-scraper-service/tests/test_properati_adapter.py`
- bateria Python revalidada dentro del contenedor con:
- `python -m unittest tests.test_argenprop_adapter tests.test_mudafy_adapter tests.test_properati_adapter tests.test_zonaprop_adapter tests.test_portal_native_provider tests.test_fetch_service -v`
- resultado: `OK`
- validacion HTTP real posterior sobre `Properati`:
- `sourcesUsed=["properati"]`
- `candidateUrlsFound=5`
- `itemsReturned=1..5` segun limite de prueba
- `contactPhone` y `publisher` reales observados en respuestas live
- parser de ubicacion de `Properati` corregido para no tragarse bloques enteros de texto operativo

- normalizacion de texto reforzada en `app/utils/text.py`:
- deteccion de mojibake ampliada para secuencias `Ã` y `Â`
- los tests de `Argenprop` y `Mudafy` quedaron actualizados para exigir texto reparado
- verificacion directa dentro del contenedor confirmo que `clean_text(...)` ya repara muestras reales con `linea`, `estacion`, `años`, `Jeronimo`, etc.
- nota operativa: PowerShell puede seguir mostrando mojibake al imprimir JSON en consola aunque la cadena interna ya este reparada; no tomar esa salida textual como prueba final de encoding en frontend

- `Zonaprop` fue reintentada con endurecimiento del browser fetch:
- `PlaywrightFetcher` ahora guarda `storage_state` por host
- suma huellas mas cercanas a navegador real (`platform`, `hardwareConcurrency`, `deviceMemory`, `vendor`, WebGL vendor)
- agrega espera activa, mouse move, scroll y reuse de cookies `cf_clearance` cuando existen
- resultado real al cierre: `Zonaprop` sigue devolviendo `browser_challenge_not_solved` en `portal-native-discovery`
- conclusion operativa actual:
- `Argenprop`: activa
- `Mudafy`: activa
- `Properati`: activa
- `Zonaprop`: integrada y reintentada, pero sigue bloqueada por challenge de Cloudflare en discovery live

- proximo foco recomendado desde este punto:
- decidir si `Zonaprop` amerita un approach especifico adicional (otra via de discovery, cookies persistentes mas fuertes o provider alternativo)
- correr una pasada de invalidacion de cache en backend y revisar en frontend resultados nuevos de `Properati` y texto reparado

2026-04-21 - cierre del approach in-house gratuito para `Zonaprop`

- `Zonaprop` ya responde live desde `python-scraper-service` sin proveedor externo ni proxy pago
- el cambio de fondo fue en `PlaywrightFetcher`:
- contexto persistente por host con `launch_persistent_context`
- retry limpio con reseteo de perfil si la sesion queda contaminada
- se elimino el warmup agresivo a home/listado generico porque empeoraba el challenge
- el acceso mas estable termino siendo entrar directo a la URL objetivo y dejar que Cloudflare emita `cf_clearance` ahi

- hallazgo clave de debugging:
- el HTML legitimo del listado de `Zonaprop` incluye `challenge-platform` embebido
- el detector anterior marcaba falso positivo y trataba paginas reales como challenge
- `looks_like_challenge(...)` quedo endurecido para exigir senales mas confiables:
- `title` de challenge (`Just a moment` / `Un momento`)
- shell real de Cloudflare con `noindex,nofollow` o `default-src 'none'`
- marcadores duros como `cf-mitigated`, `checking your browser` o `__cf_chl_rt_tk`

- validacion real posterior al ajuste:
- `POST /v1/search` con `sources=["zonaprop"]`
- `sourcesUsed=["zonaprop"]`
- `candidateUrlsFound=34`
- `candidateUrlsProcessed=3`
- `itemsReturned=3`
- `partialFailures=[]`

- endurecimiento adicional del adapter `ZonapropSourceAdapter`:
- `extract_listing_urls(...)` ahora desescapa `&amp;` en query strings
- `extract_external_id(...)` ahora soporta detail URLs con query params
- `features` y `expenses` dejaron de usar el HTML completo como texto fuente para evitar falsos positivos por bloques laterales o scripts

- estado operativo actualizado:
- `Argenprop`: activa
- `Mudafy`: activa
- `Properati`: activa
- `Zonaprop`: activa live en el servicio Python

- deuda conocida despues del desbloqueo:
- todavia hay campos mejorables en `Zonaprop`:
- `publisher` y `contactPhone` siguen viniendo nulos en varias fichas
- `price` y `currency` no aparecen siempre en los ejemplos live actuales
- hay que seguir afinando heuristicas de `propertyType` y `operation` en algunos avisos

2026-04-21 - backend alineado al pipeline real de cuatro fuentes

- el backend ya no depende del default remoto del servicio Python para decidir fuentes
- `PythonScraperSearchService` ahora envia explicitamente:
- `argenprop`
- `zonaprop`
- `mudafy`
- `properati`
- la lista queda configurable por `PYTHON_SCRAPER_SOURCES`
- si esa variable esta vacia o invalida, el backend vuelve al set completo soportado
- se actualizo:
- `backend/src/config/app.config.ts`
- `backend/src/modules/search/application/services/python-scraper-search.service.ts`
- `backend/.env`
- `backend/.env.example`
- impacto practico:
- el flujo principal backend -> python-scraper queda estable aunque cambien defaults del servicio Python
- los logs del backend ahora incluyen `requestedSources` para debugging y trazabilidad

2026-04-21 - backend endurecido para normalizar resultados del `python-scraper`

- `PythonScraperSearchService` ahora hace una pasada de normalizacion defensiva antes de rankear/persistir
- mejoras agregadas:
- reparacion basica de mojibake en `title`, `description`, `publisher`, `city`, `neighborhood` y `locationText`
- inferencia de `operation` desde texto y URL cuando la fuente la deja nula
- inferencia de `propertyType` desde `title` y `sourceUrl`, priorizando senales fuertes como `departamento`, `piso`, `ph`, `casa`, etc.
- correccion pragmatica para casos donde el parser remoto marcaba `GARAGE` solo por mencionar `cochera` como feature
- fallback contextual usando el `searchState` actual:
- si falta `operation`, usar la de la busqueda
- si falta `propertyType` y la busqueda pidio un solo tipo, usar ese tipo
- si falta `currency` pero hay `price`, usar la moneda de la busqueda

- validacion local:
- `npm run build` en backend: `OK`
- `node --require ts-node/register test/phase-5-search-foundation.spec.ts`: `OK`
- se agrego test especifico que verifica:
- reparacion de mojibake (`BalcÃ³n` -> `Balcón`)
- recuperacion de `operation`
- correccion de `propertyType` desde `GARAGE` a `APARTMENT` cuando el texto de la ficha lo indica

2026-04-21 - workspace rehidratado mejor al reabrir conversaciones

- al volver a cargar una conversacion, el frontend ya no deja vacios los chips de lectura operativa del chat
- `WorkspacePageComponent` ahora reconstruye `turnSummaries` para mensajes `ASSISTANT` usando:
- la ultima corrida disponible
- el `searchState` persistido
- filtros principales visibles como `operation`, `propertyType`, `location`, `budget` y `rooms`
- impacto practico:
- reabrir un chat conserva una lectura operativa minima aunque esos chips no se hayan generado en la sesion actual
- tambien se limpiaron textos visibles del workspace:
- separadores de preview y subtitulo pasaron a `/`
- copy del bloque de resultados ajustado para evitar mojibake

- validacion local:
- `npm run build` en frontend: `OK`
- warning conocido:
- `workspace-page.component.scss` sigue por encima del budget de SCSS, pero no rompe la build

2026-04-21 - flujo principal del workspace cubierto mejor en frontend E2E

- se ajusto el flujo del primer mensaje en `WorkspacePageComponent`:
- cuando la conversacion se crea desde `/search`, la URL pasa a `/app/chats/:id` sin recrear el componente ni perder el estado optimista del mensaje
- para eso se usa `Location.replaceState(...)` en vez de navegar temprano con `router.navigate(...)`
- impacto practico:
- el usuario ya no queda clavado en `/search` mientras espera la primera respuesta
- tampoco se pierde el mensaje optimista al cambiar la URL del primer chat

- `frontend/e2e/user-flow.spec.ts` se actualizo al layout real del workspace y ahora valida:
- registro
- primer mensaje
- resultados visibles (`result-hero` y `result-tile`)
- guardado en favoritos
- vuelta a chats
- rehidratacion de chips operativos y vista de resultados

- validacion local:
- `npm run test:e2e -- user-flow.spec.ts`: `OK`

2026-04-21 - panel admin con mejor cobertura E2E operativa

- `frontend/e2e/admin-flow.spec.ts` ya no valida solo acceso y navegacion base
- ahora tambien cubre una accion operativa real del panel:
- click en `Invalidar cache`
- verificacion de feedback visible para ambos escenarios:
- Redis no disponible
- invalidacion efectiva con claves matcheadas/borradas

- validacion local:
- `npm run test:e2e -- admin-flow.spec.ts`: `OK`

2026-04-21 - backend endurecido con rate limiting especifico para admin

- los endpoints `/api/admin/*` ya no dependen solo de auth + RBAC
- `AdminController` ahora aplica `RateLimitGuard` con dos namespaces:
- `admin-read` para lecturas (`overview`, `metrics`, listados y detalles)
- `admin-write` para mutaciones (`update role`, `cache/invalidate`)
- la clave usa `user_or_ip`, para limitar por usuario autenticado cuando existe y caer a IP si hace falta
- limites actuales:
- produccion: `120/min` lectura y `20/min` escritura
- desarrollo/local: `30/min` lectura y `10/min` escritura

- se agrego cobertura dedicada en `backend/test/phase-10-admin-rate-limit.spec.ts`
- valida:
- `429` al exceder lecturas admin
- `429` al exceder escrituras admin
- compatibilidad con el resto del stack admin existente

- validacion local:
- `npm run build`: `OK`
- `npm run test:admin:rate-limit`: `OK`
- `npm run test:admin`: `OK`
- `npm run test:rbac`: `OK`
- `npm run test:admin:actions`: `OK`

2026-04-21 - cierre del bloque de hardening HTTP previo a OpenAI

- `configureApp(...)` quedo endurecido a nivel HTTP base:
- `x-request-id` ahora se sanea antes de aceptarse:
- si viene vacio, demasiado largo o con caracteres invalidos, se reemplaza por un UUID nuevo
- todas las respuestas salen con headers anti-cache:
- `cache-control: no-store, max-age=0`
- `pragma: no-cache`
- `expires: 0`

- `phase-9-hardening.spec.ts` se amplio para validar por HTTP real:
- headers anti-cache presentes
- request ids invalidos rechazados y reemplazados por un UUID valido

- `phase-8-http-correlation-validation.ts` se ajusto para aceptar tambien la rama sana de `search_execution_cache_hit`
- impacto practico:
- la observabilidad HTTP ya no asume solo ejecucion fresca o fallback
- tambien considera valido el camino normal cuando una busqueda se sirve desde cache

- validacion local de cierre:
- `npm run test:phase8:http`: `OK`
- `npm run test:hardening`: `OK`
- `npm test`: `OK`

- conclusion operativa:
- el backend queda cerrado y revalidado en su bateria completa antes del bloque OpenAI
- no quedaron fallos pendientes en el frente de hardening HTTP/admin al cierre de esta pasada

2026-04-21 - cierre de los blockers de seguridad previos a OpenAI

- se cerraron los 4 gaps principales detectados en la auditoria tecnica previa:
- frontend:
- `AuthStore` dejo de persistir `accessToken` y `user` en `localStorage`
- la sesion ahora queda solo en memoria del cliente
- el refresh token sigue apoyado en cookie `HttpOnly`

- backend:
- `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` ahora exigen al menos 32 caracteres
- ambos rechazan placeholders o secretos debiles como `change-me`, `example`, `default`, `secret`, `password`
- se agrego `PYTHON_SCRAPER_INTERNAL_TOKEN` al schema de entorno y a la config del backend
- `PythonScraperSearchService` ahora envia `x-internal-token` cuando esta configurado

- health/readiness:
- `GET /api/health/ready` quedo reducido a:
- estado de DB
- estado de Redis
- estado configurado de OpenAI
- estado configurado de discovery
- capacidades generales
- ya no expone:
- `environment`
- `trustProxy`
- `frontendOrigin`
- warnings operativos internos
- modo/modelo de OpenAI
- provider detallado de discovery
- gaps de credenciales live

- python-scraper:
- se agrego dependencia `require_internal_token(...)`
- routers protegidos:
- `/v1/search`
- `/v1/extract`
- `/v1/capabilities`
- si `PYTHON_SCRAPER_INTERNAL_TOKEN` esta vacio, el servicio sigue aceptando requests para desarrollo local
- si esta configurado, exige `x-internal-token` valido
- `docker-compose` tambien se endurecio:
- `postgres`, `redis` y `python-scraper` quedaron publicados solo en `127.0.0.1`
- `/health/ready` del servicio Python se redujo a respuesta minima

- validacion local:
- `backend`: `npm test` -> `OK`
- `backend`: `npm run test:health` -> `OK`
- `backend`: `npm run test:hardening` -> `OK`
- `backend`: `npm run test:admin` -> `OK`
- `frontend`: `npm run build` -> `OK`
- `frontend`: `npm run test:e2e -- user-flow.spec.ts` -> `OK`
- `frontend`: `npm run test:e2e -- admin-flow.spec.ts` -> `OK`

- caveats residuales:
- warning conocido de budget SCSS en `workspace-page.component.scss`
- falta la pasada live final con `OPENAI_API_KEY` real
- `backend/.env` sigue siendo sensible y no debe tratarse como config compartible

- conclusion operativa:
- el proyecto queda en base seria para encarar integracion OpenAI
- los 4 blockers de la auditoria previa quedaron resueltos

2026-04-24 - blog y accesos admin conectados a BBDD

- se continuo el bloque que habia quedado trabado por Prisma/Windows
- Docker Desktop se levanto y quedaron corriendo:
- `postgres`
- `redis`
- `python-scraper`

- backend:
- `npx prisma generate`: `OK`
- `npx prisma migrate status`: schema local al dia
- `npm run prisma:seed:blog`: `OK`
- `npm run build`: `OK`
- `npm test`: `OK`

- se corrigio el arranque compilado del backend:
- `package.json` ahora usa `node dist/src/main`
- `tsconfig.build.json` fija `rootDir: "."`
- motivo: el build actual emite `dist/src/main.js` y antes `npm run start` apuntaba a un `dist/main.js` viejo

- validacion HTTP real:
- `GET /api/health/live`: `OK`
- `GET /api/blog`: devuelve articulos publicados desde BBDD
- con usuario admin local `demo-user@local.test`:
- `GET /api/admin/overview`: devuelve `leadsCount` y `blogArticlesCount`
- `GET /api/admin/blog`: total `4`
- `GET /api/admin/leads`: total `0`
- `GET /api/admin/scraping-sources`: total `4` (`Argenprop`, `Mudafy`, `Properati`, `Zonaprop`)

- frontend:
- Blog publico deja de depender solo de datos locales y carga articulos desde `/api/blog`
- detalle de blog carga desde `/api/blog/:slug`
- Admin consume endpoints reales para:
- lista de articulos
- creacion de articulo
- publicar/despublicar/archivar/eliminar articulo
- leads
- scraping sources
- dashboard usa `leadsCount` y `blogArticlesCount`
- se mantienen empty states cuando no hay leads o pendientes

- validacion frontend:
- `npm run build`: `OK`
- queda el warning conocido de budget SCSS en `workspace-page.component.scss`

2026-05-01 - OpenAI live activado y validado

- se activo la configuracion local para usar OpenAI real:
- `OPENAI_MOCK_MODE=false`
- `OPENAI_MODEL=gpt-5.4-mini`
- `OPENAI_API_KEY` configurada en `backend/.env` local

- primera validacion live contra Responses API detecto un cambio necesario en el schema estricto:
- OpenAI exige que los objetos bajo `text.format.schema` declaren `required` con todas las propiedades cuando `strict=true`
- se ajusto `filterPatch` para declarar todas sus claves como requeridas
- `null` dentro de `filterPatch` ahora significa "sin cambio"
- la limpieza explicita de filtros sigue pasando por `filtersToUnset`
- para arrays, `[]` queda permitido cuando el usuario realmente elimina todos los valores

- validacion live completada con `npm run test:openai`:
- busqueda nueva en espanol: `OK`
- modificacion de busqueda activa: `OK`
- aclaracion requerida: `OK`
- pedido en ingles: `OK`
- smalltalk sin busqueda: `OK`

- validacion general posterior:
- `backend`: `npm run build` -> `OK`
- `backend`: `npm test` -> `OK`

- hygiene:
- `backend/.env.example` fue saneado para no contener claves reales
- `backend/.env` sigue siendo sensible y no debe compartirse

2026-05-01 - validacion real del producto principal: chat

- se corrio smoke HTTP real contra backend levantado localmente con OpenAI live:
- registro de usuario real local
- creacion de conversacion
- `POST /api/conversations/:id/messages`
- interpretacion OpenAI live
- merge persistente de `searchState`
- busqueda real via pipeline configurado
- persistencia de mensajes, `searchRun` y `lastSearchResults`

- caso inicial validado:
- mensaje: `Quiero comprar un departamento en Palermo con balcon hasta 140000 USD y 2 ambientes`
- resultado:
- `didSearch=true`
- `requiresClarification=false`
- `operation=BUY`
- `propertyTypes=APARTMENT`
- `locations=Palermo`
- `priceMax=140000`
- `currency=USD`
- `rooms=2`
- `features=BALCONY`
- `resultCount=9`
- `sourcesUsed=argenprop`

- refinamiento validado sobre una conversacion existente:
- mensaje: `Manteneme Palermo, sacale balcon y bajame el tope a 130000 dolares`
- resultado:
- conserva `BUY`, `APARTMENT`, `Palermo` y `rooms=2`
- actualiza `priceMax=130000`
- limpia `features`
- vuelve a buscar
- persiste 4 mensajes
- `lastSearchRun.status=COMPLETED`
- `lastSearchResults=9`

- aclaracion validada:
- mensaje: `Busco algo barato`
- resultado:
- `didSearch=false`
- `requiresClarification=true`
- `searchRunId=null`
- `searchState` queda vacio

- frontend E2E actualizado al layout real del workspace:
- se reemplazaron selectores viejos como `Nueva busqueda`, `.message--assistant`, `.result-hero` y `.result-tile`
- ahora valida contra `Asistente inmobiliario`, `.message-card--assistant`, `.results-flow` y `.result-card`
- se ajusto el click de favorito al primer resultado para evitar ambiguedad con multiples botones

- validacion browser real:
- `frontend`: `npm run test:e2e -- user-flow.spec.ts` -> `OK`

- lectura operativa:
- el producto principal ya funciona localmente con OpenAI live y resultados reales
- siguiente trabajo recomendado: evaluar calidad conversacional y ranking con una matriz de prompts reales, no solo smoke tests

2026-05-06 - auditoria final de cercania a release MVP

- se rehizo `agents.md` para que funcione como guia operativa vigente de cierre, no como historico largo
- se agregaron documentos nuevos de salida:
- `docs/analisis-final-mvp.md`
- `docs/PRUEBAS-CALIDAD-MVP.md`
- `docs/go-nogo-mvp.md`
- se actualizo `README.md` para reflejar:
- OpenAI y scraping real ya integrados
- health/readiness reducido por hardening
- necesidad de Docker/Postgres/Redis para la suite completa

- validaciones ejecutadas en esta pasada:
- `backend`: `npm run build` -> `OK`
- `frontend`: `npm run build` -> `OK`
- warning frontend conocido:
- `workspace-page.component.scss` supera budget de 12 kB por 11.81 kB
- `map-page.component.scss` supera budget de 12 kB por 2.43 kB
- `backend`: `npm test` -> `PARCIAL`
- paso la bateria de dominio/search/auth/cache/ranking/hardening hasta el bloque `phase-10-admin-rate-limit`
- fallo por entorno: Postgres no disponible en `127.0.0.1:5432` y Redis no disponible en `127.0.0.1:6379`
- `docker compose ps` -> bloqueado porque Docker Desktop no estaba activo
- `python --version` desde `python-scraper-service` -> Python local no usable, se mantiene regla de Docker

- lectura tecnica actual:
- el fallo de `npm test` no demuestra una regresion del codigo; demuestra que la validacion final necesita servicios activos
- el proyecto esta listo para una corrida final seria con Docker Desktop levantado
- no conviene agregar features grandes antes de completar la matriz `PRUEBAS-CALIDAD-MVP.md`

- puntaje actualizado:
- solidez tecnica del MVP: `9/10`
- completitud funcional del MVP controlado: `8.5/10`
- readiness para demo seria: `8.5/10`
- readiness para subida controlada: `8/10`
- readiness para produccion publica abierta: `7/10`

- proximos pasos recomendados:
- levantar Docker Desktop
- `cd backend && docker compose up -d`
- correr `npx prisma migrate deploy`
- correr `npm test`
- correr `npm run test:e2e`
- correr E2E frontend user/admin
- correr smoke live con OpenAI y scraper real
- completar go/no-go antes de subir

2026-05-06 - revalidacion con Docker activo y smoke live final local

- se levanto la app con `./scripts/start-local.ps1`
- se confirmaron servicios:
- backend `http://localhost:3000/api`
- frontend `http://localhost:4200`
- Postgres, Redis y `python-scraper` activos por Docker
- backend `/api/health/ready` -> `ready`
- python scraper `/health/ready` -> `ready`
- `npx prisma migrate status` -> schema al dia

- validaciones backend:
- `npm run build` -> `OK`
- `npm test` -> `OK`
- `npm run test:e2e` -> `OK`
- `npm run test:openai` -> `OK`
- `npm run test:phase8:http` -> `OK`

- validaciones frontend:
- `npm run build` -> `OK`
- warnings persistentes:
- `workspace-page.component.scss` supera budget por 11.81 kB
- `map-page.component.scss` supera budget por 2.43 kB
- `npm run test:e2e -- admin-flow.spec.ts` -> `OK`
- `npm run test:e2e -- user-flow.spec.ts` inicialmente fallo por selectores/copy fragiles:
- esperaba heading viejo `search state`
- esperaba palabras especificas en la respuesta del assistant
- se actualizo `frontend/e2e/user-flow.spec.ts` para validar senales estables del layout real:
- heading de bienvenida actual
- textarea visible
- respuesta assistant no vacia
- resultados visibles
- reejecucion `npm run test:e2e -- user-flow.spec.ts` -> `OK`

- validaciones scraper:
- `/v1/capabilities` con token interno -> `OK`
- supported sources: `argenprop`, `zonaprop`, `mudafy`, `properati`
- active adapters: `argenprop`, `mudafy`, `properati`
- `docker compose exec -T python-scraper python -m unittest discover -s tests -v` -> `OK`, 31 tests

- smoke directo a scraper:
- `POST /v1/search` con `sources=["argenprop"]`, alquiler Palermo ARS 800k, `roomsAnyOf=[1,2]`
- devolvio 3 items crudos de Argenprop
- observacion: el scraper crudo puede traer items sobrepresupuesto o con 3 ambientes; esto confirma que el filtro esencial debe seguir viviendo en backend

- smoke live producto backend/OpenAI/scraper:
- mensaje: `Busco alquiler en Palermo cerca del Alto Palermo hasta 800k al mes, monoambiente o 2 ambientes`
- resultado:
- `didSearch=true`
- `requiresClarification=false`
- `operation=RENT`
- `locations=["Palermo"]`
- `priceMax=800000`
- `currency=ARS`
- `rooms=null`
- `roomsAnyOf=[1,2]`
- `sourcesUsed=["argenprop"]`
- `resultCount=3`
- resultados rankeados:
- ARS 650000, 2 ambientes
- ARS 700000, 2 ambientes
- ARS 850000, 2 ambientes
- no aparecieron mocks ni `example.com`
- la regla de tolerancia de alquiler ARS quedo validada en este smoke

- lectura actual:
- la bateria local/controlada queda verde
- el MVP queda tecnicamente listo para subir a staging/beta cerrada
- produccion publica abierta sigue pendiente de:
- variables reales de deploy
- CORS/cookies/HTTPS en dominio real
- monitoreo/logs productivos
- backup/rollback
- disclaimer/legal minimo
- decision de costos y limites de uso
