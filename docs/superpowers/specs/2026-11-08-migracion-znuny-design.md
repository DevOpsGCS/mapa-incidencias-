# Migración del dashboard de osTicket a Znuny (GCS) — Diseño

- **Fecha:** 2026-11-08
- **Estado:** aprobado por secciones en conversación; pendiente revisión de este documento
- **Subproyecto:** 1 de 2. El subproyecto 2 (nuevas funcionalidades y mejoras de diseño) se especifica aparte, sobre esta base.

## 1. Contexto y objetivo

La mesa de servicio pasó de osTicket a **Znuny 7.3.5**, personalizado por crisdev para Global Customs Solutions (`https://mesadeservicio.gcslatam.com/znuny/`). El dashboard (`https://mapaincidencias.gcslatam.com`) debe:

1. Leer los tickets **en vivo desde Znuny** y usar **los conceptos de Znuny tal cual** (colas, estados, prioridades, propietario, responsable, tipo, servicio, SLA). No hay una capa de "adaptación" a los conceptos de osTicket.
2. Conservar el **histórico de osTicket** en una **vista separada**, primero en vivo y desde el lunes 9-nov-2026 desde un snapshot congelado.

**Éxito =** mapa, métricas, tabla y notificaciones funcionando 100 % con Znuny en producción; usuarios restringidos viendo solo sus colas; vista "Histórico osTicket" independiente de que osTicket siga encendido.

**Fuera de alcance:** nuevas funcionalidades o rediseño (subproyecto 2), escribir en Znuny y la API REST (GenericInterface) de Znuny.

## 2. Hechos verificados de Znuny (8-nov-2026)

| Tema | Hecho |
|---|---|
| Base | MariaDB 10.11, base `znuny73`, solo escucha en `127.0.0.1` |
| Volumen | 77 tickets desde 2026-09-28 |
| Colas | Jerárquicas con `::` (`Tecnología::Servicios IT`, `SINI - Soporte IT::Redes`, `CCTV`, `BodyCams`…); hay colas inválidas (`Junk`, `Raw`, `Misc`, `Postmaster`) sin tickets |
| Estados | `nuevo`, `abierto`, `espera de información`, `Pendiente de aprobación`, `En proceso de compra`, `cerrado`, `merged`, más inválidos. Cada uno tiene un **tipo** (`ticket_state_type`: new/open/pending…/closed/merged/removed) |
| Prioridades | `baja`(2), `normal`(3), `alta`(4), `crítica`(6) válidas; `muy baja`(1) y `urgente`(5) inválidas |
| Sitio | Campo dinámico **`Ubicacion`** (id 6, Dropdown, etiqueta "Sitio de Reporte"); `dynamic_field_value.value_text` guarda la **clave**, y `PossibleValues` (YAML en `dynamic_field.config`) da clave → etiqueta |
| Nº visible | `ticket.tn` (numerador custom `GCSDate`, ej. `202611056600015`) |
| SLA | `ticket.escalation_solution_time` = epoch Unix real (0 = sin vencimiento) |
| **Fechas** | **`create_time`/`change_time` están en hora local `America/El_Salvador` (UTC-6, sin horario de verano), NO en UTC.** Verificado: `OTRSTimeZone = America/El_Salvador` y `FROM_UNIXTIME(escalation_solution_time)` coincide en hora de reloj con `create_time` |
| Historial | `ticket_history` + `ticket_history_type` (`StateUpdate`, `NewTicket`, `Move`, `OwnerUpdate`…) |
| Link agente | `https://mesadeservicio.gcslatam.com/znuny/index.pl?Action=AgentTicketZoom;TicketID=<ticket.id>` |
| Personalizaciones crisdev | Solo pantallas, plantillas, numerador, notificaciones, reporte de satisfacción. **No alteran el esquema de tickets** |

## 3. Infraestructura de conexión (ya implementada el 8-nov-2026)

