# Blueprint Tecnico del Backend NestJS

## 1. Objetivo

Este documento define el mapa tecnico del backend antes de escribir codigo.

No describe solo modulos conceptuales. Describe:

- como deberia organizarse el proyecto
- que carpetas deberian existir
- que clases o archivos principales deberia haber
- que responsabilidad tiene cada capa

La meta es evitar que el backend nazca desordenado.

---

## 2. Enfoque general

La recomendacion es:

- monolito modular en NestJS
- organizado por dominio y caso de uso
- con separacion clara entre API, aplicacion, dominio e infraestructura

## 2.1 Regla principal

El backend no debe organizarse solo por "tipo de archivo" global.

No conviene una estructura plana del estilo:

- `controllers/`
- `services/`
- `repositories/`

para toda la app mezclada.

Conviene organizarlo por modulos de negocio, y dentro de cada modulo separar capas.

---

## 3. Estructura general recomendada

```text
src/
  main.ts
  app.module.ts

  config/
  common/

  modules/
    auth/
    users/
    conversations/
    messages/
    search-state/
    ai/
    search/
    sources/
    properties/
    favorites/

  infrastructure/
    prisma/
    redis/
    openai/
    http/
    observability/
```

---

## 4. Capas base

## 4.1 `config/`

### Rol

Configuracion global y validacion de variables de entorno.

### Archivos esperados

```text
config/
  env.schema.ts
  app.config.ts
  database.config.ts
  auth.config.ts
  openai.config.ts
  search.config.ts
  cache.config.ts
```

---

## 4.2 `common/`

### Rol

Piezas transversales reutilizables por toda la app.

### Archivos o carpetas esperadas

```text
common/
  dto/
  enums/
  exceptions/
  guards/
  interceptors/
  pipes/
  decorators/
  utils/
  constants/
```

### Ejemplos

- guards de auth
- interceptors de request id
- excepciones de negocio compartidas
- utilidades de paginacion

---

## 4.3 `infrastructure/`

### Rol

Implementaciones concretas de integraciones y herramientas base.

### Estructura sugerida

```text
infrastructure/
  prisma/
    prisma.module.ts
    prisma.service.ts

  redis/
    redis.module.ts
    redis.service.ts

  openai/
    openai.module.ts
    openai.client.ts

  http/
    http-fetcher.service.ts

  observability/
    logger.service.ts
    request-context.middleware.ts
```

### Regla

Esto no debe contener logica de negocio de propiedades o conversaciones.

---

## 5. Estructura interna de un modulo

Cada modulo de negocio deberia seguir una forma similar.

```text
modules/
  example/
    example.module.ts

    api/
      controllers/
      dto/

    application/
      services/
      use-cases/

    domain/
      types/
      enums/
      rules/
      interfaces/

    infrastructure/
      repositories/
      mappers/
```

## 5.1 Que va en cada subcarpeta

### `api/`

- controllers
- request DTOs
- response DTOs

### `application/`

- servicios de orquestacion
- casos de uso

### `domain/`

- tipos de negocio
- enums
- reglas
- interfaces puras

### `infrastructure/`

- repositories concretos
- mappers a Prisma o APIs externas

---

## 6. Modulo por modulo

## 6.1 `auth`

### Objetivo

Resolver autenticacion y sesion.

### Estructura sugerida

```text
modules/
  auth/
    auth.module.ts

    api/
      controllers/
        auth.controller.ts
      dto/
        register.dto.ts
        login.dto.ts
        refresh.dto.ts

    application/
      services/
        auth.service.ts
        token.service.ts
        password.service.ts

    domain/
      interfaces/
        auth-token-payload.interface.ts

    infrastructure/
      repositories/
        refresh-token.repository.ts
```

### Controllers esperados

- `AuthController`

### Services esperados

- `AuthService`
- `TokenService`
- `PasswordService`

---

## 6.2 `users`

### Objetivo

Gestion minima del usuario.

### Estructura sugerida

```text
modules/
  users/
    users.module.ts

    application/
      services/
        users.service.ts

    domain/
      types/
        user.type.ts

    infrastructure/
      repositories/
        users.repository.ts
```

