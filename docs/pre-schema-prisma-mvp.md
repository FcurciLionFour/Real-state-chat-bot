# Pre Schema Prisma MVP

## 1. Objetivo

Este documento traduce la arquitectura de datos a una version casi ejecutable en Prisma.

No es todavia el `schema.prisma` final, pero ya define:

- modelos
- enums
- campos
- nullability
- relaciones
- indices
- uniques
- defaults recomendados

La idea es que despues el paso a Prisma sea mecanico, no conceptual.

---

## 2. Convenciones generales

## 2.1 IDs

- todos los modelos usan `String @id @default(uuid())`

## 2.2 Timestamps

### Regla

- `createdAt` con `@default(now())`
- `updatedAt` con `@updatedAt` cuando corresponda

## 2.3 Naming

### Recomendacion Prisma

- modelos en singular y PascalCase
- campos en camelCase
- enums en PascalCase
- valores de enum en UPPER_SNAKE_CASE o Pascal segun criterio uniforme

Para este proyecto recomiendo:

- modelos PascalCase
- campos camelCase
- enums PascalCase
- valores de enums en UPPER_SNAKE_CASE

---

## 3. Enums recomendados

## 3.1 `UserRole`

```prisma
enum UserRole {
  USER
  ADMIN
}
```

## 3.2 `ConversationStatus`

```prisma
enum ConversationStatus {
  ACTIVE
  ARCHIVED
}
```

## 3.3 `MessageRole`

```prisma
enum MessageRole {
  USER
  ASSISTANT
  SYSTEM
}
```

## 3.4 `OperationType`

```prisma
enum OperationType {
  BUY
  RENT
}
```

## 3.5 `CurrencyCode`

```prisma
enum CurrencyCode {
  USD
  ARS
}
```

## 3.6 `PropertyType`

```prisma
enum PropertyType {
  APARTMENT
  HOUSE
  PH
  LAND
  OFFICE
  LOCAL
  GARAGE
}
```

## 3.7 `SearchRunStatus`

```prisma
enum SearchRunStatus {
  COMPLETED
  PARTIAL
  FAILED
}
```

## 3.8 `ListingStatus`

```prisma
enum ListingStatus {
  ACTIVE
  STALE
  REMOVED
  FETCH_FAILED
}
```

### Nota

Este enum ya conviene dejarlo en el pre-schema aunque al principio el uso sea simple.

---

## 4. Modelos Prisma recomendados

## 4.1 `User`

```prisma
model User {
  id            String          @id @default(uuid())
  email         String          @unique
  passwordHash  String
  role          UserRole        @default(USER)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  conversations Conversation[]
  refreshTokens RefreshToken[]
  favorites     Favorite[]
}
```

### Notas

- `email` unico
- `passwordHash` obligatorio

---

## 4.2 `RefreshToken`