Se usa **túnel SSH siempre** (en desarrollo y en producción), no conexión directa: el Security Group de AWS queda abierto, la instancia no tiene firewall y MariaDB no tiene TLS.

- **Usuario MariaDB** `dashboard_ro@localhost`: solo `SELECT ON znuny73.*`. Probado: un `UPDATE` da `ER_TABLEACCESS_DENIED_ERROR`.
- **Usuario SSH en Znuny** `dashboard-tunnel`: `nologin`, sin contraseña y sin sudo. `authorized_keys` con `restrict,port-forwarding,permitopen="127.0.0.1:3306",command="/bin/false"`. Probado: no abre shell y rechaza reenvíos a otros puertos.
- **Servidor del dashboard** (`52.1.200.109`): llave `~/.ssh/znuny_tunnel`, huella fijada en `~/.ssh/known_hosts_znuny` y servicio systemd **`znuny-tunnel`** (autossh) que escucha en `127.0.0.1:3307`, con `Restart=always` y habilitado al arrancar.
- **Desarrollo local:** `ssh -i <znuny-prod-key.pem> -N -L 3307:127.0.0.1:3306 ubuntu@44.213.254.232`.
- **Variables** (ya en `backend/.env` local y de prod): `ZNUNY_DB_HOST=127.0.0.1`, `ZNUNY_DB_PORT=3307`, `ZNUNY_DB_USER=dashboard_ro`, `ZNUNY_DB_PASSWORD`, `ZNUNY_DB_NAME=znuny73`.
- **Rollback:** `systemctl disable --now znuny-tunnel` (dashboard); `userdel -r dashboard-tunnel` y `DROP USER 'dashboard_ro'@'localhost'` (Znuny).

## 4. Arquitectura

Enfoque elegido: **reemplazar la fuente y adoptar el modelo de Znuny** (SQL de solo lectura por el túnel). Se descartaron la API REST de Znuny (no hay web service configurado y es lenta para un poller de 20 s) y una capa genérica multi-mesa (es la "adaptación" que no se quiere).

```
backend/src/
  znuny/
    db.ts                  pool mysql2 (ZNUNY_DB_*), readOnlyQuery (solo SELECT), dateStrings: true
    time.ts                znunyLocalToIso(): "YYYY-MM-DD HH:MM:SS" (America/El_Salvador) -> ISO UTC
    catalogRepository.ts   colas, estados(+tipo), prioridades, tipos, servicios, valores de Ubicacion
    ticketsRepository.ts   SELECT de tickets, mapeo a Ticket, stats, scoping por cola en SQL
    queueAccess.ts         expansión de permisos por cola (padre incluye subcolas), SQL y rooms
  legacy/osticket/
    db.ts                  el pool actual (DB_*), sin cambios de lógica
    ticketsRepository.ts   el repositorio actual movido tal cual (modelo LegacyTicket)
    snapshot.ts            lectura de osticket-snapshot.json
  scripts/osticketSnapshot.ts   npm run osticket:snapshot
  sockets/
    znunyTicketPoller.ts   tickets nuevos / modificados
    znunyStatePoller.ts    cambios de estado (ticket_history)
  routes/
    tickets.ts, sites.ts   ahora sobre Znuny
    catalog.ts             GET /api/catalog
    legacy.ts              GET /api/legacy/osticket/tickets | /stats | /meta
  lib/dataDir.ts           resolución de DATA_DIR + copia inicial desde la ubicación vieja
  migrations/              users.json y site-metadata.json (idempotentes, con .bak)
```

Unidades con una sola responsabilidad: `time.ts` y `queueAccess.ts` son funciones puras, testeables sin base. Los repositorios solo hablan SQL a través de `readOnlyQuery`.

## 5. Modelo de datos

### 5.1 `Ticket` (Znuny)

