# Plan de Construccion MVP - Buscador Inmobiliario Conversacional

## 1. Objetivo de este documento

Este documento resume las decisiones base ya acordadas para el MVP y deja explicitado:

- que partes del sistema van a existir
- que componentes tienen costo
- como se reparte la responsabilidad entre IA, backend, base de datos y fuentes externas
- que definiciones faltan para cerrar el diseno de BBDD y logica de negocio del backend

La idea es usar este archivo como base de trabajo interna y tambien como documento simple para alinear a negocio.

---

## 2. Resumen ejecutivo

El producto no debe construirse como un chatbot generico. Debe construirse como un motor de busqueda inmobiliaria con interfaz conversacional.

La regla central es:

- la IA interpreta el mensaje del usuario
- el backend conserva la verdad del estado de busqueda
- las fuentes externas entregan datos reales
- la base de datos persiste conversaciones, estado, resultados y favoritos

La conversacion es solo la interfaz. El corazon del sistema es el `search state` y el pipeline de busqueda.

### Norte de producto

Aunque el MVP arranca acotado en CABA y con decenas de usuarios, el objetivo de negocio es:

- escalar a miles de usuarios
- cubrir toda Argentina
- incorporar mas fuentes y mas modos de operacion

Esto implica que el MVP no debe resolverse con atajos que despues bloqueen crecimiento. El alcance inicial es chico, pero la arquitectura debe quedar preparada para expansion territorial, aumento de trafico y multiplicacion de fuentes.

---

## 3. Que va a tener el MVP

### Incluido

- chat de busqueda inmobiliaria
- interpretacion de mensajes con IA
- estado de busqueda persistente por conversacion
- busqueda real sobre pocas fuentes
- resultados normalizados
- deduplicacion basica
- ranking explicable
- favoritos
- historial de conversaciones
- auth basica

### Excluido al inicio

- mapas
- recomendaciones avanzadas
- notificaciones
- cobertura nacional amplia
- scraping de redes sociales
- analitica avanzada
- matching predictivo

---

## 4. Como funciona el sistema a alto nivel

### Flujo base

1. el usuario escribe un mensaje
2. el backend carga la conversacion y el `search state`
3. el backend llama a OpenAI para interpretar la intencion y proponer cambios estructurados
4. el backend valida la salida contra schema
5. el backend aplica merge seguro sobre el `search state`
6. el backend decide si corresponde buscar o si antes falta aclaracion
7. si hay busqueda, ejecuta discovery y scraping controlado
8. el backend normaliza, deduplica y rankea resultados
9. el backend persiste mensajes, estado y corrida de busqueda
10. el frontend muestra respuesta, filtros activos y resultados

### Regla operativa

La IA no puede:

- escribir en base de datos
- hacer scraping por su cuenta
- decidir sola el estado final
- inventar propiedades

El backend si puede:

- validar contratos
- mergear filtros
- decidir si corre herramientas
- llamar fuentes externas
- guardar resultados

---

## 5. Que se paga y por que

## 5.1 OpenAI API

Se usa para interpretar mensajes del usuario y devolver estructura valida.

No se usa para:

- buscar propiedades reales
- guardar datos
- rankear de forma deterministica
- reemplazar la base de datos

### Que se paga

- consumo de tokens de entrada
- consumo de tokens de salida

### Que consume tokens

- mensaje del usuario
- parte del contexto conversacional
- `search state` actual
- instrucciones del sistema
- respuesta estructurada del modelo

### Regla de control de costo

No mandar a la IA todo el historial si el backend ya tiene el estado estructurado. La IA interpreta. El backend conserva la verdad.

## 5.2 Discovery de URLs

Se necesita una capa de discovery para encontrar publicaciones reales candidatas. Esto puede resolverse con Google Programmable Search API o una alternativa similar.

### Que se paga

- consultas al motor de discovery

### Por que existe

- para encontrar URLs reales en dominios permitidos
- para no depender de resultados inventados

## 5.3 Scraping y extraccion

Se necesita una capa para entrar a los anuncios y extraer datos estructurados.

