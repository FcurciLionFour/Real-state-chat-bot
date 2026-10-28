# Diseno Tecnico Backend y Datos - Pre Schema MVP

## 1. Objetivo

Este documento traduce la arquitectura general a definiciones tecnicas concretas, sin escribir codigo todavia.

Sirve como base para:

- schema Prisma
- modulos NestJS
- DTOs
- servicios de negocio
- backlog de implementacion

---

## 2. Stack de datos y backend

### Backend

- NestJS
- Prisma ORM
- OpenAI Responses API

### Datos

- PostgreSQL como base principal
- Redis como cache y soporte operativo

### Regla clave

PostgreSQL guarda la verdad del negocio.

Redis acelera, pero no reemplaza persistencia.

---

## 3. Convenciones base

### Primary keys

- todas las entidades usan `UUID`

### Timestamps

Todas las tablas de negocio deben tener, como minimo:

- `created_at`
- `updated_at` cuando aplique

### Soft delete

Para el MVP, no hace falta soft delete generalizado.

La recomendacion inicial es:

- no usar soft delete por defecto
- usar `status` o `revoked_at` cuando el dominio lo necesite

### JSON

Usar `jsonb` en PostgreSQL para:

- filtros
- snapshots
- payloads de IA
- payloads crudos y normalizados
- razones de ranking

---

## 4. Mapa final de tablas MVP

## 4.1 `users`

### Campos

- `id` UUID PK
- `email` varchar(320) not null
- `password_hash` varchar not null
- `role` varchar(50) not null default `user`
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Constraints

- unique `email`

### Indices

- unique index `users_email_uq(email)`

### Notas

- el `role` queda simple para MVP: `user`, `admin`

---

## 4.2 `refresh_tokens`

### Campos

- `id` UUID PK
- `user_id` UUID not null FK -> `users.id`
- `token_hash` varchar not null
- `device_label` varchar null
- `user_agent` text null
- `ip_address` varchar null
- `expires_at` timestamptz not null
- `revoked_at` timestamptz null
- `created_at` timestamptz not null

### Constraints

- unique `token_hash`

### Indices

- unique index `refresh_tokens_token_hash_uq(token_hash)`
- index `refresh_tokens_user_id_idx(user_id)`
- index `refresh_tokens_expires_at_idx(expires_at)`

### Notas

- no guardar refresh token plano
- solo hash

---

## 4.3 `conversations`

### Campos

- `id` UUID PK
- `user_id` UUID not null FK -> `users.id`
- `title` varchar(160) not null
- `status` varchar(40) not null default `active`
- `last_search_at` timestamptz null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Constraints

- FK a `users`

### Indices

- index `conversations_user_id_idx(user_id)`
- index `conversations_user_id_updated_at_idx(user_id, updated_at desc)`

### Notas

- `status` puede ser `active` o `archived` en MVP

---

## 4.4 `messages`

### Campos

- `id` UUID PK
- `conversation_id` UUID not null FK -> `conversations.id`
- `role` varchar(20) not null
- `content` text not null
- `structured_payload_json` jsonb null
- `created_at` timestamptz not null

### Constraints

- FK a `conversations`

### Indices

- index `messages_conversation_id_idx(conversation_id)`
- index `messages_conversation_id_created_at_idx(conversation_id, created_at asc)`

### Notas

- roles MVP: `user`, `assistant`, `system`
- `structured_payload_json` puede guardar salida validada de IA o metadata de respuesta

---

## 4.5 `search_states`

### Campos

- `id` UUID PK
- `conversation_id` UUID not null FK -> `conversations.id`
- `filters_json` jsonb not null
- `version` integer not null default 1
- `updated_at` timestamptz not null

### Constraints

- unique `conversation_id`

### Indices

- unique index `search_states_conversation_id_uq(conversation_id)`
- index `search_states_updated_at_idx(updated_at)`

### Notas

- una conversacion tiene exactamente un estado actual
- si despues quieren historial de cambios fino, se agrega una tabla de eventos

---

## 4.6 `search_runs`

### Campos

