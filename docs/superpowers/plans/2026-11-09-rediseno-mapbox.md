# Rediseño Mapbox + tenant de Microsoft — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** aplicar al frontend la estética "Mapbox fiel" (tokens nuevos), rehacer el panel del sitio (lista + detalle), las notificaciones, Métricas y Administración con estilo tenant de Microsoft (con CSV, buscador, columnas, páginas Inicio/Colas/Estado), simplificar el Histórico y renombrar "Znuny" → "Mesa de Servicio" en la UI.

**Arquitectura:**
- Primero los tokens (variables CSS + tema Tailwind + `lib/dataColors.ts` como única fuente TS de colores de datos); los alias viejos (`--map-bg`, `--muted`, `.glass-panel`…) se redirigen a los nuevos para que todo compile y se vea coherente desde la Tarea 1.
- Después, pantalla por pantalla, cada componente deja de usar hex literales.
- Componentes compartidos nuevos: `ServiceDeskLink`, `TicketDetail`, `SidePanel`.
- Backend: solo `GET /api/admin/status` + registro de estado de los pollers.

**Stack:** React 18 + Vite 5 + Tailwind 3 + recharts + react-router 7 + @tabler/icons-react; Express + vitest + supertest en backend.

**Spec:** `docs/superpowers/specs/2026-11-09-rediseno-mapbox-design.md`

## Restricciones globales

- **Tokens (valores exactos):** `--bg #0e1012`, `--surface-1 #15171b`, `--surface-2 #1c1f24`, `--surface-3 #23262d`, `--line #1c1f24`, `--line-strong #333943`, `--line-control #444d5a`, `--text-strong #ffffff`, `--text #a0aaba`, `--text-muted #8b96aa`, `--text-label #76829a`, `--text-faint #566171` (solo no-texto), `--accent #007afc` (solo indicadores sin texto), `--accent-fill #0a6fe6` (relleno con texto blanco), `--accent-text #3d9bff` (links).
- **Colores de datos (no cambian):** prioridad por rank `#ff4d6d`, `#f5a623`, `#4c7fff`, `#34d399` (rank ≥ 3 o desconocido = rank 3); por tipo de estado new `#3ed6c4`, open `#4c7fff`, pending `#f5a623`, closed `#64748b`; texto sobre tinte `#ff718a`, `#f7b84f`, `#7099ff`, `#5ee0b0`.
- **Ningún hex literal** en `src/` fuera de `src/index.css` y `src/lib/dataColors.ts` al terminar el plan (lo verifica una prueba en la Tarea 15). El acento nunca se usa en el mapa ni en datos.
- **Prioridad = tinte, nunca barra lateral.** `card`: `linear-gradient(180deg, rgba(c,.14), rgba(c,.04) 55%)`; `row`: `linear-gradient(90deg, rgba(c,A), rgba(c,0) 34%)` con A = .12 / .10 / .09 / .08 para rank 0/1/2/3. **Selección** = fondo `--surface-3` + `box-shadow: 0 0 0 1px rgba(0,122,252,.6)`.
- **Tipografía:** DM Sans 400/500/700 + JetBrains Mono 400/600 (Google Fonts en `index.html`; se quitan Space Grotesk, Inter y Public Sans). Mínimo 12 px; etiquetas 11 px mayúsculas `letter-spacing .12em`.
- **Radios:** paneles del dashboard 20 px; tarjetas de Métricas/Admin 8 px; chips 12; insignias 4; inputs/herramientas 6; botones y pestañas `9999px`. Sin `backdrop-filter`.
- **Textos:** ningún texto visible dice "Znuny" → "Mesa de Servicio". Botón: "Abrir en la Mesa de Servicio ↗" (variante corta "Abrir ↗") con `src/img/GCS_logo_nuevo_font_transparente.svg` dentro de un círculo blanco de 20 px. Histórico: logo `src/img/osticketlogo.png`.
- **No se toca:** `lib/hudScale.ts`, `lib/mapFraming.ts`, el contenedor de Leaflet, los tiles de CARTO, la lógica de datos y permisos (salvo lo que dice cada tarea).
- Fechas siempre `America/El_Salvador` (`lib/svTime.ts`).
- Commits en `develop`, en español, terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nunca stagear capturas sueltas, `.playwright-mcp/` ni `.superpowers/`.

## Foco de revisión

1. **Panel del sitio sin tickets para el filtro activo** (p. ej. filtro "Cerrado" vacío): el detalle muestra un estado vacío "Sin tickets con este filtro", nunca un crash ni el ticket del filtro anterior. Prueba en la Tarea 5.
2. **CSV con títulos que tienen comas, comillas, saltos de línea o tildes:** el archivo abre bien en Excel (BOM, escape RFC 4180). Prueba en la Tarea 8.
3. **`localStorage` no disponible** (navegador de TV en modo privado): el selector de columnas cae a las columnas por defecto sin romper la tabla. Prueba en la Tarea 8.
4. **Túnel caído:** `/api/admin/status` responde 200 con `serviceDesk.ok:false` y un `lastError` sin credenciales; nunca 500. Prueba en la Tarea 9.
5. **Eliminar varios usuarios incluyendo el último admin o a uno mismo:** se bloquea antes de borrar nada, con un mensaje claro. Prueba en la Tarea 11.

---

## Mapa de archivos

- **Tokens:** `frontend/src/index.css`, `frontend/tailwind.config.js`, `frontend/index.html`, nuevo `frontend/src/lib/dataColors.ts`, `frontend/src/lib/priorityTint.ts`.
- **Compartidos nuevos:** `components/ServiceDeskLink.tsx`, `components/TicketDetail.tsx`, `components/SidePanel.tsx`.
- **Mapa:** `components/{TopBar,SyncStatus,KpiDock,SiteRail,MapHeroView,MapView,NoQueueAccessBanner}.tsx`, `App.tsx`, `lib/siteMarkerHtml.tsx`, `DetailDrawer.tsx` → reemplazado por `components/SitePanel.tsx`.
- **Notificaciones:** `components/NotificationStack.tsx`.
- **Métricas:** `components/{MetricsView,StatusChart,TrendChart,TicketsTable}.tsx`, nuevos `lib/ticketSearch.ts`, `lib/ticketsCsv.ts`, `lib/tableColumns.ts`.
- **Backend:** nuevo `backend/src/sockets/pollerStatus.ts`, `backend/src/routes/admin.ts` (ruta `/status`), pollers.
- **Admin:** nuevos `admin/AdminLayout.tsx`, `admin/AdminHomePage.tsx`, `admin/UsersPage.tsx`, `admin/UserFlyout.tsx`, `admin/SitesPage.tsx`, `admin/QueuesPage.tsx`, `admin/StatusPage.tsx`, `lib/userCommands.ts`, `lib/queueAccessCounts.ts`; se eliminan `AdminSitesPage.tsx`, `AdminSitesSection.tsx`, `AdminUsersSection.tsx` cuando su contenido queda migrado.
- **Otras:** `auth/{LoginForm,LoginModal,ForgotPasswordForm,ResetPasswordPage,AuthBackground}.tsx`, `legacy/*`.

