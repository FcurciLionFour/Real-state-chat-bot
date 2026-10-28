# Frontend MVP

Frontend Angular standalone para la Fase 7 del MVP.

Pantallas actuales:

- `/`
- `/search`
- `/login`
- `/register`
- `/app/chats`
- `/app/chats/:id`
- `/app/favorites`

## Requisitos

- backend NestJS levantado en local
- `backend/.env` con:
  - `FRONTEND_URL=http://localhost:4200`
  - `DATABASE_URL` valido
  - `REDIS_URL` valido

## Configuracion runtime

La URL base del backend no queda hardcodeada en el bundle final.

Se toma de:

- [runtime-config.js](C:/Users/absti/Desktop/PROYECTOS/Real%20state%20chat%20bot/frontend/public/runtime-config.js)

Valor default:

```js
window.__REAL_STATE_APP_CONFIG__ = {
  apiBaseUrl: 'http://localhost:3000/api',
};
```

Para cambiar de entorno, editar ese archivo antes de servir o desplegar.

## Desarrollo local

1. Levantar backend:

```powershell
cd backend
npm start
```

2. Levantar frontend:

```powershell
cd frontend
npm start
```

3. Abrir:

```text
http://localhost:4200
```

## Build

```powershell
cd frontend
npm run build
```

Salida:

- `frontend/dist/frontend`

## Estado actual

Quedó conectado al backend real para:

- register
- login
- refresh por cookie HttpOnly
- logout
- listado de conversaciones
- detalle de conversación
- envío de mensajes
- resultados del último search run
- favoritos

No depende todavía de keys de OpenAI o Google para compilar.