---

## 6.3 `conversations`

### Objetivo

Gestion de conversaciones y ownership.

### Estructura sugerida

```text
modules/
  conversations/
    conversations.module.ts

    api/
      controllers/
        conversations.controller.ts
      dto/
        create-conversation.dto.ts
        conversation-response.dto.ts

    application/
      use-cases/
        create-conversation.use-case.ts
        list-conversations.use-case.ts
        get-conversation-detail.use-case.ts
      services/
        conversations.service.ts

    domain/
      types/
        conversation.type.ts

    infrastructure/
      repositories/
        conversations.repository.ts
```

### Controllers esperados

- `ConversationsController`

---

## 6.4 `messages`

### Objetivo

Persistir y leer mensajes.

### Estructura sugerida

```text
modules/
  messages/
    messages.module.ts

    application/
      services/
        messages.service.ts

    domain/
      types/
        message.type.ts
        message-role.type.ts

    infrastructure/
      repositories/
        messages.repository.ts
```

### Nota

No hace falta controller propio si el entrypoint principal de mensajes vive en conversaciones/chat.

---

## 6.5 `search-state`

### Objetivo

Mantener el estado de filtros de la conversacion.

### Estructura sugerida

```text
modules/
  search-state/
    search-state.module.ts

    application/
      services/
        search-state.service.ts
        search-state-merge.service.ts

    domain/
      types/
        search-filters.type.ts
        search-state.type.ts
        search-state-merge-operation.type.ts
      rules/
        search-state-merge.rules.ts

    infrastructure/
      repositories/
        search-state.repository.ts
```

### Services esperados

- `SearchStateService`
- `SearchStateMergeService`

---

## 6.6 `ai`

### Objetivo

Interpretar el mensaje del usuario y devolver un `SearchDecision` valido.

### Estructura sugerida

```text
modules/
  ai/
    ai.module.ts

    application/
      services/
        ai.service.ts
        prompt-builder.service.ts
        search-decision-validator.service.ts

    domain/
      types/
        search-decision.type.ts
        search-intent.type.ts
        requested-action.type.ts
```

### Services esperados

- `AiService`
- `PromptBuilderService`
- `SearchDecisionValidatorService`

### Regla

Este modulo no ejecuta scraping ni toca DB de negocio directamente.

---

## 6.7 `search`

### Objetivo

Orquestar la corrida de busqueda real.

### Estructura sugerida

```text
modules/
  search/
    search.module.ts

    application/
      services/
        search.service.ts
        query-builder.service.ts
        dedupe.service.ts
        ranking.service.ts
        search-run.service.ts

    domain/
      types/
        property-listing.type.ts
        ranking-result.type.ts
        search-run.type.ts
      rules/
        dedupe.rules.ts
        ranking.rules.ts

    infrastructure/
      repositories/
        search-runs.repository.ts
        search-run-properties.repository.ts
```

### Services esperados

- `SearchService`
- `QueryBuilderService`
- `DedupeService`
- `RankingService`
- `SearchRunService`

---

## 6.8 `sources`

### Objetivo

Resolver discovery, fetch y adapters de portales.

### Estructura sugerida

```text
modules/
  sources/
    sources.module.ts

    application/
      services/
        discovery.service.ts
        html-fetcher.service.ts
        source-adapter-registry.service.ts

    domain/
      interfaces/
        property-source-adapter.interface.ts

    infrastructure/
      adapters/
        zonaprop.adapter.ts
        argenprop.adapter.ts
        properati.adapter.ts
        mudafy.adapter.ts
```

### Regla

Cada portal entra como adapter independiente.

---

## 6.9 `properties`

### Objetivo

Resolver acceso y persistencia de propiedades normalizadas.

### Estructura sugerida

```text
modules/
  properties/
    properties.module.ts

    application/
      services/
        properties.service.ts

    infrastructure/
      repositories/
        properties.repository.ts
```

---

## 6.10 `favorites`

### Objetivo

Gestionar favoritos del usuario.

### Estructura sugerida