---

### Tarea 1: Tokens, tema y fuentes

**Archivos:**
- Modificar `frontend/src/index.css`, `frontend/tailwind.config.js`, `frontend/index.html`.
- Crear `frontend/src/lib/dataColors.ts`, `frontend/test/tokens.test.ts`.

**Interfaces:**
- Produce:
  - Variables CSS de las Restricciones globales en `:root`, más `--data-p0..p3`, `--data-p0-text..p3-text`, `--state-new|open|pending|closed`.
  - `dataColors.ts`: `PRIORITY_RGB: [number, number, number][]` (rank 0..3), `PRIORITY_HEX: string[]`, `PRIORITY_TEXT_HEX: string[]`, `STATE_TYPE_HEX: Record<StateType, string>`.
  - Tailwind: `colors.bg|surface-1|surface-2|surface-3|line|line-strong|line-control|text-strong|text|text-muted|text-label|accent|accent-fill|accent-text` → `var(--…)`; `borderRadius.panel = 20px`, `borderRadius.card = 8px`; `fontFamily.sans = ['"DM Sans"', 'system-ui', 'sans-serif']`, `fontFamily.mono = ['"JetBrains Mono"', 'monospace']`.

- [ ] **Paso 1: Prueba que falla** `test/tokens.test.ts`, que lee `src/index.css` con `fs`, extrae las variables de `:root` y verifica con la fórmula WCAG:
  - sobre `--surface-1`: `--text-strong`, `--text`, `--text-muted` y `--text-label` ≥ 4.5;
  - blanco sobre `--accent-fill` ≥ 4.5;
  - `--accent-text` sobre `--surface-1` ≥ 4.5;
  - cada `--data-p*-text` sobre `--surface-1` ≥ 4.5;
  - las variables `--data-p0..p3` y `--state-*` de `index.css` son exactamente iguales (sin distinguir mayúsculas) a `PRIORITY_HEX` y `STATE_TYPE_HEX` de `dataColors.ts`.
- [ ] **Paso 2:** `cd frontend && npx vitest run test/tokens.test.ts` → FAIL.
- [ ] **Paso 3: Implementar.**
  - Variables nuevas.
  - **Alias viejos** que apuntan a las nuevas, para que nada se rompa mientras las tareas siguientes migran: `--map-bg → --bg`, `--map-line → --line`, `--glass → --surface-1`, `--glass-border → transparent`, `--text → #a0aaba` (ojo: `--text` cambia de significado; el blanco pasa a `--text-strong`), `--muted → --text-muted`, `--muted-2 → --text-label`, `--surface-1`, `--border → --line-strong`, `--cyan → --accent-text`, `--blue/--amber/--green/--red` → `--data-*`.
  - `.glass-panel`: `background: var(--surface-1); border: none; border-radius: 20px;` sin `backdrop-filter`.
  - `body`: `font-family: "DM Sans", system-ui, sans-serif; background: var(--bg); color: var(--text);`.
  - `index.html`: un solo `<link>` de Google Fonts con `DM+Sans:wght@400;500;700` y `JetBrains+Mono:wght@400;600`.
- [ ] **Paso 4:** `npx vitest run` → PASS (todas); `npm run build` → OK.
- [ ] **Paso 5: Commit** `"Rediseño: tokens Mapbox, tema Tailwind y fuentes"`.

### Tarea 2: Colores de datos y tinte de prioridad

**Archivos:**
- Crear `frontend/src/lib/priorityTint.ts`, `frontend/test/priorityTint.test.ts`.
- Modificar `frontend/src/lib/znunyColors.ts`, `frontend/src/lib/labels.ts`, `frontend/src/lib/siteMarkerHtml.tsx`, `frontend/test/znunyStats.test.ts` (si asserta hex), `frontend/test/siteMarker.test.ts` (si corresponde).

**Interfaces:**
- Consume: `dataColors.ts` (Tarea 1).
- Produce:
  - `priorityTint(rank: number, variant: "card" | "row"): string` (el `background-image` CSS);
  - `priorityTextColor(rank: number): string`;
  - `SELECTION_STYLE: { background: string; boxShadow: string }` = `{ background: "var(--surface-3)", boxShadow: "0 0 0 1px rgba(0,122,252,.6)" }`.
  - `stateTypeColor` y `priorityColor` siguen con la misma firma pero leen de `dataColors.ts`.
  - `labels.ts` conserva `SITE_TYPE_LABELS` y `SEVERITY_COLORS` (desde `dataColors`); `CHART_CHROME` pasa a `{ grid: "var(--line)", axis: "var(--line)", mutedText: "var(--text-label)", primaryText: "var(--text-strong)", secondaryText: "var(--text-muted)" }`; se elimina `ACCENT_CYAN` y sus usos pasan a `var(--accent-text)`.

- [ ] **Paso 1: Pruebas que fallan:**
  - `priorityTint(0,"card")` contiene `rgba(255, 77, 109, 0.14)` y `rgba(255, 77, 109, 0.04) 55%`;
  - `priorityTint(1,"row")` contiene `rgba(245, 166, 35, 0.1)` y `0) 34%`;
  - `priorityTint(7,"row")` es igual a `priorityTint(3,"row")`; `priorityTint(-1,"row")` es igual a `priorityTint(0,"row")`;
  - `priorityTextColor(0) === "#ff718a"`.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.** En `siteMarkerHtml.tsx`, el gris de los cuadrantes vacíos pasa a `var(--line-strong)` y el anillo de selección a `rgba(0,122,252,.6)`. No cambia la geometría.