```prisma
model RefreshToken {
  id          String    @id @default(uuid())
  userId      String
  tokenHash   String    @unique
  deviceLabel String?
  userAgent   String?
  ipAddress   String?
  expiresAt   DateTime
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

### Notas

- guardar hash, no token plano

---

## 4.3 `Conversation`

```prisma
model Conversation {
  id            String              @id @default(uuid())
  userId        String
  title         String
  status        ConversationStatus  @default(ACTIVE)
  lastSearchAt  DateTime?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  user          User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages      Message[]
  searchState   SearchState?
  searchRuns    SearchRun[]

  @@index([userId])
  @@index([userId, updatedAt(sort: Desc)])
}
```

### Nota

- `searchState` es 1:1 logico

---

## 4.4 `Message`

```prisma
model Message {
  id                    String      @id @default(uuid())
  conversationId        String
  role                  MessageRole
  content               String
  structuredPayloadJson Json?
  createdAt             DateTime    @default(now())

  conversation          Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@index([conversationId, createdAt(sort: Asc)])
}
```

### Nota

- `structuredPayloadJson` permite guardar `SearchDecision` validado y metadata

---

## 4.5 `SearchState`

```prisma
model SearchState {
  id          String    @id @default(uuid())
  conversationId String @unique
  filtersJson Json
  version     Int       @default(1)
  updatedAt   DateTime  @updatedAt

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([updatedAt])
}
```

### Nota

- un solo estado actual por conversacion

---

## 4.6 `SearchRun`

```prisma
model SearchRun {
  id                  String           @id @default(uuid())
  conversationId      String
  parentSearchRunId   String?
  filtersSnapshotJson Json
  queryText           String
  requestedPage       Int              @default(1)
  resultCount         Int              @default(0)
  sourcesUsedJson     Json
  status              SearchRunStatus
  errorSummary        String?
  createdAt           DateTime         @default(now())

  conversation        Conversation     @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  parentSearchRun     SearchRun?       @relation("SearchRunToSearchRun", fields: [parentSearchRunId], references: [id], onDelete: SetNull)
  childSearchRuns     SearchRun[]      @relation("SearchRunToSearchRun")
  results             SearchRunProperty[]

  @@index([conversationId])
  @@index([conversationId, createdAt(sort: Desc)])
  @@index([status])
  @@index([parentSearchRunId])
}
```

### Nota

- `parentSearchRunId` soporta `show_more` o reruns encadenados

---

## 4.7 `PropertyCache`

```prisma
model PropertyCache {
  id                    String         @id @default(uuid())
  source                String
  externalId            String?
  sourceUrl             String         @unique
  canonicalHash         String
  rawPayloadJson        Json
  normalizedPayloadJson Json
  title                 String
  description           String?
  country               String?
  province              String?
  city                  String?
  neighborhood          String?
  locationText          String?
  operation             OperationType?
  propertyType          PropertyType?
  priceAmount           Decimal?
  priceCurrency         CurrencyCode?
  expensesAmount        Decimal?
  rooms                 Decimal?
  bedrooms              Int?
  bathrooms             Int?
  areaTotal             Decimal?
  areaCovered           Decimal?
  featuresJson          Json
  imagesJson            Json
  listingStatus         ListingStatus  @default(ACTIVE)
  publishedAt           DateTime?
  scrapedAt             DateTime
  expiresAt             DateTime?
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  searchRunProperties   SearchRunProperty[]
  favorites             Favorite[]

  @@unique([source, externalId])
  @@index([canonicalHash])
  @@index([source, externalId])
  @@index([city, neighborhood])
  @@index([operation, propertyType])
  @@index([priceCurrency, priceAmount])
  @@index([scrapedAt(sort: Desc)])
  @@index([listingStatus])
}
```

### Nota importante

En Prisma, `@@unique([source, externalId])` con `externalId` nullable puede requerir ajuste segun motor o estrategia exacta. Si genera problemas practicos, se resuelve en implementacion con:

- unique parcial a nivel SQL manual
- o eliminando esa unique y confiando en `sourceUrl` + reglas de upsert

Conceptualmente, igual conviene dejarlo expresado.

---

## 4.8 `SearchRunProperty`

```prisma
model SearchRunProperty {
  id              String       @id @default(uuid())
  searchRunId     String
  propertyCacheId String
  position        Int
  rankScore       Decimal
  rankReasonJson  Json
  createdAt       DateTime     @default(now())

  searchRun       SearchRun    @relation(fields: [searchRunId], references: [id], onDelete: Cascade)
  propertyCache   PropertyCache @relation(fields: [propertyCacheId], references: [id], onDelete: Cascade)

  @@unique([searchRunId, propertyCacheId])
  @@unique([searchRunId, position])
  @@index([propertyCacheId])
}
```

### Nota

- materializa exactamente el resultado mostrado y su orden

---

## 4.9 `Favorite`

```prisma
model Favorite {
  id              String        @id @default(uuid())
  userId          String
  propertyCacheId String
  createdAt       DateTime      @default(now())

  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  propertyCache   PropertyCache @relation(fields: [propertyCacheId], references: [id], onDelete: Cascade)

  @@unique([userId, propertyCacheId])
  @@index([userId])
}
```

---

## 5. Relaciones cerradas

## 5.1 Relaciones 1:N

- `User -> Conversation`
- `User -> RefreshToken`
- `Conversation -> Message`
- `Conversation -> SearchRun`
- `SearchRun -> SearchRunProperty`
- `PropertyCache -> SearchRunProperty`
- `User -> Favorite`
- `PropertyCache -> Favorite`

## 5.2 Relaciones 1:1

- `Conversation -> SearchState`

## 5.3 Autorelacion

- `SearchRun -> parentSearchRun`

---

## 6. Campos JSON que quedan confirmados

Se recomienda mantener como `Json` en Prisma:

- `Message.structuredPayloadJson`
- `SearchState.filtersJson`
- `SearchRun.filtersSnapshotJson`
- `SearchRun.sourcesUsedJson`
- `PropertyCache.rawPayloadJson`
- `PropertyCache.normalizedPayloadJson`
- `PropertyCache.featuresJson`
- `PropertyCache.imagesJson`
- `SearchRunProperty.rankReasonJson`

### Motivo

Dan flexibilidad donde el esquema puede evolucionar sin romper el modelo relacional.

---

## 7. Campos que conviene mantener denormalizados

Aunque hay payloads JSON, estos campos deben seguir en columnas:

- `source`
- `sourceUrl`
- `country`
- `province`
- `city`
- `neighborhood`
- `operation`
- `propertyType`
- `priceAmount`
- `priceCurrency`
- `listingStatus`
- `scrapedAt`

### Motivo

Mejoran:

- indices
- filtros
- auditoria
- debugging

---

## 8. Puntos de atencion al pasar a Prisma real

## 8.1 `Decimal`

Conviene usar `Decimal` en:

- `priceAmount`
- `expensesAmount`
- `areaTotal`
- `areaCovered`
- `rankScore`
- `rooms` si quieren permitir medios ambientes

## 8.2 `Json`

Prisma soporta `Json`, pero conviene mantener una disciplina fuerte de contratos en TypeScript para no degradar integridad semantica.

## 8.3 Unique parcial de `externalId`

Este es el punto tecnico mas delicado del pre-schema.

Conceptualmente:

- un anuncio deberia ser unico por `source + externalId` cuando `externalId` exista

Pragmaticamente:

- `sourceUrl` sigue siendo la unique fuerte mas segura del MVP

---

## 9. Decisiones ya cerradas con este pre-schema

- UUID en todos los modelos
- Postgres como base principal
- `SearchState` 1:1 con `Conversation`
- `SearchRun` persiste corridas incluso fallidas
- `PropertyCache` con JSON + columnas denormalizadas
- `Favorite` contra `propertyCacheId`
- `RefreshToken` persistido y hasheado
- `ListingStatus` agregado al modelo
- soporte para `show_more` con `parentSearchRunId`

---

## 10. Lo que queda despues de este documento

Con esto, el siguiente paso ya no es conceptual de datos.

Lo que sigue es:

1. contratos HTTP exactos
2. contrato exacto de IA
3. catalogos canonicos
4. reglas concretas de ranking y dedupe
5. luego si, `schema.prisma`

El pre-schema deja la base lista para bajar a implementacion.
