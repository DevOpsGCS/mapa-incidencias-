# Migración del dashboard a Znuny — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** que el dashboard lea los tickets en vivo desde Znuny con su modelo nativo (colas, estados, prioridades…) y conserve el histórico de osTicket en una vista separada: en vivo hasta el 9-nov-2026 y desde un snapshot después.

**Arquitectura:**
- El backend Express suma un módulo `znuny/` que hace SQL de solo lectura por el túnel SSH ya instalado (`127.0.0.1:3307`).
- El código actual de osTicket se mueve a `legacy/osticket/` sin cambios de lógica.
- Los permisos pasan a ser por cola (`allowedQueues`; una cola padre incluye sus subcolas) y se aplican en el SQL y en las rooms de socket.io.
- El frontend adopta el tipo `Ticket` de Znuny, arma sus filtros con `/api/catalog` y conserva los componentes viejos como la vista "Histórico osTicket".

**Stack:**
- Backend: Node 22 + Express 4 + TypeScript (CommonJS) + mysql2 + socket.io 4.
- Frontend: React 18 + Vite 5 + Tailwind + Leaflet + recharts.
- Nuevos: tests con vitest; `yaml` para leer la configuración del campo dinámico.

**Spec:** `docs/superpowers/specs/2026-11-08-migracion-znuny-design.md`

**Desvío consciente respecto de la spec:**
- No se crean endpoints `/stats`, ni para Znuny ni para el histórico. El frontend ya calcula las estadísticas a partir de los tickets que tiene cargados (`computeStats`), y hoy nadie usa `/api/tickets/stats`, así que se elimina.

## Restricciones globales

**Acceso a datos**
- **Toda** consulta a Znuny pasa por `znunyReadOnlyQuery` (rechaza lo que no sea `SELECT`) y usa el pool `ZNUNY_DB_*` con `dateStrings: true`.
- Nunca se escribe en Znuny ni en osTicket.

**Fechas**
- Los `DATETIME` de Znuny están en hora `America/El_Salvador` (UTC−06:00 fijo, sin horario de verano) y siempre se convierten con `znunyLocalToIso`.
- `escalation_solution_time` es un epoch Unix real; 0 equivale a `null`.
- En el frontend, las fechas se muestran siempre con `timeZone: "America/El_Salvador"`.

**Catálogos y estados**
- No hay listas fijas de colas, estados, prioridades, tipos ni servicios: todo sale de `/api/catalog` o de los datos en vivo.
- Se excluyen los tickets cuyo tipo de estado sea `merged` o `removed`.
- Los tipos `pending *` se normalizan a `"pending"`. Un tipo desconocido se trata como `"open"` y se registra con `console.warn`.
- "Abierto" significa `stateType` ∈ {`new`, `open`, `pending`}.
- Rojo en el mapa = algún ticket abierto con `priorityId === topPriorityId`, donde `topPriorityId` es el id máximo entre las prioridades **válidas** (hoy 6, "crítica").

**Tickets y sitios**
- Link a Znuny: `${ZNUNY_BASE_URL}/index.pl?Action=AgentTicketZoom;TicketID=${id}`, con `ZNUNY_BASE_URL=https://mesadeservicio.gcslatam.com/znuny`.
- Número visible = `ticket.tn`.
- El sitio es el campo dinámico `Ubicacion`, que se busca por `dynamic_field.name = 'Ubicacion'` y nunca por id.
- `value_text` guarda la clave; la etiqueta sale de `PossibleValues` en el YAML de `dynamic_field.config`. El nombre visible del sitio es la etiqueta de Znuny.

**Permisos**
- `allowedQueues` ausente = sin acceso a Znuny, con aviso.
- `[]` = acceso a todo.
- Lista = esas colas y sus subcolas (separadas por `::`).
- `allowedDepartments` no cambia y solo aplica al histórico de osTicket.
- Rooms de socket.io para Znuny: `all-queues` y `queue:<nombre completo>`.

**Textos exactos del frontend**
- Aviso sin colas: "Tu acceso a colas aún no fue configurado; contactá a un administrador."
- Etiqueta en el panel admin: "Pendiente de asignar colas".
- Botón del detalle: "Ver en Znuny".
- Pestaña: "Histórico osTicket".
- Etiqueta del snapshot: "Datos congelados al dd/mm/aaaa".

**Colores**
- Estado según su tipo: new `#3ED6C4`, open `#4C7FFF`, pending `#F5A623`, closed `#64748B`.
- Prioridad según su rank: 0 `#FF4D6D`, 1 `#F5A623`, 2 `#4C7FFF`, ≥3 `#34D399`.

**Archivos de datos**
- `users.json`, `site-metadata.json` y `osticket-snapshot.json` viven en `DATA_DIR`.
- Los seeds se siguen leyendo junto al código (`SEED_DIR`).

**No se toca:** `hudScale`, `mapFraming`, el contenedor de Leaflet ni los tiles de CARTO.

**Commits:** en `develop`, con mensaje en español y terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Foco de revisión

1. **Una clave de `Ubicacion` sin sitio mapeado, o eliminada de `PossibleValues`:**
   - el ticket cuenta en las métricas con `siteId: ""`;
   - muestra la clave cruda como nombre de sitio;
   - no rompe el mapa.
   - Prueba en la Tarea 6.
2. **Una cola renombrada en Znuny deja un nombre viejo en `allowedQueues`:**
   - el usuario pierde el acceso a esa cola sin que haya error;
   - el panel admin la marca como "Cola inexistente en Znuny".
   - Prueba en la Tarea 9 y UI en la Tarea 13.
3. **El túnel cae al arrancar o en plena operación:**
   - el backend arranca igual;
   - las rutas de Znuny responden 503 con `{ error: "Mesa de servicio no disponible" }`;
   - el histórico sigue funcionando;
   - los pollers reintentan sin avanzar la marca de agua.
   - Pruebas en las Tareas 8 y 9.
4. **Un ticket creado o cerrado cerca de la medianoche:** "Cerrados hoy" y la tendencia usan el día calendario de El Salvador, no UTC ni el reloj del navegador. Pruebas en las Tareas 2 y 10.
5. **Eventos de tickets que el cliente no tiene cargados:**
   - un `ticket:status_changed` de un ticket que el cliente no tiene en memoria (por ejemplo, de una cola recién asignada) se ignora sin error;
   - un `ticket:removed` de un id desconocido no hace nada.
   - Prueba en la Tarea 10.

---

## Mapa de archivos

**Backend (`backend/`)**
- Crear:
  - `vitest.config.ts`, con pruebas unitarias en `test/` y de integración en `test/integration/`; estas requieren el túnel y se activan con `ZNUNY_IT=1`.
  - `src/lib/dataDir.ts`.
  - `src/znuny/{db,time,queueAccess,catalogRepository,ticketsRepository,types}.ts`.
  - `src/migrations/{usersV2,sitesV2}.ts`.
- Mover:
  - `src/db.ts` → `src/legacy/osticket/db.ts`;
  - `src/repositories/ticketsRepository.ts` → `src/legacy/osticket/ticketsRepository.ts`.
