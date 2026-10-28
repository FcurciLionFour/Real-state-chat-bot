# Diferenciacion del MVP

## 1. Objetivo

Este documento define como evitar que el producto sea simplemente:

- otro agregador inmobiliario
- otro frontend sobre los mismos portales
- otro chat que "habla lindo" pero no mejora la busqueda

La meta es que el MVP destaque por precision operativa, claridad y utilidad real.

---

## 2. Principio de diferenciacion

No conviene competir primero por:

- cantidad de portales
- cantidad de features
- cantidad de pantallas

Conviene competir por:

- entender mejor la intencion del usuario
- mantener mejor el contexto de busqueda
- mostrar resultados mas limpios
- explicar mejor por que aparece cada propiedad

---

## 3. Diferenciales recomendados para el MVP

## 3.1 Search state visible y editable

Este deberia ser el diferencial principal.

No solo usar el chat para hablar, sino mostrar siempre:

- filtros activos
- que cambio en el ultimo mensaje
- que se agrego
- que se saco
- que se mantuvo

### Ejemplo de UX

"Mantengo Palermo, saco Belgrano, dejo tope en USD 140k y agrego balcon."

### Por que diferencia

Muchos productos conversacionales usan IA pero no hacen visible la logica. Aca el usuario ve y controla el estado.

---

## 3.2 Explicacion de resultados

Cada propiedad deberia poder mostrar una razon simple de por que aparece arriba.

Ejemplos:

- coincide con tu presupuesto
- esta en la zona exacta pedida
- tiene balcon
- fue publicada o scrapeada recientemente

### Por que diferencia

No es solo listar anuncios. Es ayudar a entender relevancia.

---

## 3.3 Dedupe visible y serio

Si varias fuentes muestran la misma propiedad, el sistema deberia intentar agruparla o al menos evitar repetirla de forma obvia.

### Valor de producto

- menos ruido
- menos sensacion de buscador "sucio"
- percepcion de mas inteligencia real

### Regla de UX

Si una propiedad aparece en varias fuentes, idealmente mostrar:

- una ficha principal
- fuente original visible
- otras fuentes relacionadas si existen

Esto quizas no entre completo en MVP, pero la logica de dedupe si debe existir desde fase 1.

---

## 3.4 Trazabilidad fuerte

Cada resultado debe mostrar:

- fuente
- fecha de extraccion
- link original

### Por que diferencia

Genera confianza.

El usuario entiende que:

- el sistema no invento el dato
- puede verificar la publicacion original

---

## 3.5 Refinamiento conversacional real

El producto tiene que destacarse porque refinar sea facil.

Ejemplos:

- "sacame las cocheras"
- "solo en Palermo Hollywood"
- "si no hay balcon, prioriza terraza"
- "manteneme el presupuesto y subi a 3 ambientes"

### Por que diferencia

No alcanza con interpretar un mensaje inicial. El valor esta en mantener coherencia entre mensajes sucesivos.

---

## 3.6 Modo claridad, no charla

La respuesta del asistente tiene que ser corta, operativa y util.

No debe parecer un chatbot generico.

### Tono recomendado

- directo
- corto
- explicativo
- accionable

### Ejemplo

"Mantengo Caballito, agrego cochera y dejo alquiler en ARS. Busco nuevas opciones."

### Por que diferencia

Muchos productos usan IA para adornar. Aca la IA tiene que servir.

---

## 3.7 Calidad antes que volumen

Para el MVP, conviene priorizar:

- menos resultados
- mejores resultados
- menos duplicados
- filtros mejor entendidos

Por eso 10 buenos resultados valen mas que 100 ruidosos.

---

## 4. Feature extra recomendada para destacar sin explotar alcance

## 4.1 "Por que no aparecieron mas resultados"

Esta es una feature chica, pero muy buena para diferenciarse.

Cuando haya pocos resultados, el sistema podria explicar algo como:

- el presupuesto esta muy ajustado para la zona
- el filtro de cochera reduce mucho la oferta
- hay pocos PH en alquiler en esa zona

Y sugerir flexibilizaciones concretas:

- subir tope
- ampliar barrio
- sacar una feature

### Por que sirve

Esto convierte al buscador en asistente experto real, no solo buscador con chat.

### Importante

Esto no requiere IA compleja.

Se puede resolver con logica de negocio y reglas simples sobre cantidad de resultados y filtros activos.

---

## 5. Features que NO conviene meter en el MVP para diferenciar

No recomiendo usar como diferencial inicial:

- mapas complejos
- tasador
- detector de estafas
- simulador hipotecario
- dashboards de mercado
- recomendaciones predictivas

No porque sean malas ideas, sino porque desordenan foco.

El MVP debe destacar por calidad del loop principal:

- pedir
- entender
- buscar
- explicar
- refinar

---

## 6. Propuesta concreta de diferencial MVP

Si tuviera que resumir el diferencial del MVP en una frase, seria:

"Un buscador inmobiliario conversacional que mantiene filtros de forma transparente, reduce duplicados y explica por que te muestra cada propiedad."

Eso ya es suficientemente distinto de:

- un portal clasico
- un agregador comun
- un chatbot bonito sin control real

---

## 7. Diferenciales que si recomiendo dejar comprometidos

### Imprescindibles

- search state visible
- filtros editables
- dedupe basico serio
- fuente visible
- fecha de extraccion visible
- respuestas cortas y operativas
- explicacion breve de relevancia

### Muy recomendados

- sugerencias de relajacion de filtros cuando hay pocos resultados
- comparacion simple entre propiedades

### Despues del MVP

- mapas
- alertas
- recomendaciones inteligentes
- analitica de mercado
- detector de oportunidades

---

## 8. Decision recomendada

Para no hacer "lo mismo con otro front", el MVP debe comprometerse con estos diferenciales:

1. `search state` como protagonista visible
2. dedupe y limpieza de resultados como feature real
3. trazabilidad fuerte de cada anuncio
4. explicacion corta de relevancia
5. ayuda para refinar cuando la busqueda queda demasiado cerrada

Ese combo ya posiciona mejor el producto sin romper el alcance del MVP.