- `id` UUID PK
- `conversation_id` UUID not null FK -> `conversations.id`
- `parent_search_run_id` UUID null FK -> `search_runs.id`
- `filters_snapshot_json` jsonb not null
- `query_text` text not null
- `requested_page` integer not null default 1
- `result_count` integer not null default 0
- `sources_used_json` jsonb not null
- `status` varchar(20) not null
- `error_summary` text null
- `created_at` timestamptz not null

### Constraints

- FK a `conversations`
- FK opcional autoreferencial para `show_more` o reruns relacionados

### Indices

- index `search_runs_conversation_id_idx(conversation_id)`
- index `search_runs_conversation_id_created_at_idx(conversation_id, created_at desc)`
- index `search_runs_status_idx(status)`
- index `search_runs_parent_search_run_id_idx(parent_search_run_id)`

### Notas

- `status`: `completed`, `partial`, `failed`
- `parent_search_run_id` permite encadenar corridas relacionadas

---

## 4.7 `properties_cache`

### Campos

- `id` UUID PK
- `source` varchar(80) not null
- `external_id` varchar(160) null
- `source_url` text not null
- `canonical_hash` varchar(160) not null
- `raw_payload_json` jsonb not null
- `normalized_payload_json` jsonb not null
- `title` text not null
- `description` text null
- `country` varchar(80) null
- `province` varchar(120) null
- `city` varchar(120) null
- `neighborhood` varchar(120) null
- `location_text` text null
- `operation` varchar(30) null
- `property_type` varchar(60) null
- `price_amount` numeric(14,2) null
- `price_currency` varchar(10) null
- `expenses_amount` numeric(14,2) null
- `rooms` numeric(4,1) null
- `bedrooms` integer null
- `bathrooms` integer null
- `area_total` numeric(10,2) null
- `area_covered` numeric(10,2) null
- `features_json` jsonb not null
- `images_json` jsonb not null
- `published_at` timestamptz null
- `scraped_at` timestamptz not null
- `expires_at` timestamptz null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Constraints

- unique `source_url`
- unique parcial recomendada en `(source, external_id)` cuando `external_id` no sea null

### Indices

- unique index `properties_cache_source_url_uq(source_url)`
- index `properties_cache_canonical_hash_idx(canonical_hash)`
- index `properties_cache_source_external_id_idx(source, external_id)`
- index `properties_cache_city_neighborhood_idx(city, neighborhood)`
- index `properties_cache_operation_property_type_idx(operation, property_type)`
- index `properties_cache_price_currency_amount_idx(price_currency, price_amount)`
- index `properties_cache_scraped_at_idx(scraped_at desc)`

### Notas

- `normalized_payload_json` mantiene el modelo interno completo
- columnas denormalizadas sirven para performance e inspeccion
- `features_json` e `images_json` se mantienen como arrays JSON en MVP

---

## 4.8 `search_run_properties`

### Campos

- `id` UUID PK
- `search_run_id` UUID not null FK -> `search_runs.id`
- `property_cache_id` UUID not null FK -> `properties_cache.id`
- `position` integer not null
- `rank_score` numeric(10,4) not null
- `rank_reason_json` jsonb not null
- `created_at` timestamptz not null

### Constraints

- unique `(search_run_id, property_cache_id)`
- unique `(search_run_id, position)`

### Indices

- unique index `search_run_properties_run_property_uq(search_run_id, property_cache_id)`
- unique index `search_run_properties_run_position_uq(search_run_id, position)`
- index `search_run_properties_property_cache_id_idx(property_cache_id)`

### Notas

- esta tabla materializa el resultado exacto mostrado al usuario

---

## 4.9 `favorites`

### Campos

- `id` UUID PK
- `user_id` UUID not null FK -> `users.id`
- `property_cache_id` UUID not null FK -> `properties_cache.id`
- `created_at` timestamptz not null

### Constraints

- unique `(user_id, property_cache_id)`

### Indices

- unique index `favorites_user_property_uq(user_id, property_cache_id)`
- index `favorites_user_id_idx(user_id)`

### Notas

- el favorito referencia una propiedad ya normalizada

---

## 5. Relaciones ER simplificadas

- `users 1:N conversations`
- `users 1:N refresh_tokens`
- `conversations 1:N messages`
- `conversations 1:1 search_states`
- `conversations 1:N search_runs`
- `search_runs N:M properties_cache` por `search_run_properties`
- `users N:M properties_cache` por `favorites`

