# Rediseño visual "Mapbox" + Métricas y Administración estilo tenant de Microsoft — Diseño

- **Fecha:** 2026-11-09
- **Estado:** aprobado por secciones en conversación (con maquetas en el compañero visual); pendiente revisión de este documento
- **Subproyecto:** 2 de 2 (el 1 fue la migración a Znuny, ya en producción desde el 9-nov-2026)

## 1. Objetivo y alcance

Mejorar la presentación de **todo el frontend** con una estética "Mapbox fiel" (consola satelital nocturna: base negra neutra, paneles sólidos sin bordes, un solo azul interactivo), resolver el panel del sitio amontonado y llevar **Métricas** y **Administración** a la estructura del centro de administración de Microsoft 365 / Entra ("tenant"), siempre en tema **oscuro**.

**Decisiones del usuario (verbatim de la conversación):**
- Dirección: **A · Mapbox fiel (azul señal)**.
- Tarjetas del panel del sitio: **Lista** (una fila por ticket); siempre visibles: Nº + título + prioridad + estado, propietario, cola, antigüedad/SLA.
- Ubicación del panel: **panel inferior (como hoy) + detalle a la derecha**.
- Indicador de prioridad: **tinte suave**, nunca barra lateral ("muy diseño de IA"); aplicar en todos los lugares donde había barra.
- Métricas y Administración: **estilo tenant de Microsoft**, incluyendo exportar CSV, buscador, selector de columnas, y las páginas nuevas **Inicio** y **Estado de conexión**.
- Texto: nunca "Znuny" en la UI → **"Mesa de Servicio"**; botón **"Abrir en la Mesa de Servicio"** con el logo `frontend/src/img/GCS_logo_nuevo_font_transparente.svg`.
- Alcance: **todo el sistema** (mapa, métricas, notificaciones, histórico, login, admin).

**Supuesto registrado:** tema oscuro también en Admin/Métricas (el usuario no eligió claro/oscuro; se mantiene oscuro por consistencia — cambiable en revisión).

**Fuera de alcance:** el HTML del correo de recuperación, lógica de datos y permisos (salvo el endpoint nuevo de estado, §8.3), identificadores de código que contengan "znuny".

**Incluido además (pendiente del subproyecto 1):** el form de edición de usuario no reenvía `allowedDepartments` si no cambiaron (en modo snapshot un departamento sin tickets bloqueaba la edición con un 400 invisible).

## 2. Tokens (fuente única de verdad)

Definidos como variables CSS en `frontend/src/index.css` y expuestos en `tailwind.config` (`theme.extend.colors`, `borderRadius`, `fontFamily`). **Ningún componente usa colores hex literales** después del rediseño (excepto los colores de datos, que se leen de los tokens `--data-*`).

### 2.1 Superficies y líneas
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0e1012` | fondo general, barra superior del dashboard |
| `--surface-1` | `#15171b` | paneles (KPIs, panel del sitio, rail, tarjetas, nav de admin) |
| `--surface-2` | `#1c1f24` | contenido anidado (detalle del ticket, hover de fila, inputs) |
| `--surface-3` | `#23262d` | seleccionado, menús, tooltips, notificaciones |
| `--line` | `#1c1f24` | divisores de tabla |
| `--line-strong` | `#333943` | bordes de inputs, cuadrantes vacíos del aro |
| `--line-control` | `#444d5a` | borde de botones secundarios / herramienta |

### 2.2 Texto (contraste medido contra `--surface-1`)
| Token | Valor | Contraste | Uso |
|---|---|---|---|
| `--text-strong` | `#ffffff` | 17.9 | títulos, números de KPI, título de ticket |
| `--text` | `#a0aaba` | 7.6 | cuerpo |
| `--text-muted` | `#8b96aa` | 6.0 | datos secundarios |
| `--text-label` | `#76829a` | 4.6 | etiquetas en mayúsculas, encabezados de tabla |
| `--text-faint` | `#566171` | 2.9 | **solo no-texto** (divisores, cuadrantes vacíos) |

