# Funcionamiento del chat, busqueda y app

Fecha de referencia: 2026-05-03.

Este documento describe como funciona hoy el flujo principal de la app: chat inmobiliario, interpretacion con OpenAI, estado de busqueda, scraping, ranking, persistencia y actualizacion del frontend.

La idea central del sistema es esta:

- el usuario habla en lenguaje natural
- OpenAI interpreta intencion y cambios de filtros
- el backend valida y mergea esos filtros
- el backend ejecuta busqueda real
- el backend normaliza, deduplica, rankea y persiste resultados
- el frontend muestra el estado y los resultados devueltos por backend

OpenAI no es la fuente de verdad. La fuente de verdad es el `searchState` persistido por conversacion.

---

## 1. Capas principales

### Frontend Angular

Archivos relevantes:

- `frontend/src/app/features/workspace/workspace-page.component.ts`
- `frontend/src/app/features/workspace/workspace-page.component.html`
- `frontend/src/app/core/services/real-state-api.service.ts`
- `frontend/src/app/core/types/api.types.ts`

Responsabilidades:

- mostrar historial de chats
- crear o abrir conversaciones
- enviar mensajes al backend
- mostrar mensajes de usuario y asistente
- mostrar filtros activos
- mostrar resultados
- guardar favoritos
- abrir la publicacion original
- rehidratar la conversacion desde backend despues de un envio

El frontend no interpreta filtros de forma autoritativa. Puede tener controles rapidos para editar filtros, pero esos cambios se mandan al backend via endpoint estructurado.

### Backend NestJS

Modulos relevantes:

- `conversations`
- `messages`
- `search-state`
- `ai`
- `search`
- `properties`
- `favorites`

Servicios clave:

- `ChatApplicationService`
- `AiSearchDecisionService`
- `SearchStateMergeService`
- `SearchExecutionService`
- `PythonScraperSearchService`
- `SearchGeoService`
- `SearchRankingService`
- `SearchRunService`
- `PropertiesService`

El backend es quien decide:

- si el mensaje modifica busqueda
- como mergear filtros
- si se puede buscar
- que fuente usar
- que resultados pasan filtros esenciales
- como se rankean
- que se persiste

---

## 2. Entidades importantes

### Conversation

Tabla Prisma: `Conversation`.

Representa un chat del usuario.

Campos importantes:

- `id`
- `userId`
- `title`
- `lastSearchAt`
- `createdAt`
- `updatedAt`

### Message

Tabla Prisma: `Message`.

Guarda mensajes del usuario y del asistente.

Campos importantes:

- `conversationId`
- `role`: `USER`, `ASSISTANT`, `SYSTEM`
- `content`
- `structuredPayloadJson`

El `structuredPayloadJson` del asistente guarda datos utiles de auditoria:

- modo (`ai` o `structured_filter_update`)
- intent
- si busco o no
- searchState resultante
- cantidad de resultados
- searchRunId

### SearchState

Tabla Prisma: `SearchState`.

Es el estado estructurado actual de la busqueda para una conversacion.

Ejemplo actual:

```json
{
  "operation": "RENT",
  "propertyTypes": ["APARTMENT"],
  "locations": ["Recoleta"],
  "geoConstraints": [],
  "priceMin": null,
  "priceMax": 1000000,
  "currency": "ARS",
  "rooms": null,
  "roomsAnyOf": [],
  "bedrooms": null,
  "bathrooms": null,
  "areaMin": null,
  "areaMax": null,
  "expensesMax": null,
  "features": [],
  "sortPreference": null
}
```

Campos principales:

- `operation`: `BUY` o `RENT`
- `propertyTypes`: tipos de propiedad
- `locations`: zonas textuales normalizadas
- `geoConstraints`: restricciones geograficas estructuradas
- `priceMin`, `priceMax`, `currency`
- `rooms` o `roomsAnyOf`
- `features`
- `sortPreference`

Regla: ninguna busqueda se ejecuta sin pasar por este estado.

### SearchRun

Tabla Prisma: `SearchRun`.

Representa una corrida de busqueda.

