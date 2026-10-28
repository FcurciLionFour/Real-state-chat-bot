# Checklist QA UX y Funcional

## 1. Objetivo

Este documento sirve para revisar manualmente que la plataforma funciona bien hasta el estado actual del proyecto.

La idea no es solo entrar y mirar pantallas. La idea es recorrer flujos reales, validar comportamiento esperado y marcar con claridad:

- que funciona
- que falla
- que se ve raro
- que hay que rediseñar
- que requiere datos nuevos o credenciales

Usar este documento como checklist antes de seguir agregando features grandes.

---

## 2. Como usar esta checklist

Para cada item marcar:

- `[ ] OK`
- `[ ] Falla`
- `[ ] Dudoso`
- `[ ] No probado`

Formato recomendado para anotar problemas:

```text
Pantalla:
Paso:
Resultado esperado:
Resultado real:
Screenshot:
Prioridad: Alta / Media / Baja
```

Prioridades:

- Alta: bloquea uso, rompe datos, impide navegar o confunde fuerte.
- Media: se puede usar, pero la experiencia queda mala o inconsistente.
- Baja: detalle visual, copy, spacing, icono, microinteraccion.

---

## 3. Preparacion del entorno

### 3.1 Servicios locales

Antes de probar, levantar desde PowerShell:

```powershell
./scripts/start-local.ps1
```

Servicios esperados:

- Frontend: `http://localhost:4200`
- Backend: `http://localhost:3000/api`
- Postgres: activo
- Redis: activo
- Python scraper: opcional segun prueba

Checklist:

- `[OK]` Frontend abre en `http://localhost:4200`
- `[OK]` Backend responde en `http://localhost:3000/api/health/ready`
- `[ ]` No hay errores rojos al cargar la app
- `[ ]` Consola del navegador no muestra errores repetidos
- `[ ]` Si se cambio `.env`, backend fue reiniciado

### 3.2 Cuenta de prueba

Cuenta simple de usuario:

```text
Email: user.demo@local.test
Password: StrongPassword123
Rol: USER
```

Checklist:

- `[ ]` La cuenta puede iniciar sesion
- `[ ]` La cuenta no entra al admin
- `[ ]` La sesion se mantiene al refrescar si corresponde
- `[ ]` Logout o expiracion no deja la app rota

---

## 4. Login

Ruta:

```text
/login
```

Comportamiento esperado:

- No debe haber scroll vertical innecesario.
- El card de login debe estar centrado.
- No debe aparecer un segundo logo `busca.ar` dentro del card.
- Header superior debe verse limpio.
- Inputs deben permitir email y password.
- Error de credenciales debe ser claro.

Casos a probar:

- `[ ]` Entrar a `/login`
- `[ ]` Verificar que no haya scroll innecesario
- `[ ]` Login correcto con `user.demo@local.test`
- `[ ]` Login con password incorrecta
- `[ ]` Login con email invalido
- `[ ]` Ir a register desde link inferior
- `[ ]` Volver a inicio desde nav

Criterio OK:

- El usuario entiende donde esta.
- Puede iniciar sesion sin friccion.
- No hay elementos duplicados ni desalineados.

---

## 5. Registro

Ruta:

```text
/register
```

Comportamiento esperado:

- Card centrado.
- Sin logo duplicado dentro del formulario.
- Sin scroll innecesario.
- Password y repetir password validan correctamente.
- Al registrarse debe crear cuenta y permitir entrar.

Casos a probar:

- `[ ]` Entrar a `/register`
- `[ ]` Crear cuenta con email nuevo
- `[ ]` Intentar crear cuenta con email ya usado
- `[ ]` Passwords distintas
- `[ ]` Password corta o invalida
- `[ ]` Navegar a login desde link inferior

Criterio OK:

- El flujo no confunde login con registro.
- Los errores son entendibles.

---

## 6. Sidebar global

Pantallas donde debe verse consistente:

- `/app/chats`
- `/app/chats/:id`
- `/app/map`
- `/app/favorites`
- `/blog`
- `/app/publish-property`
- `/app/my-properties`

Comportamiento esperado:

- Misma estructura visual de sidebar.
- Iconos consistentes y legibles.
- Estado activo correcto segun ruta.
- No debe aparecer `Buscar` si decidimos sacarlo.
- `Mapa` debe aparecer siempre que corresponda.
- `Nueva busqueda` debe ser visible y funcionar.
- El usuario activo debe verse abajo.

Items:

- `[ ]` Inicio visible
- `[ ]` Chats visible
- `[ ]` Mapa visible
- `[ ]` Favoritos visible
- `[ ]` Blog visible
- `[ ]` Publicar propiedad visible
- `[ ]` Mis propiedades visible
- `[ ]` Admin solo visible para admin
- `[ ]` Iconos se ven bien
- `[ ]` Active state coincide con pantalla actual
- `[ ]` No hay superposicion en la parte inferior

Criterio OK:

- La app se siente como una sola app, no como pantallas separadas.

---

## 7. Workspace de chat

Rutas:

```text
/app/chats
/app/chats/:id
/chat
```

Comportamiento esperado:

- Si no hay conversacion, mostrar estado inicial claro.
- Si hay conversacion, abrir la ultima o la seleccionada.
- El input de mensaje debe estar fijo abajo.
- El historial de conversaciones no debe superponerse con usuario activo.
- Los resultados deben aparecer dentro del flujo sin tapar el composer.

Casos a probar:

- `[ ]` Entrar a `/app/chats`
- `[ ]` Crear nueva busqueda
- `[ ]` Enviar: `Quiero comprar un departamento en Palermo hasta 120000 USD`
- `[ ]` Enviar modificacion: `Que tenga balcon y cochera`
- `[ ]` Enviar modificacion: `Mejor en Caballito`
- `[ ]` Refrescar pantalla y verificar que el chat sigue
- `[ ]` Cambiar entre conversaciones del sidebar
- `[ ]` Ver que no haya texto superpuesto si no hay historial

Criterio OK:

- El chat mantiene contexto.
- El usuario no tiene que repetir todo.
- La UI no se rompe con resultados.

---

## 8. Resultados en chat

Comportamiento esperado:

- Cards legibles.
- Imagen no deformada.
- Precio claro.
- Fuente visible.
- Ubicacion clara.
- Botones:
  - Ver detalle
  - Comparar
  - Guardar
- Footer de resultados:
  - Cargar mas resultados
  - Comparar
  - Ver comparacion en mapa
  - Ver en el mapa
  - Guardar busqueda
  - Ajustar presupuesto

Casos a probar:

- `[ ]` Ver cards en desktop
- `[ ]` Cambiar vista grilla/lista si aplica
- `[ ]` Cargar mas resultados
- `[ ]` Abrir detalle
- `[ ]` Cerrar detalle
- `[ ]` Guardar una propiedad
- `[ ]` Quitar guardado
- `[ ]` Seleccionar dos para comparar
- `[ ]` Tocar `Ver en el mapa`
- `[ ]` Tocar `Ver comparacion en mapa`
- `[ ]` Tocar `Ajustar presupuesto`

Criterio OK:

- Las acciones hacen lo que dicen.
- No hay botones muertos.
- No se dispara un prompt cuando deberia navegar.

---

## 9. Panel de detalle de propiedad

Comportamiento esperado:

- Se abre desde una card.
- Muestra galeria si hay imagenes.
- Muestra precio, direccion, descripcion, metricas y features.
- Tiene acciones:
  - Guardar
  - Comparar
  - Abrir mapa
  - Google Maps
  - Contacto/fuente original
- Se puede cerrar sin perder estado del chat.

Casos a probar:

- `[ ]` Abrir detalle desde card
- `[ ]` Cambiar imagen si hay varias
- `[ ]` Guardar desde detalle
- `[ ]` Comparar desde detalle
- `[ ]` Abrir mapa desde detalle
- `[ ]` Abrir Google Maps
- `[ ]` Cerrar detalle
- `[ ]` Verificar que composer sigue usable

Criterio OK:

- El panel ayuda a decidir, no tapa ni rompe el workspace.

---

## 10. Ajustar presupuesto / editor rapido

Comportamiento esperado:

- Al tocar `Ajustar presupuesto`, aparece un panel visible arriba del composer.
- No debe quedar solo el overlay gris.
- El panel debe permitir editar:
  - operacion
  - tipo
  - moneda
  - ambientes
  - dormitorios
  - banos
  - ubicacion
  - tope
- `Cerrar` debe cerrar panel.
- Click fuera debe cerrar panel.

Casos a probar:

- `[ ]` Abrir panel
- `[ ]` Cerrar con boton
- `[ ]` Cerrar tocando overlay
- `[ ]` Cambiar tope de precio
- `[ ]` Cambiar ubicacion
- `[ ]` Cambiar ambientes
- `[ ]` Verificar que dispara nueva busqueda o actualiza estado segun accion
- `[ ]` Verificar consola sin warning de foco/aria-hidden repetitivo

