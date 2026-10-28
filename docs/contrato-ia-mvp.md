# Contrato IA MVP

## 1. Objetivo

Este documento define como debe interactuar el backend con la IA en el MVP.

No define todavia el prompt exacto de produccion. Define:

- que responsabilidad tiene la IA
- que input recibe
- que output debe devolver
- como se valida
- que pasa si devuelve algo invalido
- como se maneja el contexto
- como se soporta espanol e ingles sin romper el dominio

La idea es que la IA quede acotada, util y predecible.

---

## 2. Rol de la IA

## 2.1 Responsabilidad real

La IA se usa para:

- interpretar el mensaje del usuario
- inferir la intencion
- proponer cambios estructurados de filtros
- detectar si falta aclaracion
- redactar una respuesta corta para el usuario

## 2.2 Lo que NO hace

La IA no:

- escribe en la base de datos
- hace scraping
- decide el estado final por su cuenta
- rankea resultados de forma definitiva
- inventa propiedades
- responde como si hubiese buscado cuando no se ejecuto una busqueda

## 2.3 Regla central

La IA propone.

El backend valida y decide.

---

## 3. Input minimo que recibe la IA

## 3.1 Campos recomendados

El backend debe enviar un payload conceptual equivalente a esto:

```json
{
  "userMessage": "Manteneme Palermo y agregale balcon",
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
    "features": [],
    "sortPreference": "RELEVANCE"
  },
  "recentContextSummary": "El usuario viene buscando departamento de 2 ambientes en Palermo para compra.",
  "allowedEnums": {
    "operations": ["BUY", "RENT"],
    "currencies": ["USD", "ARS"],
    "propertyTypes": ["APARTMENT", "HOUSE", "PH", "LAND", "OFFICE", "LOCAL", "GARAGE"],
    "features": ["BALCONY", "TERRACE", "PATIO", "GARAGE", "POOL", "BARBECUE", "GYM", "PROFESSIONAL_USE", "MORTGAGE_ELIGIBLE", "FURNISHED", "PETS_ALLOWED"],
    "sortPreferences": ["RELEVANCE", "PRICE_ASC", "PRICE_DESC", "NEWEST"]
  }
}
```

## 3.2 Regla de contexto

No mandar el historial completo del chat cada vez.

Mandar:

- mensaje actual
- `searchState`
- resumen corto del contexto reciente

## 3.3 Motivo

Esto:

- baja costo
- baja latencia
- reduce ruido
- mantiene control del backend

---

## 4. Estrategia de idioma

## 4.1 Decision

La IA debe poder entender entradas en:

- espanol
- ingles

## 4.2 Regla

Aunque entienda ambos idiomas, debe devolver valores canonicos del dominio interno.

### Ejemplos

- "departamento" => `APARTMENT`
- "apartment" => `APARTMENT`
- "balcon" => `BALCONY`
- "balcony" => `BALCONY`

## 4.3 Regla de salida

La salida estructurada debe usar solo enums canonicos definidos por el backend.

No debe inventar nuevos valores.

---

## 5. Output esperado de la IA

## 5.1 Estructura recomendada

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

## 5.2 Enums canonicos

### `SearchIntent`

- `NEW_SEARCH`
- `MODIFY_SEARCH`
- `CLARIFY`
- `SHOW_MORE`
- `COMPARE`
- `FAVORITE`
- `SMALLTALK`

### `RequestedAction`

- `SEARCH`
- `COMPARE`
- `FAVORITE`
- `NONE`

---

## 6. Semantica de los campos de salida

## 6.1 `intent`

Describe la naturaleza del mensaje.

## 6.2 `shouldSearch`

Indica si, despues de aplicar cambios, el backend deberia intentar una busqueda.

## 6.3 `requiresClarification`

Indica si falta informacion esencial para continuar correctamente.

## 6.4 `clarificationQuestion`

Pregunta concreta para pedir esa aclaracion.

## 6.5 `userFacingMessage`

Texto corto y operativo que el frontend mostrara al usuario.

### Regla

Debe ser:

- breve
- claro
- no teatral
- no excesivamente conversacional

## 6.6 `filterPatch`

Parche propuesto para filtros.

## 6.7 `filtersToUnset`

Lista de filtros que la IA considera que deben limpiarse.

## 6.8 `requestedAction`

Accion principal inferida del mensaje.

---

## 7. Reglas de comportamiento de la IA

