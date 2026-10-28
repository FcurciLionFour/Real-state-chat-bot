# Roadmap Final de Implementacion MVP

## 1. Objetivo

Este documento ordena la construccion real del proyecto en fases tecnicas.

La idea es:

- construir en el orden correcto
- reducir retrabajo
- validar primero el nucleo del producto
- evitar abrir demasiados frentes al mismo tiempo

Este roadmap no es comercial. Es un plan de ejecucion tecnica.

---

## 2. Principio de ejecucion

La prioridad no es tener muchas pantallas rapido.

La prioridad es validar bien el corazon del sistema:

- `search_state`
- loop conversacional
- pipeline de busqueda
- resultados trazables

---

## 3. Orden macro recomendado

1. base tecnica del backend
2. dominio y datos
3. loop conversacional con busqueda mock
4. auth y recursos de usuario
5. busqueda real con 1 fuente
6. ranking + dedupe reales
7. frontend usable
8. robustez y ampliacion de fuentes

---

## 4. Fase 0 - Setup tecnico base

## 4.1 Objetivo

Crear la base del proyecto backend para trabajar con orden.

## 4.2 Entregables

- backend NestJS creado
- estructura modular inicial
- configuracion de entorno
- Prisma conectado a PostgreSQL
- Redis disponible
- logging estructurado base
- validacion global de DTOs

## 4.3 Dependencias

- ninguna

## 4.4 Criterio de salida

La fase termina cuando:

- el backend levanta
- conecta DB
- conecta Redis
- tiene estructura base lista

---

## 5. Fase 1 - Dominio y datos

## 5.1 Objetivo

Materializar en codigo la base semantica ya definida.

## 5.2 Entregables

- `schema.prisma`
- migracion inicial
- tipos de dominio principales
- enums canonicos
- repositories base

## 5.3 Alcance

- `users`
- `refresh_tokens`
- `conversations`
- `messages`
- `search_states`
- `search_runs`
- `properties_cache`
- `search_run_properties`
- `favorites`

## 5.4 Criterio de salida

La fase termina cuando:

- DB esta migrada
- repositories principales funcionan
- relaciones y constraints estan validadas

---

## 6. Fase 2 - Search state y conversaciones

## 6.1 Objetivo

Validar el nucleo del producto sin depender todavia de scraping real.

## 6.2 Entregables

- modulo `conversations`
- modulo `messages`
- modulo `search-state`
- merge engine funcional
- endpoints de conversaciones
- endpoint `POST /conversations/:id/messages` con respuesta mock controlada

## 6.3 Regla

Todavia no hace falta busqueda real. Lo importante es que:

- el sistema entienda
- persista
- actualice estado correctamente

## 6.4 Criterio de salida

La fase termina cuando:

- un usuario puede crear conversacion
- mandar mensajes
- ver `searchState` cambiar correctamente
- ver respuestas del assistant coherentes

---

## 7. Fase 3 - Integracion con IA

## 7.1 Objetivo

Pasar de interpretacion mock a interpretacion real con OpenAI.

## 7.2 Entregables

- modulo `ai`
- prompt builder
- schema validator
- fallback seguro
- soporte espanol/ingles

## 7.3 Criterio de salida

La fase termina cuando:

- la IA devuelve `SearchDecision` valido
- el backend aplica merge correcto
- hay fallback seguro ante salida invalida

---

## 8. Fase 4 - Auth y favoritos

## 8.1 Objetivo

Habilitar la primera experiencia usable por usuario real.

## 8.2 Entregables

- `register`
- `login`
- `refresh`
- `logout`
- `me`
- guards de auth
- favoritos basicos

## 8.3 Criterio de salida

La fase termina cuando:

- un usuario puede autenticarse
- sus conversaciones quedan aisladas
- puede guardar y borrar favoritos

---

## 9. Fase 5 - Busqueda real con 1 fuente

## 9.1 Objetivo

Conectar el sistema a resultados reales.

## 9.2 Entregables

- query builder
- discovery engine
- allowlist de dominios
- fetch HTML
- adapter de 1 fuente principal
- `properties_cache`
- `search_runs`

## 9.3 Regla

No integrar varias fuentes a la vez.

## 9.4 Criterio de salida

La fase termina cuando:

- una busqueda devuelve propiedades reales
- quedan persistidas con trazabilidad
- el sistema tolera fallos controlados