- Crear para el histórico: `src/legacy/osticket/{source,snapshot}.ts` y `src/scripts/osticketSnapshot.ts`.
- Borrar `src/sockets/liveSimulator.ts` y `src/sockets/ticketEventsPoller.ts`.
- Crear `src/sockets/{znunyTicketPoller,znunyStatePoller,pollerLogic}.ts`.
- Modificar:
  - `src/repositories/{usersRepository,sitesRepository}.ts`;
  - `src/routes/{tickets,sites,admin}.ts`;
  - `src/index.ts`, `src/types/index.ts`;
  - `package.json`, `.env.example`, `.gitignore`.
- Crear `src/routes/{catalog,legacy}.ts`.

**Frontend (`frontend/src/`)**
- Crear:
  - `legacy/`, una copia congelada de las vistas actuales de métricas y tabla, más `LegacyTicket`;
  - `lib/{svTime,znunyStats,znunyColors}.ts`;
  - `hooks/useCatalog.ts`;
  - `components/{QueueTreeSelect,NoQueueAccessBanner}.tsx`.
- Modificar:
  - `types/index.ts`, `api/client.ts`, `api/adminClient.ts`;
  - `hooks/{useDashboardData,useSocket}.ts`;
  - `lib/{labels,siteDominance,siteMarkerIcon,sla}`;
  - `lib/departmentIcons.tsx`, que pasa a `lib/queueIcons.tsx`;
  - los componentes del mapa, las métricas, la tabla y el detalle;
  - `admin/AdminUsersSection.tsx`, `admin/AdminSitesSection.tsx`, `App.tsx`.

---

### Tarea 1: vitest + `DATA_DIR`

**Archivos:**
- Crear:
  - `backend/vitest.config.ts`
  - `backend/src/lib/dataDir.ts`
  - `backend/test/dataDir.test.ts`
- Modificar:
  - `backend/package.json`: scripts `test` y `test:it`; devDeps `vitest@^2` y `cross-env@^7`.
  - `backend/src/repositories/usersRepository.ts:13-15`
  - `backend/src/repositories/sitesRepository.ts:29-31`
  - `backend/.env.example`

**Interfaces:**
- Produce:
  - `SEED_DIR: string` = `path.join(__dirname, "..", "data")`.
  - `DATA_DIR: string`.
  - `DATA_FILES = ["users.json", "site-metadata.json", "osticket-snapshot.json"]`.
  - `resolveDataDir(opts: { envDataDir?: string; legacyDir: string; files: string[]; log?: (m: string) => void }): string`.

- [ ] **Paso 1: Escribir las pruebas que fallan** en `backend/test/dataDir.test.ts`, sobre directorios temporales (`fs.mkdtempSync`):
  - `sin envDataDir devuelve legacyDir y no copia nada`.
  - `con envDataDir crea el directorio y copia los archivos faltantes`:
    - el `users.json` del destino tiene contenido idéntico;
    - el original sigue existiendo (se copia, no se mueve);
    - `log` se llama una vez por archivo copiado.
  - `no pisa un archivo que ya existe en envDataDir`: el contenido del destino no cambia.
  - `ignora archivos que no existen en legacyDir`.
- [ ] **Paso 2:** `cd backend && npx vitest run test/dataDir.test.ts` → FAIL (no existe el módulo).
- [ ] **Paso 3: Implementar.**
  - `DATA_DIR = resolveDataDir({ envDataDir: process.env.DATA_DIR, legacyDir: SEED_DIR, files: DATA_FILES, log: console.log })`.
  - En los dos repositorios, el archivo real va en `DATA_DIR` y el seed se lee de `SEED_DIR`.
  - En `vitest.config.ts`, `include: ["test/**/*.test.ts"]` y excluir `test/integration/**` salvo con `process.env.ZNUNY_IT === "1"`.
  - Scripts: `"test": "vitest run"` y `"test:it": "cross-env ZNUNY_IT=1 vitest run test/integration"`.
  - En `.env.example`, documentar `DATA_DIR`: opcional; en producción vale `/home/ubuntu/mapa-incidencias-data`.
- [ ] **Paso 4:** `npx vitest run` → PASS; `npx tsc --noEmit -p .` → sin errores.
- [ ] **Paso 5: Commit** `"Agregar vitest y DATA_DIR para datos de producción fuera de dist"`.

### Tarea 2: Conexión y fechas de Znuny

**Archivos:**
- Crear:
  - `backend/src/znuny/db.ts`
  - `backend/src/znuny/time.ts`
  - `backend/test/znunyTime.test.ts`
- Modificar `backend/.env.example`:
  - agregar `ZNUNY_DB_HOST`, `ZNUNY_DB_PORT`, `ZNUNY_DB_USER`, `ZNUNY_DB_PASSWORD`, `ZNUNY_DB_NAME` y `ZNUNY_BASE_URL`;
  - agregar un comentario sobre el túnel.

**Interfaces:**
- Produce:
  - `znunyReadOnlyQuery<T>(sql: string, params?: unknown[]): Promise<T[]>`.
  - `class ZnunyUnavailableError extends Error`. Se lanza cuando falta configuración o cuando el error es `ECONNREFUSED`, `ETIMEDOUT`, `ECONNRESET`, `PROTOCOL_CONNECTION_LOST` o `ER_ACCESS_DENIED_ERROR`.
  - `znunyLocalToIso(raw: string): string`.
  - `epochToIsoOrNull(epoch: number | string | null): string | null`.
  - `svDateKey(iso: string): string`, que devuelve `YYYY-MM-DD` en hora de El Salvador.

- [ ] **Paso 1: Pruebas que fallan:**
  - `znunyLocalToIso("2026-11-05 14:24:47") === "2026-11-05T20:24:47.000Z"`.
  - `znunyLocalToIso("2026-11-05 19:30:00") === "2026-11-06T01:30:00.000Z"` (cambio de día).
  - `epochToIsoOrNull(1794947087) === "2026-11-17T20:24:47.000Z"`.
  - `epochToIsoOrNull` devuelve `null` para `0`, `"0"` y `null`.
  - `svDateKey("2026-11-06T03:00:00.000Z") === "2026-11-05"`.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.**
  - `znunyLocalToIso` = `new Date(raw.replace(" ", "T") + "-06:00").toISOString()`.
  - `svDateKey` usa `Intl.DateTimeFormat("en-CA", { timeZone: "America/El_Salvador" })`.
  - `db.ts` no valida variables al importarse, para que el backend arranque aunque falten. Si falta `ZNUNY_DB_HOST`, `znunyReadOnlyQuery` lanza `ZnunyUnavailableError("ZNUNY_DB_* no configurado")`.
  - Pool con `connectionLimit: 5`, `dateStrings: true` y `connectTimeout: 5000`.
  - Mismo guard de `SELECT` que el `db.ts` actual.
- [ ] **Paso 4:** ejecutar → PASS.
- [ ] **Paso 5: Commit** `"Agregar conexión de solo lectura y conversión de fechas de Znuny"`.

### Tarea 3: Permisos por cola (funciones puras)

**Archivos:**
- Crear:
  - `backend/src/znuny/queueAccess.ts`
  - `backend/test/queueAccess.test.ts`