### 2.3 Acento (único color interactivo)
| Token | Valor | Uso |
|---|---|---|
| `--accent` | `#007afc` | indicadores sin texto: contorno de selección, foco, punto activo |
| `--accent-fill` | `#0a6fe6` | relleno de botones primarios/pestaña activa con texto blanco (4.74:1) |
| `--accent-text` | `#3d9bff` | links y texto azul sobre paneles (6.26:1) |

Regla: el acento **nunca** aparece en el mapa ni en datos (barras, aro, prioridades).

### 2.4 Colores de datos (sin cambios de valor)
`--data-p0 #ff4d6d` (crítica / rank 0), `--data-p1 #f5a623`, `--data-p2 #4c7fff`, `--data-p3 #34d399` (rank ≥ 3); por tipo de estado `--state-new #3ed6c4`, `--state-open #4c7fff`, `--state-pending #f5a623`, `--state-closed #64748b`. Texto sobre tinte usa las variantes claras ya verificadas (`#ff718a`, `#f7b84f`, `#7099ff`, `#5ee0b0`).

### 2.5 Tinte de prioridad (reemplaza toda barra lateral)
Función pura `priorityTint(rank, variant)` en `frontend/src/lib/priorityTint.ts`:
- `variant: "card"` (notificaciones, KPI crítico): `linear-gradient(180deg, rgba(c,.14), rgba(c,.04) 55%), <surface>`.
- `variant: "row"` (filas del panel y de tablas): `linear-gradient(90deg, rgba(c,.12 rank0 | .10 rank1 | .09 rank2 | .08 rank3), rgba(c,0) 34%)`.
- rank desconocido → rank 3.
La palabra de la prioridad se muestra en su color. **Selección** = fondo `--surface-3` + contorno `0 0 0 1px rgba(0,122,252,.6)` (nunca barra).

### 2.6 Tipografía y forma
- **DM Sans** 400/500/700 (Google Fonts en `index.html`, reemplaza Space Grotesk/Inter/Public Sans; fallback `system-ui`). **JetBrains Mono** para Nº de ticket, %, etiquetas técnicas.
- Escala: mínimo 12 px; etiquetas 11 px solo en mayúsculas con `letter-spacing .12em`; KPI 30–32 px 700; títulos de página 22 px 700 `-0.01em`.
- Radios: paneles del dashboard 20 px; tarjetas de Métricas/Admin 8 px (estilo Microsoft); chips 12; insignias 4; inputs/herramientas 6; botones y pestañas en píldora (100 px).
- **Paneles sólidos**: se elimina `backdrop-filter` (pesado en navegadores de TV); `.glass-panel` pasa a `--surface-1`.
- **Viñeta del mapa**: capa `pointer-events:none` con `box-shadow: inset 0 0 120px 40px var(--bg)` por encima de los tiles y por debajo de marcadores y paneles. No se toca el contenedor de Leaflet ni `hudScale`.

## 3. Mapa (estilo dashboard)
- **Barra superior** (56 px, `--bg`): logo GCS, "Mapa de Incidencias", etiqueta "EL SALVADOR · MESA DE SERVICIO"; pestañas Mapa/Métricas/Histórico en píldora (activa `--accent-fill`); sonido, SyncStatus, admin y salir como botones-herramienta (borde `--line-control`, radio 6).
- **Columna izquierda**: selector de cola + KPIs sólidos (número blanco; solo "Crítica abiertos" en rojo y con tinte `card` cuando > 0).
- **Rail de sitios**: filas limpias; seleccionado = regla de selección §2.5.
- **Marcadores**: sin cambios de estructura (foto + aro + insignia + fichas); cuadrantes vacíos `--line-strong`; anillo de selección `--accent`.

