# Arquitectura del Servicio Python de Scraping y Adquisicion de Datos

## 1. Objetivo

Este documento define como deberia construirse un servicio Python separado para resolver:

- discovery de URLs candidatas
- scraping de portales inmobiliarios
- extraccion estructurada
- normalizacion primaria
- reporte tecnico de calidad por fuente

La decision propuesta es:

- mantener `NestJS` como backend principal y fuente de verdad del producto
- crear un servicio Python especializado para adquisicion de datos web
- integrar ambos por HTTP interno primero
- dejar el camino abierto para colas y workers despues

Este servicio no nace solo como "un scraper".

Debe pensarse como una capa especializada de adquisicion de datos, preparada para crecer luego a:

- scraping programado
- recrawl selectivo
- enriquecimiento de fichas
- comparacion mas profunda
- OCR o parseos especiales
- ingestiones batch
- otros procesos tecnicos que no necesariamente sean scraping

---

## 2. Decision principal

## 2.1 Opcion elegida

La recomendacion es:

- `NestJS` sigue siendo el backend principal del producto
- `Python` se usa como servicio especializado separado
- comunicacion inicial por HTTP interno
- evolucion posterior opcional a jobs asincronos con Redis

## 2.2 Por que Python para este servicio

Para este problema puntual, Python tiene ventajas practicas:

- ecosistema muy fuerte para scraping y parsing
- rapidez para iterar extractores por fuente
- buena ergonomia para HTTP async
- soporte fuerte de automatizacion browser cuando haga falta
- facilidad para construir workers tecnicos y tooling interno

Stack sugerido:

- `FastAPI` para exponer la API interna
- `HTTPX` para fetch async
- `selectolax` o `BeautifulSoup` para parse HTML
- `Playwright` solo para fuentes que realmente lo necesiten
- `pydantic` para contratos estrictos
- `uvicorn` para runtime
- `Redis` opcional para cache y jobs

## 2.3 Lo que no debe hacer Python

El servicio Python no debe absorber logica central del producto.

Debe evitar:

- decidir el `search state`
- decidir la intencion del usuario
- guardar conversaciones o mensajes
- aplicar ranking final del producto
- deduplicar globalmente a nivel negocio
- hablar con OpenAI como parte del loop conversacional principal

Eso sigue en `NestJS`.

---

## 3. Reparto de responsabilidades

## 3.1 NestJS

NestJS sigue haciendo:

- auth
- conversaciones y mensajes
- `search state`
- interpretacion de IA
- validacion de contratos
- decision de ejecutar busqueda
- persistencia
- dedupe global
- ranking final
- favoritos
- observabilidad del producto

## 3.2 Servicio Python

Python hace:

- discovery de URLs candidatas
- navegacion de portales
- scraping por fuente
- extraccion de campos
- normalizacion primaria
- pre-dedupe tecnico y agrupacion de avisos muy similares
- reporte tecnico por fuente
- timeouts, retries y manejo de bloqueos por sitio
- cache de fetch si se habilita

## 3.3 Regla de arquitectura

La verdad del negocio sigue estando en el backend principal.

Python es un `integration service`, no el nuevo cerebro del producto.

## 3.4 Regla para duplicados

El servicio Python si puede y debe hacer `duplicate matching` tecnico porque ve:

- urls originales por fuente
- coordenadas
- superficies
- precios
- similitudes fuertes de ficha

Pero no debe destruir referencias originales.

La salida correcta es:

- una ficha tecnica canonica
- `duplicateGroupId`
- `duplicateCount`
- `sourceEntries[]` con todos los avisos originales agrupados

Despues `NestJS` decide:

- si acepta ese merge
- como se persiste
- como se presenta al usuario

---

## 4. Fuentes iniciales

El servicio debe quedar preparado desde el dia 1 para estas cuatro webs:

- Zonaprop
- Argenprop
- Properati
- Mudafy

Y ademas debe tener un modulo de discovery desacoplado para usar Google cuando convenga.

## 4.1 Regla operativa importante

Aunque el codigo quede preparado para las 4 webs desde entrada, eso no obliga a correr las 4 con el mismo peso el primer dia.

La recomendacion operativa es:

- integrar las 4 a nivel arquitectura
- habilitar por config solo las fuentes que pasen validaciones de estabilidad
- poder apagar una fuente sin redeploy grande