**Interfaces:**
- Produce:
  - `type QueueAccess = { kind: "all" } | { kind: "some"; queues: string[] } | { kind: "none" }`.
  - `accessFromAllowedQueues(allowed: string[] | undefined): QueueAccess`.
  - `toSqlCondition(access: QueueAccess, column: string): { sql: string; params: string[] }`.
  - `queueAncestors(queue: string): string[]`.
  - `roomsForTicketQueue(queue: string): string[]`.
  - `roomsForAccess(access: QueueAccess): string[]`.
  - `canSeeQueue(access: QueueAccess, queue: string): boolean`.

- [ ] **Paso 1: Pruebas que fallan:**
  - `accessFromAllowedQueues`:
    - `undefined` → `{kind:"none"}`;
    - `[]` → `{kind:"all"}`;
    - `["CCTV"]` → `{kind:"some",queues:["CCTV"]}`.
  - `toSqlCondition`:
    - con `all` → `{sql:"1=1",params:[]}`;
    - con `none` → `{sql:"1=0",params:[]}`.
  - `toSqlCondition({kind:"some",queues:["Tecnología","CCTV"]},"q.name")` →
    - `sql: "((q.name = ? OR q.name LIKE ?) OR (q.name = ? OR q.name LIKE ?))"`;
    - `params: ["Tecnología","Tecnología::%","CCTV","CCTV::%"]`.
  - Escape de LIKE: `queues:["A_B%"]` → `params ["A_B%","A\\_B\\%::%"]`.
  - `queueAncestors("A::B::C")` → `["A","A::B","A::B::C"]`.
  - `roomsForTicketQueue("Tecnología::Servicios IT")` → `["all-queues","queue:Tecnología","queue:Tecnología::Servicios IT"]`.
  - `roomsForAccess`:
    - `some ["CCTV"]` → `["queue:CCTV"]`;
    - `all` → `["all-queues"]`;
    - `none` → `[]`.
  - `canSeeQueue`:
    - `some["Tecnología"]` con `"Tecnología::Back Office"` → `true`;
    - `some["Tecnología"]` con `"TecnologíaX"` → `false`;
    - `some["Tecnología::Redes y Ciberseguridad"]` con `"Tecnología"` → `false`.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.** Escapar `\` → `\\`, `%` → `\%` y `_` → `\_`, y agregar `::%` al final. MariaDB usa `\` como carácter de escape por defecto.
- [ ] **Paso 4:** ejecutar → PASS.
- [ ] **Paso 5: Commit** `"Agregar lógica de permisos por cola de Znuny"`.

### Tarea 4: Migraciones de `users.json` y `site-metadata.json`

**Archivos:**
- Crear:
  - `backend/src/migrations/usersV2.ts`
  - `backend/src/migrations/sitesV2.ts`
  - `backend/test/migrations.test.ts`
- Modificar:
  - `backend/src/repositories/usersRepository.ts`
  - `backend/src/repositories/sitesRepository.ts`
  - `backend/src/types/index.ts`: `PublicUser.allowedQueues: string[] | null` y `Site.znunyKey: string | null`.

**Interfaces:**
- Consume:
  - `DATA_DIR` (Tarea 1);
  - `QueueAccess` y `accessFromAllowedQueues` (Tarea 3).
- Produce, para la migración:
  - `migrateUsersV2(file: { schemaVersion?: number; users: StoredUser[] }): { changed: boolean; file }`.
  - `migrateSitesV2(file: { schemaVersion?: number; sites: RawSite[] }): { changed: boolean; file }`.
  - `SITE_ZNUNY_KEY_OVERRIDES` = `{"La Hachadura":"Hachadura","El Amatillo":"Amatillo","El Poy":"Poy","Las Chinamas":"Chinamas","Santa Elena Oficina Central":"Santa Elena","Oficina de la Diaspora":"Oficina Diaspora"}`.
  - `KNOWN_ZNUNY_KEYS`: las 14 claves de `Ubicacion` al 8-nov. Solo se usan en esta migración única. Son `Acajutla`, `Aeropuerto Internacional`, `Aeropuerto Terminal de Carga`, `Aeropuerto Terminal de Pasajeros`, `Amatillo`, `Anguiatu`, `Chinamas`, `Hachadura`, `Oficina Diaspora`, `Poy`, `San Bartolo`, `San Cristobal`, `San Francisco` y `Santa Elena`.
  - `RawSite` suma `znunyKey?: string` y `legacyOnly?: boolean`.
  - `StoredUser` suma `allowedQueues?: string[]`.
- Produce, en los repositorios:
  - `usersRepository.getQueueAccess(username): QueueAccess`.
  - `updateProfile(..., updates: { …; allowedQueues?: string[] | null })`, donde `null` borra el campo.
  - `create({ …; allowedQueues?: string[] })`.
  - `sitesRepository.findByZnunyKey(key: string): Site | undefined`.
  - `sitesRepository.upsertByZnunyKey(input: { znunyKey: string; type; lat; lng }): Site`.
  - `sitesRepository.findAll()` excluye los sitios con `legacyOnly`.

- [ ] **Paso 1: Pruebas que fallan.**
  - Usuarios:
    - con `allowedDepartments: []` → `allowedQueues: []`;
    - con `["CCTV"]` → sin la clave `allowedQueues`;
    - el resultado tiene `schemaVersion: 2` y `changed: true`.
  - Idempotencia de usuarios:
    - correrla otra vez sobre el resultado → `changed: false`;
    - un usuario **nuevo** sin `allowedQueues` en un archivo v2 sigue sin la clave, no se convierte en `[]`.
  - Sitios:
    - "El Poy" → `znunyKey: "Poy"`;
    - "Anguiatú" → `"Anguiatu"`, por coincidencia normalizada contra `KNOWN_ZNUNY_KEYS`;
    - "Acajutla" → `"Acajutla"`;
    - "Fardos Postales" → `legacyOnly: true`, sin `znunyKey`;
    - segunda ejecución → `changed: false`.
  - Repositorio, con `DATA_DIR` en un directorio temporal:
    - al construirse escribe `users.json.bak-<YYYYMMDD>` antes de guardar la migración;
    - no crea `.bak` si `changed` es `false`.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.**
  - Las migraciones son funciones puras.
  - El constructor de cada repositorio la llama después de `ensure…Exists`. Si `changed`, copia el archivo a `.bak-YYYYMMDD` y escribe el resultado.
  - `toSite`:
    - `id` = el `name` original, para que los ids no cambien;
    - `name` = el `name` guardado; la etiqueta en vivo de Znuny se resuelve en la Tarea 9;
    - `znunyKey`.
  - `getAllowedDepartments` no cambia.
- [ ] **Paso 4:** ejecutar → PASS; `tsc --noEmit` pasa.
- [ ] **Paso 5: Commit** `"Migrar users.json a allowedQueues y site-metadata.json a claves de Znuny"`.

### Tarea 5: Catálogo de Znuny

**Archivos:**
- Crear:
  - `backend/src/znuny/types.ts`
  - `backend/src/znuny/catalogRepository.ts`
  - `backend/test/catalog.test.ts`
  - `backend/test/integration/catalog.it.test.ts`
- Modificar `backend/package.json`: dependencia `yaml@^2`.

**Interfaces:**
- Consume: `znunyReadOnlyQuery` (Tarea 2).
- Produce, en `znuny/types.ts`:
  - `StateType = "new" | "open" | "pending" | "closed"`;
  - `Catalog`, idéntico a la spec §5.2.
- Produce, en `catalogRepository.ts`:
  - `normalizeStateType(typeName: string): StateType | null`:
    - `merged` y `removed` → `null`;
    - `pending*` → `"pending"`;
    - desconocido → `"open"`, con warning.
  - `rankPriorities(rows: {id:number;name:string}[]): {id;name;rank}[]` (rank 0 = id más alto).
  - `parseDropdownOptions(configYaml: string): { key: string; label: string }[]`.
  - `getCatalog(): Promise<Catalog>`.
  - `getSiteOptions(): Promise<{ key: string; label: string }[]>`.
  - Caché en memoria de 60 s (`CATALOG_TTL_MS = 60000`).

- [ ] **Paso 1: Pruebas que fallan.**
  - `normalizeStateType`:
    - `"pending reminder"` y `"pending auto"` → `"pending"`;
    - `"merged"` y `"removed"` → `null`;
    - `"new"` → `"new"`;
    - `"raro"` → `"open"`, y se llama a `console.warn`.
  - `rankPriorities([{id:2,name:"baja"},{id:6,name:"crítica"},{id:4,name:"alta"},{id:3,name:"normal"}])` → crítica 0, alta 1, normal 2, baja 3.
  - `parseDropdownOptions`, con el YAML real de la spec (`PossibleValues:\n  Anguiatu: Anguiatú\n  Poy: Poy`, más `DefaultValue: ''` y `PossibleNone: '1'`) → `[{key:"Anguiatu",label:"Anguiatú"},{key:"Poy",label:"Poy"}]`.
  - Integración (`ZNUNY_IT=1`):
    - `getCatalog().topPriorityId === 6`;
    - la cola `"Tecnología::Servicios IT"` tiene `parent: "Tecnología"`;
    - el estado `"espera de información"` es de tipo `"open"`;
    - `getSiteOptions()` devuelve 14 entradas.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.** Consultas:
  - `queue`: todas, con `valid = (valid_id = 1)`;
  - `ticket_state` JOIN `ticket_state_type` con `valid_id = 1`;
  - `ticket_priority` con `valid_id = 1`;
  - `ticket_type` y `service` con `valid_id = 1` (solo nombres);
  - `dynamic_field WHERE name = 'Ubicacion'`.
  - `parent` = lo que está antes del último `::`, o `null`.
- [ ] **Paso 4:** `npx vitest run` → PASS; con el túnel arriba, `npm run test:it` → PASS.
- [ ] **Paso 5: Commit** `"Agregar catálogo en vivo de Znuny"`.

### Tarea 6: Repositorio de tickets de Znuny

**Archivos:**
- Crear:
  - `backend/src/znuny/ticketsRepository.ts`
  - `backend/test/znunyTickets.test.ts`
  - `backend/test/integration/tickets.it.test.ts`
- Modificar `backend/src/znuny/types.ts`: `ZnunyTicket` = spec §5.1, más `siteName: string | null`, la etiqueta en vivo para la tabla y el detalle.

**Interfaces:**
- Consume:
  - `znunyReadOnlyQuery`, `znunyLocalToIso` y `epochToIsoOrNull` (Tarea 2);
  - `QueueAccess` y `toSqlCondition` (Tarea 3);
  - `sitesRepository.findByZnunyKey` (Tarea 4);
  - `normalizeStateType` y `getSiteOptions` (Tarea 5).
- Produce:
  - `ZNUNY_TICKETS_SELECT: string`, que termina en `WHERE 1=1` para que quien lo use agregue `AND …`.
  - `interface ZnunyTicketRow`: una columna por campo de §5.1, más `stateTypeName`, `createTimeRaw`, `changeTimeRaw`, `escalationSolutionTime` y `siteKey`.
  - `mapZnunyRow(row: ZnunyTicketRow, siteLabels: Map<string,string>): ZnunyTicket | null`.
  - `findAllTickets(access: QueueAccess): Promise<ZnunyTicket[]>`.
  - `findTicketsByIds(ids: number[]): Promise<ZnunyTicket[]>`, sin filtro de acceso; la usan los pollers.

- [ ] **Paso 1: Pruebas que fallan** de `mapZnunyRow`, con una fila basada en el ticket 149 de la spec (tn `202611056600015`, creado `2026-11-05 14:24:47`, escalación `1794947087`, cola `Tecnología::Servicios IT`, estado `abierto`/`open`, `siteKey "Santa Elena"`):
  - `createdAt === "2026-11-05T20:24:47.000Z"` y `slaDueAt === "2026-11-17T20:24:47.000Z"`.
  - `znunyUrl === "https://mesadeservicio.gcslatam.com/znuny/index.pl?Action=AgentTicketZoom;TicketID=149"`:
    - `ZNUNY_BASE_URL` se define en la prueba;
    - una `/` final en la variable no debe producir `//`.
  - `stateTypeName "merged"` → `null`.
  - Valores nulos:
    - sin owner → `"Sin asignar"`;
    - sin responsable → `null`;
    - sin servicio o sin SLA → `null`.
  - `siteKey` sin sitio mapeado (por ejemplo `"Chinamas"` antes de configurarlo) → `siteId: ""` y `siteName` igual a la etiqueta de `siteLabels`, o la clave cruda si no está ahí (Foco 1).
  - `siteKey` null → `siteId: ""` y `siteName: null`.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.** SELECT sobre `ticket t` con:
  - JOIN de `queue q`, `ticket_state s`, `ticket_state_type st` y `ticket_priority p`;
  - LEFT JOIN de `ticket_type`, `service` y `sla`;
  - LEFT JOIN de `users`, dos veces (owner y responsable), con nombre `CONCAT(first_name,' ',last_name)`;
  - LEFT JOIN de `customer_user cu ON cu.login = t.customer_user_id`; el nombre del cliente es `CONCAT(cu.first_name,' ',cu.last_name)` o, si falta, `t.customer_user_id`;
  - LEFT JOIN de `dynamic_field_value dfv ON dfv.object_id = t.id AND dfv.field_id = (SELECT id FROM dynamic_field WHERE name = 'Ubicacion')`.
  - `findAllTickets` agrega `AND ${toSqlCondition(access,"q.name").sql} ORDER BY t.create_time DESC` y carga `siteLabels` con `getSiteOptions()`.
