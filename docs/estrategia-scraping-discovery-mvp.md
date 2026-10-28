# Estrategia de Scraping y Discovery MVP

## 1. Objetivo

Este documento define como debe funcionar la obtencion de propiedades reales en el MVP.

La estrategia debe ser:

- acotada
- robusta
- trazable
- legalmente prudente
- compatible con escalar despues

No se busca cubrir todo. Se busca hacer bien el loop principal con pocas fuentes controladas.

---

## 2. Fuentes definidas para el MVP

Los portales aprobados para evaluar e integrar en MVP son:

- Zonaprop
- Argenprop
- Properati
- Mudafy

## 2.1 Regla

Estos cuatro no tienen que entrar todos al mismo nivel el dia 1.

### Recomendacion operativa

- fase inicial real: 1 fuente principal + discovery
- fase siguiente: agregar 2da fuente
- luego completar las 4 si se valida estabilidad

## 2.2 Motivo

Integrar 4 portales desde el arranque sube mucho:

- fragilidad
- tiempo de debugging
- deuda de scraping

El MVP gana mas con una fuente estable que con cuatro a medias.

---

## 3. Discovery

## 3.1 Objetivo

Encontrar URLs candidatas reales para una busqueda dada.

## 3.2 Recomendacion principal

Usar un motor de discovery externo, preferentemente:

- Google Programmable Search API

## 3.3 Rol del discovery

El discovery no reemplaza scraping.

Solo sirve para:

- encontrar links candidatos
- reducir dependencia de navegacion interna compleja por cada portal

## 3.4 Input del discovery

Entrada:

- query generada desde `SearchFilters`
- allowlist de dominios

## 3.5 Output del discovery

Salida:

- lista de URLs candidatas

---

## 4. Query builder para discovery

## 4.1 Objetivo

Transformar `SearchFilters` a queries utiles para discovery.

## 4.2 Componentes recomendados de query

- operacion
- tipo de propiedad
- ubicacion
- rango de precio si aporta valor
- ambientes si aporta valor
- features clave solo cuando realmente restringen

## 4.3 Regla

No meter todos los filtros siempre en una sola query textual enorme.

### Recomendacion

Construir una o varias queries razonables y simples.

### Ejemplo

Si el usuario busca:

- compra
- departamento
- Palermo
- USD 140k
- 2 ambientes
- balcon

la query podria priorizar:

- `departamento venta Palermo 2 ambientes balcon`

y usar el rango de precio como refinamiento secundario, no necesariamente textual duro.

---

## 5. Allowlist de dominios

## 5.1 Regla

El sistema no debe seguir cualquier URL encontrada.

## 5.2 Dominios iniciales sugeridos

- `zonaprop.com.ar`
- `argenprop.com`
- `properati.com.ar`
- `mudafy.com.ar`

## 5.3 Regla de seguridad

Toda URL candidata debe pasar por:

- validacion de dominio
- normalizacion
- descarte de URLs no HTTP/HTTPS

---

## 6. Limites por corrida

## 6.1 Objetivo

Evitar latencia excesiva y costos descontrolados.

## 6.2 Recomendacion MVP

Por cada corrida:

- limite de queries de discovery
- limite de URLs candidatas totales
- limite de URLs por fuente

## 6.3 Valores iniciales sugeridos

Recomendacion conservadora:

- hasta 2 queries de discovery por corrida
- hasta 20 URLs candidatas totales
- hasta 5 URLs por fuente

### Nota

Estos valores pueden ajustarse despues segun resultados reales.

---

## 7. Fetch HTML

## 7.1 Objetivo

Obtener el HTML de la pagina candidata.

## 7.2 Reglas recomendadas

- timeout por request
- user-agent controlado
- manejo de redirects
- reintentos limitados

## 7.3 Timeout recomendado

- timeout corto por URL

### Recomendacion inicial

- 4 a 8 segundos maximo por fetch

## 7.4 Reintentos

### Recomendacion MVP

- 1 reintento maximo

No conviene mas porque castiga latencia.

---

## 8. Cache de HTML

## 8.1 Rol

Evitar fetchear repetidamente la misma URL en ventanas cortas.

## 8.2 Tecnologia

- Redis

## 8.3 Regla

El HTML cacheado es efimero.

No reemplaza `properties_cache`.

## 8.4 Politica conceptual

- TTL corto
- invalida por tiempo, no por verdad del negocio

---

## 9. Adapters por portal

## 9.1 Regla