```ts
interface Ticket {
  id: number;                 // ticket.id (para link y claves internas)
  tn: string;                 // número visible
  title: string;
  queue: string;              // nombre completo con jerarquía "A::B"
  state: string;              // nombre real del estado
  stateType: "new" | "open" | "pending" | "closed"; // pending = cualquier "pending *"
  priorityId: number;
  priority: string;           // nombre real
  type: string | null;
  service: string | null;
  sla: string | null;
  owner: string;              // nombre completo o "Sin asignar"
  responsible: string | null;
  customer: string;           // customer_user (nombre) o customer_user_id
  siteId: string;             // id del sitio configurado; "" si no tiene Ubicacion o no está mapeado
  siteKey: string | null;     // clave cruda de Ubicacion
  createdAt: string;          // ISO UTC (convertido desde hora local SV)
  changedAt: string;          // ISO UTC
  slaDueAt: string | null;    // de escalation_solution_time (epoch); 0 -> null
  znunyUrl: string;           // ZNUNY_BASE_URL + "/index.pl?Action=AgentTicketZoom;TicketID=" + id
}
```

- **Excluidos** del dashboard: los tickets cuyo estado es de tipo `merged` o `removed`.
- Los estados con tipo `pending reminder`, `pending auto` y similares se normalizan a `stateType: "pending"`.
- Variables nuevas: `ZNUNY_BASE_URL=https://mesadeservicio.gcslatam.com/znuny`.

### 5.2 `GET /api/catalog` (en vivo, sin listas fijas en el código)

```ts
interface Catalog {
  queues: { id: number; name: string; parent: string | null; valid: boolean }[];
  states: { id: number; name: string; type: Ticket["stateType"] }[];  // solo válidos, sin merged/removed
  priorities: { id: number; name: string; rank: number }[];          // solo válidas; rank 0 = la más alta
  types: string[];
  services: string[];
  topPriorityId: number;      // prioridad válida de mayor id (hoy "crítica"); en Znuny el id define el orden
}
```

### 5.3 Fechas

`znunyLocalToIso(raw)` interpreta el string crudo como hora de `America/El_Salvador` (offset fijo −06:00, porque El Salvador no tiene horario de verano) y devuelve ISO UTC. **Nunca** se usa `mysqlDatetimeToIso` (que asume UTC) con datos de Znuny. Las marcas de agua del poller se guardan como string crudo de la base, igual que hoy.

### 5.4 Severidad del mapa

- **Rojo:** el sitio tiene ≥1 ticket abierto (`stateType` ∈ new/open/pending) con `priorityId === topPriorityId`. Se calcula en vivo: si activan una prioridad más alta, pasa a ser esa.
- **Ámbar:** tiene tickets abiertos, pero ninguno en la prioridad máxima.
- **Gris:** no tiene tickets abiertos.

## 6. Permisos por cola

- `users.json` incorpora **`allowedQueues?: string[]`**:
  - **ausente** = no configurado → no ve ningún ticket de Znuny y el frontend muestra el aviso "Tu acceso a colas aún no fue configurado; contactá a un administrador";
  - `[]` = ve todas las colas;
  - `[...]` = esas colas **y todas sus subcolas**.