- [ ] **Paso 4:** `npx vitest run` → PASS; `npm run build` → OK.
- [ ] **Paso 5: Commit** `"Rediseño: tinte de prioridad y colores de datos centralizados"`.

### Tarea 3: "Mesa de Servicio" y botón con logo

**Archivos:**
- Crear `frontend/src/components/ServiceDeskLink.tsx`, `frontend/test/uiCopy.test.ts`.
- Modificar todos los archivos con texto visible "Znuny": hoy `components/NotificationStack.tsx`, `components/TicketsTable.tsx`, `components/SyncStatus.tsx`, `components/DetailDrawer.tsx`, `admin/AdminSitesSection.tsx`, `lib/adminQueues.ts` (y sus pruebas).

**Interfaces:**
- Produce `<ServiceDeskLink href: string; variant?: "full" | "short"; className?: string />`:
  - un `<a target="_blank" rel="noopener noreferrer">` en píldora con fondo `var(--accent-fill)`, texto blanco 12 px 500 y padding `5px 12px 5px 5px`;
  - a la izquierda, un círculo blanco de 20 px con `<img src={logo} alt="" />` de 14 px (`import logo from "../img/GCS_logo_nuevo_font_transparente.svg"`);
  - texto "Abrir en la Mesa de Servicio ↗" (full) o "Abrir ↗" (short);
  - `aria-label` siempre "Abrir en la Mesa de Servicio".

- [ ] **Paso 1: Prueba que falla** `uiCopy.test.ts`. Recorre `src/components`, `src/admin`, `src/auth` y `src/lib` (excluye `legacy/`) y busca "Znuny" en tres lugares:
  - texto JSX (`>[^<{]*Znuny`);
  - atributos `title=`, `aria-label=`, `placeholder=`;
  - literales string fuera de comentarios que contengan la palabra seguida o precedida de un espacio.
  
  Tiene que dar 0 coincidencias. No cuenta identificadores como `znunyUrl`, `computeZnunyStats` ni `ZnunyStats`.
- [ ] **Paso 2:** ejecutar → FAIL, con la lista de los archivos de hoy.
- [ ] **Paso 3: Implementar** los reemplazos con los textos exactos de la spec §9:
  - "Cola inexistente en la Mesa de Servicio: X";
  - "No se pudo verificar (Mesa de Servicio no disponible)";
  - "El dashboard sigue conectado, pero no puede consultar la Mesa de Servicio";
  - "Sitio sin clave en la Mesa de Servicio: solo existe en el histórico".
  
  Todos los "Ver en Znuny" pasan a `<ServiceDeskLink>`. Ajustar `test/adminQueues.test.ts`.
- [ ] **Paso 4:** `npx vitest run` → PASS; `npm run build` → OK.
- [ ] **Paso 5: Commit** `"Renombrar Znuny a Mesa de Servicio en la interfaz y botón con logo"`.

### Tarea 4: Shell del dashboard y mapa

**Archivos:** modificar `App.tsx`, `components/{TopBar,SyncStatus,KpiDock,SiteRail,MapHeroView,MapView,NoQueueAccessBanner,MapZoomControls}.tsx`; crear `components/LoadingSkeleton.tsx`.

**Interfaces:**
- Consume: tokens (T1), `priorityTint` / `SELECTION_STYLE` (T2).
- Produce: `<LoadingSkeleton />`.

- [ ] **Paso 1: Implementar.**
  - **TopBar** (56 px, `--bg`):
    - logo + "Mapa de Incidencias" en 15 px 700 + etiqueta "EL SALVADOR · MESA DE SERVICIO" (mono 10 px `--text-label`);
    - pestañas en píldora (la activa `--accent-fill`, el resto con borde `--line-control` y texto `--text`);
    - herramientas (sonido, sync, admin, salir) con borde `--line-control` y radio 6.
  - **SyncStatus:** punto verde "hace N s"; "Conectando…" antes del primer latido; ámbar o rojo con "Sin conexión con la Mesa de Servicio" cuando `ok:false` o sin socket.
  - **App:** banners (error, sin colas, mesa no disponible) en un contenedor `flex-col gap-2`, como píldoras anchas de `--surface-3` con ícono Tabler; "Cargando dashboard…" pasa a `<LoadingSkeleton/>` (paneles grises animados con opacidad en las posiciones de KPI, rail y mapa).
  - **KpiDock:** paneles `--surface-1` radio 20; número 30 px 700 `--text-strong`; solo "Crítica abiertos" en `var(--data-p0)` y con `priorityTint(0,"card")` cuando es mayor que 0.
  - **SiteRail:** filas sin borde, seleccionado con `SELECTION_STYLE`, nombre `--text-strong`, conteo mono.
  - **Viñeta:** en `MapView`, un `<div aria-hidden className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 120px 40px var(--bg)", zIndex: 401 }}/>` como hermano del `MapContainer` dentro del contenedor relativo. Los tiles van en z 200, los marcadores en 600 y los paneles por encima. No va dentro del contenedor de Leaflet.
- [ ] **Paso 2: Verificar:**
  - `npm run build` → OK; `npx vitest run` → PASS;
  - `grep -c "#[0-9a-fA-F]\{6\}"` en estos archivos → 0;
  - `git diff --stat` no incluye `hudScale.ts` ni `mapFraming.ts`.
- [ ] **Paso 3: Commit** `"Rediseño: barra superior, KPIs, rail de sitios y mapa"`.

### Tarea 5: Panel del sitio (lista + detalle)

**Archivos:**
- Crear `components/SitePanel.tsx`, `components/TicketDetail.tsx`, `lib/sitePanel.ts`, `test/sitePanel.test.ts`.
- Eliminar `components/DetailDrawer.tsx` y modificar `MapHeroView.tsx` para que use `SitePanel`.