### 3.1 Panel del sitio (franja inferior)
- Encabezado: nombre del sitio (20 px 700), tipo + "N abiertos", filtros por estado en píldoras con conteo, botón "Cerrar".
- **Lista (≈60 %)**: una fila por ticket, columnas: título blanco con `Nº · hace X` debajo (mono) | cola ("Tecnología › Servicios IT") | propietario | estado (punto + texto) | anillo SLA. Tinte `row` por prioridad; hover `--surface-2`; selección §2.5.
- **Detalle (≈40 %, `--surface-2`)**: título completo, insignias de prioridad y estado, tabla clave/valor (cola completa, tipo, servicio, propietario, responsable, cliente, creado, vencimiento SLA) y botón **"Abrir en la Mesa de Servicio ↗"** (píldora `--accent-fill` con el logo en círculo blanco de 20 px).
- Al abrir el panel se selecciona el primer ticket (el detalle nunca queda vacío). Alto ≈ 38 % del viewport, redimensionable con el asa como hoy.

### 3.2 Componente de detalle único
`TicketDetail` (nuevo) se usa en el panel del sitio, como panel lateral en Métricas y en ningún otro lugar se duplica. `ServiceDeskLink` (nuevo) = botón con logo; variantes `full` ("Abrir en la Mesa de Servicio ↗") y `short` ("Abrir ↗").

## 4. Notificaciones
Tarjeta `--surface-3` radio 16, ancho 400, tinte `card` de la prioridad; encabezado mono "Ticket nuevo · <sitio>" / "Cambió de estado · <sitio>" con la prioridad en su color; título blanco 15 px 700; meta "Nº · cola"; etiquetas; en cambio de estado "anterior → nuevo" con colores por tipo; `ServiceDeskLink` (`full` en nuevo, `short` en cambio de estado). Se mantienen sonido, máximo 4 y auto-cierre.

## 5. Métricas (estilo "Informes" de Microsoft 365)
- Migas "Métricas › Resumen de tickets"; título 22 px; "Actualizado hace N s · datos en vivo de la Mesa de Servicio".
- **Comandos**: rango de fechas (Últimos 7 / 30 / 90 días; por defecto 30), **Exportar CSV**, Actualizar (fuerza `loadFullState`).
- **Tarjetas** (radio 8, borde `--line`): Tickets abiertos, Crítica abiertos (tinte `card` si > 0), Cerrados hoy, Creados en el período.
- **Paneles**: "Tickets por estado" (barras por tipo de estado) y "Tickets creados por día" (línea blanca + área degradada) — respetan el rango. "Ver detalles" en cada panel aplica el filtro correspondiente a la tabla y hace scroll hasta ella (estado: filtro de estado; tendencia: filtro "creados en el período").
- **Tabla**: barra de comandos con filtros como desplegables (Cola en árbol, Prioridad, Estado, Propietario; "Más filtros" despliega Tipo, Servicio, Sitio), **Columnas** (mostrar/ocultar; persistido en `localStorage` por navegador, con try/catch), **buscador** por Nº o título (sin distinguir mayúsculas ni tildes). Filas con tinte `row`; Nº como link (`--accent-text`) y clic en la fila → `TicketDetail` como panel lateral derecho.
- **Exportar CSV**: exporta las filas **filtradas** y las columnas **visibles**, UTF-8 con BOM (Excel), separador `,`, fechas en `America/El_Salvador` `dd/mm/aaaa HH:mm`, nombre `tickets-YYYYMMDD-HHmm.csv`. Función pura `ticketsToCsv(tickets, columns)`.

## 6. Administración (estilo tenant de Microsoft)
Layout: barra superior `--surface-1` (logo, "Administración · Mapa de Incidencias", buscador global, "← Volver al mapa", avatar con iniciales); navegación lateral 210 px con íconos (Tabler) agrupada: **Inicio**; *Gestión*: **Usuarios**, **Sitios**, **Colas**; *Sistema*: **Estado de conexión**. Ítem activo = regla de selección. Cada página: migas, título 22 px, pestañas de vista con subrayado `--accent`, barra de comandos, lista con casillas, y **panel deslizante derecho (flyout, 380 px)** que reemplaza a los modales actuales. Rutas: `/admin` (Inicio), `/admin/users`, `/admin/sites`, `/admin/queues`, `/admin/status`; `/admin/sites` actual redirige a `/admin` para no romper marcadores.

