# Catalogos Canonicos MVP

## 1. Objetivo

Este documento define los catalogos canonicos del sistema para el MVP.

Sirve para alinear:

- IA
- backend
- scraping
- normalizacion
- frontend

La idea es que el sistema no dependa de texto libre desordenado para conceptos criticos.

---

## 2. Regla general

El sistema necesita separar:

- valor canonico interno
- aliases de entrada
- labels de salida al usuario

### Ejemplo

- valor interno: `APARTMENT`
- aliases de entrada: `departamento`, `depto`, `apartment`
- label UI es-AR: `Departamento`
- label UI en: `Apartment`

---

## 3. Catalogo de operaciones

## 3.1 Canonicos

- `BUY`
- `RENT`

## 3.2 Aliases de entrada recomendados

### `BUY`

- comprar
- compra
- venta
- en venta
- buy
- purchase
- for sale

### `RENT`

- alquilar
- alquiler
- alquilo
- en alquiler
- rent
- rental
- for rent

## 3.3 Labels

### es-AR

- `BUY` => `Compra`
- `RENT` => `Alquiler`

### en

- `BUY` => `Buy`
- `RENT` => `Rent`

---

## 4. Catalogo de monedas

## 4.1 Canonicos

- `USD`
- `ARS`

## 4.2 Aliases de entrada recomendados

### `USD`

- usd
- u$s
- us$
- dolares
- dólares
- dollar
- dollars

### `ARS`

- ars
- pesos
- peso
- $
- argentinos
- argentine pesos

## 4.3 Regla importante

El simbolo `$` aislado puede ser ambiguo.

### Recomendacion

- en propiedades argentinas, por default interpretar `$` como `ARS`
- si hay evidencia textual fuerte de dolar, usar `USD`
- si no hay suficiente contexto en un parseo dudoso, dejar moneda nula antes que inventar

---

## 5. Catalogo de tipos de propiedad

## 5.1 Canonicos

- `APARTMENT`
- `HOUSE`
- `PH`
- `LAND`
- `OFFICE`
- `LOCAL`
- `GARAGE`

## 5.2 Aliases recomendados

### `APARTMENT`

- departamento
- depto
- depa
- apartment
- flat

### `HOUSE`

- casa
- chalet
- home
- house

### `PH`

- ph
- p.h.
- propiedad horizontal

### `LAND`

- terreno
- lote
- land
- plot

### `OFFICE`

- oficina
- office

### `LOCAL`

- local
- local comercial
- shop
- retail

### `GARAGE`

- cochera
- garage
- parking

## 5.3 Labels

### es-AR

- `APARTMENT` => `Departamento`
- `HOUSE` => `Casa`
- `PH` => `PH`
- `LAND` => `Terreno`
- `OFFICE` => `Oficina`
- `LOCAL` => `Local`
- `GARAGE` => `Cochera`

---

## 6. Catalogo de features

## 6.1 Canonicos

- `BALCONY`
- `TERRACE`
- `PATIO`
- `GARAGE`
- `POOL`
- `BARBECUE`
- `GYM`
- `PROFESSIONAL_USE`
- `MORTGAGE_ELIGIBLE`
- `FURNISHED`
- `PETS_ALLOWED`

## 6.2 Aliases recomendados

### `BALCONY`

- balcon
- balcón
- balcony

### `TERRACE`

- terraza
- terrace

### `PATIO`

- patio

### `GARAGE`

- cochera
- garage
- parking

### `POOL`

- pileta
- piscina
- pool

### `BARBECUE`

- parrilla
- quincho con parrilla
- barbecue
- bbq

### `GYM`

- gimnasio
- gym

### `PROFESSIONAL_USE`

- apto profesional
- professional use

### `MORTGAGE_ELIGIBLE`

- apto credito
- apto crédito
- mortgage eligible
- credito hipotecario

### `FURNISHED`

- amoblado
- furnished
- equipado

### `PETS_ALLOWED`

- acepta mascotas
- pets allowed
- pet friendly

## 6.3 Labels

### es-AR

- `BALCONY` => `Balcón`
- `TERRACE` => `Terraza`
- `PATIO` => `Patio`
- `GARAGE` => `Cochera`
- `POOL` => `Pileta`
- `BARBECUE` => `Parrilla`
- `GYM` => `Gimnasio`
- `PROFESSIONAL_USE` => `Apto profesional`
- `MORTGAGE_ELIGIBLE` => `Apto crédito`
- `FURNISHED` => `Amoblado`
- `PETS_ALLOWED` => `Acepta mascotas`

