# Tipos de Dominio MVP

## 1. Objetivo

Este documento define el lenguaje interno del sistema.

No describe tablas ni endpoints. Describe:

- que entidades conceptuales existen
- que campos tienen
- que valores son validos
- como se nombran internamente
- como manejar espanol e ingles sin duplicar el dominio

La regla principal es:

- el dominio interno usa valores canonicos estables
- la UI puede traducirlos
- la IA puede entender espanol e ingles

---

## 2. Estrategia de idioma

## 2.1 Decision

Si, el sistema puede ofrecer espanol e ingles.

Pero no conviene duplicar tipos de dominio en dos idiomas.

### Regla correcta

- enums internos y valores canonicos en ingles
- labels de frontend en espanol e ingles
- prompts y parsing de IA preparados para recibir consultas en ambos idiomas
- datos crudos de portales se guardan tal como vienen

## 2.2 Por que

Si el dominio interno mezcla idiomas, despues se complica:

- merge de filtros
- ranking
- normalizacion
- busqueda por features
- mantenimiento futuro

Por eso:

- internamente `apartment`
- en UI puede mostrarse `Departamento` o `Apartment`

## 2.3 Idioma del producto

Recomendacion:

- MVP con UI principal en espanol
- opcion futura o temprana de labels en ingles
- motor de interpretacion preparado para ambos idiomas desde el inicio

## 2.4 Donde vive esta preferencia

En el futuro puede agregarse a `users` un campo:

- `preferred_locale`: `es-AR | en`

No es obligatorio para cerrar el dominio base hoy.

---

## 3. Tipos principales de dominio

Los tipos base del MVP son:

- `SearchFilters`
- `SearchDecision`
- `PropertyListing`
- `SearchIntent`
- `RequestedAction`
- `OperationType`
- `PropertyType`
- `CurrencyCode`
- `SortPreference`
- `PropertyFeature`
- `SearchStateMergeOperation`

---

## 4. Enums canonicos

## 4.1 `OperationType`

```ts
type OperationType = "buy" | "rent";
```

### Semantica

- `buy`: compra
- `rent`: alquiler

---

## 4.2 `CurrencyCode`

```ts
type CurrencyCode = "USD" | "ARS";
```

### Semantica

- `USD`: dolares estadounidenses
- `ARS`: pesos argentinos

### Regla

Aunque muchas ventas sean en USD y muchos alquileres en ARS, el dominio no debe asumirlo como obligatorio.

Tiene que soportar:

- ventas en USD o ARS
- alquileres en ARS o USD

---

## 4.3 `PropertyType`

```ts
type PropertyType =
  | "apartment"
  | "house"
  | "ph"
  | "land"
  | "office"
  | "local"
  | "garage";
```

### Semantica

- `apartment`: departamento
- `house`: casa
- `ph`: propiedad horizontal
- `land`: terreno o lote
- `office`: oficina
- `local`: local comercial
- `garage`: cochera

---

## 4.4 `SortPreference`

```ts
type SortPreference =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "newest";
```

### Semantica

- `relevance`: prioridad por coincidencia general
- `price_asc`: menor precio primero
- `price_desc`: mayor precio primero
- `newest`: mas reciente primero

---

## 4.5 `PropertyFeature`

```ts
type PropertyFeature =
  | "balcony"
  | "terrace"
  | "patio"
  | "garage"
  | "pool"
  | "barbecue"
  | "gym"
  | "professional_use"
  | "mortgage_eligible"
  | "furnished"
  | "pets_allowed";
```

### Semantica

- `balcony`: balcon
- `terrace`: terraza
- `patio`: patio
- `garage`: cochera
- `pool`: pileta
- `barbecue`: parrilla
- `gym`: gimnasio
- `professional_use`: apto profesional
- `mortgage_eligible`: apto credito
- `furnished`: amoblado
- `pets_allowed`: acepta mascotas

### Regla

El sistema puede almacenar texto adicional de features en payloads crudos o normalizados, pero el ranking MVP solo debe confiar fuerte en este catalogo canonico.

---

## 4.6 `SearchIntent`

```ts
type SearchIntent =
  | "new_search"
  | "modify_search"
  | "clarify"
  | "show_more"
  | "compare"
  | "favorite"
  | "smalltalk";
```

### Regla

Aunque algunas capacidades se profundicen despues, conviene dejar estos intents desde ahora para no romper el contrato del sistema mas adelante.

---

## 4.7 `RequestedAction`

```ts
type RequestedAction = "search" | "compare" | "favorite" | "none";
```

---

## 5. `SearchFilters`

## 5.1 Definicion propuesta

```ts
type SearchFilters = {
  operation: OperationType | null;
  propertyTypes: PropertyType[];
  locations: string[];
  priceMin: number | null;
  priceMax: number | null;
  currency: CurrencyCode | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaMin: number | null;
  areaMax: number | null;
  expensesMax: number | null;
  features: PropertyFeature[];
  sortPreference: SortPreference | null;
};
```

## 5.2 Decisiones cerradas

- `operation` es singular
- `propertyTypes` es lista
- `locations` es lista de strings canonicos
- `currency` soporta `USD` y `ARS`
- `features` es lista canonica

## 5.3 Semantica de campos

### `operation`

Compra o alquiler.

### `propertyTypes`

