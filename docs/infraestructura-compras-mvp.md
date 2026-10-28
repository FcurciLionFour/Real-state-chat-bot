# Infraestructura y Compras MVP

## 1. Objetivo

Este documento sirve para definir, de forma simple, que tiene que comprar o activar negocio para poder poner en linea el MVP.

No busca listar todas las opciones del mercado.

Busca dejar una recomendacion concreta para este proyecto:

- donde alojar frontend
- donde alojar backend
- donde correr Postgres y Redis
- que cuentas pagas hacen falta
- que cosas conviene comprar ahora y cuales dejar para despues

Fecha de preparacion:

- 8 de abril de 2026

Regla:

- los precios pueden cambiar
- antes de pagar, conviene re-chequear la pantalla oficial de checkout de cada proveedor

---

## 2. Recomendacion cerrada para este MVP

### Stack recomendado

- frontend: `Vercel`
- backend API: `Railway`
- base de datos PostgreSQL: `Railway Postgres`
- Redis: `Railway Redis`
- IA: `OpenAI API`
- discovery de URLs: `Google Custom Search JSON API`
- dominio principal Argentina: `NIC Argentina` para `.com.ar`
- dominio internacional opcional: `Cloudflare Registrar` para `.com`
- email transaccional futuro: `Resend`

### Por que esta es la recomendacion

- es la combinacion mas simple para sacar el MVP sin meter DevOps pesado
- separa bien frontend y backend
- el backend ya esta armado con NestJS + PostgreSQL + Redis, asi que Railway encaja bien
- Vercel encaja muy bien con frontend web moderno
- OpenAI y Google Search son dos costos variables del producto y conviene tenerlos desacoplados

---

## 3. Que hay que comprar o activar

## 3.1 Frontend

### Recomendacion

- usar `Vercel Pro`

### Motivo

- `Vercel Hobby` es para uso personal y no comercial
- este proyecto es de negocio, aunque sea MVP
- `Vercel Pro` ya sirve para dominio propio, despliegues mas serios y control de gasto

### Precio oficial verificado

- `Hobby`: gratis
- `Pro`: `USD 20/mes` mas uso adicional

### Decision practica

- si solo quieren demo interna cerrada: se puede arrancar en `Hobby`
- si lo van a mostrar como producto real o con dominio de marca: recomiendo `Pro`

---

## 3.2 Backend API

### Recomendacion

- usar `Railway`

### Motivo

- despliega facil una app Node/Nest
- permite correr API, Postgres y Redis dentro del mismo proyecto
- reduce mucho la complejidad operativa inicial

### Precio oficial verificado

- `Free`: `USD 0/mes`
- `Hobby`: `USD 5/mes` e incluye `USD 5` de uso
- `Pro`: `USD 20/mes` e incluye `USD 20` de uso

### Precios de uso oficiales que mas importan

- RAM: `USD 10 / GB / mes`
- CPU: `USD 20 / vCPU / mes`
- egress: `USD 0.05 / GB`
- storage persistente: `USD 0.15 / GB / mes`

### Decision practica

- si yo soy el unico que administra infraestructura: `Railway Hobby`
- si ambas quieren entrar al workspace, revisar deploys y tocar variables: `Railway Pro`

### Nota importante

- no esperaria que el costo real cierre en `USD 5` si dejamos `API + Postgres + Redis` encendidos 24/7
- `USD 5` es el piso del plan, no un techo real de operacion

### Estimacion conservadora para MVP

- `USD 15 a USD 40/mes`

Esto es una inferencia razonable para trafico bajo y servicios chicos, no un precio contractual.

---

## 3.3 Base de datos PostgreSQL

### Recomendacion

- correrla en `Railway Postgres`

### Motivo

- ya expone `DATABASE_URL`
- evita administrar un proveedor aparte al principio
- acelera mucho el primer release usable

### Compra separada

- no hace falta comprar una base aparte si usamos Railway

### Cuando cambiaria esto

- si mas adelante quieren backups mas fuertes, dashboards mejores o separar responsabilidades
- en ese caso se puede evaluar mover Postgres a `Supabase` o similar

---

## 3.4 Redis

### Recomendacion

- correrlo en `Railway Redis`

### Motivo

- el proyecto ya lo usa para cache
- queda en el mismo entorno que el backend
- reduce tiempo de integracion

### Compra separada

- no hace falta comprar Redis aparte si usamos Railway

---

## 3.5 OpenAI API

### Recomendacion

- abrir cuenta de `OpenAI Platform`
- cargar credito prepago
- arrancar con `gpt-4.1-mini`

### Motivo

- es suficientemente barato para MVP
- ya esta alineado con el backend actual

### Precio oficial verificado

- compra minima inicial de credito: `USD 5`
- `gpt-4.1-mini`:
  - input: `USD 0.40 / 1M tokens`
  - output: `USD 1.60 / 1M tokens`

### Decision practica

- cargar `USD 10` alcanza para pruebas reales iniciales con bastante margen
- si quieren ultra prudencia, cargar `USD 5`

### Nota administrativa

- para API individual/team, OpenAI maneja prepago y recibos/historial de pago
- la facturacion enterprise es otra categoria distinta

---

## 3.6 Discovery de resultados

### Recomendacion

- activar `Google Custom Search JSON API`

### Motivo

- hoy el proyecto depende de discovery para encontrar URLs candidatas
- sin esto, la busqueda real queda limitada o cae en fallback