---

## 6. Search state: forma y reglas

## 6.1 Forma recomendada

```json
{
  "operation": "buy",
  "propertyTypes": ["apartment"],
  "locations": ["Palermo"],
  "priceMin": null,
  "priceMax": 140000,
  "currency": "USD",
  "rooms": 2,
  "bedrooms": 1,
  "bathrooms": 1,
  "areaMin": null,
  "areaMax": null,
  "expensesMax": null,
  "features": ["balcony"],
  "sortPreference": null
}
```

## 6.2 Reglas

- `operation` singular
- `propertyTypes` lista
- `locations` lista de strings canonicos
- `features` lista canonica
- si un campo no esta definido, se representa con `null` o lista vacia segun corresponda

## 6.3 Por que `propertyTypes` como lista

Porque modela mejor pedidos reales:

- "busco depto o PH"
- "puede ser casa o lote"

---

## 7. Contrato del backend con la IA

## 7.1 Entrada a la IA

El backend debe enviar:

- mensaje actual del usuario
- `search_state` actual
- resumen breve del contexto reciente
- instrucciones del sistema con schema estricto

## 7.2 Salida minima esperada

```ts
type SearchDecision = {
  intent: "new_search" | "modify_search" | "clarify" | "show_more" | "compare" | "favorite" | "smalltalk";
  shouldSearch: boolean;
  requiresClarification: boolean;
  clarificationQuestion: string | null;
  userFacingMessage: string;
  filterPatch: Record<string, unknown>;
  filtersToUnset: string[];
  requestedAction: "search" | "compare" | "favorite" | "none";
};
```

## 7.3 Regla no negociable

La IA no muta DB ni aplica merge final.

El backend valida y decide.

---

## 8. Merge engine del search state

## 8.1 Problema

Un `Partial<SearchFilters>` no alcanza por si solo para reflejar la intencion real del usuario.

## 8.2 Solucion

El backend necesita un motor de merge con operaciones internas.

### Operaciones

- `set_field`
- `unset_field`
- `replace_list`
- `add_list_value`
- `remove_list_value`

## 8.3 Ejemplos

- "mejor Palermo" => `replace_list locations=["Palermo"]`
- "sumale cochera" => `add_list_value features=["garage"]`
- "sin cochera" => `remove_list_value features=["garage"]`
- "sin limite de expensas" => `unset_field expensesMax`

## 8.4 Donde vive

Debe vivir en dominio o en un servicio de aplicacion dedicado.

No en el controlador.
No en el prompt.

---

## 9. Flujo exacto de `POST /conversations/:id/messages`

## 9.1 Input

- `conversationId`
- `message`

## 9.2 Respuesta esperada

```json
{
  "conversationId": "uuid",
  "assistantMessage": "Mantengo Palermo y agrego balcon. Busco nuevas opciones.",
  "searchState": {},
  "didSearch": true,
  "results": [],
  "meta": {
    "searchRunId": "uuid",
    "sourcesUsed": ["zonaprop", "argenprop"],
    "resultCount": 10
  }
}
```

## 9.3 Flujo interno

1. autenticar usuario
2. verificar ownership de la conversacion
3. persistir mensaje user
4. leer `search_state`
5. construir input para OpenAI
6. invocar modelo
7. validar schema
8. traducir salida de IA a operaciones de merge
9. aplicar merge al estado
10. incrementar `version`
11. persistir `search_state`
12. si `requiresClarification = true`, no correr busqueda
13. si `shouldSearch = true`, ejecutar pipeline
14. persistir `search_run`
15. persistir `search_run_properties`
16. persistir mensaje assistant
17. devolver respuesta al frontend

---

## 10. Pipeline de busqueda del backend

## 10.1 Fases

1. query builder
2. discovery
3. filtro de dominios
4. fetch HTML
5. adapter por portal
6. normalizacion
7. dedupe
8. ranking
9. persistencia

## 10.2 Query builder

Entrada:

- `SearchFilters`

Salida:

- texto o conjunto de queries aptas para discovery

## 10.3 Discovery

Entrada:

- query

Salida:

- URLs candidatas

## 10.4 Fetch y adapters