- **Buscador global**: filtra usuarios y sitios por nombre (cliente); resultados en un desplegable que navega a la página y abre el flyout.
- **Inicio**: tarjetas de resumen con link: usuarios pendientes de colas (→ pestaña Pendientes), usuarios con colas inexistentes, sitios sin configurar (→ Sitios/pestaña Sin configurar), estado de conexión resumido (→ Estado).
- **Usuarios**: pestañas Todos / Administradores / Pendientes de colas; comandos **Agregar usuario**, **Actualizar**, **Restablecer contraseña** (habilitado con exactamente 1 seleccionado; usa el `PATCH .../password` existente), **Eliminar** (1 o más seleccionados, con confirmación; secuencial; se respeta la regla existente de no dejar el sistema sin admins y no eliminarse a uno mismo); filtro por nombre. Columnas: usuario (link), correo, rol (insignia), colas (insignias Pendiente / Cola inexistente en la Mesa de Servicio), departamentos (histórico). Flyout con pestañas **Cuenta** (usuario, correo, rol), **Colas** (selector en árbol, chips de colas inexistentes removibles), **Departamentos** (histórico; solo lectura si no disponibles), **Contraseña**; Guardar/Cancelar. Se conservan todas las reglas actuales (null vs [], no reenviar campos sin cambios).
- **Sitios**: pestañas Configurados / Sin configurar; comandos Asignar coordenadas, Actualizar, Eliminar; flyout con tipo y lat/lng.
- **Colas** (nueva, solo lectura): árbol de colas válidas de la Mesa de Servicio con: tickets abiertos y nº de usuarios con acceso (directo o por cola padre, o "todas"). Datos: `/api/admin/queues` + `/api/admin/users` + `/api/tickets` (todo existente).
- **Estado de conexión** (nueva): tarjetas de Mesa de Servicio (OK / sin conexión, latencia de un `SELECT 1`, último ciclo OK de cada poller, último error), Histórico (live/snapshot, fecha de congelado, total), y Servidor (versión = commit corto, uptime). Botón "Probar conexión".

## 7. Otras pantallas
- **Login / recuperar / restablecer**: fondo `--bg` con el contorno del país tenue y viñeta; tarjeta `--surface-1` radio 24 con logo GCS, "Mapa de Incidencias", "Global Customs Solutions · Mesa de Servicio"; inputs radio 6; "Ingresar" en píldora `--accent-fill`; errores en línea roja bajo el campo.
- **Histórico osTicket** (decisión del usuario: sin identidad de "archivo" especial):
  - Encabezado con el **logo de osTicket** (`frontend/src/img/osticketlogo.png`, 28 px, radio 6) + título "Histórico osTicket" + "Datos congelados al dd/mm/aaaa" como insignia ámbar (solo en modo snapshot).
  - **Se quitan las tarjetas y gráficos de métricas** (KPIs, estados, tendencia): la vista queda **solo con la lista de tickets y sus filtros** (departamento → equipo → agente, estado, prioridad, como hoy), con los tokens nuevos y el mismo estilo de tabla que Métricas (§5) pero sin exportar/columnas/buscador.
  - Datos y permisos (`allowedDepartments`) sin cambios. `legacyStats.ts` y los gráficos copiados de `legacy/` quedan sin uso y se eliminan si ningún otro archivo los importa.
- **Avisos**: error / sin colas / Mesa de Servicio no disponible apilados sin superponerse, como píldoras anchas con ícono. "Cargando dashboard…" → esqueleto de paneles. **SyncStatus**: punto verde "hace N s"; ámbar/rojo "Sin conexión con la Mesa de Servicio"; sin "--" al inicio (muestra "Conectando…").

## 8. Cambios de backend (mínimos)
El único cambio de backend es el endpoint de estado (los mensajes del backend ya dicen "Mesa de servicio" y el fix de `allowedDepartments` es solo frontend):

