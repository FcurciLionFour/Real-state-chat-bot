# Contratos HTTP MVP

## 1. Objetivo

Este documento define como debe hablar el frontend con el backend en el MVP.

No es implementacion. Define:

- endpoints
- requests
- responses
- errores
- reglas de autenticacion
- convenciones de formato

La idea es que despues se pueda traducir a:

- DTOs
- controllers
- guards
- validaciones
- clientes frontend

---

## 2. Convenciones generales de API

## 2.1 Base

Recomendacion:

- prefijo `/api`

Ejemplo:

- `/api/auth/login`
- `/api/conversations`

## 2.2 Formato

Todas las requests y responses del MVP usan JSON, excepto cookies de auth que viajan por encabezados HTTP.

## 2.3 Fechas

Todas las fechas se devuelven en formato ISO 8601.

## 2.4 IDs

Todos los ids de negocio son UUID string.

## 2.5 Convencion de nombres

JSON en `camelCase`.

---

## 3. Convenciones de autenticacion

## 3.1 Estrategia

- access token JWT de corta vida
- refresh token en cookie HttpOnly

## 3.2 Endpoints protegidos

Requieren access token valido:

- conversaciones
- mensajes
- favoritos
- `auth/me`

## 3.3 Refresh

El frontend no debe manipular el refresh token manualmente. El backend lo maneja via cookie.

---

## 4. Convenciones de errores

## 4.1 Formato recomendado

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "priceMax must be greater than priceMin",
  "code": "VALIDATION_ERROR"
}
```

## 4.2 Campos

- `statusCode`: codigo HTTP
- `error`: etiqueta corta estandar
- `message`: mensaje legible
- `code`: codigo interno estable

## 4.3 Codigos internos recomendados

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `INTERNAL_ERROR`
- `SEARCH_SOURCE_ERROR`
- `AI_OUTPUT_INVALID`

## 4.4 Regla

No devolver stack traces ni detalles sensibles al frontend.

---

## 5. Auth

## 5.1 `POST /api/auth/register`

### Request

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123"
}
```

### Response `201`

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "USER",
    "createdAt": "2026-04-07T12:00:00.000Z"
  },
  "accessToken": "jwt"
}
```

### Notas

- el refresh token se setea en cookie HttpOnly

---

## 5.2 `POST /api/auth/login`

### Request

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123"
}
```

### Response `200`

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "USER"
  },
  "accessToken": "jwt"
}
```

### Errores posibles

- `401 UNAUTHORIZED`

---

## 5.3 `POST /api/auth/refresh`

### Request

Sin body obligatorio. Usa cookie HttpOnly.

### Response `200`

```json
{
  "accessToken": "jwt"
}
```

### Errores posibles

- `401 UNAUTHORIZED`

---

## 5.4 `POST /api/auth/logout`

### Request

Sin body obligatorio.

### Response `200`

```json
{
  "success": true
}
```

### Efecto esperado

- invalida refresh token actual
- limpia cookie

---

## 5.5 `GET /api/auth/me`

### Response `200`

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "USER"
}
```

---

## 6. Conversations

## 6.1 `POST /api/conversations`

### Request

```json
{
  "title": "Busqueda en Palermo"
}
```

### Regla

`title` puede ser opcional. Si no viene, el backend puede generar uno.

### Response `201`

```json
{
  "id": "uuid",
  "title": "Busqueda en Palermo",
  "status": "ACTIVE",
  "searchState": {
    "operation": null,
    "propertyTypes": [],
    "locations": [],
    "priceMin": null,
    "priceMax": null,
    "currency": null,
    "rooms": null,
    "bedrooms": null,
    "bathrooms": null,
    "areaMin": null,
    "areaMax": null,
    "expensesMax": null,
    "features": [],
    "sortPreference": null
  },
  "createdAt": "2026-04-07T12:00:00.000Z",
  "updatedAt": "2026-04-07T12:00:00.000Z"
}
```

---

## 6.2 `GET /api/conversations`

### Query params

- `page` opcional
- `limit` opcional

### Response `200`

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Busqueda en Palermo",
      "status": "ACTIVE",
      "lastSearchAt": "2026-04-07T12:10:00.000Z",
      "createdAt": "2026-04-07T12:00:00.000Z",
      "updatedAt": "2026-04-07T12:10:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

