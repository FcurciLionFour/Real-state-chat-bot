# Reglas Finas de Datos y Lifecycle

## 1. Objetivo

Este documento cierra las decisiones finas de comportamiento de datos para el MVP.

No agrega nuevas entidades grandes. Define:

- como viven y evolucionan los datos
- que se guarda siempre
- que se considera vigente o vencido
- que hacer cuando una fuente falla
- como se conserva trazabilidad sin sobredisenar

Con este documento, la BBDD queda practicamente cerrada a nivel de diseño.

---

## 2. Principio general

La base de datos no debe guardar solo "estado feliz".

Tambien debe reflejar:

- busquedas fallidas
- datos parciales
- propiedades viejas
- favoritos sobre anuncios caidos

Eso hace al sistema mas robusto, mas auditable y mas creible.

---

## 3. Lifecycle de `search_states`

## 3.1 Que representa

`search_states` representa el estado actual de filtros de una conversacion.

No representa historial completo.

## 3.2 Regla del MVP

- una conversacion tiene un solo `search_state` vigente
- el estado se actualiza despues de cada mensaje relevante
- `version` aumenta cada vez que cambia el estado

## 3.3 Historial fino

### Decision

No se crea tabla de historial fino del `search_state` en el MVP.

### Motivo

- aumenta complejidad
- no es imprescindible para validar el producto
- el historial parcial ya queda trazado en mensajes y search runs

### Futuro

Si mas adelante hace falta, puede agregarse:

- `search_state_events`
- o `search_state_versions`

Pero no es necesario ahora.

---

## 4. Lifecycle de `messages`

## 4.1 Que se guarda siempre

Cada mensaje de usuario y assistant se persiste.

## 4.2 `structured_payload_json`

### Regla recomendada

- en mensajes `user`, normalmente `null`
- en mensajes `assistant`, guardar la salida estructurada validada de IA y metadata relevante

### Que puede incluir

- `searchDecision` validado
- `didSearch`
- `searchRunId`
- resumen de cambios aplicados

### Que no conviene hacer

- usarlo como bolsa desordenada de cualquier dato
- mezclar payloads incompatibles sin estructura

---

## 5. Lifecycle de `search_runs`

## 5.1 Cuando se crea un `search_run`

Se crea un `search_run` cada vez que el backend intenta una busqueda real.

### Esto incluye

- corridas exitosas
- corridas parciales
- corridas fallidas

## 5.2 Estados permitidos

Valores recomendados:

- `completed`
- `partial`
- `failed`

## 5.3 Semantica

### `completed`

La corrida termino y produjo resultados sin errores relevantes.

### `partial`

La corrida devolvio resultados, pero hubo fallos parciales:

- una fuente no respondio
- un portal devolvio HTML invalido
- algunas URLs fallaron

### `failed`

La corrida no pudo devolver resultados utilizables.

## 5.4 Regla de persistencia

Un `search_run` fallido igual se guarda.

### Motivo

- debugging
- observabilidad
- analitica
- explicabilidad de errores

## 5.5 `error_summary`

Cuando una corrida no es `completed`, se recomienda guardar un resumen tecnico breve y controlado.

No debe exponer secretos ni stack traces crudos.

---

## 6. Lifecycle de `properties_cache`

## 6.1 Que representa

Una propiedad ya extraida y normalizada desde una fuente real.

## 6.2 Problema

Una propiedad puede:

- seguir activa
- volverse vieja
- dejar de estar accesible
- cambiar su precio o datos

## 6.3 Decision

Conviene agregar una nocion de estado de vigencia interna.

### Estado recomendado

Agregar un campo futuro o conceptual:

- `listing_status`

Valores recomendados:

- `active`
- `stale`
- `removed`
- `fetch_failed`

## 6.4 Semantica

### `active`

La publicacion fue scrapeada recientemente y se considera usable.

### `stale`

La publicacion existe en cache, pero su informacion puede estar desactualizada.

### `removed`

La publicacion ya no esta disponible o su URL ya no responde como anuncio valido.

### `fetch_failed`

No se pudo refrescar recientemente, pero tampoco hay evidencia suficiente para marcarla como removida.

## 6.5 Regla MVP

Aunque `listing_status` todavia no este materializado en codigo, el modelo de negocio debe asumir esta semantica desde ahora.

---

## 7. Expiracion y frescura de propiedades

## 7.1 Regla conceptual

No toda propiedad vieja debe borrarse.

Hay que distinguir:

- persistencia historica
- frescura operativa