**Interfaces:**
- Consume: `ServiceDeskLink` (T3), `priorityTint` / `SELECTION_STYLE` / `priorityTextColor` (T2), `buildPriorityRankMap`, `formatSvDateTime`, `SlaRing`.
- Produce:
  - `<TicketDetail ticket: Ticket | null; catalog: Catalog; emptyText?: string />`:
    - título completo 17 px 700;
    - insignias de prioridad (tinte `card` + texto en su color) y de estado;
    - `<dl>` de dos columnas: Cola (con `›` en lugar de `::`), Tipo, Servicio, Propietario, Responsable, Cliente, Creado, Vencimiento SLA ("—" si es null);
    - `<ServiceDeskLink variant="full">`;
    - con `ticket === null` muestra `emptyText` (por defecto "Sin tickets con este filtro").
  - `<SitePanel site, tickets, catalog, onClose />`, con la misma firma que el viejo `DetailDrawer`.
  - En `lib/sitePanel.ts`:
    - `formatAge(createdIso: string, now: Date): string` ("hace 5 min", "hace 3 h", "hace 2 d");
    - `queueLabel(queue: string): string` (`"A::B"` → `"A › B"`);
    - `pickSelected(visible: Ticket[], selectedId: number | null): Ticket | null`: si el seleccionado está en `visible` lo devuelve; si no, el primero; si `visible` está vacío, `null`.

- [ ] **Paso 1: Pruebas que fallan:**
  - `formatAge` con `now` fijo: 5 min, 3 h, 2 d;
  - `queueLabel("Tecnología::Servicios IT") === "Tecnología › Servicios IT"`;
  - `pickSelected`: conserva la selección, cae al primero y devuelve `null` con la lista vacía (Foco 1).
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar el `SitePanel`.**
  - Franja inferior `--surface-1` radio 20 (arriba), alto inicial 38 vh, redimensionable con el asa igual que hoy (conservar la lógica de arrastre del `DetailDrawer`).
  - Encabezado: nombre del sitio 20 px 700, tipo + "N abiertos" (mono `--text-label`), píldoras de filtro por estado con conteo (la activa `--accent-fill`) y botón "Cerrar" con borde.
  - Cuerpo en grid `3fr 2fr`.
  - **Izquierda, lista con scroll.** Filas de 52 px con grid `1fr 180px 140px 130px 40px`:
    - título 14 px 500 `--text-strong` + `Nº · formatAge` en mono 11 px `--text-label`;
    - `queueLabel` en `--text-muted`;
    - propietario;
    - estado como punto + texto;
    - `SlaRing` chico.
    
    Fondo `priorityTint(rank,"row")`, hover `--surface-2` y seleccionada con `SELECTION_STYLE`.
  - **Derecha:** `--surface-2` radio 12 con `<TicketDetail ticket={pickSelected(...)}>`.
  - Al cambiar de sitio o de filtro se recalcula `pickSelected`.
- [ ] **Paso 4:** `npx vitest run` → PASS; `npm run build` → OK.
- [ ] **Paso 5: Commit** `"Rediseño: panel del sitio con lista de tickets y detalle"`.

### Tarea 6: Notificaciones

**Archivos:** modificar `components/NotificationStack.tsx`.

**Interfaces:** consume `priorityTint`, `priorityTextColor`, `stateTypeColor` y `ServiceDeskLink`.

- [ ] **Paso 1: Implementar.** Tarjeta de 400 px, radio 16, fondo `priorityTint(rank,"card") , var(--surface-3)` y sombra `0 8px 30px rgba(0,0,0,.45)`.
  - **Encabezado** mono 10 px `--text-label`: "<Prioridad en su color> · Ticket nuevo · <sitio>" o "… · Cambió de estado · <sitio>", y una × para cerrar.
  - **Título** 15 px 700 `--text-strong`; meta "Nº · cola" (con `queueLabel`).
  - **Nuevo:** etiqueta de estado + `ServiceDeskLink variant="full"`.
  - **Cambio de estado:** etiqueta `from` → etiqueta `to`, cada una con el color de su tipo de estado (usar `catalog.states` para mapear nombre → tipo; si no está, gris), + `ServiceDeskLink variant="short"`.
  - Se mantienen el sonido, el máximo de 4 y el auto-cierre (no se toca la lógica de `useDashboardData`).
- [ ] **Paso 2:** `npm run build` → OK; `npx vitest run` → PASS; 0 hex en el archivo.
- [ ] **Paso 3: Commit** `"Rediseño: notificaciones con tinte de prioridad"`.

### Tarea 7: Métricas — página de informe, tarjetas y gráficos

**Archivos:**
- Modificar `components/MetricsView.tsx`, `components/StatusChart.tsx`, `components/TrendChart.tsx`, `lib/znunyStats.ts` y su prueba.
- Crear `components/ReportCard.tsx`.

**Interfaces:**
- Produce:
  - `type DateRange = 7 | 30 | 90`;
  - `createdInRange(tickets: Ticket[], days: DateRange, now: Date): Ticket[]` en `znunyStats.ts`, por día calendario de El Salvador e inclusivo del día de hoy;
  - `trendFor(tickets, days, now): { date: string; count: number }[]` con `days` entradas;
  - `<ReportCard title, value, hint, tint?: string />`;
  - en `MetricsView`, el estado `range` y un callback `onShowDetails(filter: { stateType?: StateType; createdInRangeOnly?: boolean })` que se pasa a la tabla (T8).

- [ ] **Paso 1: Pruebas que fallan:**
  - `createdInRange` con `now = 2026-11-09T18:00Z`: un ticket creado el `2026-10-11T07:00Z` (11-oct 01:00 SV) entra con 30 d; uno del `2026-10-10T05:00Z` (9-oct 23:00 SV) no entra;
  - `trendFor(…, 7, now)` devuelve 7 entradas, la última `2026-11-09`.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.**
  - **Encabezado:**
    - migas "Métricas › Resumen de tickets" (12 px `--text-label`);
    - título 22 px 700;
    - "Actualizado hace N s · datos en vivo de la Mesa de Servicio" (tomado de `lastHeartbeatAt`).
  - **Comandos a la derecha:**
    - select "Últimos 7 / 30 / 90 días" (30 por defecto);
    - "Exportar CSV" (solo dispara el callback que la T8 conecta; hasta entonces queda deshabilitado);
    - "Actualizar" (llama a `loadFullState` expuesto por `useDashboardData`: agregar `refresh` a su retorno).
  - **4 `ReportCard`** (radio 8, borde 1px `--line`, `--surface-1`): Tickets abiertos ("en N colas"), Crítica abiertos (tinte `card` si es mayor que 0), Cerrados hoy ("día El Salvador"), Creados (N d) con `createdInRange(...).length`.
  - **Dos paneles** con título y un link "Ver detalles" (`--accent-text`) que llama a `onShowDetails`:
    - `StatusChart` con barras por tipo de estado, grilla `var(--line)` y ejes `var(--text-label)`;
    - `TrendChart` con `trendFor(range)`, línea `var(--text-strong)` y área con degradado blanco de .2 a 0. Se elimina su selector interno de 7/30: ahora manda el del encabezado.