---

## 5. Modelo de comunicacion con el backend

## 5.1 Fase inicial recomendada

Comunicacion por HTTP interno sincronico.

Flujo:

1. frontend envia mensaje a Nest
2. Nest interpreta y mergea filtros
3. Nest decide buscar
4. Nest llama al servicio Python
5. Python devuelve items normalizados y metadata tecnica
6. Nest aplica dedupe, ranking y persistencia
7. Nest responde al frontend

## 5.2 Por que HTTP sincronico primero

Porque:

- es mucho mas simple de implementar
- baja la complejidad operativa inicial
- evita abrir colas antes de validar necesidad
- es suficiente para el MVP si se limita bien la cantidad de requests por busqueda

## 5.3 Evolucion posterior

Si la latencia o el volumen lo exigen, se agrega:

- cola en Redis
- jobs asincronos
- workers Python
- warm cache y scraping programado

Pero eso no debe ser el punto de partida.

---

## 6. Contrato HTTP inicial

## 6.1 Endpoint principal

`POST /v1/search`

Objetivo:

- recibir filtros normalizados desde Nest
- ejecutar discovery + scraping + extraccion
- devolver propiedades normalizadas y metadata tecnica

## 6.2 Payload de entrada esperado

```json
{
  "requestId": "req_123",
  "conversationId": "conv_123",
  "searchRunId": "run_123",
  "filters": {
    "operation": "buy",
    "propertyType": "apartment",
    "locations": ["Palermo"],
    "priceMin": null,
    "priceMax": 140000,
    "currency": "USD",
    "rooms": 2,
    "bedrooms": 1,
    "bathrooms": 1,
    "features": ["balcony"],
    "areaMin": null,
    "areaMax": null
  },
  "sources": ["zonaprop", "argenprop", "properati", "mudafy"],
  "discovery": {
    "providers": ["google", "portal-native"],
    "allowDomains": [
      "zonaprop.com.ar",
      "argenprop.com",
      "properati.com.ar",
      "mudafy.com.ar"
    ],
    "maxCandidateUrls": 40
  },
  "execution": {
    "limitPerSource": 10,
    "timeoutMs": 12000,
    "preferDetailPages": true,
    "allowBrowserFallback": true
  }
}
```

## 6.3 Significado de los campos

- `requestId`: correlacion tecnica HTTP
- `conversationId`: trazabilidad a nivel producto
- `searchRunId`: trazabilidad de la corrida
- `filters`: filtros ya interpretados por Nest
- `sources`: fuentes habilitadas para esa corrida
- `discovery.providers`: mecanismo de descubrimiento a intentar
- `discovery.allowDomains`: dominios autorizados
- `discovery.maxCandidateUrls`: limite global de candidatos
- `execution.limitPerSource`: maximo de fichas por fuente a procesar
- `execution.timeoutMs`: timeout total o por etapa segun implementacion
- `execution.preferDetailPages`: indica que el servicio debe priorizar fichas reales
- `execution.allowBrowserFallback`: habilita Playwright si HTTP simple no alcanza

## 6.4 Respuesta esperada

```json
{
  "items": [
    {
      "externalId": "123456789",
      "source": "zonaprop",
      "sourceUrl": "https://www.zonaprop.com.ar/propiedades/departamento-...",
      "title": "Departamento de 2 ambientes en Palermo",
      "description": "Departamento con balcon y cocina integrada.",
      "operation": "buy",
      "propertyType": "apartment",
      "price": 125000,
      "currency": "USD",
      "expenses": 95000,
      "locationText": "Palermo, Capital Federal",
      "city": "Capital Federal",
      "neighborhood": "Palermo",
      "rooms": 2,
      "bedrooms": 1,
      "bathrooms": 1,
      "areaTotal": 52,
      "areaCovered": 48,
      "features": ["balcony", "laundry"],
      "images": [
        "https://..."
      ],
      "sourceEntries": [
        {
          "source": "zonaprop",
          "sourceUrl": "https://www.zonaprop.com.ar/propiedades/departamento-...",
          "externalId": "123456789"
        },
        {
          "source": "argenprop",
          "sourceUrl": "https://www.argenprop.com/departamento-...",
          "externalId": "998877"
        }
      ],
      "duplicateGroupId": "dup-abcd1234",
      "duplicateCount": 2,
      "publishedAt": null,
      "scrapedAt": "2026-04-11T16:00:00Z"
    }
  ],
  "meta": {
    "sourcesRequested": ["zonaprop", "argenprop", "properati", "mudafy"],
    "sourcesUsed": ["zonaprop", "argenprop"],
    "discoveryProvidersUsed": ["portal-native"],
    "candidateUrlsFound": 18,
    "candidateUrlsProcessed": 9,
    "detailPagesAccepted": 6,
    "rawItemsBeforeDedupe": 8,
    "duplicatesCollapsed": 2,
    "itemsReturned": 6,
    "durationsMs": {
      "total": 3200,
      "discovery": 700,
      "zonaprop": 1100,
      "argenprop": 900
    },
    "partialFailures": [
      {
        "source": "properati",
        "stage": "fetch",
        "reason": "http_403"
      }
    ]
  }
}
```