- [ ] **Paso 4:** pruebas unitarias → PASS. Integración (`ZNUNY_IT=1`) → PASS:
  - `findAllTickets({kind:"all"})` tiene el mismo largo que un `COUNT(*)` sobre `ticket` con `st.name NOT IN ('merged','removed')`;
  - los conteos por cola coinciden con un `GROUP BY q.name`;
  - `{kind:"some",queues:["Tecnología"]}` solo trae colas iguales a `"Tecnología"` o que empiezan con `"Tecnología::"`;
  - `{kind:"none"}` → `[]`.
- [ ] **Paso 5: Commit** `"Agregar repositorio de tickets de Znuny con scoping por cola"`.

### Tarea 7: osTicket como histórico (legacy + snapshot)

**Archivos:**
- Mover con `git mv`, ajustando solo los imports:
  - `backend/src/db.ts` → `backend/src/legacy/osticket/db.ts`;
  - `backend/src/repositories/ticketsRepository.ts` → `backend/src/legacy/osticket/ticketsRepository.ts`.
- Crear:
  - `backend/src/legacy/osticket/snapshot.ts`
  - `backend/src/legacy/osticket/source.ts`
  - `backend/src/scripts/osticketSnapshot.ts`
  - `backend/test/snapshot.test.ts`
- Modificar:
  - `backend/src/routes/admin.ts`: import de `readOnlyQuery` desde la nueva ruta, para `/departments`.
  - `backend/package.json`: `"osticket:snapshot": "tsx src/scripts/osticketSnapshot.ts"`. En producción se corre con `node dist/scripts/osticketSnapshot.js`.
  - `backend/.gitignore`: `src/data/osticket-snapshot.json*`.
  - `backend/.env.example`: `OSTICKET_SOURCE`.