- [ ] **Paso 4:** `npx vitest run` → PASS; `npm run build` → OK.
- [ ] **Paso 5: Commit** `"Rediseño: métricas estilo informe con rango de fechas"`.

### Tarea 8: Métricas — tabla con buscador, columnas, CSV y detalle

**Archivos:**
- Crear `lib/ticketSearch.ts`, `lib/ticketsCsv.ts`, `lib/tableColumns.ts`, `components/SidePanel.tsx`.
- Crear las pruebas `test/ticketSearch.test.ts`, `test/ticketsCsv.test.ts`, `test/tableColumns.test.ts`.
- Modificar `components/TicketsTable.tsx` y `MetricsView.tsx`.

**Interfaces:**
- Consume: `TicketDetail` (T5), `priorityTint` / `SELECTION_STYLE` (T2), `onShowDetails` y `range` (T7).
- Produce:
  - `matchesSearch(ticket: Ticket, query: string): boolean`: compara `tn` (parcial) y `title`, sin distinguir mayúsculas ni tildes, y con texto vacío devuelve `true`.
  - `type ColumnId = "tn" | "title" | "queue" | "priority" | "state" | "owner" | "site" | "sla" | "created" | "type" | "service" | "responsible" | "customer"`.
  - `DEFAULT_COLUMNS: ColumnId[] = ["tn","title","queue","priority","state","owner","site","sla","created"]`.
  - `COLUMN_LABELS: Record<ColumnId,string>`.
  - `loadColumns(storage: Pick<Storage,"getItem"> | null): ColumnId[]` y `saveColumns(storage: Pick<Storage,"setItem"> | null, cols: ColumnId[]): void`, con la clave `"metrics.columns.v1"` y tolerantes a `null`, a excepciones y a JSON inválido (si algo falla, `DEFAULT_COLUMNS`).
  - `ticketsToCsv(tickets: Ticket[], columns: ColumnId[], ctx: { siteName(t: Ticket): string; priorityName(t: Ticket): string }): string`, que empieza con `﻿` y usa CRLF.
  - `csvFileName(now: Date): string` → `tickets-YYYYMMDD-HHmm.csv` en hora SV.
  - `<SidePanel open, onClose, width?: number = 440, children>`: panel fijo a la derecha, `--surface-1`, sombra `-20px 0 40px rgba(0,0,0,.5)`, que se cierra con Esc y con la ×.

- [ ] **Paso 1: Pruebas que fallan:**
  - `matchesSearch`:
    - "impresion" encuentra "No puedo imprimir… Impresión";
    - "600012" encuentra el tn `202611066600012`;
    - "" devuelve `true`.
  - `loadColumns`:
    - con `null` devuelve los defaults;
    - con un `getItem` que lanza devuelve los defaults;
    - con `"not json"` devuelve los defaults;
    - con `'["tn","title"]'` devuelve `["tn","title"]`;
    - descarta ids desconocidos.
    
    Esto cubre el Foco 3.
  - `ticketsToCsv` (Foco 2):
    - empieza con BOM y usa CRLF;
    - el encabezado sale con `COLUMN_LABELS` en el orden de `columns`;
    - un título `Pedido "urgente", sala 2\nsegundo` sale como `"Pedido ""urgente"", sala 2\nsegundo"`;
    - las tildes se conservan;
    - la fecha va como `dd/mm/aaaa HH:mm` en SV;
    - solo salen las columnas pedidas.
  - `csvFileName(new Date("2026-11-09T18:05:00Z")) === "tickets-20261109-1205.csv"`.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar la tabla.**
  - Panel `--surface-1` radio 8 con título "Tickets" + conteo.
  - **Barra de comandos:**
    - filtros visibles: Cola (árbol), Prioridad, Estado y Propietario;
    - botón "＋ Más filtros", que muestra Tipo, Servicio y Sitio (Sitio es un filtro nuevo, con opciones de los sitios presentes en los tickets);
    - botón "☰ Columnas": popover con checkboxes de `COLUMN_LABELS`, que persiste con `saveColumns(window.localStorage)` dentro de un try y no deja ocultar `title`;
    - buscador "Buscar por Nº o título…";
    - "Limpiar filtros" (solo si hay alguno activo).
  - **Encabezados** sticky, 11 px mayúsculas `--text-label`.
  - **Filas** de 44 px con `priorityTint(rank,"row")`, hover `--surface-2` y la seleccionada con `SELECTION_STYLE`. El Nº va como link `--accent-text`; el clic en la fila abre `<SidePanel><TicketDetail/></SidePanel>`.
  - **"Exportar CSV"** del encabezado (T7) genera un `Blob` `text/csv;charset=utf-8` con `ticketsToCsv(filasFiltradas, columnasVisibles, …)` y lo descarga con `csvFileName(new Date())`.
  - **`onShowDetails`** aplica el filtro de estado (o "creados en el rango") y hace scroll hasta la tabla.
- [ ] **Paso 4:** `npx vitest run` → PASS; `npm run build` → OK.
- [ ] **Paso 5: Commit** `"Métricas: tabla con buscador, columnas, exportar CSV y detalle lateral"`.

### Tarea 9: Backend — estado de conexión

**Archivos:**
- Crear `backend/src/sockets/pollerStatus.ts`, `backend/test/pollerStatus.test.ts`.
- Modificar `backend/src/sockets/znunyTicketPoller.ts`, `znunyStatePoller.ts`, `backend/src/routes/admin.ts`, `backend/src/index.ts` (fecha de arranque) y `backend/test/routes.test.ts`.

