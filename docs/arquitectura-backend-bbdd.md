# Arquitectura de Backend y BBDD - MVP

## 1. Objetivo

Este documento define como debe quedar estructurado el backend y la base de datos del MVP.

No es codigo. Es el plano que despues se traducira a:

- schema Prisma
- modulos NestJS
- contratos de dominio
- endpoints
- reglas de negocio

La idea es que el MVP arranque acotado en CABA, pero que la arquitectura quede lista para escalar a miles de usuarios y cobertura nacional.

---

## 2. Principios de arquitectura

### El backend es la fuente de verdad

La IA interpreta mensajes. El backend:

- valida
- mergea filtros
- ejecuta busquedas
- persiste estado
- decide herramientas

### El chat no es el centro del sistema

El centro es:

- `search_state`
- `search_runs`
- `properties_cache`

El chat es la interfaz de entrada y salida.

### Persistir lo importante

Hay que poder reconstruir:

- que queria buscar el usuario
- que entendio la IA
- que filtros quedaron activos
- que corrida se ejecuto
- que propiedades se devolvieron

### Diseno extensible

Aunque el MVP sea CABA, el modelo no debe quedar roto para:

- provincias
- ciudades
- miles de usuarios
- mas fuentes
- mas tipos de propiedad

---

## 3. Capas del backend

## 3.1 Dominio

Contiene:

- `SearchFilters`
- `SearchDecision`
- `PropertyListing`
- reglas de merge
- reglas de ranking
- reglas de dedupe

No depende de OpenAI, Prisma ni scraping.

## 3.2 Aplicacion

Orquesta casos de uso:

- crear conversacion
- enviar mensaje
- listar conversaciones
- obtener detalle de conversacion
- guardar favorito
- eliminar favorito
- autenticar usuario

## 3.3 Infraestructura e integraciones

Contiene:

- cliente OpenAI
- discovery engine
- fetchers HTML
- adapters de portales
- Prisma
- auth JWT

## 3.4 API

Expone endpoints HTTP para frontend.

---

## 4. Modulos recomendados en NestJS

### Core funcional

- `auth`
- `users`
- `conversations`
- `messages`
- `search-state`
- `ai`
- `search`
- `sources`
- `properties`
- `favorites`

### Soporte

- `cache`
- `observability`
- `config`

### Orden de implementacion

1. `conversations`
2. `messages`
3. `search-state`
4. `ai`
5. `search`
6. `sources`
7. `properties`
8. `auth`
9. `favorites`

Aunque auth aparezca en release usable, conviene definirlo en arquitectura desde ahora.

---

## 5. Entidades principales de dominio

## 5.1 User

Representa al usuario autenticado.

## 5.2 Conversation

Representa una conversacion de busqueda. Es el contenedor de mensajes y del estado de busqueda vigente.

## 5.3 Message

Representa cada intercambio de chat. Sirve para UI, auditoria y debugging.

## 5.4 SearchState

Representa la fotografia actual de filtros activos de una conversacion. Es la fuente de verdad de la busqueda.

## 5.5 SearchRun

Representa una corrida concreta de busqueda.

Sirve para:

- auditoria
- debugging
- paginacion
- repetibilidad
- analitica

## 5.6 PropertyCache

Representa una propiedad ya scrapeada y normalizada.

No es solo cache tecnica. Es la representacion interna de una publicacion real.

## 5.7 SearchRunProperty

Tabla pivote que vincula una corrida con propiedades devueltas y guarda score/rank.

## 5.8 Favorite

Relacion entre usuario y propiedad guardada.

## 5.9 Session o RefreshToken

Entidad para persistir sesiones o refresh tokens revocables.

---

## 6. Diseno de tablas

## 6.1 `users`

### Proposito

Identidad del usuario.

### Campos

- `id` UUID PK
- `email` varchar unique not null
- `password_hash` varchar not null
- `role` varchar default `user`
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Reglas

- `email` unico
- no guardar password plano

### Indices

- unique index en `email`

---

## 6.2 `conversations`

### Proposito

Agrupa mensajes y estado de busqueda de un usuario.

### Campos

- `id` UUID PK
- `user_id` UUID FK -> `users.id`
- `title` varchar not null
- `status` varchar default `active`
- `last_search_at` timestamptz null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Reglas