## 6.5 Principio de respuesta

El servicio Python debe devolver:

- datos tecnicos suficientes para debugging
- items ya bastante limpios
- errores parciales por fuente

Pero no debe intentar "maquillar" la respuesta.

Si una fuente no devolvio nada, se reporta.

Si una fuente bloqueo o rompio, se reporta.

---

## 7. Endpoints adicionales recomendados

## 7.1 Salud

`GET /health/live`

Sirve para verificar:

- proceso arriba
- loop HTTP funcionando

`GET /health/ready`

Sirve para verificar:

- dependencias listas
- browser runtime disponible si aplica
- Redis disponible si se usa
- config minima valida

## 7.2 Extraccion directa por URL

`POST /v1/extract-url`

Uso:

- debugging de una URL puntual
- repro de errores por fuente
- tests manuales

Entrada:

```json
{
  "url": "https://www.zonaprop.com.ar/propiedades/....html",
  "sourceHint": "zonaprop",
  "allowBrowserFallback": true
}
```

## 7.3 Capacidades

`GET /v1/capabilities`

Debe devolver:

- fuentes soportadas
- providers de discovery disponibles
- browser fallback habilitado o no
- limites de runtime activos

Esto simplifica observabilidad y admin.

---

## 8. Arquitectura interna del servicio Python

## 8.1 Estructura recomendada

```text
python-scraper-service/
  app/
    api/
      routes/
        health.py
        search.py
        extract.py
        capabilities.py
    core/
      config.py
      logging.py
      errors.py
      observability.py
    contracts/
      requests.py
      responses.py
      enums.py
    services/
      search_orchestrator.py
      discovery_service.py
      fetch_service.py
      normalization_service.py
      cache_service.py
    discovery/
      base.py
      google_provider.py
      portal_native_provider.py
    sources/
      base.py
      registry.py
      zonaprop/
        search.py
        extract.py
        normalize.py
      argenprop/
        search.py
        extract.py
        normalize.py
      properati/
        search.py
        extract.py
        normalize.py
      mudafy/
        search.py
        extract.py
        normalize.py
    browser/
      playwright_pool.py
    models/
      listing.py
      source_report.py
      discovery_result.py
    utils/
      urls.py
      html.py
      dates.py
  tests/
    unit/
    integration/
    fixtures/
  Dockerfile
  pyproject.toml
```

## 8.2 Orquestador

`search_orchestrator.py` debe coordinar:

1. discovery
2. filtrado por dominio
3. priorizacion de fichas reales
4. fetch
5. parse
6. normalizacion
7. armado de metadata tecnica

## 8.3 Modulo discovery

Debe existir como interfaz:

```python
class DiscoveryProvider(Protocol):
    async def discover(self, filters: dict, domains: list[str], max_urls: int) -> list[str]:
        ...
```

Providers iniciales:

- `google_provider`
- `portal_native_provider`

### Regla importante

Google no debe ser una dependencia unica.

Debe quedar como provider intercambiable por config.

## 8.4 Modulo por fuente

Cada fuente deberia tener al menos:

- `search.py`: logica de busqueda interna o navegacion del portal
- `extract.py`: parseo HTML y extraccion
- `normalize.py`: mapeo a modelo comun

Interfaz base sugerida:

```python
class SourceAdapter(Protocol):
    source_name: str

    async def search(self, filters: dict, limit: int) -> list[str]:
        ...

    async def extract(self, url: str) -> dict | None:
        ...

    def can_handle(self, url: str) -> bool:
        ...
```