**`GET /api/admin/status`** (admin): `{ serviceDesk: { ok, latencyMs, lastError, ticketPoller: { lastOkAt, lastErrorAt }, statePoller: { lastOkAt, lastErrorAt } }, legacy: { source, frozenAt, total }, server: { version, startedAt } }`. Los pollers registran su último ciclo OK/error en un módulo `sockets/pollerStatus.ts` (memoria). `latencyMs` mide `SELECT 1` vía `znunyReadOnlyQuery` con timeout; si falla, `ok:false` y `lastError` con el mensaje (sin credenciales). `version` = `process.env.APP_VERSION` o el commit corto leído al arrancar de `git rev-parse --short HEAD` (si falla, "desconocida").

## 9. Textos "Mesa de Servicio"
Todos los textos visibles (JSX, `title`, `aria-label`, mensajes) que digan "Znuny" pasan a "Mesa de Servicio" (p. ej. "Cola inexistente en la Mesa de Servicio", "No se pudo verificar (Mesa de Servicio no disponible)", "El dashboard sigue conectado, pero no puede consultar la Mesa de Servicio"). Los nombres de código, tipos, archivos y variables de entorno no cambian.

## 10. Pruebas
- **vitest (frontend)**, además de las 52 actuales:
  - contraste: parsea `:root` de `index.css` y verifica cada par texto/fondo de §2.2–2.3 (≥ 4.5 para texto, ≥ 3 para texto grande/decorativo declarado);
  - `priorityTint` (ranks 0–3, desconocido, ambas variantes);
  - `ticketsToCsv` (BOM, comillas/comas/saltos escapados, fechas SV, solo columnas visibles);
  - búsqueda (mayúsculas/tildes, Nº parcial);
  - textos: ningún literal visible con "Znuny" en `src/components`, `src/admin`, `src/auth`, `src/lib` (excluye identificadores y comentarios);
  - lógica pura de selección de comandos de Usuarios (habilitado/deshabilitado, regla del último admin).
- **vitest (backend)**: `GET /api/admin/status` (admin vs normal 403, túnel caído → `ok:false`, sin credenciales en `lastError`), `pollerStatus`.
- **Revisión visual con Playwright** a 1920×1080 y 1366×768 con un admin temporal en un `DATA_DIR` descartable: mapa, panel del sitio con detalle, métricas (filtros, columnas, CSV descargado), notificación crítica y normal, login, admin (inicio, usuarios con flyout, sitios, colas, estado) e histórico; comparación contra las maquetas aprobadas; `hudScale`/encuadre intactos.

## 11. Despliegue
- Frontend + endpoint de estado: `git pull`, build de backend y `pm2 restart backend` (corte de segundos, las TVs reconectan), luego build del frontend. Con tu OK paso a paso.
- Vuelta atrás: `git checkout` del commit anterior, build y restart.
- Maquetas de referencia: `.superpowers/brainstorm/1889-1794242033/content/` (local, no versionado).

## 12. Decisiones registradas
| Decisión | Motivo |
|---|---|
| Mapbox fiel con azul `#007afc` | elegido por el usuario |
| Ajustes de contraste (`#76829a`, `#0a6fe6`, `#3d9bff`) | los valores originales de Mapbox no llegan a WCAG AA en pantalla/TV |
| Tinte en vez de barra lateral; selección con contorno | pedido del usuario ("muy diseño de IA") |
| Paneles sólidos sin blur | look Mapbox y rendimiento en TV |
| Métricas y Admin estilo Microsoft, Mapa estilo dashboard | pedido del usuario |
| Tema oscuro también en Admin/Métricas | supuesto por consistencia; el usuario no eligió |
| Un solo `TicketDetail` y un solo `ServiceDeskLink` | evitar duplicación entre mapa, métricas y notificaciones |
| Logo en círculo blanco | el logo azul marino no se ve sobre fondos oscuros/azules y no se modifica el archivo original |