- Borrar:
  - `backend/src/sockets/liveSimulator.ts` y `backend/src/sockets/ticketEventsPoller.ts`;
  - sus llamadas en `index.ts`.
  - Entre este commit y la Tarea 8 no hay pollers. Es un estado intermedio esperado.

**Interfaces:**
- Produce:
  - `LegacyTicket`, `LegacyTicketStatus` y `LegacyTicketPriority`: los tipos actuales `Ticket`, `TicketStatus` y `TicketPriority`, renombrados en `src/types/index.ts`.
  - `interface OsticketSnapshotFile { frozenAt: string; total: number; tickets: LegacyTicket[] }`.
  - `writeSnapshot(opts: { tickets: LegacyTicket[]; expectedTotal: number; filePath: string; now?: Date }): void`. Lanza `Error("El total exportado (X) no coincide con la base (Y)")` sin escribir nada.
  - `readSnapshot(filePath: string): OsticketSnapshotFile`.
  - `getLegacySourceKind(): "live" | "snapshot"`, según `OSTICKET_SOURCE`. Por defecto es `live` si existe `DB_HOST` y `snapshot` si no.
  - `fetchLegacyTickets(allowedDepartments: string[] | null): Promise<LegacyTicket[]>`.
  - `getLegacyMeta(): Promise<{ source: "live" | "snapshot"; frozenAt: string | null; total: number }>`.
  - En el repositorio legacy, `countExportableTickets(): Promise<number>`. Usa el mismo criterio de estados que `loadStatusAppById`: excluye archivados, borrados y estados no reconocidos.

- [ ] **Paso 1: Pruebas que fallan** (directorio temporal):
  - `writeSnapshot` con 3 tickets y `expectedTotal: 3` → el archivo existe, con `total: 3` y `frozenAt` igual a `now` en ISO.
  - `expectedTotal: 4` → lanza el error y el archivo no existe.
  - Sobre un snapshot existente → crea `.bak-YYYYMMDD` con el contenido anterior.
  - Escribe primero a un temporal y después hace `renameSync`. Si la escritura falla, el archivo anterior queda intacto.
  - `fetchLegacyTickets` en modo snapshot con `["CCTV"]` → solo tickets con `department === "CCTV"`.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.**
  - El script ejecuta `fetchAllTickets(null)` y `countExportableTickets()` y llama a `writeSnapshot` sobre `path.join(DATA_DIR,"osticket-snapshot.json")`.
  - Imprime el total y la ruta.
  - En modo `snapshot` se omite `osTicketUrl` de la respuesta.
- [ ] **Paso 4:** `npx vitest run` → PASS; `tsc --noEmit` pasa.
- [ ] **Paso 5: Commit** `"Mover osTicket a módulo legacy con fuente en vivo o snapshot"`.

### Tarea 8: Pollers de Znuny

**Archivos:**
- Crear:
  - `backend/src/sockets/pollerLogic.ts`
  - `backend/src/sockets/znunyTicketPoller.ts`
  - `backend/src/sockets/znunyStatePoller.ts`
  - `backend/test/pollerLogic.test.ts`

**Interfaces:**
- Consume:
  - `znunyReadOnlyQuery` y `ZnunyUnavailableError` (Tarea 2);
  - `roomsForTicketQueue` (Tarea 3);
  - `findTicketsByIds` (Tarea 6).
- Produce:
  - `selectChanged(rows: {id:number; changeTimeRaw:string}[], watermark: string, seen: Set<string>): { ids: number[]; watermark: string; seen: Set<string> }`.
  - `parseStateUpdate(historyName: string): { from: string; to: string } | null`.
  - `removalRooms(oldQueue: string, newQueue: string): string[]`.
  - `startZnunyTicketPoller(io: Server): void` y `startZnunyStatePoller(io: Server): void`.
- Eventos de socket:
  - `ticket:new` (ZnunyTicket);
  - `ticket:updated` (ZnunyTicket);
  - `ticket:removed` (`{ id: number }`);
  - `ticket:status_changed` (`{ id: number; from: string | null; to: string; ticket: ZnunyTicket }`);
  - `sync:heartbeat`, igual que hoy.

- [ ] **Paso 1: Pruebas que fallan.**
  - `selectChanged([{id:1,changeTimeRaw:"2026-11-08 10:00:00"},{id:2,changeTimeRaw:"2026-11-08 10:00:05"}], "2026-11-08 10:00:00", new Set(["1|2026-11-08 10:00:00"]))` → `ids:[2]`, `watermark:"2026-11-08 10:00:05"` y `seen` igual a `{"2|2026-11-08 10:00:05"}`.
  - La misma entrada aplicada otra vez con el estado de salida → `ids: []` (sin duplicados).
  - Dos tickets en el mismo segundo que la marca, uno ya visto → solo se emite el otro.
  - `parseStateUpdate`:
    - `"%%nuevo%%abierto%%"` → `{from:"nuevo",to:"abierto"}`;
    - `"%%abierto%%espera de información%%"` → correcto;
    - `"texto raro"` → `null`.
  - `removalRooms`:
    - `("Tecnología::Servicios IT","Tecnología::Back Office")` → `["queue:Tecnología::Servicios IT"]`;
    - `("CCTV","Tecnología")` → `["queue:CCTV"]`;
    - nunca incluye `all-queues`.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.**
  - Poller de tickets, cada 20 s:
    - al iniciar toma `lastId = MAX(id)` y `watermark = MAX(change_time)`;
    - en cada ciclo consulta `SELECT id, change_time FROM ticket WHERE id > ? OR change_time >= ?`;
    - los ids mayores que `lastId` → `ticket:new`;
    - el resto pasa por `selectChanged` → `ticket:updated`;
    - carga los tickets con `findTicketsByIds` y emite con `io.to(roomsForTicketQueue(ticket.queue))`;
    - mantiene un `Map<id, cola>` y, si la cola cambió, emite `ticket:removed` a `removalRooms`;
    - si un ticket pasa a `merged`/`removed` (`mapZnunyRow` devuelve null), emite `ticket:removed` a las rooms de su última cola conocida.
  - Poller de estados:
    - parte de `lastHistoryId = MAX(ticket_history.id)`;
    - consulta `SELECT h.id, h.ticket_id, h.name FROM ticket_history h JOIN ticket_history_type ht ON ht.id = h.history_type_id WHERE h.id > ? AND ht.name = 'StateUpdate' ORDER BY h.id`;
    - carga los tickets y emite `ticket:status_changed`, con `from` = `parseStateUpdate(...)?.from ?? null` y `to` = el estado actual del ticket.
  - Manejo de errores:
    - ante cualquier error, `console.error` sin avanzar ningún estado; el próximo ciclo reintenta;
    - si falla la inicialización, reintenta cada 20 s hasta lograrlo. Hoy el poller se rinde en ese caso.
  - Conectar ambos pollers en `index.ts`.
