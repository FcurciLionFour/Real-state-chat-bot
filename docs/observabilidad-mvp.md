# Observabilidad MVP

## 1. Objetivo

Este documento define la estrategia minima de observabilidad para el MVP.

El objetivo no es llenar el sistema de telemetria innecesaria. El objetivo es poder responder preguntas reales como:

- por que una busqueda devolvio pocos resultados
- por que una fuente fallo
- cuanto tarda cada etapa
- cuanto cuesta operativamente el flujo
- donde se esta rompiendo el producto

---

## 2. Principio general

Este producto va a ser dificil de depurar si no deja rastros claros.

La observabilidad minima tiene que cubrir:

- request
- usuario
- conversacion
- corrida de busqueda
- fuente
- tiempos por etapa

---

## 3. Logging estructurado

## 3.1 Regla

Los logs deben ser estructurados, no texto libre improvisado.

### Formato recomendado

- JSON logs

## 3.2 Campos base recomendados

Cada log relevante deberia poder incluir:

- `timestamp`
- `level`
- `message`
- `requestId`
- `userId` cuando exista
- `conversationId` cuando exista
- `searchRunId` cuando exista
- `module`
- `action`

## 3.3 Regla

No hace falta que todos los logs tengan todos los campos, pero el formato debe permitirlo.

---

## 4. Request ID y correlacion

## 4.1 Regla

Cada request HTTP debe tener un `requestId`.

## 4.2 Comportamiento recomendado

- si el request ya trae un id confiable, reutilizarlo
- si no, generarlo en backend

## 4.3 Motivo

Permite seguir el flujo completo de:

- entrada API
- llamada a IA
- corrida de busqueda
- fallos por fuente

---

## 5. Trazabilidad por dominio

## 5.1 `conversationId`

Todo log relacionado al chat debe incluir `conversationId` cuando exista.

## 5.2 `searchRunId`

Todo log del pipeline de busqueda debe incluir `searchRunId`.

## 5.3 `source`

Todo fallo o exito de scraping debe incluir nombre de fuente.

---

## 6. Eventos de negocio que conviene loguear

## 6.1 Auth

- register exitoso
- login exitoso
- login fallido
- refresh
- logout

## 6.2 Conversations

- conversacion creada
- conversacion consultada

## 6.3 Chat

- mensaje recibido
- decision IA validada
- fallback de IA activado
- merge de search state aplicado
- aclaracion requerida

## 6.4 Search

- corrida iniciada
- discovery ejecutado
- cantidad de URLs candidatas
- cantidad de URLs descartadas
- cantidad de propiedades normalizadas
- cantidad de duplicados eliminados
- corrida completada o parcial o fallida

## 6.5 Favorites

- favorito agregado
- favorito eliminado

---

## 7. Tiempos por etapa

## 7.1 Regla

No alcanza con medir tiempo total del request.

Hay que medir tiempo por etapa.

## 7.2 Etapas recomendadas para medir

- validacion inicial
- consulta a IA
- merge de search state
- query builder
- discovery
- fetch HTML
- parsing/extraccion
- dedupe
- ranking
- persistencia de `search_run`
- tiempo total del request

## 7.3 Motivo

Permite ver:

- si OpenAI esta lento
- si el cuello esta en discovery
- si el problema es scraping
- si la DB esta penalizando

---

## 8. Metricas operativas recomendadas

## 8.1 Chat

- cantidad de mensajes por conversacion
- porcentaje de mensajes que disparan busqueda
- porcentaje de mensajes que requieren aclaracion
- porcentaje de fallbacks de IA

## 8.2 Search

- tiempo medio de busqueda total
- tiempo medio por fuente
- cantidad media de URLs candidatas por corrida
- cantidad media de propiedades validas por corrida
- cantidad de duplicados eliminados
- porcentaje de corridas `completed`
- porcentaje de corridas `partial`
- porcentaje de corridas `failed`

## 8.3 Datos

- porcentaje de propiedades sin precio
- porcentaje de propiedades sin barrio normalizado
- porcentaje de propiedades con tipo nulo
- porcentaje de resultados stale

## 8.4 Producto

- favoritos por usuario
- conversaciones activas
- cantidad de resultados por corrida
- cantidad de veces que `show_more` se usa

---

## 9. Errores por fuente

## 9.1 Regla

Cada error por fuente debe poder clasificarse.

## 9.2 Tipos recomendados

- timeout
- url_descartada
- html_invalido
- selector_roto
- fetch_failed
- blocked
- normalization_failed

## 9.3 Motivo

Si no se clasifican, despues todo termina en:

- "la fuente fallo"

y eso no sirve para operar.

---

## 10. Logs que no conviene emitir

No loguear:

- passwords
- refresh tokens
- access tokens completos
- cookies sensibles
- API keys
- HTML completo de paginas
- payloads gigantes sin necesidad

## 10.1 Recomendacion

Loguear resumenes y metadatos, no blobs enteros.

---

## 11. Observabilidad de la IA

## 11.1 Que conviene registrar

- modelo usado
- tiempo de respuesta
- si la salida valido o no
- si se uso fallback

## 11.2 Que no conviene registrar crudo siempre

- prompts completos gigantes
- outputs completos si contienen demasiado ruido

## 11.3 Recomendacion

Guardar:

- version de prompt o `promptTemplateId`
- resumen de contexto
- decision validada

Eso suele ser mas util que loguear todo el prompt textual completo cada vez.

---

## 12. Observabilidad del scraping

## 12.1 Por cada corrida conviene conocer

- cuantas URLs entraron
- cuantas pasaron allowlist
- cuantas se fetchearon
- cuantas extrajeron propiedad valida
- cuantas quedaron nulas
- cuantos duplicados se descartaron

## 12.2 Por fuente conviene conocer

- latencia media
- tasa de fallo
- tasa de HTML invalido
- tasa de propiedad valida

---

## 13. Nivel minimo de dashboard mental

Aunque al inicio no haya dashboards sofisticados, el sistema deberia permitir reconstruir:

1. request recibido
2. decision de IA
3. estado aplicado
4. si hubo busqueda
5. que fuentes participaron
6. que resultados se mostraron

Si eso no puede reconstruirse, la observabilidad es insuficiente.

---

## 14. Alertas operativas futuras

No hace falta montar alertas complejas en MVP, pero conviene pensar despues en:

- subida fuerte de `failed search runs`
- caida de una fuente
- aumento de latencia total
- aumento de fallbacks de IA

---

## 15. Decision de implementacion recomendada

Para MVP, alcanza con:

- logger estructurado
- request id middleware
- logs por etapa
- metricas simples agregables

No hace falta empezar con un stack de observabilidad enorme si todavia no aporta valor.

---

## 16. Checklist minima de observabilidad MVP

Antes de considerar el backend listo para pruebas serias, deberia tener:

1. requestId por request
2. logs estructurados
3. `conversationId` en logs de chat
4. `searchRunId` en logs de search
5. tiempo total del request
6. tiempo por consulta a IA
7. tiempo por discovery
8. tiempo por scraping/parsing
9. clasificacion de errores por fuente
10. registro de fallback de IA

---

## 17. Decisiones cerradas con este documento

- logs estructurados obligatorios
- request id obligatorio
- trazabilidad por `conversationId` y `searchRunId`
- tiempos por etapa obligatorios
- metricas de chat, search y calidad de datos
- errores por fuente clasificados
- no loguear secretos ni blobs gigantes

---

## 18. Proximo paso

Con observabilidad definida, el siguiente bloque natural es:

- roadmap final de implementacion

Despues de eso, la etapa de definicion previa a codigo queda esencialmente cerrada.