- una conversacion pertenece a un usuario
- el titulo puede autogenerarse y luego editarse

### Indices

- index en `user_id`
- index en `(user_id, updated_at desc)`

---

## 6.3 `messages`

### Proposito

Persistir historial de chat.

### Campos

- `id` UUID PK
- `conversation_id` UUID FK -> `conversations.id`
- `role` varchar not null
- `content` text not null
- `structured_payload_json` jsonb null
- `created_at` timestamptz not null

### `role`

Valores iniciales:

- `user`
- `assistant`
- `system`

### Uso de `structured_payload_json`

Puede guardar:

- salida cruda validada de IA
- metadata de respuesta
- resumen de cambios aplicados

### Indices

- index en `conversation_id`
- index en `(conversation_id, created_at asc)`

---

## 6.4 `search_states`

### Proposito

Guardar el estado activo de filtros de una conversacion.

### Campos

- `id` UUID PK
- `conversation_id` UUID FK -> `conversations.id`
- `filters_json` jsonb not null
- `version` integer not null
- `updated_at` timestamptz not null

### Reglas

- una conversacion tiene un solo `search_state` activo
- `version` sube cada vez que cambia el estado

### Claves e indices

- unique index en `conversation_id`
- index en `updated_at`

### Motivo de usar JSON

Para el MVP conviene `filters_json` en vez de columnas individuales porque:

- los filtros van a evolucionar
- simplifica cambios tempranos
- evita migraciones por cada experimento menor

La logica fuerte vive en el dominio, no en SQL ad hoc.

---

## 6.5 `search_runs`

### Proposito

Representar cada corrida de busqueda ejecutada.

### Campos

- `id` UUID PK
- `conversation_id` UUID FK -> `conversations.id`
- `filters_snapshot_json` jsonb not null
- `query_text` text not null
- `requested_page` integer default 1
- `result_count` integer default 0
- `sources_used_json` jsonb not null
- `status` varchar not null
- `created_at` timestamptz not null

### `status`

Valores sugeridos:

- `completed`
- `partial`
- `failed`

### Reglas

- cada busqueda tiene snapshot propio de filtros
- nunca depende solo del estado vivo de la conversacion

### Indices

- index en `conversation_id`
- index en `(conversation_id, created_at desc)`
- index en `status`

---

## 6.6 `properties_cache`

### Proposito

Guardar anuncios ya extraidos y normalizados.

### Campos

- `id` UUID PK
- `source` varchar not null
- `external_id` varchar null
- `source_url` text not null
- `canonical_hash` varchar not null
- `raw_payload_json` jsonb not null
- `normalized_payload_json` jsonb not null
- `country` varchar null
- `province` varchar null
- `city` varchar null
- `neighborhood` varchar null
- `price_amount` numeric null
- `price_currency` varchar null
- `operation` varchar null
- `property_type` varchar null
- `published_at` timestamptz null
- `scraped_at` timestamptz not null
- `expires_at` timestamptz null
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### Reglas

- `source_url` debe preservarse siempre
- `normalized_payload_json` es la fuente principal de lectura interna
- columnas denormalizadas ayudan a indexar y filtrar

### Claves e indices

- unique index en `(source, external_id)` solo cuando `external_id` exista
- unique index en `source_url`
- index en `canonical_hash`
- index en `(city, neighborhood)`
- index en `(operation, property_type)`
- index en `(price_currency, price_amount)`
- index en `scraped_at`

### Motivo de columnas denormalizadas

Si todo queda solo en JSON, despues filtrar, ordenar y auditar se vuelve torpe. Por eso conviene:

- guardar payload completo en JSON
- exponer algunos campos clave en columnas indexables

---

## 6.7 `search_run_properties`

### Proposito

Tabla pivote entre corrida y propiedad.

### Campos

- `id` UUID PK
- `search_run_id` UUID FK -> `search_runs.id`
- `property_cache_id` UUID FK -> `properties_cache.id`
- `position` integer not null
- `rank_score` numeric not null
- `rank_reason_json` jsonb not null
- `created_at` timestamptz not null

### Reglas

- una propiedad puede aparecer en muchas corridas
- una corrida puede devolver muchas propiedades
- `position` guarda el orden final mostrado

