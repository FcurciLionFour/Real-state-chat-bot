# OpenAI - Modos de Operacion

## 1. Objetivo

Este documento deja una regla operativa simple para trabajar el proyecto sin mezclar:

- desarrollo local sin costo
- pruebas reales baratas con OpenAI
- configuracion futura de produccion

Se alinea con:

- `docs/roadmap-implementacion-mvp.md`
- `docs/plan-construccion-mvp.md`
- `docs/contrato-ia-mvp.md`

La meta inmediata es cerrar bien la Fase 3 antes de seguir con Fase 4.

---

## 2. Regla general

El backend ya soporta dos comportamientos:

- con `OPENAI_API_KEY` vacia: usa fallback seguro
- con `OPENAI_API_KEY` presente: intenta interpretar con OpenAI real

Por eso no hace falta bifurcar el codigo para desarrollo local. La diferencia operativa vive en entorno y configuracion.

---

## 3. Modo local sin costo

## 3.1 Cuando usarlo

- desarrollo diario del backend
- cambios en contratos
- cambios en merge de filtros
- pruebas de persistencia
- pruebas del endpoint de chat sin depender de red externa

## 3.2 Configuracion

En `backend/.env` dejar:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

## 3.3 Comportamiento esperado

- `AiSearchDecisionService` cae al fallback seguro
- no se ejecuta decision real con OpenAI
- el backend sigue respondiendo con contrato estable
- los logs deben indicar que esta en modo `safe-fallback`

## 3.4 Objetivo

Permitir avanzar en Fase 2 y partes de Fase 3 sin costo y sin bloquear el desarrollo.

---

## 4. Modo prueba barato con API real

## 4.1 Cuando usarlo

- validacion real de Fase 3
- tuning de prompt
- pruebas de schema real con mensajes en espanol e ingles
- verificacion de `shouldSearch`, `requiresClarification` y `requestedAction`

## 4.2 Configuracion local

En `backend/.env` cargar:

```env
OPENAI_API_KEY=tu_api_key_real
OPENAI_MODEL=gpt-4.1-mini
```

## 4.3 Regla de costo

Para esta etapa:

- usar un modelo economico primero
- probar con pocos mensajes controlados
- no mandar historial completo
- no abrir scraping real todavia

## 4.4 Recomendacion operativa

- cargar credito minimo para pruebas
- revisar el limite mensual en la cuenta de OpenAI
- validar primero 5 a 10 mensajes representativos
- guardar ejemplos buenos y malos para tuning posterior

## 4.5 Casos minimos a probar

- busqueda nueva clara en espanol
- modificacion parcial de filtros
- pedido ambiguo que fuerce aclaracion
- smalltalk que no deba buscar
- mensaje en ingles con enums canonicos correctos

## 4.6 Comando de validacion

Con la key real cargada en `backend/.env`, correr:

```bash
npm run test:openai
```

El script:

- llama a `AiSearchDecisionService` con OpenAI real
- valida casos minimos de Fase 3
- falla si el modelo cae al fallback seguro
- imprime cada `SearchDecision` para revisar prompt y schema

---

## 5. Modo produccion futuro

## 5.1 Cuando aplica

Despues de cerrar:

- Fase 3
- Fase 4
- Fase 5 al menos con una fuente real

## 5.2 Configuracion esperada

- `OPENAI_API_KEY` real
- modelo definido segun costo y calidad observada
- limites de uso revisados
- observabilidad mas completa

## 5.3 Regla

No pasar a un modelo mas caro hasta validar que:

- el schema es estable
- el prompt ya esta razonablemente afinado
- el backend no manda contexto innecesario

---

## 6. Flujo recomendado de trabajo

1. desarrollar en modo local sin costo
2. cerrar cambios de codigo y tests
3. activar modo prueba barato
4. validar mensajes reales
5. ajustar prompt y validaciones
6. volver a modo local para seguir desarrollo

---

## 7. Decision operativa actual

Mientras el proyecto siga sin busqueda real, el uso correcto es:

- local sin OpenAI para construir y refactorizar
- OpenAI real solo para cerrar Fase 3 de interpretacion

No conviene consumir API real de forma continua hasta terminar esa validacion.