- **SQL** (`queueAccess.toSqlCondition`): por cada cola permitida `X`, `(q.name = ? OR q.name LIKE ?)`, con el parámetro `X::%`. El `LIKE` se escapa (`%`, `_`, `\`) para que `Tecnología` no coincida con `TecnologíaX`.
- **Socket.io:**
  - cada usuario entra a la room `queue:<X>` por cada cola permitida, o a `all-queues` si tiene `[]`; sin configurar, no entra a ninguna room de Znuny;
  - cada evento se emite a `all-queues` y a `queue:<ancestro>` por cada prefijo de la cola del ticket (`A`, `A::B`, `A::B::C`).
- **`allowedDepartments` se conserva sin cambios** y solo restringe la vista Histórico osTicket.
- **Migración** de `users.json`:
  - si `allowedDepartments` está vacío → `allowedQueues = []`;
  - si no está vacío → `allowedQueues` queda ausente (pendiente de asignar). Hoy son 8 usuarios.
- **Panel admin de usuarios:** marca "Pendiente de asignar colas" y ofrece un selector de colas en árbol (desde `/api/catalog`), además del selector actual de departamentos, reetiquetado como "Departamentos (histórico osTicket)".

## 7. Tiempo real

| Poller (20 s) | Marca de agua | Detección | Emite |
|---|---|---|---|
| `znunyTicketPoller` (nuevos) | `MAX(ticket.id)` | `t.id > lastId` | `ticket:new` (con sonido en el frontend, como hoy) |
| `znunyTicketPoller` (modificados) | `change_time` crudo | `t.change_time >= marca`, deduplicado por `id\|change_time` (set acotado al último segundo de la marca) | `ticket:updated` |
| `znunyStatePoller` | `MAX(ticket_history.id)` | `h.id > lastId AND tipo = 'StateUpdate'` | evento de cambio de estado, con estado anterior y nuevo y datos del ticket |

- **Al arrancar**, cada marca se inicializa con el máximo actual: no se reenvía nada viejo.
- **Cambio de cola:** el poller mantiene en memoria un mapa `ticketId → cola`. Si la cola cambia, emite `ticket:removed` a las rooms de la cola anterior que no estén entre las de la nueva.
- **Errores** (túnel caído, timeout): se registran en el log, se reintenta en el siguiente ciclo y la marca de agua no avanza. El frontend ya resincroniza todo al reconectar (`useSocket`).
- **Estado anterior y nuevo:** el `StateUpdate` de Znuny guarda en `ticket_history.name` el texto `%%<anterior>%%<nuevo>%%`. Se parsea ese formato y, si no coincide, se muestra solo el estado actual del ticket.

## 8. Histórico osTicket

- El código actual de osTicket se mueve a `backend/src/legacy/osticket/` **sin cambios de lógica** (incluye `mysqlDatetimeToIso` en UTC, que sí es correcto para osTicket).
- **`OSTICKET_SOURCE=live|snapshot`:**
  - `live`: usa la conexión `DB_*` actual;
  - `snapshot`: lee `${DATA_DIR}/osticket-snapshot.json`;
  - si falta la variable, se usa `live` mientras exista `DB_HOST` y `snapshot` en caso contrario.
- **Endpoints** (respetan `allowedDepartments`): `GET /api/legacy/osticket/tickets`, `GET /api/legacy/osticket/stats` y `GET /api/legacy/osticket/meta` (`{ source, frozenAt?, total }`).
- **Script `npm run osticket:snapshot`:**
  1. lee **todos** los tickets con el repositorio legacy (sin filtro de departamento);
  2. compara el total contra `SELECT COUNT(*)` de los estados incluidos y **aborta sin escribir** si no coincide;
  3. escribe `{ frozenAt, total, tickets }` en un archivo temporal y lo renombra atómicamente; si ya existía un snapshot, lo respalda como `.bak-<fecha>`.
- **Frontend:**
  - tercera vista en la TopBar, **"Histórico osTicket"**, con las métricas y la tabla actuales sobre el tipo `LegacyTicket` (el modelo actual renombrado);
  - sin mapa ni tiempo real;
  - muestra la etiqueta "Datos congelados al dd/mm/aaaa" si viene del snapshot;
  - el link "Ver en osTicket" solo aparece con `source = live`.

## 9. Sitios

- **Znuny manda en los nombres.** El nombre visible del sitio es la **etiqueta actual** de `Ubicacion` en Znuny. `site-metadata.json` solo guarda `znunyKey → { id, type, lat, lng }`; su campo `name` queda como referencia y no se muestra si hay `znunyKey`.
- **Migración** de `site-metadata.json`: agrega `znunyKey` con este mapeo explícito.

| Sitio actual | `znunyKey` |
|---|---|
| La Hachadura | `Hachadura` |
| El Amatillo | `Amatillo` |
| El Poy | `Poy` |
| Las Chinamas | `Chinamas` |
| Santa Elena Oficina Central | `Santa Elena` |
| Oficina de la Diaspora | `Oficina Diaspora` |
| Acajutla, Anguiatú, San Bartolo, San Cristobal, San Francisco, Aeropuerto Internacional, Aeropuerto Terminal de Carga, Aeropuerto Terminal de Pasajeros | coincidencia normalizada (sin tildes, sin mayúsculas) con la clave |
| Fardos Postales | sin `znunyKey` → `legacyOnly: true`, no aparece en el mapa |

- **Resolución del sitio de un ticket:** clave de `Ubicacion` → sitio con ese `znunyKey`. Si no hay sitio con esa clave, el ticket cuenta en las métricas globales pero no en el mapa (igual que hoy).
- **Admin "Sitios sin configurar":** compara en vivo las claves de `PossibleValues` de `Ubicacion` contra los `znunyKey` configurados. `POST /api/admin/sites` valida que la clave exista en `Ubicacion` antes de guardar.

## 10. Frontend

- **Tipos:** `Ticket` (Znuny, §5.1), `Catalog` y `LegacyTicket`; se elimina el viejo `TicketStatus`/`TicketPriority` del modelo en vivo.
- **Tabla:**
  - columnas: TN, Título, Cola, Estado, Prioridad, Propietario, Sitio, SLA y Creado;
  - filtros: Cola (árbol; una cola padre incluye sus subcolas) → Propietario, más Estado, Prioridad, Tipo y Servicio, todos alimentados por el catálogo y los tickets cargados.
- **Detalle:** agrega tipo, servicio, SLA, responsable y cliente, con el botón "Ver en Znuny".
- **Colores sin listas fijas:**
  - **estado según su tipo:** new `#3ED6C4`, open `#4C7FFF`, pending `#F5A623`, closed `#64748B`;
  - **prioridad según su `rank`:** 0 `#FF4D6D`, 1 `#F5A623`, 2 `#4C7FFF`, ≥3 `#34D399`.
  - Se mantienen los pares de contraste ya verificados de `labels.ts`.
- **KPIs:** Abiertos (new+open+pending), En prioridad máxima (abiertos con `topPriorityId`, rotulado con el nombre real, hoy "Crítica"), Cerrados hoy (`stateType` closed con `changedAt` en el día calendario de El Salvador) y Tendencia de 30 días.
- **Fechas:** `formatDateTime` con `timeZone: "America/El_Salvador"` fijo.
- **Íconos:** pasan a ser por **cola raíz** (Tecnología, SINI - Soporte IT, SINI - Mantenimiento, CCTV, BodyCams), con un ícono genérico para el resto.
- **Textos:** "osTicket" → "Znuny" o "mesa de servicio", excepto en la vista Histórico.
- **Usuario sin colas configuradas:** ve el mapa vacío y el aviso de la §6.
- **No se toca:** `hudScale`, `mapFraming`, Leaflet ni CARTO.

## 11. Datos de producción fuera de `dist/`

- **Problema verificado:** en producción, `users.json` y `site-metadata.json` viven en `backend/dist/data/`. Un `rm -rf dist` o un deploy limpio los borraría.
- **Solución:** variable `DATA_DIR` (en prod, `/home/ubuntu/mapa-incidencias-data/`; por defecto, la ubicación actual por compatibilidad).
- **Al arrancar** (`lib/dataDir.ts`): si `DATA_DIR` no tiene un archivo y existe en `dist/data/`, lo **copia** (no lo mueve) y lo registra en el log.
- Seeds, `site-metadata.json`, `users.json` y `osticket-snapshot.json` se leen y escriben en `DATA_DIR`.
- Se corrige `CLAUDE.md`.

## 12. Errores y casos borde

- Tickets sin `Ubicacion` (hoy 7): cuentan en las métricas, no van al mapa.
- Cola o estado nuevo en Znuny: aparece solo vía catálogo; un estado de tipo desconocido se trata como `open` y se registra un warning.
- Túnel caído al iniciar: el backend arranca igual, las rutas de Znuny responden 503 con un mensaje claro y la vista Histórico sigue funcionando.
- `readOnlyQuery` sigue rechazando todo lo que no sea `SELECT`, y además la base lo rechaza por permisos (defensa doble).

## 13. Pruebas

- **Runner:** `vitest` en `backend` (hoy no hay runner). En el frontend, solo para las funciones puras de `lib/`.
- **Unitarias:**
  - `znunyLocalToIso`: incluye un cambio de día por el offset;
  - `queueAccess`: subcolas, escape de `LIKE`, prefijos parecidos, `[]` frente a ausente, rooms de ancestros;
  - `rank` y `topPriorityId`;
  - severidad de sitio;
  - parseo de `StateUpdate`;
  - migraciones de `users.json` y `site-metadata.json` (idempotencia y `.bak`);
  - dedupe del poller de modificados.
- **Integración**, contra Znuny real por el túnel y solo con `SELECT`: el mapeo de todos los tickets no lanza errores; los conteos por cola, estado y sitio coinciden con un `GROUP BY` directo en SQL; el scoping de un usuario restringido devuelve exactamente las colas esperadas.
- **Prueba visual** con Playwright y el frontend en local: mapa, métricas, histórico, usuario sin colas, viewport de TV (1920×1080 con `hudScale`).

## 14. Pase a producción

1. Respaldo de `backend/dist/data/` y `backend/.env` en el servidor del dashboard.
2. Agregar al `.env`: `ZNUNY_BASE_URL`, `DATA_DIR=/home/ubuntu/mapa-incidencias-data`, `OSTICKET_SOURCE=live`.
3. El trabajo se hace en `develop` y se mergea a `main`. En el servidor (que está en `main`, en `5a58e97`, con `frontend/package-lock.json` modificado localmente y `frontend/.env.production` sin trackear, ambos a preservar): `git pull` de `main`, `npm ci` y build de backend y frontend.
4. `pm2 restart backend`. Verificar: logs sin errores, copia a `DATA_DIR` registrada, `/api/catalog` responde, conteos iguales a los de SQL, login de un admin y de un usuario restringido (que ve el aviso).
5. Asignar colas a los 8 usuarios restringidos desde el panel.
6. **Lunes 9-nov-2026:** `npm run osticket:snapshot`, `OSTICKET_SOURCE=snapshot` y `pm2 restart backend`. Verificar la etiqueta "Datos congelados".
7. **Rollback:** `git checkout <commit previo>`, build y restart. Los archivos originales siguen en `dist/data/` y el `.env` tiene su respaldo.

## 15. Decisiones registradas

| Decisión | Motivo |
|---|---|
| Túnel SSH también en producción | El SG queda abierto, no hay firewall en la instancia, MariaDB no tiene TLS y no hace falta reiniciar MariaDB |
| Modelo nativo de Znuny, sin traducción | Pedido explícito: "manejar las colas y todo tal cual lo maneja Znuny" |
| Histórico osTicket separado | Sus conceptos no existen en Znuny; mezclarlos implicaría adaptar |
| Rojo = prioridad válida más alta, en vivo | No existe "urgente" en Znuny; se evita una lista fija |
| Usuarios restringidos quedan sin acceso hasta asignar colas | Mejor ocultar de más que mostrar colas indebidas |
| Marcas de agua por id donde es posible | Evita la clase de bug de zona horaria y duplicados ya sufrida |
| Nombres de sitio = etiquetas de Znuny | "Znuny manda" |
| `DATA_DIR` fuera de `dist/` | Los datos de prod hoy se pueden borrar con un build limpio |