### Claves e indices

- unique index en `(search_run_id, property_cache_id)`
- unique index en `(search_run_id, position)`
- index en `property_cache_id`

---

## 6.8 `favorites`

### Proposito

Guardar propiedades favoritas de cada usuario.

### Campos

- `id` UUID PK
- `user_id` UUID FK -> `users.id`
- `property_cache_id` UUID FK -> `properties_cache.id`
- `created_at` timestamptz not null

### Reglas

- un usuario no puede favoritear dos veces la misma propiedad

### Claves e indices

- unique index en `(user_id, property_cache_id)`
- index en `user_id`

---

## 6.9 `refresh_tokens`

### Proposito

Persistir refresh tokens para control de sesiones.

### Campos

- `id` UUID PK
- `user_id` UUID FK -> `users.id`
- `token_hash` varchar not null
- `device_label` varchar null
- `user_agent` varchar null
- `ip_address` varchar null
- `expires_at` timestamptz not null
- `revoked_at` timestamptz null
- `created_at` timestamptz not null

### Reglas

- nunca guardar refresh token plano
- guardar solo hash
- permitir revocacion por token

### Indices

- index en `user_id`
- unique index en `token_hash`
- index en `expires_at`

---

## 7. Relaciones principales

- `users 1:N conversations`
- `conversations 1:N messages`
- `conversations 1:1 search_states`
- `conversations 1:N search_runs`
- `search_runs N:M properties_cache` via `search_run_properties`
- `users N:M properties_cache` via `favorites`
- `users 1:N refresh_tokens`

---

## 8. SearchFilters recomendado

Para el MVP, `filters_json` deberia representar algo cercano a esto:

```json
{
  "operation": "buy",
  "propertyTypes": ["apartment"],
  "locations": ["Palermo", "Recoleta"],
  "priceMin": null,
  "priceMax": 140000,
  "currency": "USD",
  "rooms": 2,
  "bedrooms": 1,
  "bathrooms": 1,
  "areaMin": null,
  "areaMax": null,
  "expensesMax": null,
  "features": ["balcony", "garage"],
  "sortPreference": null
}
```

### Decision importante

Recomiendo `propertyTypes` como lista en vez de campo singular. Es mas extensible y modela mejor frases como:

- "depto o PH"
- "casa o lote"

---

## 9. SearchDecision recomendado

La salida estructurada de la IA deberia cubrir al menos:

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

### Regla clave

La IA no debe aplicar merge directamente. El backend convierte `filterPatch` y `filtersToUnset` en operaciones deterministicas.

---

## 10. Reglas de negocio del backend

## 10.1 Crear conversacion

### Flujo

1. validar usuario autenticado
2. crear `conversation`
3. crear `search_state` vacio con version inicial
4. devolver id y estado inicial

### Regla

Cada conversacion nace con estado vacio persistido.

---

## 10.2 Enviar mensaje

### Endpoint

`POST /conversations/:id/messages`

### Flujo completo

1. validar autenticacion
2. validar que la conversacion pertenezca al usuario
3. persistir mensaje del usuario
4. cargar `search_state`
5. llamar a OpenAI con:
   - mensaje actual
   - resumen corto del contexto
   - `search_state` actual
6. validar schema de salida
7. convertir salida IA a operaciones de merge
8. aplicar merge sobre `search_state`
9. persistir nueva version del estado
10. decidir si se ejecuta `search`
11. si hay busqueda:
   - construir query
   - correr discovery
   - filtrar dominios
   - fetch + extract
   - normalizar
   - dedupe
   - rank
   - persistir `search_run`
   - vincular propiedades en `search_run_properties`
12. persistir mensaje assistant
13. devolver respuesta al frontend

### Reglas

- no se busca si falta aclaracion esencial
- no se responde como si hubiera resultados si la corrida no ocurrio
- siempre se persiste el estado final aplicado

---

## 10.3 Merge de filtros

### Regla

No hacer merge ciego de JSON.

### Operaciones internas recomendadas

- `set_field`
- `unset_field`
- `replace_list`
- `add_list_value`
- `remove_list_value`

### Ejemplos