### Que se paga

- infraestructura
- potencialmente proxies o herramientas anti-bot si el volumen sube

### Por que existe

- para transformar paginas HTML en `PropertyListing`

## 5.4 Base de datos

Se necesita persistencia para:

- usuarios
- conversaciones
- mensajes
- search state
- search runs
- cache de propiedades
- favoritos

## 5.5 Hosting backend

El backend es el cerebro operativo. Orquesta IA, estado, herramientas, integraciones externas y persistencia.

## 5.6 Hosting frontend

El frontend muestra chat, filtros activos, resultados, favoritos e historial.

## 5.7 Dominio

Se necesita un dominio para publicar el producto con una URL propia.

## 5.8 Cache y observabilidad

Redis y herramientas de logs/metricas no son estrictamente obligatorios el dia 1, pero ayudan a bajar costo operativo y a depurar el sistema.

---

## 6. Mapa funcional del backend

### Capa de dominio

Define:

- `SearchFilters`
- `SearchDecision`
- `PropertyListing`
- reglas de merge
- reglas de ranking
- reglas de deduplicacion

### Capa de aplicacion

Orquesta casos de uso:

- crear conversacion
- enviar mensaje
- actualizar estado de busqueda
- ejecutar busqueda
- listar resultados de una corrida
- guardar favorito
- quitar favorito

### Capa de integraciones

Contiene:

- cliente OpenAI
- discovery engine
- adapters por fuente inmobiliaria
- fetchers HTML

### Capa de persistencia

Contiene:

- Prisma
- repositorios
- cache de propiedades
- search runs

---

## 7. Mapa preliminar de BBDD

### `users`

- id
- email
- password_hash
- created_at
- updated_at

### `conversations`

- id
- user_id
- title
- last_search_at
- created_at
- updated_at

### `messages`

- id
- conversation_id
- role
- content
- structured_payload_json
- created_at

### `search_states`

- id
- conversation_id
- filters_json
- version
- updated_at

### `search_runs`

- id
- conversation_id
- query_text
- filters_snapshot_json
- result_count
- created_at

### `properties_cache`

- id
- source
- external_id
- source_url
- canonical_hash
- raw_payload_json
- normalized_payload_json
- scraped_at
- expires_at
- created_at

### `search_run_properties`

- id
- search_run_id
- property_cache_id
- rank_score
- rank_reason_json

### `favorites`

- id
- user_id
- property_cache_id
- created_at

### `sessions` o `refresh_tokens`

- pendiente de definir segun estrategia de auth

---

## 8. Mapa preliminar de logica de negocio

## 8.1 Search state

Cada conversacion tiene un unico estado estructurado de busqueda. Ese estado es la fuente de verdad de lo que el usuario esta buscando.

### Reglas base

- se actualiza con cada mensaje relevante
- se persiste por conversacion
- admite cambios parciales
- admite reset parcial o total
- ninguna busqueda corre sin pasar por este estado

## 8.2 Interpretacion con IA

La IA debe devolver una estructura valida, no texto libre para la logica.

Campos minimos:

- `intent`
- `shouldSearch`
- `requiresClarification`
- `clarificationQuestion`
- `userFacingMessage`
- `filterPatch`
- `filtersToUnset`
- `requestedAction`

## 8.3 Merge de filtros

No conviene un merge ingenuo de JSON. Tiene que existir una funcion de dominio explicita que resuelva:

- reemplazos
- agregados
- eliminaciones
- resets
- conflictos entre filtros

## 8.4 Busqueda

El backend construye la query desde `SearchFilters`, ejecuta discovery, filtra dominios validos, scrapea, normaliza, deduplica y rankea.

## 8.5 Ranking

El ranking inicial debe ser explicable. Factores base:

- ubicacion
- presupuesto
- ambientes
- features
- completitud del anuncio
- actualidad del dato

## 8.6 Favoritos

Favoritos no deben depender del chat. Deben colgar de `user_id` y `property_cache_id`.

---

## 9. Orden de construccion recomendado