### Regla

Aunque haya pocas conversaciones, conviene paginar desde el inicio.

---

## 6.3 `GET /api/conversations/:id`

### Response `200`

```json
{
  "id": "uuid",
  "title": "Busqueda en Palermo",
  "status": "ACTIVE",
  "searchState": {
    "operation": "BUY",
    "propertyTypes": ["APARTMENT"],
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
    "features": ["BALCONY"],
    "sortPreference": "RELEVANCE"
  },
  "messages": [
    {
      "id": "uuid",
      "role": "USER",
      "content": "Busco un depto en Palermo",
      "createdAt": "2026-04-07T12:01:00.000Z"
    },
    {
      "id": "uuid",
      "role": "ASSISTANT",
      "content": "Mantengo Palermo y busco opciones.",
      "createdAt": "2026-04-07T12:01:03.000Z"
    }
  ],
  "lastSearchRun": {
    "id": "uuid",
    "status": "COMPLETED",
    "resultCount": 10,
    "createdAt": "2026-04-07T12:01:03.000Z"
  },
  "lastSearchResults": [
    {
      "propertyId": "uuid",
      "source": "zonaprop",
      "sourceUrl": "https://example.com/property",
      "title": "Departamento 2 ambientes en Palermo",
      "operation": "BUY",
      "propertyType": "APARTMENT",
      "price": 135000,
      "currency": "USD",
      "expenses": 120000,
      "city": "CABA",
      "neighborhood": "Palermo",
      "locationText": "Palermo, Capital Federal",
      "rooms": 2,
      "bedrooms": 1,
      "bathrooms": 1,
      "areaTotal": 48,
      "areaCovered": 44,
      "features": ["BALCONY"],
      "images": ["https://example.com/image.jpg"],
      "scrapedAt": "2026-04-07T12:01:05.000Z",
      "publishedAt": "2026-04-05T10:00:00.000Z",
      "rank": {
        "position": 1,
        "score": 0.94,
        "reasons": [
          "Coincide con tu zona",
          "Está dentro de tu presupuesto",
          "Tiene balcon"
        ]
      }
    }
  ],
  "createdAt": "2026-04-07T12:00:00.000Z",
  "updatedAt": "2026-04-07T12:10:00.000Z"
}
```

### Regla

Si el historial crece mucho, a futuro mensajes deberian paginarse. En MVP pueden venir embebidos inicialmente.

`lastSearchResults` permite rehidratar la vista de resultados cuando el usuario reabre una conversacion sin volver a disparar una busqueda.

---

## 7. Chat

## 7.1 `POST /api/conversations/:id/messages`

### Request

```json
{
  "message": "Manteneme Palermo y agregale balcon"
}
```

### Response `200`

```json
{
  "conversationId": "uuid",
  "assistantMessage": "Mantengo Palermo, agrego balcon y busco nuevas opciones.",
  "searchState": {
    "operation": "BUY",
    "propertyTypes": ["APARTMENT"],
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
    "features": ["BALCONY"],
    "sortPreference": "RELEVANCE"
  },
  "didSearch": true,
  "requiresClarification": false,
  "clarificationQuestion": null,
  "results": [
    {
      "propertyId": "uuid",
      "source": "zonaprop",
      "sourceUrl": "https://example.com/property",
      "title": "Departamento 2 ambientes en Palermo",
      "operation": "BUY",
      "propertyType": "APARTMENT",
      "price": 135000,
      "currency": "USD",
      "expenses": 120000,
      "city": "CABA",
      "neighborhood": "Palermo",
      "locationText": "Palermo, Capital Federal",
      "rooms": 2,
      "bedrooms": 1,
      "bathrooms": 1,
      "areaTotal": 48,
      "areaCovered": 44,
      "features": ["BALCONY"],
      "images": ["https://example.com/image.jpg"],
      "scrapedAt": "2026-04-07T12:01:05.000Z",
      "publishedAt": "2026-04-05T10:00:00.000Z",
      "rank": {
        "position": 1,
        "score": 0.94,
        "reasons": [
          "Coincide con tu zona",
          "Está dentro de tu presupuesto",
          "Tiene balcon"
        ]
      }
    }
  ],
  "meta": {
    "searchRunId": "uuid",
    "sourcesUsed": ["zonaprop", "argenprop"],
    "resultCount": 10
  }
}
```