---

## 9. Discovery: rol de Google y rol de las webs

## 9.1 Regla general

El servicio Python debe soportar dos caminos:

- discovery por Google
- discovery nativo por portal

## 9.2 Google

Google debe usarse como provider opcional, no como pilar unico.

Motivos:

- puede cambiar producto, costos o permisos
- puede degradar la calidad de URLs candidatas
- no conviene atar la adquisicion de datos a un unico proveedor externo

## 9.3 Portal-native discovery

Cada portal debe poder tener una estrategia propia:

- construir URL de busqueda interna
- recorrer listados del portal
- obtener URLs de detalle
- alimentar luego la extraccion

## 9.4 Recomendacion

El servicio debe priorizar:

1. `portal-native`
2. `google` como apoyo o fallback

No al reves.

---

## 10. Performance y colas

## 10.1 Riesgo percibido

La preocupacion valida es:

- si este servicio agregara demasiada espera

## 10.2 Respuesta tecnica

No necesariamente.

Con una implementacion acotada y async, el rendimiento puede ser razonable para MVP.

Reglas:

- fetch async en paralelo
- timeouts estrictos
- limite de URLs por fuente
- cache de HTML
- Playwright solo bajo necesidad real
- no ejecutar browser por defecto en cada pagina

## 10.3 Modo recomendado al inicio

Modo sincronico por HTTP.

## 10.4 Cuando pasar a colas

Agregar colas recien cuando aparezca alguno de estos sintomas:

- latencia media demasiado alta
- necesidad de reintentos automaticos
- scraping programado
- recrawl masivo
- warm cache
- volumen concurrente sostenido

## 10.5 Evolucion a jobs

Fase posterior sugerida:

- Redis
- cola de jobs
- workers Python
- Nest crea job y consulta estado

Pero esto es fase posterior.

---

## 11. Escalabilidad para futuras funciones

Este servicio debe quedar preparado para crecer a otras capacidades tecnicas, incluso si no tienen que ver con scraping.

## 11.1 Principio

No abrir varios microservicios antes de tiempo.

Primero crear una plataforma Python unica, con modulos internos claros.

## 11.2 Posibles capacidades futuras

- scraping programado
- enrichment de avisos
- OCR de imagenes de planos o PDFs
- geocoding o estandarizacion de ubicaciones
- parseo de documentos
- scoring tecnico por calidad de fuente
- importacion batch desde archivos
- ingestiones especiales desde feeds o APIs de partners

## 11.3 Regla de separacion futura

Solo extraer otro servicio si:

- cambia el patron de carga
- requiere despliegue muy distinto
- necesita permisos o secretos muy diferentes
- exige runtime distinto o costos separados

Hasta entonces, conviene una sola plataforma Python modular.

---

## 12. Roadmap de implementacion

## Fase 0 - Diseno y contratos

- definir payloads HTTP con Nest
- definir modelo comun de `PropertyListing`
- definir metadata tecnica de respuesta
- definir estrategia de errores parciales
- definir providers de discovery

Objetivo:

- alinear contrato antes de escribir scraping real

## Fase 1 - Esqueleto del servicio

- crear repo o carpeta del servicio Python
- configurar `FastAPI`
- agregar `health/live` y `health/ready`
- agregar configuracion por `.env`
- agregar logging estructurado
- agregar `pydantic` para contratos

Objetivo:

- tener servicio arrancable por Docker Compose

## Fase 2 - Orquestador minimo

- implementar `POST /v1/search`
- implementar `search_orchestrator`
- integrar cache opcional
- definir `SourceAdapter`
- definir `DiscoveryProvider`

Objetivo:

- tener circuito tecnico base aunque todavia use fixtures

## Fase 3 - Primera fuente real

- integrar primera fuente completa
- primero por `HTTPX`
- `Playwright` solo si es necesario
- agregar pruebas con fixtures HTML
- devolver items normalizados reales

Objetivo:

- validar que el servicio aporta valor real

## Fase 4 - Discovery hibrido

- agregar `portal-native discovery`
- agregar provider `google`
- feature flags por provider
- soporte de `sources` configurables desde Nest

Objetivo:

- bajar dependencia de un unico proveedor externo

## Fase 5 - Cuatro fuentes operativas

