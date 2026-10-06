# Mapa de Incidencias — contexto del proyecto

Dashboard con mapa que muestra en vivo los tickets de un osTicket real (aduanas/sedes). Backend Express+TypeScript, frontend React+Vite+TypeScript, tiempo real vía socket.io.

## Arquitectura

- `backend/src/db.ts` — conexión MySQL de **solo lectura** (`readOnlyQuery`) contra la base real de osTicket.
- `backend/src/repositories/ticketsRepository.ts` — lee tickets en vivo desde MySQL y los traduce al modelo del frontend. No hay caché ni copia propia de tickets.
- `backend/src/repositories/sitesRepository.ts` — ver más abajo, "Regla de oro de datos".
- `backend/src/sockets/liveSimulator.ts` — poller que reutiliza la misma lógica de `ticketsRepository` para emitir updates en vivo por socket.io.
- `backend/src/auth.ts` + `backend/src/routes/admin.ts` — login admin (JWT en cookie httpOnly) y CRUD de `site-metadata.json`.
- `frontend/src/admin/` — `AdminLoginForm.tsx` (form puro, sin layout), `AdminLogin.tsx` (página completa que lo envuelve, para acceso directo por `/admin/login`), `AdminLoginModal.tsx` (mismo form en modal) y `AdminSitesPage.tsx`. El botón de acceso (ícono de candado) vive en `TopBar.tsx`, junto a `SoundToggle`/`SyncStatus`: abre el modal si no hay sesión vigente (probando primero `GET /api/admin/sites`; si da 401 recién ahí muestra el login) o navega directo a `/admin/sites` si la cookie sigue válida.

## Regla de oro de datos (por qué existe `site-metadata.json`)

Lo único que este dashboard "posee" y osTicket no tiene: **lat/lng y tipo de sitio** (aduana marítima/terrestre/aérea/sede). Todo lo demás (qué sitios existen, departamentos, prioridades, estados) se consulta siempre en vivo, nunca se mantiene una lista propia que se pueda desincronizar.

- `backend/src/data/site-metadata.json` — dato real de producción, editado por el panel `/admin/sites`. Está en `.gitignore` (`backend/.gitignore`): un `git pull` **nunca** debe pisarlo.
- `backend/src/data/site-metadata.seed.json` — sí se trackea; es el punto de partida para una instalación nueva (se copia a `site-metadata.json` la primera vez que el proceso arranca y ese archivo no existe todavía).
- `POST /api/admin/sites` nunca "inventa" un sitio: valida en vivo contra `ost_list_items` que el nombre ya exista en osTicket antes de guardar coordenadas.

## Decisiones no obvias (evitar re-romperlas)

- **Sitios se resuelven por NOMBRE, nunca por ID.** Un mismo sitio puede tener IDs distintos en `ost_list_items` según la lista: `list_id=2` ("Sitio de Aduana", campo general de tickets) vs `list_id=7` ("CCTV Sitios", campo propio del depto CCTV). Ver `SITE_LIST_IDS` en `ticketsRepository.ts` y `routes/admin.ts`.
- **Prioridad/estado se traducen por la PALABRA real de osTicket, nunca por ID fijo.** Si alguien reordena `ost_ticket_priority`/`ost_ticket_status` en osTicket, un mapeo por ID queda mal sin que nadie lo note — ya pasó una vez. Ver `PRIORITY_WORD_TO_APP` / `STATUS_NAME_TO_APP`.
- **Número de ticket visible = `ost_ticket.number`, nunca `ticket_id`.** Son contadores distintos y se desalinean (desde `ticket_id` 1890, el 2026-09-20, `number` va +1). El link a osTicket sí usa `ticket_id` (`tickets.php?id=`). Ver `toDisplayTicketId`.
- **Fechas:** la base guarda DATETIME ya en UTC. `mysqlDatetimeToIso` marca el string como UTC explícitamente antes de convertir — dejar que el driver de MySQL reinterprete con timezone local causó un desfasaje de 6h en la UI y un bug de reenvío duplicado en el poller.
- **Detección de sitios nuevos:** `GET /api/admin/sites/unmapped` compara en vivo los valores reales de `ost_list_items` contra `site-metadata.json` y devuelve los que faltan configurar. `AdminSitesPage.tsx` ya lo consume (sección "Sitios sin configurar"): un sitio nuevo en osTicket **sí aparece ahí** (como texto plano, sin ícono — no tiene `type` todavía) con un botón "Asignar coordenadas", pero **no aparece en el mapa** hasta que un admin le asigna tipo + lat/lng manualmente. Mientras tanto sus tickets sí cuentan en las métricas globales pero no en el desglose por sitio.
- **Acceso admin:** ya no es solo por URL directa — hay un botón discreto (ícono candado) en la barra superior del dashboard (`TopBar.tsx`) que abre un modal de login (`AdminLoginModal.tsx`), sin navegar a una página aparte. `/admin/login` sigue existiendo como página completa para acceso directo por URL (bookmarks, etc.), reutilizando el mismo `AdminLoginForm.tsx`. Tanto el modal como la página de admin (`AdminSitesPage.tsx`) llevan el logo de GCS.

## Configuración / secretos (NO están acá, transferir a mano)

`backend/.env` (gitignored, ver `backend/.env.example` para las claves):
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — conexión de solo lectura a la base real de osTicket.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` (bcrypt — la contraseña real nunca se guarda en texto plano en ningún archivo, se genera con `npm run hash-password -- "contraseña"` dentro de `backend/`), `JWT_SECRET`.

Si migrás de máquina/cuenta, copiá `backend/.env` a mano — no viaja con git.

## Estado / historial reciente

- `f1c1c16` — migración del backend de datos mock a datos reales de osTicket vía MySQL.
- Repo remoto: `https://github.com/devopsGSC/mapa-incidencias-.git`.
- Trabajo reciente sin commitear: capa de auth admin (`auth.ts`, `routes/admin.ts`), panel `frontend/src/admin/`, `adminClient.ts`, script de hash de password (`backend/src/scripts/`), `site-metadata.seed.json`. Revisar `git status` antes de asumir que esto ya está en el repo.