**Interfaces:**
- Produce:
  - `recordPollerOk(name: "tickets" | "states", at?: Date): void`;
  - `recordPollerError(name, message: string, at?: Date): void`;
  - `getPollerStatus(): { tickets: { lastOkAt: string | null; lastErrorAt: string | null; lastError: string | null }; states: … }`;
  - `sanitizeError(message: string): string`: quita cualquier `password=…`, `user=…` y la cadena `ZNUNY_DB_PASSWORD` si aparece, y trunca a 200 caracteres;
  - `GET /api/admin/status` → `{ serviceDesk: { ok: boolean; latencyMs: number | null; lastError: string | null; ticketPoller; statePoller }, legacy: { source: "live" | "snapshot"; frozenAt: string | null; total: number | null }, server: { version: string; startedAt: string } }`.

- [ ] **Paso 1: Pruebas que fallan:**
  - `pollerStatus`: guarda el último ok y el último error por poller, y `sanitizeError("Access denied for user 'dashboard_ro' (using password: YES) password=abc")` no contiene `abc`.
  - En `routes.test.ts`:
    - un usuario normal recibe 403 en `/api/admin/status`;
    - con `znunyReadOnlyQuery` mockeado para lanzar `ZnunyUnavailableError("connect ECONNREFUSED")`, la ruta responde **200** con `serviceDesk.ok === false`, `latencyMs === null` y `lastError` con `ECONNREFUSED` (Foco 4);
    - con la consulta OK, `ok === true` y `latencyMs >= 0`;
    - con `getLegacyMeta` lanzando, `legacy.total === null` y la ruta igual responde 200.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.**
  - Los pollers llaman a `recordPollerOk` / `recordPollerError` donde hoy emiten el heartbeat `ok:true` / `ok:false` (y el poller de estados en su ciclo).
  - La ruta mide `SELECT 1` con `znunyReadOnlyQuery` y un timeout de 3 s (`Promise.race`).
  - `version` = `process.env.APP_VERSION` o `git rev-parse --short HEAD` (`execSync` con try, ejecutado una vez al cargar el módulo, `"desconocida"` si falla).
  - `startedAt` se fija al cargar el módulo.
- [ ] **Paso 4:** `cd backend && npx vitest run` → PASS; `npx tsc --noEmit -p .` → OK.
- [ ] **Paso 5: Commit** `"Backend: endpoint de estado de conexión para el panel admin"`.

### Tarea 10: Admin — layout tenant, rutas, buscador global e Inicio

**Archivos:**
- Crear `admin/AdminLayout.tsx`, `admin/AdminHomePage.tsx`, `admin/adminNav.ts`.
- Modificar `main.tsx` y `components/TopBar.tsx` (el botón de admin va a `/admin`).
- Modificar `api/adminClient.ts`: agregar `fetchAdminStatus(): Promise<AdminStatus>` y el tipo `AdminStatus` igual al de la T9.

**Interfaces:**
- Produce:
  - `<AdminLayout title: string; crumbs: { label: string; to?: string }[]; children />`:
    - barra superior `--surface-1` de 44 px: logo, "Administración · Mapa de Incidencias", buscador global (placeholder "Buscar usuarios, sitios…"), "← Volver al mapa" y avatar con las iniciales del usuario;
    - navegación de 210 px con íconos Tabler, agrupada como en `ADMIN_NAV`;
    - ítem activo con `SELECTION_STYLE`;
    - área principal con migas y título de 22 px.
  - `ADMIN_NAV = [{ group: null, items: [{ to: "/admin", label: "Inicio", icon: "home" }] }, { group: "Gestión", items: [{ to: "/admin/users", label: "Usuarios" }, { to: "/admin/sites", label: "Sitios" }, { to: "/admin/queues", label: "Colas" }] }, { group: "Sistema", items: [{ to: "/admin/status", label: "Estado de conexión" }] }]`.
  - `searchAdmin(query: string, users: AdminUserSummary[], sites: Site[]): { kind: "user" | "site"; id: string; label: string }[]`: sin distinguir mayúsculas ni tildes, con un máximo de 8 resultados.
  - Rutas bajo `RequireRole role="admin"`: `/admin`, `/admin/users`, `/admin/sites`, `/admin/queues`, `/admin/status`; cada página acepta `?open=<id>` para abrir su flyout.

- [ ] **Paso 1: Prueba que falla** `test/adminSearch.test.ts`: "santa" encuentra el sitio "Santa Elena"; "rsan" encuentra el usuario `rsanchez`; con 20 coincidencias devuelve 8.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar** el layout, las rutas y `AdminHomePage`. Mientras las páginas de las T11–T13 no existen, sus rutas renderizan las secciones viejas dentro del layout.
  - Inicio muestra 4 tarjetas (`ReportCard`) con link:
    - "Usuarios pendientes de colas" → `/admin/users?tab=pending`;
    - "Usuarios con colas inexistentes";
    - "Sitios sin configurar" → `/admin/sites?tab=unmapped`;
    - "Mesa de Servicio" (OK o "Sin conexión", desde `fetchAdminStatus`) → `/admin/status`.
- [ ] **Paso 4:** `npx vitest run` → PASS; `npm run build` → OK.
- [ ] **Paso 5: Commit** `"Admin: layout estilo tenant, rutas, buscador global e Inicio"`.

### Tarea 11: Admin — Usuarios con lista y flyout

**Archivos:**
- Crear `admin/UsersPage.tsx`, `admin/UserFlyout.tsx`, `lib/userCommands.ts`, `test/userCommands.test.ts`.
- Eliminar `admin/AdminUsersSection.tsx` una vez migrado.

**Interfaces:**
- Consume:
  - `adminClient` (`fetchUsers`, `createUser`, `setUserRole`, `updateUserProfile`, `setUserPassword`, `deleteUser`, `fetchAdminQueues`, `fetchDepartments`);
  - `lib/adminQueues.ts` (sin cambios de lógica);
  - `QueueTreeSelect`, `SidePanel` (T8) y `AdminLayout` (T10).