---

## 10. Fase 6 - Dedupe y ranking reales

## 10.1 Objetivo

Mejorar calidad del resultado, no solo conectividad.

## 10.2 Entregables

- `DedupeService`
- `RankingService`
- persistencia de `rankReasonJson`
- explicaciones simples de relevancia

## 10.3 Criterio de salida

La fase termina cuando:

- los resultados dejan de ser solo "lo que se encontro"
- pasan a ser "lo mejor que coincide"

---

## 11. Fase 7 - Frontend usable

## 11.1 Objetivo

Construir una experiencia operativa real para el usuario.

## 11.2 Entregables

- pantalla de chat
- filtros activos visibles
- resultados visibles
- favoritos
- listado de conversaciones
- detalle de conversacion

## 11.3 Regla

La UI debe priorizar:

- claridad
- control
- trazabilidad

No chat decorativo.

## 11.4 Criterio de salida

La fase termina cuando:

- un usuario puede buscar, refinar, revisar resultados y guardar favoritos sin salir del flujo

---

## 12. Fase 8 - Robustez MVP

## 12.1 Objetivo

Hacer que el sistema soporte mejor uso real.

## 12.2 Entregables

- cache de resultados por filtros
- cache HTML
- rate limiting fino
- observabilidad completa MVP
- mejor manejo de errores
- tuning de tiempos y limites

## 12.3 Criterio de salida

La fase termina cuando:

- el sistema es depurable
- la latencia es razonable
- los fallos parciales no destruyen la UX

---

## 13. Fase 9 - Expansion de fuentes

## 13.1 Objetivo

Ampliar cobertura sin romper estabilidad.

## 13.2 Entregables

- 2da fuente
- ajuste de dedupe cross-source
- luego 3ra y 4ta fuente segun evidencia

## 13.3 Regla

Agregar una fuente a la vez.

## 13.4 Criterio de salida

La fase termina cuando:

- cada nueva fuente agrega valor real sin degradar demasiado la calidad

---

## 14. Dependencias criticas entre fases

- Fase 0 antes de todo
- Fase 1 antes de IA real
- Fase 2 antes de frontend serio
- Fase 3 antes de validar producto conversacional
- Fase 5 antes de decir que el MVP busca de verdad
- Fase 6 antes de hablar de calidad del buscador
- Fase 8 antes de abrir pruebas serias

---

## 15. Orden practico recomendado de ejecucion inmediata

Si hubiera que arrancar ya, el orden mas sano seria:

1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4
6. Fase 5
7. Fase 6
8. Fase 7
9. Fase 8
10. Fase 9

---

## 16. Que conviene testear en cada fase

## Fase 1

- schema y repositorios

## Fase 2

- merge de filtros
- persistencia de conversaciones

## Fase 3

- validacion de output IA
- fallback

## Fase 5

- adapter de fuente
- pipeline de corrida

## Fase 6

- dedupe
- ranking

## Fase 7

- flujo end to end usuario

---

## 17. Definicion practica de MVP listo

El MVP puede considerarse listo cuando:

1. el usuario se registra y entra
2. crea una conversacion
3. escribe en lenguaje natural
4. el backend mantiene `searchState`
5. se ejecuta busqueda real sobre al menos 1 fuente
6. los resultados salen normalizados y con fuente visible
7. el usuario puede refinar sin empezar de cero
8. el usuario puede guardar favoritos
9. el sistema tiene logs, rate limiting y fallbacks basicos

---

## 18. Que no conviene meter antes de validar el MVP

No recomiendo agregar antes:

- mapas
- simuladores
- analitica de mercado
- recomendaciones predictivas
- detector de estafas
- integraciones extras innecesarias
- workers complejos si todavia no hacen falta

---

## 19. Decision final del roadmap

La construccion correcta es:

- primero solidez del core
- despues resultados reales
- despues UX usable
- despues robustez
- despues expansion

No al reves.

---

## 20. Estado de cierre de la etapa de diseño

Con este roadmap y los documentos anteriores queda cerrada la etapa de especificacion funcional-tecnica del MVP en un nivel muy alto.

Lo que sigue ya no es pensar la arquitectura general.

Lo que sigue es:

- convertir estas decisiones en codigo real
- empezando por setup backend y schema Prisma