- "mejor Palermo" => `replace_list locations=["Palermo"]`
- "sumale balcon" => `add_list_value features=["balcony"]`
- "sin balcon" => `remove_list_value features=["balcony"]`
- "olvidate del presupuesto" => `unset_field priceMax`

### Donde vive esta logica

En dominio o servicio de aplicacion, no en controlador ni en prompt.

---

## 10.4 Search run

### Regla

Toda corrida debe guardar snapshot de filtros.

Eso permite:

- reproducir resultados
- explicar que paso
- depurar errores
- sostener `show_more`

### `show_more`

Regla MVP:

- si la fuente y la corrida original permiten paginar, se trae otra pagina del mismo snapshot
- si no, se genera nueva corrida con mismo snapshot y se registra como nueva ejecucion

---

## 10.5 Dedupe

### Orden recomendado

1. `(source, external_id)` si existe
2. `source_url`
3. `canonical_hash`
4. heuristica por titulo + precio + ubicacion + area

### Regla

Primero eliminar duplicados evidentes. No perseguir perfeccion en fase 1.

---

## 10.6 Ranking

### Factores MVP

- match de ubicacion
- match de operacion
- match de tipo de propiedad
- match de presupuesto
- match de ambientes
- match de features
- completitud del anuncio
- frescura del scrapeo

### Persistencia

Guardar score y razones en `search_run_properties.rank_reason_json`.

Motivo:

- auditoria
- debugging
- explicabilidad futura

---

## 10.7 Favoritos

### Regla

El favorito apunta a `property_cache`.

### Si la publicacion caduca

Recomendacion MVP:

- el favorito sigue existiendo
- se marca internamente que la publicacion puede estar desactualizada o inactiva
- no se borra el favorito automaticamente

Esto evita frustracion y conserva historial del usuario.

---

## 10.8 Auth

### Modelo recomendado

- access token JWT de corta vida
- refresh token en cookie HttpOnly
- refresh token hasheado en DB

### Beneficios

- revocacion de sesiones
- bajo acoplamiento con backend stateless
- escalabilidad

---

## 11. Keys, constraints e indices criticos

## 11.1 Primary keys

Usar UUID en todas las tablas de negocio.

Motivo:

- mejor desacople entre sistemas
- mas comodo para APIs
- evita exponer ids secuenciales

## 11.2 Foreign keys

Necesarias en:

- `conversations.user_id`
- `messages.conversation_id`
- `search_states.conversation_id`
- `search_runs.conversation_id`
- `search_run_properties.search_run_id`
- `search_run_properties.property_cache_id`
- `favorites.user_id`
- `favorites.property_cache_id`
- `refresh_tokens.user_id`

## 11.3 Unique keys

Las mas importantes:

- `users.email`
- `search_states.conversation_id`
- `properties_cache.source_url`
- `favorites(user_id, property_cache_id)`
- `search_run_properties(search_run_id, property_cache_id)`
- `refresh_tokens.token_hash`

## 11.4 Indices mas importantes

Para que el sistema no se degrade con miles de usuarios:

- `conversations(user_id, updated_at desc)`
- `messages(conversation_id, created_at asc)`
- `search_runs(conversation_id, created_at desc)`
- `properties_cache(operation, property_type)`
- `properties_cache(city, neighborhood)`
- `properties_cache(price_currency, price_amount)`
- `favorites(user_id)`

---

## 12. Que conviene dejar en JSON y que conviene en columnas

### En JSON

- `search_states.filters_json`
- `messages.structured_payload_json`
- `search_runs.filters_snapshot_json`
- `search_runs.sources_used_json`
- `properties_cache.raw_payload_json`
- `properties_cache.normalized_payload_json`
- `search_run_properties.rank_reason_json`

### En columnas

- ids
- foreign keys
- timestamps
- estado
- ubicacion clave
- precio clave
- tipo de propiedad
- operacion

### Regla

JSON da flexibilidad. Columnas dan performance y orden. El MVP necesita ambas.

---

## 13. Decisiones que ya quedan fijas

- MVP inicial en CABA
- compra y alquiler
- alquiler temporal fuera del MVP
- 4 portales iniciales: Zonaprop, Argenprop, Properati, Mudafy
- auth con JWT corto + refresh token en cookie HttpOnly
- 10 resultados por corrida
- `show_more` sobre el mismo snapshot cuando sea posible