Guarda:

- `conversationId`
- `queryText`
- snapshot de filtros
- status
- cantidad de resultados
- fuentes usadas
- fecha

Sirve para debugging, auditoria e historial.

### PropertyCache

Tabla Prisma: `PropertyCache`.

Guarda propiedades normalizadas y trazables.

Campos importantes:

- `source`
- `externalId`
- `sourceUrl`
- `title`
- `priceAmount`
- `priceCurrency`
- `province`
- `city`
- `neighborhood`
- `locationText`
- coordenadas si existen o se pudieron inferir
- payload crudo y normalizado
- fecha de scraping

---

## 3. Flujo principal del chat

Endpoint:

```http
POST /api/conversations/:id/messages
```

Payload:

```json
{
  "message": "quiero alquiler cerca del Alto Palermo hasta 1 millon"
}
```

El controlador llama:

```ts
ChatApplicationService.sendMessage(userId, conversationId, message)
```

### Paso 1: validar ownership

El backend valida que la conversacion pertenezca al usuario.

Servicio:

- `ConversationsService.assertOwnership`

Si no pertenece, responde error.

### Paso 2: persistir mensaje del usuario

Antes de llamar a OpenAI, el backend guarda el mensaje del usuario.

Servicio:

- `MessagesService.createUserMessage`

Esto evita perder trazabilidad si despues falla la interpretacion o la busqueda.

### Paso 3: cargar searchState actual

Servicio:

- `SearchStateService.getOrCreateByConversationId`

Si no existe estado, crea uno usando:

- `DEFAULT_SEARCH_FILTERS`

### Paso 4: pedir interpretacion a OpenAI

Servicio:

- `AiSearchDecisionService.decide`

Input enviado a OpenAI:

- mensaje nuevo del usuario
- searchState actual
- resumen corto del contexto
- enums permitidos
- schema estricto esperado

OpenAI debe devolver una estructura tipo:

```ts
type SearchDecision = {
  intent: "NEW_SEARCH" | "MODIFY_SEARCH" | "CLARIFY" | "SHOW_MORE" | "COMPARE" | "FAVORITE" | "SMALLTALK";
  shouldSearch: boolean;
  requiresClarification: boolean;
  clarificationQuestion: string | null;
  userFacingMessage: string;
  filterPatch: Partial<SearchFilters>;
  filtersToUnset: SearchFilterKey[];
  requestedAction: "SEARCH" | "COMPARE" | "FAVORITE" | "NONE";
};
```

Ejemplo:

```json
{
  "intent": "MODIFY_SEARCH",
  "shouldSearch": true,
  "requiresClarification": false,
  "clarificationQuestion": null,
  "userFacingMessage": "Cambio la zona a Recoleta y busco nuevas opciones.",
  "filterPatch": {
    "operation": null,
    "propertyTypes": null,
    "locations": ["Recoleta"],
    "geoConstraints": null,
    "priceMin": null,
    "priceMax": null,
    "currency": null,
    "rooms": null,
    "roomsAnyOf": null,
    "bedrooms": null,
    "bathrooms": null,
    "areaMin": null,
    "areaMax": null,
    "expensesMax": null,
    "features": null,
    "sortPreference": null
  },
  "filtersToUnset": [],
  "requestedAction": "SEARCH"
}
```

Importante:

- OpenAI no escribe base de datos.
- OpenAI no scrapea.
- OpenAI no decide ranking.
- OpenAI no inventa propiedades.
- OpenAI solo propone interpretacion y patch de filtros.

### Paso 5: validar salida de OpenAI

`AiSearchDecisionService` valida:

- que el JSON tenga las claves esperadas
- que los enums sean validos
- que arrays y numeros tengan formato correcto
- que no entren claves desconocidas

Si falla OpenAI o falla validacion, se usa fallback seguro:

- no se inventa busqueda
- no se inventan propiedades
- se evita continuar con datos ambiguos

### Paso 6: overrides deterministas

Despues de validar la respuesta de OpenAI, el backend aplica algunas reglas deterministas.