Criterio OK:

- El panel aparece en lugar correcto.
- No deja la pantalla bloqueada.

---

## 11. Comparacion

Comportamiento esperado:

- Se pueden seleccionar dos propiedades.
- El contador debe reflejar seleccion.
- Si hay menos de dos, comparar debe estar deshabilitado o no ejecutar.
- `Ver comparacion en mapa` debe mandar esas propiedades al mapa.

Casos a probar:

- `[ ]` Seleccionar una propiedad
- `[ ]` Seleccionar dos propiedades
- `[ ]` Deseleccionar una
- `[ ]` Intentar seleccionar tercera
- `[ ]` Ejecutar comparacion
- `[ ]` Ver comparacion en mapa

Criterio OK:

- El usuario entiende que compara dos propiedades.
- No se pierden seleccionadas al navegar al mapa.

---

## 12. Favoritos

Ruta:

```text
/app/favorites
```

Comportamiento esperado:

- Muestra propiedades guardadas.
- Permite buscar en favoritos.
- Permite filtrar por compra/alquiler/tipo.
- Permite abrir detalle.
- Permite comparar o buscar similares si aplica.
- Sidebar debe ser el mismo que el resto.

Casos a probar:

- `[ ]` Guardar propiedad desde chat
- `[ ]` Entrar a favoritos
- `[ ]` Ver que aparece guardada
- `[ ]` Buscar por texto
- `[ ]` Filtrar compra/alquiler
- `[ ]` Abrir detalle
- `[ ]` Quitar favorito
- `[ ]` Refrescar y verificar persistencia

Criterio OK:

- Favoritos refleja acciones reales del usuario.
- No muestra datos duplicados o viejos sin sentido.

---

## 13. Blog

Ruta:

```text
/blog
```

Comportamiento esperado:

- Sidebar consistente.
- Cards de articulos visibles.
- Filtros de categoria funcionan.
- Busqueda de articulos funciona si backend responde.
- Si backend falla, mostrar error claro sin romper layout.
- El blog no debe aparecer dentro del chat como `Insights del mercado`.

Casos a probar:

- `[ ]` Entrar a `/blog`
- `[ ]` Ver articulos
- `[ ]` Filtrar por Compra
- `[ ]` Filtrar por Alquiler
- `[ ]` Buscar articulo
- `[ ]` Abrir articulo
- `[ ]` Volver al listado
- `[ ]` Confirmar que en chat no aparece seccion de insights/blog

Criterio OK:

- Blog se siente como modulo separado.
- Error de API no rompe toda la pagina.

---

## 14. Publicar propiedad

Ruta:

```text
/app/publish-property
```

Comportamiento esperado:

- Pantalla de validacion clara.
- No debe parecer una pantalla vacia o improvisada.
- Debe explicar que la cuenta debe validarse.
- Botones:
  - Solicitar validacion
  - Ver mis propiedades
- Cards inferiores explican requisitos.
- Sidebar consistente.

Casos a probar:

- `[ ]` Entrar como USER
- `[ ]` Ver pantalla de validacion
- `[ ]` Tocar `Solicitar validacion`
- `[ ]` Tocar `Ver mis propiedades`
- `[ ]` Ver responsive en ancho chico

Criterio OK:

- El usuario entiende por que no puede publicar todavia.
- La pantalla se ve integrada al producto.

---

## 15. Mis propiedades

Ruta:

```text
/app/my-properties
```

Comportamiento esperado:

- Muestra propiedades propias si existen.
- Empty state claro si no existen.
- Sidebar consistente.
- No debe permitir acciones confusas a un USER si aun no esta validado.

Casos a probar:

- `[ ]` Entrar a mis propiedades
- `[ ]` Empty state correcto
- `[ ]` Si hay propiedades, ver listado
- `[ ]` Abrir detalle/editar si aplica
- `[ ]` Volver a publicar propiedad

Criterio OK:

- El usuario entiende el estado de sus publicaciones.

---

## 16. Mapa

Ruta:

```text
/app/map
```

Comportamiento esperado general:

- El mapa debe cargar como herramienta de exploracion.
- Si viene desde chat, debe usar esas propiedades.
- Si entra directo, debe usar ultima busqueda, favoritos o demo.
- Lista izquierda y pins deben estar sincronizados.
- El mapa no debe inventar precision falsa.
- Si una propiedad tiene `geo`, usar coordenadas reales del backend.
- Si no tiene `geo`, mostrar ubicacion aproximada.