- Produce:
  - `commandState(selected: string[], users: AdminUserSummary[], currentUsername: string): { resetPassword: boolean; delete: { enabled: boolean; reason: string | null } }`:
    - `resetPassword` solo se habilita con exactamente 1 usuario seleccionado;
    - `delete` se deshabilita si no hay ninguno seleccionado, con el motivo `"No podés eliminar tu propio usuario"` si la selección incluye a `currentUsername`, y con `"Tiene que quedar al menos un administrador"` si eliminarlos dejaría 0 admins.
  - `profilePatch(original: AdminUserSummary, draft: { username; email; allowedQueues; allowedDepartments }): UpdateUserProfilePayload` incluye solo los campos que cambiaron. `allowedDepartments` se compara como conjunto: es el fix pendiente. `allowedQueues` usa `queuesChanged`.

- [ ] **Paso 1: Pruebas que fallan:**
  - `commandState`:
    - 2 seleccionados → `resetPassword:false`;
    - la selección incluye al usuario actual → `delete.enabled:false` con el motivo propio;
    - seleccionar a todos los admins → `delete.enabled:false` con el motivo de admins (Foco 5);
    - caso válido → `enabled:true`.
  - `profilePatch`:
    - con `allowedDepartments` igual en otro orden, el campo no aparece en el payload;
    - con `allowedQueues` sin cambios, tampoco;
    - si cambia el email, solo sale `email`.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.**
  - **Pestañas** Todos / Administradores / Pendientes de colas (con `?tab=all|admins|pending`), subrayado `--accent`.
  - **Comandos:**
    - "＋ Agregar usuario": abre el flyout vacío;
    - "⟳ Actualizar";
    - "🔑 Restablecer contraseña": abre el flyout en la pestaña Contraseña;
    - "🗑 Eliminar": pide confirmación con la lista y borra en secuencia; si `commandState` lo bloquea, el botón queda deshabilitado con `title` = motivo.
  - **Filtro por nombre.**
  - **Lista con casillas:** usuario (link que abre el flyout), correo, rol (insignia "Administrador" con texto `var(--accent-text)` sobre `rgba(0,122,252,.14)`, o "Normal" en `--text-muted`), colas (`queueCellFor` + `unknownQueuesNotices` como insignias de radio 4: ámbar para pendiente, rojo para inexistente, gris para no verificable) y departamentos.
  - **Flyout** (`SidePanel` de 380 px) con pestañas:
    - **Cuenta:** usuario, correo y rol;
    - **Colas:** los 3 modos actuales + `QueueTreeSelect` + chips de colas inexistentes removibles, todo como hoy;
    - **Departamentos:** de solo lectura si no están disponibles;
    - **Contraseña.**
    
    Guardar usa `profilePatch` + `setUserRole` si cambió el rol. Se mantiene la desconexión de sockets del backend (no cambia).
  - Se conservan todos los mensajes y reglas actuales de `AdminUsersSection`.
- [ ] **Paso 4:** `npx vitest run` → PASS (incluido `adminQueues.test.ts`); `npm run build` → OK.
- [ ] **Paso 5: Commit** `"Admin: usuarios estilo tenant con flyout y edición sin reenviar campos sin cambios"`.

### Tarea 12: Admin — Sitios y Colas

**Archivos:**
- Crear `admin/SitesPage.tsx`, `admin/QueuesPage.tsx`, `lib/queueAccessCounts.ts`, `test/queueAccessCounts.test.ts`.
- Eliminar `admin/AdminSitesSection.tsx` y `admin/AdminSitesPage.tsx` (la ruta vieja `/admin/sites` ahora es la nueva página de Sitios; no hace falta redirigir).

**Interfaces:**
- Produce `queueAccessCounts(queues: Catalog["queues"], users: AdminUserSummary[], tickets: Ticket[]): { name: string; depth: number; openTickets: number; usersWithAccess: number }[]`, que solo incluye las colas válidas y las ordena por nombre.
  - `usersWithAccess` cuenta a los usuarios con `allowedQueues === []` (todas), con la cola exacta o con algún ancestro (`::`).
  - `openTickets` cuenta los tickets abiertos (`isOpenStateType`) de la cola o de sus subcolas.

- [ ] **Paso 1: Pruebas que fallan:**
  - un usuario con `["Tecnología"]` cuenta para `Tecnología::Servicios IT`, y uno con `[]` cuenta en todas;
  - un usuario con `null` no cuenta;
  - un ticket cerrado no suma a `openTickets`;
  - un ticket en `A::B` suma a `A` y a `A::B`.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.**
  - **Sitios:**
    - pestañas Configurados / Sin configurar (`?tab=unmapped`);
    - comandos "Asignar coordenadas" (habilitado en Sin configurar con 1 seleccionado), "⟳ Actualizar" y "🗑 Eliminar" (con confirmación);
    - lista con casillas;
    - flyout con tipo, latitud y longitud, que conserva la validación actual.
  - **Colas:** tabla en árbol (sangría por `depth`) de solo lectura con las columnas Cola, Tickets abiertos y Usuarios con acceso. Los datos salen de `fetchAdminQueues`, `fetchUsers` y `fetchTickets`.
- [ ] **Paso 4:** `npx vitest run` → PASS; `npm run build` → OK.
- [ ] **Paso 5: Commit** `"Admin: sitios y colas estilo tenant"`.

### Tarea 13: Admin — Estado de conexión

**Archivos:** crear `admin/StatusPage.tsx`, `lib/statusView.ts`, `test/statusView.test.ts`.

**Interfaces:**
- Consume `fetchAdminStatus` (T10).
- Produce `describeStatus(s: AdminStatus, now: Date): { tone: "ok" | "warn" | "error"; headline: string; lines: string[] }`:
  - `error` si `!serviceDesk.ok` → headline "Sin conexión con la Mesa de Servicio";
  - `warn` si `ok` pero el último OK de algún poller tiene más de 60 s → "Conectado, sin sincronizar hace N s";
  - si no, `ok` → "Conectado".

- [ ] **Paso 1: Pruebas que fallan:** los tres tonos con `now` fijo, y `lastError` incluido en `lines` cuando está presente.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.**
  - Tarjetas:
    - **Mesa de Servicio:** el tono como punto de color, la latencia y el último OK de los pollers de tickets y de estados (como "hace N s");
    - **Histórico:** live/snapshot, fecha de congelado y total;
    - **Servidor:** versión y "en línea desde" en hora SV.
  - Botón "Probar conexión": vuelve a pedir el estado.
  - Refresco automático cada 15 s mientras la página está abierta.
