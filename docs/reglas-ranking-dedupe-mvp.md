# Reglas de Ranking y Dedupe MVP

## 1. Objetivo

Este documento define como limpiar y ordenar resultados en el MVP.

La idea es:

- reducir duplicados evidentes
- evitar resultados ruidosos
- ordenar por relevancia explicable

No se busca perfeccion matematica. Se busca un sistema:

- util
- razonable
- depurable
- entendible

---

## 2. Orden del pipeline

El orden correcto es:

1. discovery
2. fetch y extraccion
3. normalizacion
4. dedupe
5. ranking
6. persistencia

### Regla

No rankear antes de deduplicar.

Si no, el sistema puede favorecer multiples copias del mismo anuncio.

---

## 3. Objetivo del dedupe

El dedupe del MVP no necesita resolver todos los duplicados posibles.

Tiene que resolver bien:

- misma publicacion repetida en la misma fuente
- misma URL repetida
- duplicados muy evidentes entre resultados

---

## 4. Estrategia de dedupe por niveles

## 4.1 Nivel 1: `source + externalId`

### Regla

Si dos resultados comparten:

- misma `source`
- mismo `externalId`

se consideran la misma propiedad.

### Prioridad

Es la senal mas fuerte cuando existe.

---

## 4.2 Nivel 2: `sourceUrl`

### Regla

Si dos resultados tienen la misma `sourceUrl`, son la misma propiedad.

### Prioridad

Es la segunda senal mas fuerte.

---

## 4.3 Nivel 3: `canonicalHash`

### Regla

Si comparten `canonicalHash`, son muy probablemente la misma propiedad.

### Uso

Sirve como ayuda, no como verdad absoluta.

---

## 4.4 Nivel 4: heuristica de similitud

Si no hay coincidencia fuerte por IDs o URL, aplicar heuristica de similitud.

### Variables sugeridas

- titulo normalizado
- precio aproximado
- barrio o ubicacion normalizada
- area aproximada
- tipo de propiedad

### Regla

Solo considerar duplicado si varias senales coinciden a la vez.

No deduplicar agresivamente con una sola coincidencia debil.

---

## 5. Construccion recomendada de `canonicalHash`

## 5.1 Objetivo

Crear una huella relativamente estable para detectar duplicados evidentes.

## 5.2 Componentes sugeridos

- `source`
- `propertyType`
- titulo normalizado simplificado
- barrio normalizado
- precio redondeado
- area total o cubierta redondeada

## 5.3 Regla

No incluir texto demasiado variable ni datos cosméticos.

---

## 6. Seleccion del representante al deduplicar

Cuando dos o mas resultados representan la misma propiedad, hay que elegir una version principal.

## 6.1 Prioridad recomendada

Elegir la propiedad con:

1. mayor completitud de datos
2. imagenes presentes
3. precio y moneda presentes
4. mejor normalizacion geografica
5. scrapeo mas reciente

## 6.2 Regla

No elegir ciegamente la primera.

---

## 7. Dedupe entre fuentes distintas

## 7.1 Decision MVP

Se intenta dedupe basico entre fuentes, pero de forma conservadora.

## 7.2 Regla

Solo agrupar entre fuentes si la similitud es claramente alta.

Si hay duda:

- preferir mostrar ambos
- antes que colapsar anuncios diferentes por error

## 7.3 Motivo

Un falso positivo de dedupe es peor que un duplicado leve en MVP.

---

## 8. Persistencia del dedupe

## 8.1 Recomendacion MVP

El dedupe se aplica durante la corrida.

No hace falta, por ahora:

- una tabla extra de grupos de duplicados
- un grafo global de entidades equivalentes

## 8.2 Resultado esperado

La corrida final ya persiste solo los resultados deduplicados que se muestran.

---

## 9. Objetivo del ranking

Ordenar las propiedades deduplicadas segun:

- match con la intencion del usuario
- calidad del anuncio
- frescura

El ranking debe poder explicarse.

No debe ser una caja negra.

---

## 10. Factores de ranking MVP

## 10.1 Match de operacion

### Regla

Si la operacion no coincide con el filtro buscado, el resultado debe caer fuertemente o descartarse antes.

### Recomendacion

Filtrar duro por operacion cuando el dato este disponible.

---

## 10.2 Match de tipo de propiedad

### Regla

Si el usuario definio `propertyTypes`, priorizar fuertemente coincidencia exacta.

### Recomendacion

Si el resultado tiene un tipo incompatible y el tipo viene claro, penalizar fuerte.

---

## 10.3 Match de ubicacion

### Regla

Este es uno de los factores mas importantes del ranking.

Prioridad:

1. match exacto del barrio pedido
2. match de una de las zonas pedidas
3. match solo a nivel CABA cuando no se pudo normalizar mejor

---

## 10.4 Match de presupuesto

### Regla

El ranking debe premiar:

- propiedades dentro del rango
- propiedades cerca del presupuesto objetivo

### Recomendacion

Si el precio excede mucho el maximo pedido:

- penalizar fuerte

Si el precio esta por debajo del minimo cuando el usuario definio uno:

- penalizar moderadamente