- [ ] **Paso 4:** `npx vitest run` → PASS.
- [ ] **Paso 5: Commit** `"Agregar pollers en tiempo real contra Znuny"`.

### Tarea 9: Rutas y sockets

**Archivos:**
- Crear:
  - `backend/src/routes/catalog.ts`
  - `backend/src/routes/legacy.ts`
  - `backend/test/routes.test.ts`, con `supertest@^7` y `@types/supertest` como devDeps, y repositorios mockeados con `vi.mock`.
- Modificar:
  - `backend/src/routes/tickets.ts`, `sites.ts` y `admin.ts`.
  - `backend/src/index.ts`: exportar `app` y hacer `listen` solo si `require.main === module`.

**Interfaces:**
- Consume: Tareas 3 a 8.
- Produce, rutas generales:
  - `GET /api/tickets` → `ZnunyTicket[]` según `getQueueAccess`. Ante `ZnunyUnavailableError`, **503** con `{ error: "Mesa de servicio no disponible" }`.
  - `GET /api/me/access` → `{ queueAccess: "all" | "some" | "none" }`.
  - `GET /api/catalog` → `Catalog`, para cualquier usuario autenticado.
  - `GET /api/sites` → `Site[]`, donde `name` es la etiqueta en vivo de Znuny si el `znunyKey` está en `getSiteOptions()`. Si no, o si Znuny está caído, usa el `name` guardado sin fallar.
  - `GET /api/legacy/osticket/tickets` → `LegacyTicket[]` según `allowedDepartments`.
  - `GET /api/legacy/osticket/meta`.
- Produce, rutas de admin:
  - `GET /api/admin/sites/unmapped` → `{ key, label }[]`: las opciones de `Ubicacion` que no tienen sitio con ese `znunyKey`.
  - `POST /api/admin/sites` con `{ znunyKey, type, lat, lng }` → 400 si la clave no está en `getSiteOptions()`.
  - `GET /api/admin/queues` → `catalog.queues`.
  - `POST` y `PATCH` de usuarios aceptan `allowedQueues: string[] | null` y lo validan contra las colas existentes; si alguna no existe, 400 con la lista de colas desconocidas.
  - `GET /api/admin/users` suma `unknownQueues: string[]` por usuario (Foco 2).
- Sockets:
  - al conectar, `socket.join(roomsForAccess(usersRepository.getQueueAccess(username)))`;
  - desaparecen las rooms `department:*` y `all-departments`.
- Se elimina `/api/tickets/stats`.

- [ ] **Paso 1: Pruebas que fallan**, con supertest. Firmar la cookie con `signSessionToken` y definir `JWT_SECRET` en la prueba.
  - `GET /api/tickets` sin cookie → 401.
  - Usuario sin `allowedQueues` → 200 `[]`, y `/api/me/access` → `{queueAccess:"none"}`.
  - `findAllTickets` mockeado para lanzar `ZnunyUnavailableError` → 503 con `{ error: "Mesa de servicio no disponible" }`. En ese mismo estado, `GET /api/legacy/osticket/tickets` → 200 (Foco 3).
  - `POST /api/admin/sites` con `znunyKey: "NoExiste"` → 400.
  - `PATCH /api/admin/users/:u/profile` con `allowedQueues: ["Cola Fantasma"]` → 400, y el body menciona `"Cola Fantasma"`.
  - `GET /api/admin/users` con un usuario que tiene `allowedQueues: ["Vieja"]`, cuando el catálogo no incluye "Vieja" → `unknownQueues: ["Vieja"]`.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.** `/api/admin/departments` (osTicket, para el histórico) se mantiene y devuelve 503 si osTicket está caído.
- [ ] **Paso 4:** verificar.
  - `npx vitest run` → PASS y `npm run build` → OK.
  - Con el túnel arriba, `npm run dev` y `curl` con cookie de admin: `/api/tickets` devuelve unos 77 tickets.
- [ ] **Paso 5: Commit** `"Conectar rutas y sockets a Znuny con permisos por cola"`.

### Tarea 10: Frontend — histórico congelado, tipos, catálogo y lógica pura

**Archivos:**
- Crear primero, copiando **antes** de modificar los originales:
  - `frontend/src/legacy/LegacyMetricsView.tsx`
  - `legacy/LegacyTicketsTable.tsx`
  - `legacy/legacyStats.ts`
  - `legacy/legacyLabels.ts`
  - `legacy/types.ts`: el `Ticket` actual pasa a llamarse `LegacyTicket`.
  - `legacy/LegacyView.tsx`:
    - carga `/api/legacy/osticket/tickets` y `/meta`;
    - muestra "Datos congelados al dd/mm/aaaa" si `source === "snapshot"`;
    - oculta "Ver en osTicket" si la fuente no es `live`.
- Crear después:
  - `frontend/vitest.config.ts`
  - `frontend/src/lib/svTime.ts`
  - `frontend/src/lib/znunyStats.ts`
  - `frontend/src/lib/znunyColors.ts`
  - `frontend/src/hooks/useCatalog.ts`
  - `frontend/test/znunyStats.test.ts`
  - `frontend/test/dashboardReducer.test.ts`
- Modificar:
  - `frontend/src/types/index.ts`: `Ticket` pasa a ser el `ZnunyTicket`; se suman `Catalog`, `StateType` y `Site.znunyKey`.
  - `frontend/src/api/client.ts`: `fetchTickets()` sin filtros, más `fetchCatalog`, `fetchQueueAccess`, `fetchLegacyTickets` y `fetchLegacyMeta`.
  - `frontend/src/hooks/useSocket.ts` y `useDashboardData.ts`.
  - `frontend/package.json`: `vitest` y script `test`.

**Interfaces:**
- Produce, funciones de fecha:
  - `svDateKey(iso: string): string`;
  - `formatSvDateTime(iso: string): string`.
- Produce, estadísticas:
  - `computeZnunyStats(tickets: Ticket[], sites: Site[], topPriorityId: number, now?: Date): ZnunyStats`;
  - `ZnunyStats = { total; totalOpen; topPriorityOpen; closedToday; byStateType: Record<StateType,number>; byState: {name;stateType;count}[]; byPriority: {id;name;count}[]; bySite: {siteId;siteName;total;open;topPriorityOpen}[]; trend: {date;count}[] }`.
- Produce, colores y severidad:
  - `isOpenStateType(t: StateType): boolean`;
  - `stateTypeColor(t: StateType): string`;
  - `priorityColor(rank: number): string`;
  - `siteSeverity(stat: {open:number; topPriorityOpen:number}): "idle"|"warning"|"urgente"`.
- Produce, hooks:
  - `useCatalog(): { catalog: Catalog | null; error: string | null }`;
  - `applyDashboardEvent(tickets: Ticket[], event): Ticket[]`: reductor puro para `new`, `updated`, `removed` y `status_changed`, con clave `id: number`;
  - `useDashboardData()` expone `queueAccess: "all"|"some"|"none"`.