- agregar Zonaprop
- agregar Argenprop
- agregar Properati
- agregar Mudafy
- endurecer parseos y tolerancia a fallos

Objetivo:

- cobertura inicial multipuerta

## Fase 6 - Observabilidad fuerte

- metricas por fuente
- metricas por etapa
- tiempos por discovery y scraping
- tasa de errores por dominio
- tasa de paginas descartadas
- trazabilidad con `requestId` y `searchRunId`

Objetivo:

- poder operar y depurar el servicio

## Fase 7 - Preparacion para escala

- rate limiting por dominio
- browser pool si hace falta
- cache de HTML
- recrawl selectivo
- jobs asincronos opcionales

Objetivo:

- que el servicio escale sin reescritura grande

---

## 13. Integracion con el backend actual

## 13.1 Modelo recomendado

El backend actual debe sumar un cliente interno tipo:

- `PythonScraperClient`

Nest seguiria teniendo un selector de discovery o search provider, pero ahora podria decidir:

- provider actual Node
- provider Python

Eso permite migracion gradual, no big bang.

## 13.2 Estrategia de migracion

1. crear servicio Python
2. integrarlo con fixtures primero
3. conectar una fuente real
4. agregar feature flag en Nest
5. comparar resultados entre pipeline actual y Python
6. mover trafico gradualmente

## 13.3 Regla de seguridad

Nest no debe quedar bloqueado si Python cae.

Por lo tanto:

- timeout corto y claro
- errores parciales controlados
- fallback seguro
- capacidad de apagar el servicio por config

---

## 14. Variables de entorno sugeridas

```env
PY_SCRAPER_HOST=0.0.0.0
PY_SCRAPER_PORT=8000
PY_SCRAPER_LOG_LEVEL=INFO
PY_SCRAPER_REDIS_URL=redis://redis:6379/1
PY_SCRAPER_ENABLE_CACHE=true
PY_SCRAPER_ENABLE_BROWSER_FALLBACK=true
PY_SCRAPER_DEFAULT_TIMEOUT_MS=12000
PY_SCRAPER_MAX_URLS_PER_SOURCE=10
PY_SCRAPER_ENABLE_GOOGLE_DISCOVERY=false
PY_SCRAPER_GOOGLE_API_KEY=
PY_SCRAPER_GOOGLE_CX=
```

En Nest:

```env
PYTHON_SCRAPER_BASE_URL=http://python-scraper:8000
PYTHON_SCRAPER_ENABLED=false
PYTHON_SCRAPER_TIMEOUT_MS=15000
```

---

## 15. Criterios de calidad minima

El servicio Python no se considera listo si no cumple:

- contratos estrictos y versionados
- test unitario por extractor
- fixtures HTML por fuente
- timeouts claros
- logs estructurados
- trazabilidad por request
- capacidad de apagar fuentes individualmente
- respuesta util incluso con fallos parciales

---

## 16. Conclusion

La arquitectura recomendada es:

- `NestJS` como plataforma principal del producto
- `Python` como servicio especializado de adquisicion de datos
- HTTP interno sincronico al inicio
- evolucion posterior a jobs y workers solo si el volumen lo exige

El servicio debe nacer enfocado en scraping, discovery y extraccion, pero con estructura suficientemente modular para convertirse despues en una plataforma tecnica reutilizable para otras funciones.

La meta no es construir microservicios por moda.

La meta es crear una pieza especializada, util, controlable y extensible.

---

## 17. Prioridad de implementacion acordada

Para evitar mezclar frentes y abrir cambios de contrato demasiado temprano, el orden acordado a partir de este punto es:

1. terminar `discovery`
2. terminar `scraping` y extraccion por fuente
3. validar calidad y completitud de datos del servicio Python
4. despues retomar cambios de contratos en backend y frontend

Esto implica:

- no expandir ahora los contratos Nest solo porque ya sabemos que la ficha final deberia incluir mas campos
- si el servicio Python detecta datos ricos adicionales, puede dejarse documentado como objetivo futuro
- la integracion completa de ficha rica con backend y frontend se retoma cuando el servicio Python ya tenga discovery y scraping razonablemente estables

Campos de ficha rica ya identificados para fase posterior de contratos:

- imagenes completas
- mapa y coordenadas
- publisher / inmobiliaria
- contacto
- propiedades cercanas
- propiedades similares