### Regla con faltantes

Si falta precio:

- no descartar automaticamente
- pero penalizar completitud

---

## 10.5 Match de ambientes, dormitorios y banos

### Regla

Priorizar coincidencia con:

- `rooms`
- `bedrooms`
- `bathrooms`

### Orden de importancia

Para MVP:

1. `rooms`
2. `bedrooms`
3. `bathrooms`

---

## 10.6 Match de features

### Regla

Premiar coincidencia con features canonicas pedidas.

### Ejemplo

Si el usuario pidio:

- balcon
- cochera

y el anuncio tiene ambas, sube score.

Si no tiene ninguna, no necesariamente se descarta, pero pierde prioridad.

---

## 10.7 Completitud del anuncio

### Regla

Anuncios mejor completos deben rankear mejor.

### Campos valiosos para completitud

- precio
- moneda
- barrio
- tipo de propiedad
- ambientes
- superficie
- imagenes
- descripcion

---

## 10.8 Frescura

### Regla

Resultados scrapeados recientemente deben rankear mejor que resultados viejos o `stale`.

### Importancia

Media.

No deberia pesar mas que ubicacion o presupuesto.

---

## 11. Formula de ranking recomendada

No hace falta una formula ultra rigida desde el dia 1, pero si una estructura clara.

## 11.1 Score total

Recomendacion conceptual:

- score de 0 a 1

### Componentes sugeridos

- `locationScore`: 0.25
- `budgetScore`: 0.20
- `propertyTypeScore`: 0.15
- `roomsScore`: 0.10
- `bedroomsScore`: 0.05
- `bathroomsScore`: 0.05
- `featuresScore`: 0.10
- `completenessScore`: 0.07
- `freshnessScore`: 0.03

### Regla

Estos pesos son recomendados para MVP y se pueden ajustar despues con evidencia real.

---

## 12. Reglas de score por factor

## 12.1 `locationScore`

- 1.0 si match exacto con barrio pedido
- 0.7 si match aceptable dentro de las ubicaciones pedidas
- 0.3 si solo coincide a nivel ciudad
- 0.0 si no coincide

## 12.2 `budgetScore`

- 1.0 si esta dentro del rango
- 0.7 si esta muy cerca del maximo o minimo
- 0.3 si se aleja moderadamente
- 0.0 si esta claramente fuera

## 12.3 `propertyTypeScore`

- 1.0 si coincide con alguno de los tipos pedidos
- 0.0 si no coincide y el tipo esta claro
- 0.5 si el tipo es nulo o dudoso

## 12.4 `roomsScore`

- 1.0 si coincide exacto
- 0.7 si queda cerca
- 0.0 si difiere claramente

## 12.5 `featuresScore`

- proporcional a cantidad de features pedidas que el anuncio cumple

Ejemplo:

- pidió 2 y cumple 2 => 1.0
- pidió 2 y cumple 1 => 0.5
- pidió 2 y cumple 0 => 0.0

## 12.6 `completenessScore`

Se calcula por presencia de campos relevantes.

## 12.7 `freshnessScore`

- 1.0 si el scrapeo es reciente
- baja progresivamente si el dato envejece

---

## 13. Regla de descarte antes del ranking

Algunos resultados no deberian entrar al ranking final si contradicen filtros esenciales.

### Filtros de descarte recomendados

- operacion incompatible
- ubicacion claramente incompatible cuando el dato es confiable
- tipo de propiedad incompatible cuando el dato es confiable

### Regla

No usar ranking para arreglar resultados obviamente incorrectos.

---

## 14. Persistencia de razones de ranking

## 14.1 Recomendacion

Persistir en `rankReasonJson` algo parecido a:

```json
{
  "locationScore": 1,
  "budgetScore": 0.9,
  "propertyTypeScore": 1,
  "roomsScore": 1,
  "featuresScore": 0.5,
  "completenessScore": 0.8,
  "freshnessScore": 0.9,
  "matchedFeatures": ["BALCONY"],
  "withinBudget": true
}
```

## 14.2 Motivo

Sirve para:

- debugging
- auditoria
- explicaciones al usuario

---

## 15. Explicacion al usuario

No conviene exponer el score crudo, pero si razones humanas simples.

### Ejemplos

- coincide con tu zona
- esta dentro de tu presupuesto
- tiene balcon
- fue actualizado recientemente

### Regla

El frontend puede construir estas explicaciones a partir de `rankReasonJson`.

---

## 16. Reglas cerradas del MVP

1. dedupe antes de ranking
2. dedupe fuerte por `source + externalId`
3. dedupe fuerte por `sourceUrl`
4. dedupe conservador entre fuentes distintas
5. elegir representante por completitud y frescura
6. ranking explicable con score 0..1
7. priorizar ubicacion y presupuesto
8. no rankear resultados que contradicen filtros esenciales
9. persistir razones de ranking

---

## 17. Proximo paso

Con este documento, la especificacion previa a implementacion queda muy avanzada.

Lo que sigue, si queres cerrar completamente esta etapa, es:

1. estrategia concreta de scraping y discovery
2. seguridad operativa
3. observabilidad
4. roadmap final de implementacion