1. definir contratos de dominio
2. definir schema de base de datos
3. cerrar reglas de merge y decisiones del orquestador
4. crear endpoint conversacional con resultados mock
5. conectar OpenAI con schema estricto
6. agregar discovery y primera fuente real
7. agregar dedupe y ranking
8. construir frontend usable
9. sumar auth y favoritos completos

---

## 10. Definiciones que faltan antes de escribir codigo

Para poder bajar esto a BBDD y backend sin improvisar, faltan decisiones de producto y operacion.

## 10.1 Decisiones ya tomadas

### Ambito geografico inicial

- MVP inicial en CABA solamente
- expansion a toda Argentina despues de validar el MVP

### Operaciones soportadas

- `buy`
- `rent`
- otros modos quedan fuera del MVP

### Prioridad del primer release usable

- chat
- busqueda mock
- search state
- auth
- favoritos
- historial

### Volumen esperado

- decenas de usuarios

### Objetivo de largo plazo

- miles de usuarios
- cobertura nacional
- mas fuentes inmobiliarias
- mas modos y filtros de busqueda

## 10.2 Decisiones recomendadas para cerrar ahora

### Tipos de propiedad soportados

Producto quiere abrir el abanico amplio desde el inicio. Tecnica y operativamente, la recomendacion es:

- el modelo de datos soporta todos los tipos relevantes
- la experiencia MVP optimiza principalmente para `apartment`, `house`, `ph`, `office`, `local`, `land`, `garage`

Motivo:

- el costo no esta en el espacio de base de datos
- el costo esta en normalizacion, ranking, parsing, filtros y calidad de resultados

### Filtros MVP

Producto quiere contemplar todos los filtros posibles. La recomendacion operativa es separar entre:

- filtros de primera clase soportados por IA, backend y ranking desde el inicio
- filtros secundarios que pueden almacenarse como features o metadata sin prometer precision total desde fase 1

#### Filtros de primera clase recomendados para MVP

- `operation`
- `propertyType`
- `locations`
- `priceMin`
- `priceMax`
- `currency`
- `rooms`
- `bedrooms`
- `bathrooms`
- `areaMin`
- `areaMax`
- `expensesMax`
- `features`
- `sortPreference`

#### Features iniciales sugeridas

- balcon
- terraza
- patio
- cochera
- pileta
- parrilla
- gimnasio
- apto profesional
- apto credito
- amoblado
- acepta mascotas

### Semantica de ubicacion

Para CABA, la recomendacion es:

- mantener `locations` como lista de strings canonicos de barrios
- guardar tambien `locationText` libre en resultados
- normalizar cada anuncio a `city = CABA` y `neighborhood = barrio`

Esto simplifica mucho el MVP y evita sobredisenar jerarquias territoriales antes de tiempo.

Pero para no bloquear la expansion nacional, el modelo interno de propiedades y la base deben contemplar desde el inicio:

- `country`
- `province`
- `city`
- `neighborhood`
- `location_text`

En el MVP algunos campos pueden quedar fijos o nulos, pero la entidad no debe nacer pensada solo para CABA.

### Politica de merge

La recomendacion es que el backend no use solo `filterPatch + filtersToUnset`, sino una capa interna de operaciones de merge.

Operaciones internas recomendadas:

- `set_field`
- `unset_field`
- `add_list_value`
- `remove_list_value`
- `replace_list`

La IA puede seguir devolviendo un contrato simple hacia afuera, pero el backend debe convertirlo a operaciones deterministicas.

### Estrategia de auth recomendada

Para este MVP, la recomendacion es:

- access token JWT corto
- refresh token en cookie HttpOnly
- refresh token persistido en DB para revocacion

Motivo:

- encaja bien con API frontend/backend separada
- escala mejor si despues abren mobile o mas clientes
- mantiene control de sesiones sin acoplar todo a memoria del servidor

### Portales candidatos para el MVP

Recomendacion inicial de 4 portales a evaluar:

- Zonaprop
- Argenprop
- Properati
- Mudafy

Motivo:

- los cuatro muestran inventario activo en venta y alquiler para CABA
- cubren varios tipos de propiedad
- permiten pensar un pipeline comun de discovery + extraccion

Antes de implementarlos hay que hacer una validacion legal y tecnica por portal:

- terminos de uso
- robots
- estabilidad de HTML
- presencia o no de contenido renderizado en cliente
- nivel de anti-bot

La arquitectura de fuentes debe asumir que despues del MVP se van a sumar mas portales. Por eso cada portal debe entrar a traves de un adapter desacoplado, con contratos comunes de extraccion y normalizacion.

### Politica de resultados

Para el MVP, recomendacion inicial:

- mostrar 10 resultados por corrida
- persistir cada `search_run`
- soportar `show_more` como nueva pagina de la misma corrida si el origen lo permite
- si no lo permite, ejecutar nueva corrida con el mismo snapshot de filtros y registrar relacion logica con la corrida anterior

### Politica de favoritos

Hay que definir:

- si un favorito apunta a una propiedad cacheada
- que pasa si la publicacion caduca
- si se guarda snapshot visual del anuncio

### Politica de costo

Hay que acordar limites operativos para el MVP:

- maximo de mensajes enviados al modelo por interaccion
- maximo de URLs por corrida
- timeout por fuente
- cache por combinacion de filtros

### Implicancias de escala

Si el objetivo real es llegar a miles de usuarios y cobertura nacional, desde el inicio hay que dejar previstas estas decisiones:

- adapters por fuente desacoplados
- `search_runs` persistidos para auditoria y debugging
- cache de resultados por filtros
- cache de HTML por URL
- limites duros por corrida
- posibilidad futura de pasar scraping y enriquecimiento a jobs asincronos
- normalizacion geografica extensible a provincias y ciudades
- observabilidad desde el dia 1
- auth con tokens revocables

No hace falta construir toda la infraestructura de escala en el MVP, pero si dejar el modelo listo para que la migracion no sea traumática.

---

## 11. Lo que necesito de ustedes para seguir

Para avanzar al siguiente documento de diseno, necesito estas decisiones:

1. confirmacion de los tipos de propiedad que van a tener soporte fuerte en fase 1
2. confirmacion de los filtros de primera clase del MVP
3. decision final de las 4 webs a evaluar primero
4. decision final de auth
5. regla de favoritos cuando una publicacion deja de existir
6. cantidad de resultados por pagina si 10 no les convence
7. si `show_more` debe traer mas de la misma corrida o rerun con mismos filtros
8. si alquiler temporal queda explicitamente fuera del MVP

Con esas respuestas puedo preparar:

- mapa definitivo de entidades y relaciones
- contratos de dominio del backend
- flujo detallado del endpoint de chat
- backlog de implementacion por fases

---

## 12. Proximo entregable recomendado

El siguiente entregable deberia ser un documento de diseno funcional-t tecnico con:

- entidades y relaciones
- decisiones de dominio
- contrato del `search state`
- contrato del `SearchDecision`
- flujo de negocio de `POST /conversations/:id/messages`
- reglas de merge
- reglas de dedupe y ranking MVP

Ese documento ya seria la base directa para Prisma y para NestJS.

---

## 13. Posibles extensiones futuras con Python

La decision para el MVP y el core del producto es:

- backend principal en NestJS
- no mezclar lenguajes en el flujo core inicial

Pero se deja explicitamente abierta la posibilidad de usar Python despues del MVP para modulos o jobs especializados si aparece una necesidad real.

### Casos futuros donde Python puede tener sentido

- ranking mas sofisticado
- analisis de mercado
- clustering o dedupe mas complejo
- enriquecimiento masivo de datos
- jobs offline de investigacion o procesamiento

### Casos donde no conviene usar Python en MVP

- auth
- chat
- search state
- API principal
- favoritos
- historial
- controllers
- scraping basico del MVP
- orquestacion de busqueda

### Regla

Python queda como tecnologia opcional para capacidades avanzadas futuras, no como parte obligatoria del MVP.