### Response cuando falta aclaracion `200`

```json
{
  "conversationId": "uuid",
  "assistantMessage": "Necesito saber si buscás compra o alquiler.",
  "searchState": {
    "operation": null,
    "propertyTypes": [],
    "locations": ["Palermo"],
    "priceMin": null,
    "priceMax": null,
    "currency": null,
    "rooms": null,
    "bedrooms": null,
    "bathrooms": null,
    "areaMin": null,
    "areaMax": null,
    "expensesMax": null,
    "features": [],
    "sortPreference": null
  },
  "didSearch": false,
  "requiresClarification": true,
  "clarificationQuestion": "¿Buscás compra o alquiler?",
  "results": [],
  "meta": {
    "searchRunId": null,
    "sourcesUsed": [],
    "resultCount": 0
  }
}
```

### Errores posibles

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `404 NOT_FOUND`
- `429 RATE_LIMITED`
- `500 INTERNAL_ERROR`

### Regla

Aunque no haya busqueda, el backend debe devolver el `searchState` actualizado.

---

## 8. Favorites

## 8.1 `GET /api/favorites`

### Query params

- `page` opcional
- `limit` opcional

### Response `200`

```json
{
  "items": [
    {
      "favoriteId": "uuid",
      "createdAt": "2026-04-07T12:05:00.000Z",
      "property": {
        "propertyId": "uuid",
        "source": "zonaprop",
        "sourceUrl": "https://example.com/property",
        "title": "Departamento 2 ambientes en Palermo",
        "operation": "BUY",
        "propertyType": "APARTMENT",
        "price": 135000,
        "currency": "USD",
        "city": "CABA",
        "neighborhood": "Palermo",
        "listingStatus": "ACTIVE",
        "scrapedAt": "2026-04-07T12:01:05.000Z",
        "images": ["https://example.com/image.jpg"]
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

---

## 8.2 `POST /api/favorites`

### Request

```json
{
  "propertyId": "uuid"
}
```

### Response `201`

```json
{
  "favoriteId": "uuid",
  "propertyId": "uuid",
  "createdAt": "2026-04-07T12:05:00.000Z"
}
```

### Regla

Si el favorito ya existe, el endpoint puede:

- devolver `200` idempotente
- o `409 CONFLICT`

### Recomendacion

Usar `200` idempotente para una UX mas simple.

---

## 8.3 `DELETE /api/favorites/:propertyId`

### Response `200`

```json
{
  "success": true
}
```

---

## 9. Convenciones de paginacion

## 9.1 Estrategia recomendada en MVP

Paginacion simple por:

- `page`
- `limit`

## 9.2 Respuesta estandar

```json
{
  "items": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0
  }
}
```

### Motivo

Es mas simple para MVP. Cursor pagination puede venir despues si hace falta.

---

## 10. Convenciones de enums hacia frontend

## 10.1 Decision recomendada

El backend puede devolver enums canonicos en ingles y uppercase:

- `BUY`
- `RENT`
- `APARTMENT`
- `USD`

El frontend se ocupa de traducir etiquetas.

### Motivo

Mantiene consistencia con dominio interno.

---

## 11. Casos especiales de UX/API

## 11.1 Pocos resultados

Cuando haya pocos resultados, la respuesta de chat puede incluir:

- `assistantMessage` explicativo
- sugerencia de relajacion de filtros

No hace falta un campo extra de API en el MVP si eso se comunica en el texto.

## 11.2 Corrida parcial

Si una corrida es `partial`, la response igual puede ser `200` con resultados.

La degradacion se refleja en:

- `meta.sourcesUsed`
- mensaje assistant

---

## 12. Decisiones cerradas con este documento

- JSON uniforme en API
- auth por access token + refresh cookie
- errores con `statusCode`, `error`, `message`, `code`
- paginacion `page/limit`
- endpoint principal de chat ya definido
- `searchState` siempre vuelve en la respuesta del chat
- `results` y `meta` estandarizados
- favoritos idempotentes recomendados

---

## 13. Proximo paso

Con los contratos HTTP cerrados, lo siguiente recomendable es:

1. contrato exacto de IA
2. catalogos canonicos
3. reglas concretas de ranking y dedupe

Despues de eso, ya queda todo listo para empezar a escribir codigo con muy poca incertidumbre.
