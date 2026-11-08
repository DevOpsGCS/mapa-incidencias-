import mysql from "mysql2/promise";

/**
 * Znuny no está disponible: falta configuración o la conexión (túnel SSH) cayó.
 * Las rutas la traducen a 503 "Mesa de servicio no disponible".
 */
export class ZnunyUnavailableError extends Error {
  constructor(message = "Mesa de servicio no disponible") {
    super(message);
    this.name = "ZnunyUnavailableError";
  }
}

const UNAVAILABLE_CODES = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ECONNRESET",
  "PROTOCOL_CONNECTION_LOST",
  "ER_ACCESS_DENIED_ERROR",
]);

let pool: mysql.Pool | null = null;

// No se valida nada al importar: el backend debe arrancar aunque falte la
// configuración o el túnel esté caído. El pool se crea la primera vez que se usa.
function getPool(): mysql.Pool {
  if (!process.env.ZNUNY_DB_HOST) {
    throw new ZnunyUnavailableError("ZNUNY_DB_* no configurado");
  }
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.ZNUNY_DB_HOST,
      port: Number(process.env.ZNUNY_DB_PORT ?? 3306),
      user: process.env.ZNUNY_DB_USER,
      password: process.env.ZNUNY_DB_PASSWORD,
      database: process.env.ZNUNY_DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 5000,
      // DATETIME como string crudo, para convertirlo con znunyLocalToIso.
      dateStrings: true,
    });
  }
  return pool;
}

/**
 * Conexión de SOLO LECTURA a la base de Znuny. Única vía de acceso a Znuny:
 * rechaza cualquier consulta que no sea SELECT.
 */
export async function znunyReadOnlyQuery<T = unknown>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const normalized = sql.trim().toUpperCase();
  if (!normalized.startsWith("SELECT")) {
    throw new Error(
      `Consulta rechazada: solo se permiten SELECT en esta conexión de solo lectura. Recibido: ${sql.slice(0, 60)}...`
    );
  }
  const p = getPool();
  try {
    const [rows] = await p.query(sql, params);
    return rows as T[];
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code && UNAVAILABLE_CODES.has(code)) {
      throw new ZnunyUnavailableError(`Znuny no disponible (${code})`);
    }
    throw err;
  }
}