---

## 14. Siguiente entregable tecnico

Con este documento, el siguiente paso natural es bajar esto a:

1. schema Prisma inicial
2. tipos de dominio TypeScript
3. flujo del endpoint `POST /conversations/:id/messages`
4. backlog de implementacion por modulo

Ese ya seria el punto donde empieza la construccion real.

---

## 15. Que tipo de BBDD usar y por que

## 15.1 Recomendacion principal

La base principal del sistema debe ser:

- PostgreSQL

Y de forma opcional, como soporte operativo:

- Redis para cache y rate limiting

### Resumen corto

PostgreSQL debe guardar la verdad del negocio.

Redis, si se usa, no guarda la verdad del negocio. Solo acelera.

---

## 15.2 Por que PostgreSQL es la mejor opcion para este proyecto

Este producto necesita:

- relaciones claras entre usuarios, conversaciones, mensajes, estados y favoritos
- consistencia fuerte
- transacciones
- claves foraneas
- indices
- consultas ordenadas y auditables
- flexibilidad para guardar algunos payloads JSON

PostgreSQL resuelve todo eso bien.

### Beneficios concretos

- excelente para datos relacionales
- soporta `jsonb`, que sirve para filtros, payloads de IA y resultados normalizados
- permite integridad referencial real con foreign keys
- escala bien para un MVP y tambien para una etapa mas seria
- encaja muy bien con Prisma
- es una tecnologia madura, estable y muy conocida

---

## 15.3 Por que no conviene usar solo NoSQL como base principal

Bases tipo documento pueden parecer tentadoras porque:

- el chat parece flexible
- los filtros cambian
- hay payloads JSON

Pero para este proyecto, usar solo NoSQL como base principal complica cosas importantes:

- relaciones entre entidades
- favoritos
- sesiones
- constraints
- unicidad por usuario y recurso
- auditoria de corridas
- consistencia de negocio

El sistema no es solo "guardar conversaciones". Es un producto con entidades relacionadas y reglas fuertes.

Por eso:

- NoSQL puede servir como complemento en otros escenarios
- no deberia ser la base principal del MVP

---

## 15.4 Por que no usar MySQL en vez de PostgreSQL

MySQL podria funcionar, pero PostgreSQL encaja mejor aca por:

- mejor ergonomia general para `jsonb`
- muy buen soporte para consultas mixtas relacional + documento
- mejor sensacion de robustez para modelado con Prisma en proyectos de backend ricos en relaciones

No es que MySQL este mal. Simplemente PostgreSQL es mas natural para este diseño.

---

## 15.5 Rol de Redis

Redis no reemplaza Postgres.

Sirve para:

- cache de resultados de busqueda
- cache de HTML por URL
- rate limiting
- invalidaciones rapidas
- eventualmente colas simples o locks distribuidos

### Regla

Si Redis se cae, el sistema idealmente sigue funcionando mas lento.

Si PostgreSQL se cae, el sistema pierde su fuente de verdad.

---

## 15.6 Que guarda cada tecnologia

### PostgreSQL

Debe guardar:

- usuarios
- conversaciones
- mensajes
- search states
- search runs
- propiedades cacheadas
- favoritos
- refresh tokens

### Redis

Puede guardar:

- resultados cacheados por combinacion de filtros
- HTML temporal de paginas ya scrapeadas
- limites de rate por IP o usuario
- sesiones efimeras tecnicas si hicieran falta

---

## 15.7 Como pensar la estrategia de datos

La estrategia correcta para este proyecto es:

- Postgres como fuente de verdad transaccional
- JSON dentro de Postgres para partes flexibles
- Redis solo como acelerador

No es:

- Mongo como base principal
- Redis como base de negocio
- todo en JSON sin relaciones

---

## 15.8 Conclusiones practicas

Para este MVP y para crecer despues a miles de usuarios:

- BBDD principal: PostgreSQL
- ORM: Prisma
- Cache opcional: Redis

Eso les da:

- solidez relacional
- flexibilidad para payloads dinamicos
- camino de crecimiento sano
- menos riesgo de rediseñar todo cuando escalen de CABA a toda Argentina