Ejemplos:

- si el usuario dice `monoambiente o 2 ambientes`, se fuerza `roomsAnyOf: [1, 2]`
- si dice `mas barato`, se fuerza `sortPreference: PRICE_ASC`
- si dice `Alto Palermo`, se agrega una restriccion geografica estructurada

Esto existe porque no conviene confiar 100% en que la IA siempre representara bien reglas criticas.

### Paso 7: merge controlado del searchState

Servicio:

- `SearchStateMergeService.applySearchDecision`

Este servicio:

- parte del estado actual
- limpia campos indicados en `filtersToUnset`
- aplica `filterPatch`
- resuelve conflictos

Reglas actuales:

- si setea `rooms`, limpia `roomsAnyOf`
- si setea `roomsAnyOf`, limpia `rooms`
- los arrays se reemplazan por el patch validado
- no hay merge ciego de JSON

Resultado:

```ts
{
  searchState,
  assistantMessage,
  requiresClarification,
  clarificationQuestion,
  didSearch
}
```

### Paso 8: persistir searchState

Servicio:

- `SearchStateService.updateByConversationId`

El estado resultante se persiste antes de buscar.

Esto es importante: aunque la busqueda falle, el sistema conserva lo que entendio.

### Paso 9: ejecutar busqueda si corresponde

Si:

- `requestedAction === SEARCH`
- `shouldSearch === true`
- `requiresClarification === false`

entonces se ejecuta:

```ts
SearchExecutionService.execute(searchState)
```

Si no, el backend responde sin buscar.

---

## 4. Como se usa OpenAI

Modulo:

- `infrastructure/openai`
- `AiSearchDecisionService`

El proyecto usa OpenAI como capa de interpretacion estructurada.