Lista porque el usuario puede aceptar mas de un tipo:

- depto o PH
- casa o lote

### `locations`

Lista de strings canonicos de ubicacion de busqueda.

Para MVP en CABA, normalmente seran barrios:

- Palermo
- Caballito
- Belgrano

En el futuro podran representar ciudades o zonas mas amplias.

### `priceMin` y `priceMax`

Presupuesto minimo y maximo expresado en la `currency` elegida.

### `rooms`

Cantidad de ambientes.

### `bedrooms`

Cantidad de dormitorios.

### `bathrooms`

Cantidad de banos.

### `areaMin` y `areaMax`

Superficie minima y maxima.

### `expensesMax`

Limite superior de expensas si el usuario lo menciona.

### `features`

Lista de features canonicas deseadas.

### `sortPreference`

Preferencia de orden cuando el usuario la expresa.

---

## 6. `SearchDecision`

## 6.1 Definicion propuesta

```ts
type SearchDecision = {
  intent: SearchIntent;
  shouldSearch: boolean;
  requiresClarification: boolean;
  clarificationQuestion: string | null;
  userFacingMessage: string;
  filterPatch: Partial<SearchFilters>;
  filtersToUnset: (keyof SearchFilters)[];
  requestedAction: RequestedAction;
};
```

## 6.2 Regla clave

`SearchDecision` no aplica cambios por si solo.

Solo propone.

El backend:

- valida
- traduce a operaciones de merge
- actualiza el `SearchFilters`

## 6.3 Semantica de campos

### `intent`

Que intento detecto la IA.

### `shouldSearch`

Si corresponde correr una busqueda luego de aplicar cambios.

### `requiresClarification`

Si falta informacion esencial para continuar correctamente.

### `clarificationQuestion`

Pregunta concreta al usuario cuando falta claridad.

### `userFacingMessage`

Texto breve que el backend puede mostrar al usuario.

### `filterPatch`

Parche propuesto de filtros.

### `filtersToUnset`

Campos a limpiar.

### `requestedAction`

Accion pedida por el usuario.

---

## 7. `PropertyListing`

## 7.1 Definicion propuesta

```ts
type PropertyListing = {
  externalId: string | null;
  source: string;
  sourceUrl: string;
  title: string;
  description: string | null;
  operation: OperationType | null;
  propertyType: PropertyType | null;
  price: number | null;
  currency: CurrencyCode | null;
  expenses: number | null;
  country: string | null;
  province: string | null;
  city: string | null;
  neighborhood: string | null;
  locationText: string | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaTotal: number | null;
  areaCovered: number | null;
  features: PropertyFeature[];
  images: string[];
  publishedAt: string | null;
  scrapedAt: string;
};
```

## 7.2 Regla de ubicacion

Aunque el MVP arranque en CABA, el tipo ya debe soportar:

- pais
- provincia
- ciudad
- barrio
- texto libre

Asi no queda roto cuando se expanda a toda Argentina.

## 7.3 Regla de fuente

Toda propiedad debe conservar:

- origen
- URL original
- fecha de scrapeo

Eso es obligatorio para trazabilidad.

---

## 8. Operaciones de merge del dominio

## 8.1 Definicion propuesta

```ts
type SearchStateMergeOperation =
  | { type: "set_field"; field: keyof SearchFilters; value: unknown }
  | { type: "unset_field"; field: keyof SearchFilters }
  | { type: "replace_list"; field: "propertyTypes" | "locations" | "features"; value: unknown[] }
  | { type: "add_list_value"; field: "propertyTypes" | "locations" | "features"; value: unknown }
  | { type: "remove_list_value"; field: "propertyTypes" | "locations" | "features"; value: unknown };
```

## 8.2 Motivo

Esto evita merges ambiguos.

Ejemplos:

- "mejor Palermo" => reemplaza ubicacion
- "sumale balcon" => agrega feature
- "sin balcon" => elimina feature

---

## 9. Reglas de localizacion del producto

## 9.1 Regla de dominio

El dominio no se traduce.

Se localiza la presentacion.

## 9.2 Ejemplos

Interno:

- `buy`
- `apartment`
- `balcony`

UI en espanol:

- Comprar
- Departamento
- Balcon

UI en ingles:

- Buy
- Apartment
- Balcony

## 9.3 IA y lenguaje natural

La IA debe poder mapear frases como:

- "departamento en Palermo"
- "apartment in Palermo"
- "quiero algo con balcon"
- "I want something with a balcony"

hacia los mismos valores canonicos internos.

---

## 10. Decisiones cerradas con este documento

- dominio interno canonico en ingles
- soporte de UI y parsing en espanol e ingles
- `propertyTypes` como lista
- `locations` como lista
- `currency` en `USD | ARS`
- `sortPreference` en `relevance | price_asc | price_desc | newest`
- tipos de propiedad iniciales cerrados
- features canonicas iniciales cerradas
- `show_more`, `favorite` y `compare` quedan en `SearchIntent`

---

## 11. Proximo paso

Con esto ya se puede hacer una de estas dos cosas:

1. bajar estas definiciones a tipos TypeScript reales
2. traducirlas a schema Prisma y DTOs

La recomendacion es:

- primero revisar si este vocabulario de dominio cierra con negocio
- despues convertirlo en artefactos tecnicos reales