## 7.2 Recomendacion de frescura

### HTML cacheado

- vida corta
- pensado para evitar requests repetidos inmediatos

### propiedad normalizada

- vida mas larga
- sirve para favoritos, historial y dedupe

## 7.3 Decision MVP

- no borrar automaticamente propiedades viejas del cache principal
- marcar o tratar como `stale` cuando excedan la ventana de frescura operativa

## 7.4 Motivo

- evita perder favoritos
- conserva auditoria
- facilita dedupe futuro

---

## 8. Lifecycle de favoritos

## 8.1 Que referencia un favorito

Un favorito referencia `property_cache_id`.

## 8.2 Si la publicacion desaparece

### Decision

El favorito no se borra automaticamente.

### Comportamiento esperado

- el favorito sigue visible
- puede marcarse como desactualizado o inactivo
- el usuario mantiene historial de interes

## 8.3 Motivo

Borrar favoritos automaticamente rompe confianza y borra valor historico.

---

## 9. Persistencia de resultados por corrida

## 9.1 Que se persiste en MVP

Se persisten los resultados finales mostrados al usuario.

## 9.2 Que no conviene persistir ahora

- grandes lotes de candidatos no mostrados
- demasiada informacion intermedia irrelevante

## 9.3 Motivo

En MVP importa materializar:

- lo que el usuario realmente vio
- el orden final
- el score final

No hace falta guardar toda la cocina interna en la DB principal.

---

## 10. `show_more` y corridas relacionadas

## 10.1 Decision

`show_more` debe intentar trabajar sobre el mismo snapshot de filtros.

## 10.2 Regla

- si la fuente o pipeline permite paginacion sobre la misma corrida logica, usarla
- si no, crear nuevo `search_run` con el mismo snapshot y vincularlo con `parent_search_run_id`

## 10.3 Motivo

Esto conserva coherencia con lo que el usuario estaba viendo.

---

## 11. Fuentes fallidas

## 11.1 Regla

Una fuente caida no debe romper toda la experiencia.

## 11.2 Comportamiento esperado

- la corrida puede quedar `partial`
- se registran solo las fuentes que participaron bien
- se guarda resumen de error
- el usuario recibe respuesta clara, no tecnica

## 11.3 Motivo

En scraping real, la falla parcial no es excepcional. Es parte del sistema.

---

## 12. Canonicalizacion y catalogos

## 12.1 Regla

El sistema necesita catalogos canonicos para evitar ambiguedades.

## 12.2 Catalogos que conviene cerrar

- barrios de CABA
- `PropertyType`
- `PropertyFeature`
- monedas
- operaciones

## 12.3 Motivo

Sin catalogos canonicos, despues se rompe:

- merge de filtros
- ranking
- dedupe
- consistencia visual

---

## 13. Datos que deben ser siempre trazables

Toda propiedad devuelta debe poder rastrearse a:

- `source`
- `sourceUrl`
- `scrapedAt`

Toda corrida debe poder rastrearse a:

- `conversationId`
- snapshot de filtros
- fecha
- fuentes usadas
- resultados mostrados

Todo cambio importante de experiencia debe poder rastrearse a:

- mensaje del usuario
- decision estructurada de IA
- estado final aplicado

---

## 14. Reglas concretas cerradas

Con este documento quedan recomendadas estas decisiones:

1. `search_state` guarda solo estado actual, no historial fino en MVP
2. `messages.structured_payload_json` guarda payload estructurado relevante, especialmente en assistant
3. `search_runs` se guardan tambien cuando fallan
4. `properties_cache` no se borra automaticamente por vejez
5. una propiedad puede quedar conceptualmente `active`, `stale`, `removed` o `fetch_failed`
6. los favoritos sobreviven aunque la publicacion desaparezca
7. en MVP se persisten los resultados finales mostrados, no todos los candidatos intermedios
8. `show_more` mantiene el mismo snapshot de filtros
9. una fuente fallida degrada a `partial`, no necesariamente a fallo total
10. catalogos canonicos son obligatorios para consistencia

---

## 15. Estado de cierre de la BBDD

Con lo definido hasta ahora, la BBDD queda:

- cerrada en su estructura principal
- cerrada en relaciones y claves
- casi cerrada para schema Prisma

Lo que resta ya no es conceptual grande, sino traduccion tecnica:

- nombres finales de campos
- tipos Prisma exactos
- defaults concretos
- eventuales campos menores como `listing_status`

Eso ya es trabajo de schema, no de estrategia de datos.