Variables relevantes:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_MOCK_MODE`

En modo live:

- `OPENAI_MOCK_MODE=false`
- se llama al servicio OpenAI real
- se pide una respuesta JSON compatible con schema

En modo mock:

- `OPENAI_MOCK_MODE=true`
- `AiSearchDecisionService` usa heuristicas locales
- sirve para tests y desarrollo sin costo externo

El prompt de sistema le dice al modelo:

- devolver solo estructura
- no inventar resultados
- no actuar como si busco si `shouldSearch=false`
- usar enums canonicos
- pedir aclaracion si algo es ambiguo
- representar proximidad con `geoConstraints`
- representar alternativas de ambientes con `roomsAnyOf`

OpenAI no recibe resultados completos ni tiene acceso a Prisma. Su trabajo termina en `SearchDecision`.

---

## 5. Filtros y searchState

Los filtros actuales viven en:

- `backend/src/modules/search-state/domain/types/search-filters.type.ts`

Campos:

```ts
type SearchFilters = {
  operation: OperationType | null;
  propertyTypes: PropertyType[];
  locations: string[];
  geoConstraints?: GeoConstraint[];
  priceMin: number | null;
  priceMax: number | null;
  currency: CurrencyCode | null;
  rooms: number | null;
  roomsAnyOf?: number[];
  bedrooms: number | null;
  bathrooms: number | null;
  areaMin: number | null;
  areaMax: number | null;
  expensesMax: number | null;
  features: PropertyFeature[];
  sortPreference: SortPreference | null;
};
```

### Locations

`locations` es una lista textual normalizada.

Ejemplos:

- `Palermo`
- `Recoleta`
- `Caballito`

Sirve para:

- armar query
- filtrar por barrio/localidad
- mostrar chips en frontend

Limitacion:

- no sirve para resolver POIs o ambiguedad geografica por si sola
- `Alto Palermo` puede existir como texto en Cordoba

### GeoConstraints

`geoConstraints` representa geografia estructurada.

Ejemplo:

```json
{
  "kind": "PROXIMITY",
  "sourceText": "Alto Palermo",
  "label": "Alto Palermo Shopping",
  "province": "CABA",
  "city": "CABA",
  "neighborhood": "Palermo",
  "latitude": -34.5881,
  "longitude": -58.4106,
  "radiusMeters": 1000,
  "confidence": 0.95,
  "provider": "local-poi"
}
```

Usos:

- mejorar query antes del scraping
- filtrar resultados despues del scraping
- descartar provincias incorrectas
- calcular distancia cuando hay coordenadas

Reglas actuales:

- `cerca de X`: radio default 1000 metros
- `Alto Palermo`: se resuelve como POI en CABA/Palermo
- `Bosques de Palermo`: se resuelve como POI en CABA/Palermo
- si una propiedad dice `Cordoba` y el constraint dice `CABA`, se descarta
- si hay coordenadas exactas y estan fuera del radio, se descarta

Esta capa esta preparada para integrar Google Geocoding:

- `GEOCODING_PROVIDER=google`
- `GEOCODING_GOOGLE_API_KEY=...`

Hoy no es obligatorio. El resolver local cubre los POIs criticos agregados.

---

## 6. Pipeline de busqueda

Servicio:

- `SearchExecutionService`

Orden real:

1. enriquecer geografia
2. construir query principal
3. revisar cache
4. buscar candidatos de propiedades cargadas por propietarios
5. intentar scraper Python
6. si no hay scraper, usar discovery legacy
7. deduplicar
8. enriquecer candidatos con geografia
9. rankear y filtrar
10. cachear resultado
11. devolver resultados

### 6.1 Enriquecimiento geografico

Servicio:

- `SearchGeoService`

Hace:

- toma `locations` y `geoConstraints`
- resuelve POIs conocidos
- agrega provincia/ciudad/barrio/coordenadas cuando puede
- normaliza zonas como CABA

Ejemplo:

Usuario:

```text
cerca del Alto Palermo
```

Search state esperado:

```json
{
  "locations": ["Palermo"],
  "geoConstraints": [
    {
      "kind": "PROXIMITY",
      "label": "Alto Palermo Shopping",
      "city": "CABA",
      "neighborhood": "Palermo",
      "radiusMeters": 1000
    }
  ]
}
```

### 6.2 Query builder

Servicio:

- `SearchQueryBuilderService`

Construye queries para discovery/scraper.

Ejemplo:

```text
propiedad alquiler Recoleta Capital Federal
```

Con POI:

```text
departamento alquiler Palermo Capital Federal Alto Palermo Shopping
```

No busca simplemente `Alto Palermo`, porque eso puede traer Cordoba.

### 6.3 Cache

Servicio:

- `SearchResultsCacheService`

Usa Redis.

Clave:

- hash SHA1 del payload de filtros

TTL actual:

- 120 segundos

Objetivo:

- evitar repetir scraping caro ante filtros identicos

Si el cache contiene mocks y los mocks estan deshabilitados, se ignora.

### 6.4 Owner submitted properties

Servicio:

- `OwnerSubmittedSearchService`

Busca propiedades cargadas por usuarios propietarios dentro de la base propia.

Esto permite mezclar:

- propiedades externas scrapeadas
- propiedades propias publicadas

### 6.5 Python scraper

Servicio backend:

- `PythonScraperSearchService`

Servicio externo:

- `python-scraper-service`

Endpoint usado:

```http
POST /v1/search
```

Variables relevantes:

- `PYTHON_SCRAPER_ENABLED`
- `PYTHON_SCRAPER_BASE_URL`
- `PYTHON_SCRAPER_INTERNAL_TOKEN`
- `PYTHON_SCRAPER_SOURCES`
- `PYTHON_SCRAPER_ALLOW_BROWSER_FALLBACK`

Payload enviado al scraper:

```json
{
  "requestId": "backend-...",
  "conversationId": null,
  "searchRunId": null,
  "filters": {
    "operation": "rent",
    "propertyType": "apartment",
    "locations": ["Recoleta", "Capital Federal"],
    "priceMin": null,
    "priceMax": 1000000,
    "currency": "ARS",
    "rooms": null,
    "roomsAnyOf": [],
    "bedrooms": null,
    "bathrooms": null,
    "features": [],
    "areaMin": null,
    "areaMax": null
  },
  "sources": ["argenprop"],
  "discovery": {
    "providers": ["portal-native"],
    "allowDomains": [],
    "maxCandidateUrls": 40
  },
  "execution": {
    "limitPerSource": 10,
    "timeoutMs": 12000,
    "preferDetailPages": true,
    "allowBrowserFallback": false
  }
}
```

Fuente principal actual:

- `argenprop`

El scraper devuelve items normalizados parcialmente. Backend vuelve a normalizar:

- operation
- propertyType
- currency
- text mojibake
- features
- contexto faltante

### 6.6 Fallback legacy

Si Python scraper no esta habilitado o falla:

1. `SearchDiscoveryService` busca URLs candidatas
2. Google Programmable Search o Vertex pueden aportar discovery
3. `PropertySourceRegistryService` filtra URLs soportadas
4. `HtmlFetchService` baja HTML
5. adapters por fuente extraen datos

Adapters existentes:

- Argenprop
- Zonaprop
- Properati
- Mudafy

Para el flujo live actual se prioriza Python scraper con Argenprop.

### 6.7 Deduplicacion

Servicio:

- `SearchDedupeService`

Objetivo:

- reducir duplicados evidentes

Estrategias:

- mismo `externalId`
- misma URL
- similitud por titulo/precio/ubicacion/area

No intenta dedupe perfecto. Prefiere ser conservador.

### 6.8 Ranking y filtros esenciales

Servicio:

- `SearchRankingService`

Primero aplica filtros esenciales. Si falla un filtro esencial, la propiedad no se muestra.

Filtros esenciales actuales:

- operacion incompatible
- tipo incompatible cuando se conoce
- moneda incompatible si el usuario pidio moneda y el resultado tiene precio
- precio por encima del maximo permitido
- precio por debajo del minimo permitido
- ambientes incompatibles
- ubicacion textual incompatible
- restriccion geografica incompatible

Regla especial de alquiler en ARS:

- si usuario pide `800k`, se permite como maximo `950k`
- margen maximo: `+150000 ARS`
- resultados en USD no pasan si el usuario pidio ARS y el resultado tiene precio en USD

Regla geografica:

- si pide CABA/Palermo y el aviso dice Cordoba, se descarta
- si pide cercania a POI con coordenadas y el aviso tiene coordenadas exactas fuera del radio, se descarta
- si no hay coordenadas exactas, se usa barrio/ciudad/provincia como aproximacion

Luego calcula score ponderado:

- ubicacion
- presupuesto
- tipo de propiedad
- ambientes
- dormitorios
- banos
- features
- completitud
- frescura

El resultado final incluye:

```json
{
  "rank": {
    "position": 1,
    "score": 0.94,
    "reasons": [
      "Resultado real extraido desde una fuente permitida",
      "Coincide con tu zona",
      "Esta dentro de tu presupuesto"
    ]
  }
}
```

---

## 7. Persistencia despues de buscar

Cuando `SearchExecutionService` devuelve resultados, `ChatApplicationService` hace:

1. persiste cada propiedad con `PropertiesService.persistSearchResult`
2. crea o actualiza `PropertyCache`
3. persiste un `SearchRun`
4. persiste relacion `SearchRunProperty`
5. persiste mensaje del asistente
6. devuelve respuesta HTTP al frontend

### PropertiesService

Servicio:

- `PropertiesService`

Responsabilidades:

- guardar datos normalizados
- calcular/guardar geocoding de la propiedad si puede
- mantener `sourceUrl` como identificador trazable
- preservar payload raw/normalized

### SearchRunService

Servicio:

- `SearchRunService`

Guarda:

- filtros usados
- queryText
- fuentes usadas
- cantidad de resultados
- ranking por propiedad

Esto permite rehidratar resultados cuando el usuario vuelve al chat.

---

## 8. Respuesta HTTP al frontend

Respuesta tipica:

```json
{
  "conversationId": "uuid",
  "assistantMessage": "Cambio a Recoleta.",
  "searchState": {
    "operation": "RENT",
    "locations": ["Recoleta"],
    "priceMax": 1000000,
    "currency": "ARS"
  },
  "didSearch": true,
  "requiresClarification": false,
  "clarificationQuestion": null,
  "results": [],
  "meta": {
    "searchRunId": "uuid",
    "sourcesUsed": ["argenprop"],
    "resultCount": 4
  }
}
```

El frontend usa:

- `assistantMessage` para agregar mensaje del asistente
- `searchState` para chips/filtros
- `results` para tarjetas
- `meta.resultCount` para resumen
- `meta.searchRunId` para referencia del ultimo search run

---

## 9. Funcionamiento del frontend del chat

Componente:

- `WorkspacePageComponent`

Servicio HTTP:

- `RealStateApiService`

### Enviar mensaje

Metodo:

- `sendPreparedMessage`

Secuencia:

1. bloquea envio con `sendingMessage=true`
2. limpia error
3. asegura que exista conversacion
4. agrega mensaje local del usuario para feedback inmediato
5. llama `api.sendMessage`
6. aplica respuesta local con `applyChatResponse`
7. rehidrata conversacion desde backend con `loadConversation`
8. recarga historial y favoritos
9. libera `sendingMessage=false`

La rehidratacion despues del envio es importante porque backend es la fuente de verdad. Si el backend persistio pero el frontend quedo con estado viejo, `loadConversation` corrige la pantalla.

### Recuperacion ante error

Si algo falla despues del envio:

1. intenta `loadConversation(conversationId)`
2. si backend ya persistio, la UI se recupera
3. si no se pudo recuperar, recien ahi hace rollback del mensaje local

Esto evita perder visualmente mensajes que el backend si proceso.

### Cargar conversacion

Metodo:

- `loadConversation`

Hace:

- `GET /api/conversations/:id`
- setea `activeConversation`
- setea `visibleResults`
- reconstuye chips/resumenes
- sincroniza seleccion de resultados
- sincroniza filtros rapidos

### Listar conversaciones

Metodo:

- `loadConversations`

Endpoint:

```http
GET /api/conversations
```

La ruta `/app/chats` redirige a la conversacion mas reciente del usuario.

---

## 10. Flujo de edicion estructurada de filtros

Ademas del chat textual existe:

```http
PATCH /api/conversations/:id/search-state
```

Lo usa el frontend cuando el usuario edita filtros desde controles UI.

Payload:

```json
{
  "filterPatch": {
    "locations": ["Recoleta"],
    "priceMax": 900000
  },
  "filtersToUnset": [],
  "shouldSearch": true
}
```

Este endpoint no llama a OpenAI.

Flujo:

1. valida patch
2. mergea searchState
3. persiste searchState
4. si `shouldSearch=true`, busca
5. devuelve misma forma que `sendMessage`

Esto es importante: filtros desde UI siguen pasando por backend y no modifican estado solo en frontend.

---

## 11. Ejemplos reales

### Caso 1: primera busqueda

Usuario:

```text
quiero que me busques alquileres por palermo de menos de 1m de pesos
```

OpenAI propone:

```json
{
  "operation": "RENT",
  "locations": ["Palermo"],
  "priceMax": 1000000,
  "currency": "ARS"
}
```

Backend:

1. mergea estado
2. resuelve Palermo como CABA
3. arma query `propiedad alquiler Palermo Capital Federal`
4. llama scraper Argenprop
5. rankea resultados
6. persiste search run
7. responde al frontend

### Caso 2: modificar zona

Usuario:

```text
mejor que sean en recoleta
```

OpenAI propone patch:

```json
{
  "locations": ["Recoleta"]
}
```

Backend mantiene:

- `operation=RENT`
- `priceMax=1000000`
- `currency=ARS`

Backend cambia:

- `locations=["Recoleta"]`

Luego busca otra vez.

### Caso 3: cercania a POI

Usuario:

```text
quiero un alquiler cerca del Alto Palermo hasta 1 millon
```

Backend espera:

```json
{
  "locations": ["Palermo"],
  "geoConstraints": [
    {
      "kind": "PROXIMITY",
      "sourceText": "Alto Palermo",
      "label": "Alto Palermo Shopping",
      "city": "CABA",
      "neighborhood": "Palermo",
      "radiusMeters": 1000
    }
  ]
}
```

Resultado:

- no deberia pasar un aviso de `Alto Palermo, Cordoba`
- si hay coordenadas exactas y esta a mas de 1 km, se descarta
- si no hay coordenadas exactas pero dice Palermo/CABA, puede pasar con menor confianza

---

## 12. Scraping: que hace y que no hace

El scraping no decide la verdad del producto.

El scraper:

- busca candidatos en fuentes permitidas
- extrae datos de avisos
- devuelve items normalizados parcialmente

El backend:

- valida
- normaliza
- infiere operacion/moneda/tipo si la fuente viene mal
- filtra
- deduplica
- rankea
- persiste

Ejemplo de bug ya corregido:

- scraper devolvia `operation=buy`
- titulo/URL indicaban alquiler
- backend prioriza texto real del aviso y URL para inferir `RENT`

---

## 13. Observabilidad y debugging

El backend usa logs estructurados con:

- requestId
- userId
- conversationId
- searchRunId
- queryText
- sourcesUsed
- tiempos por etapa
- errores por fuente

Para investigar un caso:

1. mirar conversacion por ID
2. revisar mensajes
3. revisar `SearchState`
4. revisar ultimos `SearchRun`
5. revisar `SearchRunProperty`
6. revisar `PropertyCache`

Consulta conceptual:

```sql
Conversation -> Message
Conversation -> SearchState
Conversation -> SearchRun -> SearchRunProperty -> PropertyCache
```

---

## 14. Reglas criticas actuales

### Backend manda

La IA no ejecuta busquedas directamente.

### SearchState manda

El chat no debe funcionar como memoria libre. Todo refinement modifica estado estructurado.

### No inventar resultados

Si no hay resultados reales, no se deben mostrar mocks cuando `SEARCH_MOCK_FALLBACK_ENABLED=false`.

### Moneda y precio son esenciales

Si el usuario pide alquiler en ARS, un resultado en USD no debe pasar como buen match.

### Geografia debe ser estructurada

Strings como `Alto Palermo` no alcanzan. Se necesita:

- provincia
- ciudad
- barrio
- POI
- lat/lon
- radio

### Frontend rehidrata

Despues de enviar mensaje, frontend recarga la conversacion desde backend para evitar quedarse con estado local viejo.

---

## 15. Limitaciones actuales

### Georef todavia no esta integrado

Hay preparacion para mejorar geografia, pero todavia falta integrar Georef Argentina como fuente oficial.

Uso esperado futuro:

- normalizar provincias
- normalizar departamentos/localidades
- resolver calles/direcciones argentinas

### Google Geocoding esta preparado, no obligatorio

Variables:

```env
GEOCODING_PROVIDER=google
GEOCODING_GOOGLE_API_KEY=
```

Uso esperado:

- POIs
- shoppings
- plazas
- estaciones
- lugares coloquiales

### Coordenadas de avisos no siempre existen

Si el portal no entrega coordenadas:

- se usa barrio/localidad como aproximacion
- el resultado puede pasar pero con menor confianza

### Fuente principal actual

El MVP esta estabilizando una fuente:

- Argenprop

Otras fuentes existen en codigo, pero no conviene activarlas todas hasta estabilizar calidad y latencia.

---

## 16. Proximos pasos recomendados

1. Mejorar prompt y contrato del chat para que explique mejor cambios de filtros.
2. Integrar Georef para normalizacion oficial Argentina.
3. Integrar Google Places/Geocoding para POIs y cercania real.
4. Guardar `geoConstraints` visibles en el detalle/admin de search runs.
5. Mejorar UX de loading cuando scraping tarda mucho.
6. Mostrar mejor cuando una propiedad tiene ubicacion aproximada y no exacta.
7. Agregar tests E2E para:
   - cambio de zona via chat
   - cercania a POI
   - descarte de provincia incorrecta
   - rehidratacion de frontend despues de enviar mensaje