- [ ] **Paso 1: Copiar** las vistas actuales a `legacy/`, ajustando solo imports y el tipo a `LegacyTicket`. `npx tsc --noEmit` → sin errores.
- [ ] **Paso 2: Pruebas que fallan.**
  - "Cerrados hoy" de `computeZnunyStats`, con `now = 2026-11-08T18:00:00Z` (Foco 4):
    - un ticket `closed` con `changedAt "2026-11-08T05:30:00Z"` (7-nov 23:30 en El Salvador) → `closedToday === 0`;
    - con `"2026-11-08T06:30:00Z"` → `1`.
  - Tendencia:
    - 30 entradas con claves en hora de El Salvador;
    - un ticket creado `2026-11-08T03:00:00Z` cuenta el día `2026-11-07`.
  - `topPriorityOpen` cuenta solo tickets abiertos con `priorityId === topPriorityId`.
  - `bySite` ignora `siteId: ""`, pero `total` sí los incluye.
  - Colores:
    - `priorityColor(0) === "#FF4D6D"`;
    - `priorityColor(3)` y `priorityColor(7)` → `"#34D399"`;
    - `stateTypeColor("pending") === "#F5A623"`.
  - `applyDashboardEvent` (Foco 5):
    - `removed` con id desconocido → mismo array;
    - `status_changed` de un id ausente → mismo array;
    - `updated` de un id existente → lo reemplaza;
    - `new` de un id existente → no lo duplica.
- [ ] **Paso 3:** `cd frontend && npx vitest run` → FAIL.
- [ ] **Paso 4: Implementar** las funciones puras y los hooks.
  - `useSocket` escucha `ticket:removed`, y `status_changed` recibe `{ id, from, to, ticket }`.
  - `useDashboardData` usa `applyDashboardEvent`. Suena con `new`, y con `status_changed` solo si el ticket existía y su estado cambió.
  - `loadFullState` también trae `fetchQueueAccess`.
  - `TicketNotification.previousState?: string`.
- [ ] **Paso 5:** `npx vitest run` → PASS. `tsc` puede seguir fallando en componentes aún no migrados; eso se resuelve en la Tarea 11.
- [ ] **Paso 6: Commit** `"Frontend: congelar vista histórica y agregar modelo y lógica de Znuny"`.

### Tarea 11: Frontend — mapa, métricas, tabla y detalle sobre Znuny

**Archivos:**
- Crear:
  - `frontend/src/components/QueueTreeSelect.tsx`
  - `frontend/src/components/NoQueueAccessBanner.tsx`
  - `frontend/src/lib/queueIcons.tsx`, que reemplaza a `departmentIcons.tsx`
  - `frontend/test/queueFilter.test.ts`
- Modificar:
  - `frontend/src/lib/{labels,siteDominance,siteMarkerIcon,sla}`
  - `frontend/src/components/{TicketsTable,DetailDrawer,KpiDock,MapHeroView,MapView,MetricsView,NotificationStack,StatusChart,SiteRail}.tsx`
  - `frontend/src/App.tsx`

**Interfaces:**
- Consume: la Tarea 10.
- Produce:
  - `matchesQueueFilter(ticketQueue: string, selected: string | null): boolean`. Seleccionar `"A"` coincide con `"A"` y con `"A::…"`.
  - `<QueueTreeSelect queues={catalog.queues} value onChange multiple? />`.
  - `queueIcon(queue: string)`, según la cola raíz: `Tecnología`, `SINI - Soporte IT`, `SINI - Mantenimiento`, `CCTV` y `BodyCams`, con un ícono genérico para el resto.

- [ ] **Paso 1: Prueba que falla** de `matchesQueueFilter`:
  - `("Tecnología::Back Office","Tecnología")` → `true`;
  - `("TecnologíaX","Tecnología")` → `false`;
  - `(cualquiera, null)` → `true`.
- [ ] **Paso 2:** ejecutar → FAIL.
- [ ] **Paso 3: Implementar.**
  - Tabla:
    - columnas TN, Título, Cola, Estado, Prioridad, Propietario, Sitio, SLA y Creado;
    - filtro de Cola en árbol → Propietario, cuyas opciones son los owners de los tickets que pasan el filtro de cola;
    - filtros de Estado, Prioridad, Tipo y Servicio con opciones del `catalog`.
  - Detalle:
    - suma tipo, servicio, SLA, responsable y cliente;
    - botón "Ver en Znuny" con `ticket.znunyUrl`, `target="_blank"` y `rel="noopener"`.
  - KPIs: Abiertos, `<nombre de la prioridad máxima>` abiertos, Cerrados hoy y Tendencia.
  - Mapa: usa `siteSeverity` con `topPriorityOpen`.
  - SLA: `computeSlaPercentage` recibe `stateType`; cuenta como abierto según `isOpenStateType`.
  - Notificaciones: "TN · título"; en los cambios de estado, "de X a Y".
  - Fechas con `formatSvDateTime`.
  - Se eliminan `STATUS_LABELS` y `PRIORITY_LABELS`: se usan los nombres reales.
  - `App.tsx` muestra `NoQueueAccessBanner` si `queueAccess === "none"`.
  - "osTicket" → "Znuny" en todos estos componentes.
- [ ] **Paso 4:** `npx vitest run` → PASS; `npm run build` (tsc + vite) → sin errores.
- [ ] **Paso 5: Commit** `"Frontend: mapa, métricas y tabla con el modelo nativo de Znuny"`.

### Tarea 12: Frontend — pestaña Histórico osTicket

**Archivos:**
- Modificar:
  - `frontend/src/components/TopBar.tsx`: `DashboardView = "map" | "metrics" | "legacy"`, con la pestaña "Histórico osTicket".
  - `frontend/src/App.tsx`: renderiza `<LegacyView />` cuando `view === "legacy"`.

**Interfaces:**
- Consume: `LegacyView` (Tarea 10).

- [ ] **Paso 1: Implementar** la pestaña. `LegacyView` carga los datos solo cuando se abre, y no tiene mapa ni socket.
- [ ] **Paso 2: Verificar.**
  - `npm run build` → OK.
  - Con backend, túnel y osTicket arriba: la pestaña muestra las métricas y la tabla viejas, sin la etiqueta "Datos congelados".
  - Con `OSTICKET_SOURCE=snapshot` y un snapshot generado en local (`npm run osticket:snapshot`): muestra "Datos congelados al 08/11/2026" y no muestra el link a osTicket.
- [ ] **Paso 3: Commit** `"Agregar pestaña Histórico osTicket"`.

### Tarea 13: Panel admin — colas por usuario y sitios por clave de Znuny

**Archivos:**
- Modificar:
  - `frontend/src/api/adminClient.ts`:
    - `fetchAdminQueues`;
    - `allowedQueues` en alta y edición de usuarios;
    - `fetchUnmappedSites(): Promise<{key;label}[]>`;
    - `saveSite({znunyKey,type,lat,lng})`.
  - `frontend/src/admin/AdminUsersSection.tsx`
  - `frontend/src/admin/AdminSitesSection.tsx`
  - `frontend/src/types/index.ts`: `AdminUserSummary.allowedQueues: string[] | null` y `unknownQueues: string[]`.