- [ ] **Paso 4:** `npx vitest run` → PASS; `npm run build` → OK.
- [ ] **Paso 5: Commit** `"Admin: página de estado de conexión"`.

### Tarea 14: Login, recuperación y Histórico

**Archivos:**
- Modificar `auth/{LoginForm,LoginModal,ForgotPasswordForm,ResetPasswordPage,AuthBackground}.tsx` y `legacy/LegacyView.tsx`, `legacy/LegacyTicketsTable.tsx`, `legacy/legacyLabels.ts`.
- Eliminar los archivos de `legacy/` que queden sin importar: `LegacyMetricsView.tsx`, `LegacyStatusChart.tsx`, `LegacyTrendChart.tsx`, `legacyStats.ts` y otros (verificarlo con grep).

**Interfaces:**
- Consume: tokens, `priorityTint` / `SELECTION_STYLE`.
- `legacyLabels.ts` deja los hex y pasa a `dataColors` o a tokens.

- [ ] **Paso 1: Implementar el login y las pantallas de contraseña.**
  - Fondo `--bg` con `CountryBoundary` (o el contorno actual) a opacidad .15 y la viñeta.
  - Tarjeta `--surface-1` de radio 24, 400 px, padding 32: logo GCS, "Mapa de Incidencias" en 22 px 700 y "Global Customs Solutions · Mesa de Servicio" en mono `--text-label`.
  - Inputs `--surface-2`, borde `--line-strong`, radio 6.
  - "Ingresar" en píldora `--accent-fill` a todo el ancho.
  - Errores en una línea `var(--data-p0-text)` debajo del campo.
  - Mismo estilo en "¿Olvidaste tu contraseña?" y en la página de restablecer.
- [ ] **Paso 2: Implementar el Histórico.**
  - Encabezado: `<img src={osticketLogo}>` de 28 px y radio 6 + "Histórico osTicket" en 22 px 700 + la insignia ámbar "Datos congelados al dd/mm/aaaa", solo si `meta.source === "snapshot"`.
  - Quitar las tarjetas y los gráficos; queda solo `LegacyTicketsTable` con sus filtros actuales.
  - Estilo de tabla como Métricas, con tinte `row` por prioridad: rank de urgente/alta/normal/baja = 0/1/2/3.
  - Datos y permisos sin cambios.
- [ ] **Paso 3: Verificar:**
  - `npm run build` → OK;
  - `npx vitest run` → PASS;
  - `grep -rn "LegacyMetricsView\|legacyStats\|LegacyStatusChart\|LegacyTrendChart" src` → sin resultados.
- [ ] **Paso 4: Commit** `"Rediseño: login, recuperación de contraseña e histórico osTicket"`.

### Tarea 15: Sin hex sueltos, verificación visual y documentación

**Archivos:**
- Crear `frontend/test/noHexLiterals.test.ts`.
- Modificar los archivos que la prueba marque y `CLAUDE.md`.

- [ ] **Paso 1: Prueba** `noHexLiterals.test.ts`: recorre `src/**/*.{ts,tsx}` y falla si encuentra `#[0-9a-fA-F]{3,8}\b` fuera de `src/lib/dataColors.ts`. `index.css` no entra porque no es `ts`/`tsx`. Ejecutar y corregir lo que quede.
- [ ] **Paso 2: Pruebas completas:**
  - `cd frontend && npx vitest run && npm run build` → todo PASS;
  - `cd backend && npx vitest run && npx tsc --noEmit -p .` → todo PASS.
- [ ] **Paso 3: Revisión visual con Playwright** a 1920×1080 y 1366×768.
  - Preparación: backend con un `DATA_DIR` temporal (copia de `src/data/users.json` y `site-metadata.json` + un admin descartable) y túnel arriba; `npm run dev` en el frontend.
  - Capturas en `.playwright-mcp/` (después se borran):
    - mapa;
    - panel de Santa Elena con el detalle y el botón con logo;
    - filtro de estado sin tickets → estado vacío;
    - métricas: rango de 7 d, "Ver detalles", buscador, columnas, un CSV descargado y abierto para verificar el BOM y las tildes;
    - una notificación, provocada inyectando el evento con el socket o esperando un ticket real;
    - login;
    - admin: Inicio, Usuarios con el flyout abierto, Sitios, Colas y Estado;
    - histórico.
  - Compararlas contra las maquetas aprobadas de `.superpowers/brainstorm/1889-1794242033/content/`.
  - Confirmar que `hudScale` funciona: a 1920 los paneles escalan y el mapa no se desfasa al hacer clic.
  - Detener los procesos por PID y borrar el temporal.
- [ ] **Paso 4:** actualizar `CLAUDE.md`:
  - la sección Frontend, con los tokens, `dataColors`, `priorityTint`, `ServiceDeskLink`, `TicketDetail`, las rutas `/admin/*` y la página de estado;
  - el hito "9 nov — rediseño Mapbox + admin estilo tenant";
  - corregir el estado de producción: los datos ya viven en `DATA_DIR` y el snapshot se hizo el 9-nov (1638 tickets).
- [ ] **Paso 5: Commit** `"Rediseño: limpieza final, verificación visual y documentación"`.

### Tarea 16: Despliegue a producción (requiere OK del usuario antes de cada paso en el servidor)

- [ ] **Paso 1:** merge de `develop` en `main` (fast-forward), pruebas sobre `main` y push, con confirmación.
- [ ] **Paso 2 (servidor):** respaldo `tar` de `/home/ubuntu/mapa-incidencias-data` y de los `.env`.
- [ ] **Paso 3:** `git pull`, `cd backend && npm ci && npm run build`, `pm2 restart backend` y verificar los logs y `/api/health`.
- [ ] **Paso 4:** `cd frontend && npm ci && npm run build`; desde afuera, verificar que `/`, `/admin` (401 sin sesión en la API) y `/api/admin/status` (401 sin sesión) respondan.
- [ ] **Paso 5:** el usuario revisa en su navegador: mapa, panel, métricas, admin y estado.
- [ ] **Vuelta atrás:** `git checkout 4c2981c` (el `main` actual de producción), build y `pm2 restart backend`.