Cada portal debe tener su extractor propio.

## 9.2 Contrato recomendado

```ts
interface PropertySourceAdapter {
  sourceName: string;
  canHandle(url: string): boolean;
  extract(url: string, html: string): Promise<PropertyListing | null>;
}
```

## 9.3 Responsabilidad de cada adapter

- detectar si la URL corresponde a su fuente
- parsear HTML especifico
- extraer datos relevantes
- devolver `PropertyListing` normalizado o `null`

## 9.4 Regla

La normalizacion por portal no debe dispersarse por todo el backend.

Debe vivir en adapters o helpers cercanos a la fuente.

---

## 10. Paginas no utiles

## 10.1 Regla

No toda URL del dominio es una propiedad usable.

Hay que descartar:

- home
- listados genericos sin detalle
- paginas vacias
- landing pages comerciales
- errores disfrazados

## 10.2 Comportamiento esperado

Si el adapter detecta que la URL no es detalle de propiedad:

- devuelve `null`
- se registra descarte

---

## 11. Manejo de paginas renderizadas con JS

## 11.1 Riesgo

Algunos portales pueden depender de renderizado en cliente.

## 11.2 Decision MVP

Priorizar fuentes y paginas que permitan extraccion estable sin browser automation pesada.

## 11.3 Regla

No meter Playwright o navegador headless como requisito del MVP si se puede evitar.

### Motivo

- sube mucho complejidad
- sube consumo de recursos
- empeora operacion

## 11.4 Futuro

Si una fuente clave lo exige y vale la pena, eso puede agregarse despues.

---

## 12. Manejo de fallos por fuente

## 12.1 Regla

Una fuente que falla no debe tumbar toda la corrida.

## 12.2 Resultado esperado

- la corrida puede quedar `partial`
- se guardan fuentes utilizadas con exito
- se registra error resumido

## 12.3 Ejemplos de fallos

- timeout
- HTML inesperado
- bloqueos
- estructura rota

---

## 13. Persistencia y upsert de propiedades

## 13.1 Regla

Una vez normalizada una propiedad:

- se hace upsert en `properties_cache`
- luego se la vincula a la corrida

## 13.2 Clave operacional

Prioridad de identificacion:

1. `source + externalId`
2. `sourceUrl`
3. `canonicalHash`

## 13.3 Motivo

Evita:

- duplicados de persistencia
- perdida de historial
- resultados inconsistentes

---

## 14. Limites de latencia

## 14.1 Objetivo

El endpoint de chat no debe quedar bloqueado demasiado tiempo.

## 14.2 Regla MVP

La busqueda puede ser sincronica, pero con limites duros.

### Recomendacion inicial

- discovery acotado
- pocas URLs por corrida
- timeout total razonable

## 14.3 Futuro

Si la latencia del pipeline crece demasiado:

- mover scraping pesado a workers
- dejar refresh asincrono

No hace falta hacerlo desde el dia 1.

---

## 15. Cumplimiento y prudencia legal

## 15.1 Regla

Antes de implementar cada fuente hay que revisar:

- terminos de uso
- robots
- restricciones visibles

## 15.2 Principio de producto

El sistema debe:

- atribuir fuente
- redirigir al anuncio original
- no fingir ser propietario del contenido

## 15.3 Recomendacion

Dejar una checklist operativa por portal antes de integrarlo.

---

## 16. Estrategia por fases recomendada

## 16.1 Fase A

- discovery
- 1 adapter principal
- pipeline completo funcionando

## 16.2 Fase B

- 2da fuente
- tuning de dedupe
- tuning de ranking

## 16.3 Fase C

- 3ra y 4ta fuente
- mejoras de cache
- observabilidad mas fuerte

### Regla

No integrar 4 portales completos antes de validar el pipeline con 1 o 2.

---

## 17. Decisiones cerradas con este documento

1. usar discovery externo para encontrar URLs candidatas
2. usar allowlist estricta de dominios
3. limitar queries y URLs por corrida
4. cachear HTML en Redis con TTL corto
5. adapters separados por portal
6. no usar browser automation pesada en MVP si se puede evitar
7. fallos por fuente degradan a `partial`, no rompen toda la corrida
8. integrar fuentes por fases, no todas a la vez

---

## 18. Proximo paso

Con scraping y discovery definidos, los siguientes bloques recomendables son:

1. seguridad operativa
2. observabilidad
3. roadmap final de implementacion

Despues de eso, la especificacion previa a codigo queda esencialmente cerrada.