**Interfaces:**
- Consume:
  - los endpoints de admin de la Tarea 9;
  - `QueueTreeSelect` (Tarea 11).

- [ ] **Paso 1: Implementar.**
  - Usuarios:
    - columna "Colas" con `Badge` "Pendiente de asignar colas" si `allowedQueues === null`, "Todas" si es `[]` y la lista en otro caso;
    - por cada entrada de `unknownQueues`, "Cola inexistente en Znuny: X" en rojo;
    - el formulario tiene "Todas las colas", "Colas específicas" (`QueueTreeSelect` múltiple) y "Sin acceso" (envía `null`);
    - el selector de departamentos pasa a llamarse "Departamentos (histórico osTicket)".
  - Sitios:
    - "Sitios sin configurar" lista `{key,label}` con el botón "Asignar coordenadas", que envía el `znunyKey`;
    - los sitios configurados se muestran con la etiqueta de Znuny.
- [ ] **Paso 2: Verificar** en local, con backend y túnel arriba:
  - un admin asigna `CCTV` a un usuario restringido → `GET /api/tickets` de ese usuario solo trae colas `CCTV`;
  - al pasarlo a "Sin acceso" vuelve el aviso;
  - `npm run build` → OK.
- [ ] **Paso 3: Commit** `"Panel admin: colas por usuario y sitios por clave de Znuny"`.

### Tarea 14: Verificación end-to-end y documentación

**Archivos:**
- Modificar:
  - `CLAUDE.md`: la arquitectura con `znuny/`, `legacy/osticket/`, el túnel, `DATA_DIR`, la zona horaria de Znuny y las rooms `queue:*`; corregir "src/data"; sumar el hito "8 nov — migración a Znuny".
  - `backend/.env.example`

- [ ] **Paso 1:** correr todas las pruebas.
  - `cd backend && npx vitest run && npm run test:it`, con el túnel arriba → todo PASS.
  - `cd frontend && npx vitest run && npm run build` → PASS.
- [ ] **Paso 2:** Playwright contra la instalación local (`npm run dev` en backend y frontend). Guardar capturas en el scratchpad.
  - Como admin:
    - el mapa muestra los sitios con nombres de Znuny ("Santa Elena", "Hachadura"…), en rojo donde hay tickets "crítica" abiertos;
    - en Métricas, el total coincide con el conteo de la prueba de integración;
    - el filtro de cola `Tecnología` incluye sus subcolas;
    - "Ver en Znuny" abre la URL correcta;
    - la pestaña Histórico carga;
    - con un viewport de 1920×1080 (TV), el layout no se rompe.
  - Como usuario restringido sin colas: se ve el aviso y el mapa queda vacío.
- [ ] **Paso 3:** actualizar `CLAUDE.md` y hacer commit `"Documentar arquitectura con Znuny"`.

### Tarea 15: Pase a producción

Requiere el OK explícito del usuario antes de cada paso que toque el servidor.

**Servidor:**
- `ubuntu@ec2-52-1-200-109.compute-1.amazonaws.com`, con la llave `~/.ssh/appsproyectos.pem`.
- La app está en `/home/ubuntu/mapa-incidencias-` y corre en PM2 como `backend`.

- [ ] **Paso 1:** merge de `develop` → `main` y push, con confirmación del usuario.
- [ ] **Paso 2 (servidor):** respaldo.
  - `tar czf ~/backup-mapa-$(date +%Y%m%d-%H%M).tgz backend/dist/data backend/.env frontend/.env.production`;
  - verificar que el `.tgz` contiene `users.json` y `site-metadata.json`.
- [ ] **Paso 3:** configuración.
  - Agregar a `backend/.env`: `ZNUNY_BASE_URL=https://mesadeservicio.gcslatam.com/znuny`, `DATA_DIR=/home/ubuntu/mapa-incidencias-data` y `OSTICKET_SOURCE=live`.
  - Verificar que las 5 variables `ZNUNY_DB_*` ya están (se cargaron en prod el 8-nov, con `ZNUNY_DB_PORT=3307`), **sin imprimir valores**: `grep -c '^ZNUNY_DB_' backend/.env` → `5`. Si da otro número, revisar los nombres con `grep -o '^ZNUNY_DB_[A-Z]*' backend/.env` (solo nombres).
  - `systemctl is-active znuny-tunnel` → `active`.
- [ ] **Paso 4:** actualizar el código y compilar.
  - Si `git pull` se bloquea por `frontend/package-lock.json`, hacer `git stash` de ese archivo.
  - `git pull origin main`.
  - `cd backend && npm ci && npm run build`.
  - `cd ../frontend && npm ci && npm run build`.
  - `frontend/.env.production` no se toca.
- [ ] **Paso 4b:** confirmar cómo corre el proceso antes de reiniciarlo.
  - `pm2 describe backend`: el `script path` debe terminar en `dist/index.js` y el `exec mode` debe ser `fork` (en `cluster` cada instancia correría sus propios pollers y duplicaría eventos). Si no coincide, frenar y revisar con el usuario.
- [ ] **Paso 5:** reiniciar y verificar.
  - `pm2 restart backend`.
  - `pm2 logs backend --lines 50` debe mostrar la copia a `DATA_DIR`, las migraciones con sus `.bak` y ningún error.
  - En esos logs también: `API + socket.io escuchando en ...` y los dos pollers arrancados, `[znuny-poller] tickets iniciado (lastId=...)` y `[znuny-poller] estados iniciado (lastHistoryId=...)`. Un `error en el ciclo` repetido indica túnel o credenciales `ZNUNY_DB_*` mal.
  - `curl -s localhost:4000/api/health` → `ok`.
  - En el navegador: login de admin, unos 77 tickets y el mapa correcto.
- [ ] **Paso 6:** el usuario asigna colas a los 8 usuarios restringidos desde el panel.
- [ ] **Paso 7 (lunes 9-nov-2026):** congelar el histórico.
  - `cd backend && node dist/scripts/osticketSnapshot.js` debe imprimir un total igual al `COUNT`.
  - Poner `OSTICKET_SOURCE=snapshot` en `.env` y hacer `pm2 restart backend`.
  - La pestaña Histórico debe mostrar "Datos congelados al 09/11/2026".
- [ ] **Paso 8 (antes de apagar osTicket):** confirmar que `/api/admin/departments` responde en modo snapshot.
  - Va después del Paso 7 porque recién ahí el backend corre con `OSTICKET_SOURCE=snapshot`; osTicket **no** se apaga hasta que este paso dé bien.
  - Con sesión de admin, en el panel → Usuarios → "Crear usuario": la lista de departamentos debe aparecer (sin el aviso "osTicket no disponible"). Equivalente: en las DevTools del navegador logueado, `fetch("/api/admin/departments").then(r => r.status)` → `200` con la lista de departamentos del snapshot.
  - Si da 503, el snapshot no está en `DATA_DIR` (`osticket-snapshot.json`): no apagar osTicket.
- [ ] **Rollback:** `git checkout 5a58e97`, build y `pm2 restart backend`. Los archivos originales siguen en `dist/data/` y en el `.tgz` de respaldo.