## 7.1 Cuando pedir aclaracion

La IA debe marcar `requiresClarification = true` cuando falte un dato realmente esencial para continuar.

### Ejemplos razonables

- el usuario quiere buscar pero no queda claro si compra o alquiler
- pide "algo barato" sin zona ni contexto previo suficiente

### Regla

No pedir aclaracion por detalles menores si el backend ya puede avanzar con una busqueda razonable.

---

## 7.2 Cuando buscar

La IA puede sugerir `shouldSearch = true` cuando:

- el mensaje define una busqueda inicial util
- el mensaje modifica filtros y tiene sentido refrescar resultados
- el mensaje pide ver mas resultados

## 7.3 Cuando no buscar

- smalltalk
- aclaraciones pendientes
- mensajes que solo corrigen un detalle pero aun dejan ambiguedad esencial

---

## 7.4 Sobre resultados

La IA no debe mencionar propiedades especificas si el backend no se las paso.

### Regla

No puede inventar:

- barrios adicionales
- cantidades de resultados
- propiedades
- precios

---

## 8. Shape recomendado de `filterPatch`

## 8.1 Regla

`filterPatch` debe usar la estructura del dominio interno.

### Ejemplo valido

```json
{
  "locations": ["Palermo"],
  "features": ["BALCONY"]
}
```

### Ejemplo invalido

```json
{
  "zone": "Palermo Soho",
  "extra": "quiero algo lindo"
}
```

## 8.2 Regla de listas

La IA puede devolver listas en:

- `propertyTypes`
- `locations`
- `features`

El backend decide si eso implica `replace_list` o `add_list_value`.

---

## 9. Validacion de salida

## 9.1 Regla

Toda salida de IA debe validarse contra schema estricto.

## 9.2 Validaciones minimas

- enum valido
- tipos de dato correctos
- arrays donde corresponda
- no permitir claves desconocidas
- no permitir valores fuera de catalogo para enums conocidos

## 9.3 Si falla validacion

El backend no debe aplicar la salida ciegamente.

---

## 10. Fallback cuando la IA falla

## 10.1 Casos de falla

- JSON invalido
- schema invalido
- enum desconocido
- respuesta vacia
- timeout

## 10.2 Comportamiento recomendado

El backend debe responder con un fallback seguro.

### Fallback sugerido

```json
{
  "intent": "CLARIFY",
  "shouldSearch": false,
  "requiresClarification": true,
  "clarificationQuestion": "No entendí bien tu pedido. ¿Podés decirme zona, operación y tipo de propiedad?",
  "userFacingMessage": "No entendí bien tu pedido. ¿Podés decirme zona, operación y tipo de propiedad?",
  "filterPatch": {},
  "filtersToUnset": [],
  "requestedAction": "NONE"
}
```

## 10.3 Regla

Ante duda o salida invalida:

- no buscar
- no mutar agresivamente el estado
- pedir aclaracion

---

## 11. Resumen del contexto conversacional

## 11.1 Regla

No pasar todo el historial crudo al modelo.

## 11.2 Recomendacion

Mandar un `recentContextSummary` breve armado por el backend.

### Ejemplo

"El usuario busca compra de departamento en Palermo o Belgrano, hasta USD 140000, 2 ambientes, con balcon."

## 11.3 Motivo

- menos tokens
- menos ruido
- mas control

---

## 12. Estilo de `userFacingMessage`

## 12.1 Tono

- corto
- claro
- operativo

## 12.2 Ejemplos correctos

- "Mantengo Palermo, agrego balcon y busco nuevas opciones."
- "Necesito saber si buscás compra o alquiler."
- "Saco cochera y mantengo el tope en USD 140k."

## 12.3 Ejemplos incorrectos

- respuestas largas tipo asistente generalista
- frases ambiguas
- promesas sobre resultados no ejecutados

---

## 13. Decisiones cerradas con este contrato

- la IA interpreta, no decide sola
- input minimo: mensaje actual + search state + resumen corto
- soporte para espanol e ingles
- salida estructurada con enums canonicos
- schema estricto obligatorio
- fallback seguro cuando la salida falla
- `userFacingMessage` corto y operativo
- no mandar historial completo por default

---

## 14. Proximo paso

Con el contrato IA cerrado, los siguientes puntos naturales son:

1. catalogos canonicos
2. reglas concretas de ranking y dedupe

Despues de eso, la especificacion previa a implementacion queda practicamente completa.