### 16.1 Carga inicial

Casos:

- `[ ]` Entrar directo a `/app/map`
- `[ ]` Entrar desde `Ver en el mapa` en chat
- `[ ]` Entrar desde `Ver comparacion en mapa`
- `[ ]` Entrar desde detalle de propiedad

Resultado esperado:

- El mapa abre.
- No redirige al chat.
- No queda pantalla verde sin tiles.
- La lista tiene scroll.
- Las cards no se aplastan.

### 16.2 Lista izquierda

Comportamiento esperado:

- Cards con altura minima.
- Scroll vertical.
- Imagen, badge, titulo, ubicacion, precio y datos base legibles.
- Click en card centra mapa y abre preview.

Casos:

- `[ ]` Scrollear lista
- `[ ]` Click en primera card
- `[ ]` Click en card intermedia
- `[ ]` Guardar desde card
- `[ ]` Ver que no se corte texto de forma absurda

### 16.3 Pins

Comportamiento esperado:

- Pin muestra precio abreviado.
- Venta verde.
- Alquiler violeta.
- Si precision es aproximada, el pin debe verse menos definitivo.
- Click en pin abre preview.

Casos:

- `[ ]` Click en pin
- `[ ]` Cerrar preview
- `[ ]` Click en otro pin
- `[ ]` Zoom in/out
- `[ ]` Ver clusters si hay muchos pins

### 16.4 Ubicacion real

Comportamiento esperado:

- Si backend devuelve `geo`, el pin usa `latitude/longitude`.
- Si `geo.precision` es `exact` o `street`, mostrar como direccion estimada.
- Si `geo.precision` es `neighborhood`, mostrar zona aproximada.
- No distribuir pins al azar para que se vean lindos.

Casos:

- `[ ]` Hacer una busqueda nueva despues de activar geocoding
- `[ ]` Abrir resultados en mapa
- `[ ]` Revisar una direccion conocida
- `[ ]` Comparar pin contra Google Maps
- `[ ]` Ver que propiedades sin direccion exacta digan zona aproximada

Nota:

Si las propiedades son viejas de cache, pueden no tener `geo`. Para probar geocoding, ejecutar una busqueda nueva o invalidar cache operativo.

### 16.5 Buscar en esta zona

Comportamiento esperado:

- Al mover mapa aparece `Buscar en esta zona`.
- No debe refrescar resultados automaticamente con cada movimiento.
- Al tocar el boton, lista y pins se actualizan al area visible.

Casos:

- `[ ]` Drag del mapa
- `[ ]` Zoom del mapa
- `[ ]` Ver boton `Buscar en esta zona`
- `[ ]` Tocar boton
- `[ ]` Ver lista sincronizada

### 16.6 Panel derecho

Comportamiento esperado:

- `Ver detalle` abre panel derecho.
- Panel muestra imagen, precio, direccion, features y acciones.
- Se puede cerrar.
- El mapa se mantiene usable.

Casos:

- `[ ]` Abrir panel desde preview
- `[ ]` Cerrar panel
- `[ ]` Comparar propiedad
- `[ ]` Guardar propiedad
- `[ ]` Abrir en chat IA
- `[ ]` Ver detalle completo en fuente

Criterio OK del mapa:

- El usuario entiende visualmente donde estan las propiedades.
- No se muestran ubicaciones falsas como si fueran exactas.
- Lista, pins y detalle trabajan juntos.

---

## 17. Geocoding backend

Estado esperado:

- `.env` local puede usar:

```text
GEOCODING_PROVIDER=nominatim
GEOCODING_NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
GEOCODING_TIMEOUT_MS=3500
```

- Backend persiste en `PropertyCache`:
  - `latitude`
  - `longitude`
  - `geoPrecision`
  - `geocodingProvider`
  - `geocodedAt`

Casos a probar:

- `[ ]` Backend levanta con `GEOCODING_PROVIDER=nominatim`
- `[ ]` `/api/health/ready` responde
- `[ ]` Hacer busqueda nueva
- `[ ]` Verificar en DB que algunas propiedades tienen lat/lng
- `[ ]` Verificar que frontend recibe `geo`
- `[ ]` Abrir mapa y verificar pins usando `geo`

Consulta SQL util:

```sql
select title, locationText, latitude, longitude, geoPrecision, geocodingProvider, geocodedAt
from "PropertyCache"
where latitude is not null
order by "updatedAt" desc
limit 20;
```

Criterio OK:

- El backend resuelve coordenadas y las cachea.
- El frontend no hace geocoding directo.

---

## 18. Admin

Ruta:

```text
/app/admin
```

Comportamiento esperado:

- Solo ADMIN accede.
- USER debe ser bloqueado.
- Panel muestra overview, metricas, usuarios, propiedades, search runs, etc.
- Acciones administrativas no deben estar disponibles para usuario simple.

Casos:

- `[ ]` Entrar como USER a `/app/admin`
- `[ ]` Confirmar bloqueo o redireccion
- `[ ]` Entrar como ADMIN si existe cuenta admin
- `[ ]` Ver overview
- `[ ]` Ver usuarios
- `[ ]` Ver propiedades
- `[ ]` Ver search runs
- `[ ]` Invalidar cache operativo

Criterio OK:

- RBAC no permite acceso indebido.

---

## 19. Responsive

Anchos a revisar:

- Desktop normal: `1366x768`
- Desktop ancho: `1440+`
- Tablet aproximado: `900px`
- Mobile: `390px`

Pantallas criticas:

- Login
- Register
- Chat
- Resultados
- Detalle propiedad
- Mapa
- Favoritos
- Blog
- Publicar propiedad

Checklist:

- `[ ]` No hay texto superpuesto
- `[ ]` No hay botones cortados
- `[ ]` Sidebar se comporta correctamente
- `[ ]` Composer de chat queda usable
- `[ ]` Mapa no queda sin altura
- `[ ]` Lista del mapa scrollea
- `[ ]` Paneles se pueden cerrar

---

## 20. Consola del navegador

Durante toda la prueba mantener DevTools abierto.

No deberia haber:

- Errores rojos repetidos.
- Errores de Leaflet al salir del mapa.
- Warnings de `aria-hidden` por foco atrapado.
- 401 inesperados en sesion activa.
- 500 en endpoints principales.
- Loops de requests.

Checklist:

- `[ ]` Login sin errores rojos
- `[ ]` Chat sin errores rojos
- `[ ]` Mapa sin errores rojos
- `[ ]` Blog sin errores rojos
- `[ ]` Favoritos sin errores rojos
- `[ ]` Publicar propiedad sin errores rojos

---

## 21. Backend y logs

Endpoints utiles:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health/live
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health/ready
```

Checklist:

- `[ ]` Backend responde `live`
- `[ ]` Backend responde `ready`
- `[ ]` Redis aparece `up` o degradado sin romper app
- `[ ]` Discovery aparece configurado si hay credenciales
- `[ ]` No hay stack traces repetidos
- `[ ]` No hay secretos impresos en logs

---

## 22. Cache y datos viejos

Importante:

Algunas pruebas pueden verse mal si la app usa propiedades cacheadas antes de cambios recientes.

Casos donde conviene invalidar o generar datos nuevos:

- Geocoding nuevo.
- Cambios de normalizacion.
- Cambios de ranking.
- Cambios de mapa.

Checklist:

- `[ ]` Probar con datos actuales
- `[ ]` Invalidar cache desde admin si hace falta
- `[ ]` Ejecutar busqueda nueva
- `[ ]` Confirmar que resultados nuevos traen campos esperados

---

## 23. Criterio de cierre de esta etapa

No seguir con admin avanzado ni features grandes si hay fallos altos en:

- Login/register
- Chat y search state
- Resultados
- Detalle propiedad
- Favoritos
- Mapa con coordenadas
- Sidebar consistente
- Backend health

Para considerar esta etapa OK:

- `[ ]` Usuario puede entrar
- `[ ]` Usuario puede buscar
- `[ ]` Usuario puede refinar busqueda
- `[ ]` Usuario puede ver resultados
- `[ ]` Usuario puede guardar favoritos
- `[ ]` Usuario puede abrir mapa
- `[ ]` Mapa no miente con ubicaciones
- `[ ]` Usuario puede volver al chat
- `[ ]` No hay errores rojos bloqueantes
- `[ ]` Backend queda estable

---

## 24. Tabla rapida de ejecucion

| Modulo | Estado | Observaciones |
| --- | --- | --- |
| Login | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Register | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Sidebar | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Chat | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Resultados | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Detalle propiedad | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Ajustar presupuesto | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Comparacion | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Favoritos | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Blog | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Publicar propiedad | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Mis propiedades | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Mapa | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Geocoding | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Admin | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Responsive | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Consola browser | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |
| Backend health | `[ ] OK` `[ ] Falla` `[ ] Dudoso` | |