Cada portal entra por un adapter con contrato comun:

```ts
interface PropertySourceAdapter {
  sourceName: string;
  canHandle(url: string): boolean;
  extract(url: string, html: string): Promise<PropertyListing | null>;
}
```

## 10.5 Persistencia

Una vez normalizadas, las propiedades deben:

- upsertearse en `properties_cache`
- vincularse a la corrida en `search_run_properties`

---

## 11. Dedupe y canonicalizacion

## 11.1 Orden MVP

1. `source + external_id`
2. `source_url`
3. `canonical_hash`
4. heuristica

## 11.2 Canonical hash

Debe construirse con componentes relativamente estables, por ejemplo:

- source
- titulo normalizado
- ubicacion normalizada
- precio aproximado
- area aproximada

### Regla

No usarlo como unica fuente de verdad. Es una ayuda de dedupe.

---

## 12. Ranking MVP

## 12.1 Factores

- match de ubicacion
- match de operacion
- match de tipo
- cercania al presupuesto
- match de ambientes
- match de features
- completitud del anuncio
- frescura del scrapeo

## 12.2 Persistencia de explicacion

Guardar razones en `rank_reason_json`, por ejemplo:

```json
{
  "locationMatch": true,
  "budgetScore": 0.9,
  "roomsScore": 1,
  "featuresMatched": ["balcony"],
  "freshnessScore": 0.8
}
```

---

## 13. Redis: uso exacto en el MVP

## 13.1 Casos de uso recomendados

- cache de resultados por combinacion de filtros
- cache de HTML por URL
- rate limiting en auth y chat

## 13.2 Casos de uso no recomendados como prioridad

- guardar verdad de favoritos
- guardar sesiones como unica fuente
- guardar search state como unica fuente

## 13.3 Regla

Todo lo importante debe poder reconstruirse desde PostgreSQL.

---

## 14. Modulos backend y responsabilidades

## 14.1 `auth`

Responsable de:

- register
- login
- refresh
- logout
- `GET /auth/me`

## 14.2 `users`

Responsable de:

- datos base del usuario
- perfil simple si se necesita

## 14.3 `conversations`

Responsable de:

- crear conversacion
- listar conversaciones del usuario
- obtener detalle de conversacion

## 14.4 `messages`

Responsable de:

- persistir mensajes
- recuperar historial

## 14.5 `search-state`

Responsable de:

- mantener estado actual
- mergear filtros
- versionar estado

## 14.6 `ai`

Responsable de:

- construir prompt
- invocar OpenAI
- validar schema

## 14.7 `search`

Responsable de:

- query builder
- orquestacion de discovery
- dedupe
- ranking
- persistencia de `search_runs`

## 14.8 `sources`

Responsable de:

- fetchers
- adapters por portal
- parseo y normalizacion por fuente

## 14.9 `properties`

Responsable de:

- acceso a propiedades cacheadas
- lectura de detalle

## 14.10 `favorites`

Responsable de:

- alta y baja de favoritos
- listado del usuario

---

## 15. Endpoints MVP

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Conversations

- `POST /conversations`
- `GET /conversations`
- `GET /conversations/:id`

### Messages / Chat

- `POST /conversations/:id/messages`

### Favorites

- `GET /favorites`
- `POST /favorites`
- `DELETE /favorites/:propertyId`

---

## 16. Decisiones tecnicas que recomiendo cerrar ya

1. `propertyTypes` como lista, no singular
2. `filters_json` en `search_states`, no columnas por filtro
3. `search_runs` obligatoria desde fase temprana
4. `properties_cache` con JSON + columnas denormalizadas
5. `favorites` contra `property_cache_id`
6. `refresh_tokens` persistidos y hasheados
7. `parent_search_run_id` para soportar `show_more`
8. Redis solo como cache, no como verdad

---

## 17. Siguiente paso natural

Con este documento ya podemos pasar a uno de estos dos siguientes niveles:

1. escribir el schema Prisma inicial
2. definir tipos TypeScript de dominio y DTOs antes del schema

Mi recomendacion es:

- primero cerrar tipos de dominio clave
- enseguida despues bajar a Prisma

Asi evitamos que la BBDD nazca desconectada del lenguaje del negocio.