### Precio oficial verificado

- `100` queries por dia gratis
- despues: `USD 5 / 1000 queries`
- limite oficial: hasta `10.000` queries por dia

### Decision practica

- para pruebas internas, probablemente el free alcance al principio
- para publicar MVP serio, conviene activar billing desde el dia 1 igual

---

## 3.7 Dominio

### Recomendacion minima

- comprar `marca.com.ar`

### Proveedor recomendado para Argentina

- `NIC Argentina`

### Precio oficial verificado

- alta `.com.ar`: `ARS 8.500`
- renovacion anual `.com.ar`: `ARS 8.500`

### Recomendacion adicional

- si la marca importa de verdad, tambien comprar `marca.com`

### Proveedor recomendado para `.com`

- `Cloudflare Registrar`

### Nota de precio

- Cloudflare vende a precio de costo del registry, sin markup
- el valor exacto del `.com` puede variar segun registry e ICANN y conviene verlo al momento de compra

### Decision practica

- minimo: `com.ar`
- ideal: `com.ar + com`

---

## 3.8 Email transaccional

### Hace falta ahora

- no para el MVP tecnico actual

### Va a hacer falta despues

- si activamos registro con verificacion por email
- si activamos recuperacion de password

### Recomendacion

- `Resend`

### Precio oficial verificado

- `Free`: `3.000 emails/mes`, `100/dia`, `1 domain`
- `Pro`: `USD 20/mes`, `50.000 emails/mes`

### Decision practica

- no hace falta comprarlo hoy
- si en la siguiente etapa activamos email verification, el plan `Free` deberia alcanzar al inicio

---

## 4. Presupuesto sugerido

## 4.1 Presupuesto minimo para avanzar ya

- dominio `.com.ar`: `ARS 8.500/año`
- `Railway Hobby`: `USD 5/mes` base
- `OpenAI`: `USD 5 a USD 10` iniciales
- `Google Search API`: `USD 0` al principio si entramos en free
- frontend: `Vercel Hobby` solo si es demo interna

### Lectura realista

Esto sirve para arrancar, pero no es la configuracion que recomiendo para mostrar producto comercial.

---

## 4.2 Presupuesto recomendado para MVP serio

- frontend `Vercel Pro`: `USD 20/mes`
- backend + Postgres + Redis en `Railway`: estimar `USD 15 a USD 40/mes`
- OpenAI: cargar `USD 10` iniciales
- Google Search API: `USD 0` al principio o variable segun uso
- dominio `.com.ar`: `ARS 8.500/año`
- dominio `.com`: variable segun checkout de Cloudflare

### Orden de magnitud mensual recomendado

- infraestructura base: `USD 35 a USD 60/mes`
- mas OpenAI variable
- mas Google Search variable

Esto es una estimacion operativa mia a partir de los precios oficiales. No reemplaza el billing real del proveedor.

---

## 4.3 Cosas que no hace falta comprar ahora

- observabilidad paga externa
- CDN aparte
- balanceador aparte
- servicios enterprise
- dedicated IP para email
- proveedor separado de Postgres
- proveedor separado de Redis

---

## 5. Compra recomendada por orden

1. comprar `dominio .com.ar` en `NIC Argentina`
2. comprar tambien `dominio .com` si quieren proteger marca
3. abrir `Vercel`
4. abrir `Railway`
5. abrir `OpenAI Platform` y cargar credito
6. abrir `Google Cloud` y activar `Custom Search JSON API`
7. dejar `Resend` para la etapa en que activemos email verification

---

## 6. Decision ejecutiva sugerida

Si quieren una decision simple para avanzar sin discutir demasiado:

- frontend: `Vercel Pro`
- backend + Postgres + Redis: `Railway Hobby` si administro yo solo, `Railway Pro` si vamos a entrar las dos
- IA: `OpenAI prepago` con carga inicial de `USD 10`
- discovery: `Google Custom Search JSON API`
- dominio: `com.ar` si o si, `com` si el nombre de marca importa

---

## 7. Riesgos o aclaraciones para negocio

- `Vercel Hobby` no es la recomendacion para uso comercial
- `Railway` cobra por uso real; no conviene leer el plan de `USD 5` como costo final garantizado
- `OpenAI` no es el unico costo variable; discovery y hosting tambien pesan
- si en el futuro activamos mails, hay que sumar proveedor transaccional
- si el volumen crece mucho, probablemente mas adelante convenga separar backend y base de datos en infraestructura mas robusta

---

## 8. Fuentes oficiales verificadas

- Vercel pricing: https://vercel.com/pricing
- Vercel Hobby plan y restriccion de uso no comercial: https://vercel.com/docs/accounts/plans/hobby
- Railway pricing: https://docs.railway.com/reference/pricing/plans
- Railway Postgres: https://docs.railway.com/guides/postgresql
- Railway Redis: https://docs.railway.com/guides/redis
- OpenAI prepaid billing: https://help.openai.com/en/articles/8264644-what-is-prepaid-billing
- OpenAI API pricing: https://platform.openai.com/docs/pricing/
- Google Custom Search JSON API pricing: https://developers.google.com/custom-search/v1/overview
- NIC Argentina dominios y aranceles: https://nic.ar/es/dominios/dominios_y_aranceles
- Cloudflare Registrar: https://www.cloudflare.com/products/registrar/
- Resend pricing: https://resend.com/pricing