---

## 7. Catalogo de ordenamiento

## 7.1 Canonicos

- `RELEVANCE`
- `PRICE_ASC`
- `PRICE_DESC`
- `NEWEST`

## 7.2 Aliases recomendados

### `RELEVANCE`

- relevante
- relevancia
- mejores coincidencias
- relevance

### `PRICE_ASC`

- menor precio
- precio ascendente
- mas barato primero
- cheapest first

### `PRICE_DESC`

- mayor precio
- precio descendente
- mas caro primero
- highest price

### `NEWEST`

- mas nuevo
- recientes
- newest
- latest

---

## 8. Catalogo geografico MVP de CABA

## 8.1 Regla

Para el MVP, `locations` debe trabajar con valores canonicos de barrios de CABA.

## 8.2 Barrios canonicos recomendados

- Agronomia
- Almagro
- Balvanera
- Barracas
- Belgrano
- Boedo
- Caballito
- Chacarita
- Coghlan
- Colegiales
- Constitucion
- Flores
- Floresta
- La Boca
- La Paternal
- Liniers
- Mataderos
- Monte Castro
- Monserrat
- Nueva Pompeya
- Nunez
- Palermo
- Parque Avellaneda
- Parque Chacabuco
- Parque Chas
- Parque Patricios
- Puerto Madero
- Recoleta
- Retiro
- Saavedra
- San Cristobal
- San Nicolas
- San Telmo
- Velez Sarsfield
- Versalles
- Villa Crespo
- Villa Devoto
- Villa General Mitre
- Villa Lugano
- Villa Luro
- Villa Ortuzar
- Villa Pueyrredon
- Villa Real
- Villa Riachuelo
- Villa Santa Rita
- Villa Soldati
- Villa Urquiza

## 8.3 Aliases geograficos recomendados

### Palermo

- palermo hollywood
- palermo soho
- palermo chico
- palermo viejo

### Barrio Norte

No conviene como barrio canonico propio en MVP.

### Regla

Mapear `Barrio Norte` a `Recoleta` salvo que despues se decida tratarlo como zona comercial separada.

### Microcentro

Mapear a:

- `San Nicolas`
- o `Monserrat` segun contexto si el parser tiene evidencia

Si no hay evidencia suficiente, mejor conservar `locationText` pero no forzar barrio incorrecto.

### Capital Federal / CABA / Capital

No usar como barrio.

Se interpreta como:

- `city = CABA`

Pero no como valor canonico en `locations` si el sistema esta refinando por barrio.

## 8.4 Regla de expansion futura

Aunque el MVP use barrios de CABA, `PropertyListing` ya soporta:

- country
- province
- city
- neighborhood

Eso deja el sistema listo para expandirse a toda Argentina.

---

## 9. Reglas de normalizacion

## 9.1 Texto

Antes de mapear aliases:

- trim
- lowercase para matching
- remover ruido tipografico basico
- normalizar acentos cuando haga falta para matching

## 9.2 Ubicaciones

### Regla

Guardar:

- valor canonico cuando hay match confiable
- `locationText` original cuando la fuente trae una descripcion rica

## 9.3 Features

### Regla

Si una fuente trae features fuera del catalogo:

- conservarlas en payload crudo o metadata
- no convertirlas forzosamente a un canonico incorrecto

## 9.4 Tipos de propiedad

### Regla

Si el tipo no puede clasificarse con confianza:

- dejar `propertyType = null`
- conservar texto original en payload

---

## 10. Reglas para IA y backend

## 10.1 IA

La IA debe:

- entender aliases en espanol e ingles
- devolver solo valores canonicos

## 10.2 Backend

El backend debe:

- validar enums
- normalizar strings antes de persistir
- rechazar valores fuera de catalogo cuando correspondan

## 10.3 Frontend

El frontend debe:

- renderizar labels traducidas
- no inventar enums propios

---

## 11. Decisiones cerradas con este documento

- enums canonicos del dominio quedan estabilizados
- aliases de espanol e ingles quedan previstos
- CABA se trabaja por barrios canonicos en MVP
- `Barrio Norte` se absorbe en `Recoleta` en MVP
- `Capital Federal / CABA` no se usa como barrio canonico
- features y tipos dudosos no se inventan

---

## 12. Proximo paso

Con catalogos canonicos cerrados, lo siguiente recomendable es:

1. reglas concretas de ranking
2. reglas concretas de dedupe

Despues de eso, la especificacion funcional-tecnica previa a codigo queda casi completa.