```text
modules/
  favorites/
    favorites.module.ts

    api/
      controllers/
        favorites.controller.ts
      dto/
        create-favorite.dto.ts

    application/
      use-cases/
        create-favorite.use-case.ts
        delete-favorite.use-case.ts
        list-favorites.use-case.ts
      services/
        favorites.service.ts

    infrastructure/
      repositories/
        favorites.repository.ts
```

---

## 7. Componente orquestador principal

## 7.1 Recomendacion

Conviene tener un servicio orquestador claro para el caso de uso principal del producto.

### Nombre sugerido

- `ChatApplicationService`

### Ubicacion sugerida

Puede vivir en:

- `modules/conversations/application/services/`

o en un modulo `chat/` si despues el producto crece mucho.

## 7.2 Responsabilidades

- recibir mensaje
- validar ownership
- persistir mensaje user
- leer `search_state`
- pedir interpretacion a `ai`
- aplicar merge
- decidir si buscar
- coordinar `search`
- persistir mensaje assistant
- devolver respuesta final

### Regla

Este servicio coordina. No debe absorber toda la logica de ranking o scraping.

---

## 8. Controllers recomendados

## 8.1 Necesarios en MVP

- `AuthController`
- `ConversationsController`
- `FavoritesController`

## 8.2 Endpoint principal de chat

Mi recomendacion es que el endpoint principal viva en:

- `ConversationsController`

porque semanticamente el mensaje existe dentro de una conversacion.

### Metodo esperado

- `POST /conversations/:id/messages`

---

## 9. DTOs principales que deberian existir

## Auth

- `RegisterDto`
- `LoginDto`
- `RefreshDto`

## Conversations

- `CreateConversationDto`
- `ConversationResponseDto`
- `ConversationDetailResponseDto`

## Chat

- `SendMessageDto`
- `SendMessageResponseDto`

## Favorites

- `CreateFavoriteDto`
- `FavoriteResponseDto`

---

## 10. Repositories recomendados

## 10.1 Regla general

Cada agregado o modulo importante deberia tener su repository explicito.

### Repositories esperados

- `UsersRepository`
- `RefreshTokensRepository`
- `ConversationsRepository`
- `MessagesRepository`
- `SearchStateRepository`
- `SearchRunsRepository`
- `SearchRunPropertiesRepository`
- `PropertiesRepository`
- `FavoritesRepository`

## 10.2 Regla de diseño

Los repositories:

- encapsulan Prisma
- no contienen logica fuerte de negocio
- no hablan con OpenAI
- no hacen merge de filtros

---

## 11. Componentes transversales recomendados

## 11.1 Guards

- `JwtAuthGuard`

## 11.2 Interceptors

- `RequestContextInterceptor`
- `LoggingInterceptor`

## 11.3 Middleware

- request id / correlation id

## 11.4 Pipes

- validacion global de DTOs

## 11.5 Exception filters

- filtro global para errores HTTP y de negocio

---

## 12. Orden de construccion sugerido del backend

1. `config`
2. `infrastructure/prisma`
3. `common` base
4. `auth`
5. `conversations`
6. `messages`
7. `search-state`
8. `ai`
9. `search`
10. `sources`
11. `properties`
12. `favorites`
13. `cache`
14. `observability`

### Nota

Aunque `auth` no era prioridad de arquitectura de negocio, si entra en el primer release usable conviene dejarlo pronto en la base tecnica.

---

## 13. Lo que NO conviene hacer en la estructura

No recomiendo:

- meter controllers y services de todos los modulos en carpetas globales compartidas
- dejar Prisma llamado directamente desde controllers
- mezclar scraping con lógica de conversaciones
- meter prompts de IA dentro del controller
- poner dedupe/ranking dentro de repositories
- crear un modulo "utils" gigante con logica de negocio escondida

---

## 14. Resultado de este blueprint

Con este documento ya queda definido:

- como deberia organizarse `src/`
- que modulos existen
- que controllers existen
- que servicios clave existen
- que repositories existen
- donde deberia vivir la logica importante

El siguiente paso natural es:

1. pre-schema Prisma final
2. contratos HTTP exactos
3. contrato exacto de IA

Eso ya deja el backend listo para empezar a construirse con orden.
