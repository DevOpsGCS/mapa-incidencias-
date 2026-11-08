import mysql from "mysql2/promise";

const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"] as const;

let pool: mysql.Pool | null = null;

// El pool se crea recién en el primer uso (no al importar el módulo): en modo
// snapshot (OSTICKET_SOURCE=snapshot, osTicket apagado) no hay variables DB_*
// y el backend tiene que poder arrancar igual.
function getPool(): mysql.Pool {
  if (pool) return pool;
  for (const name of requiredEnvVars) {
    if (!process.env[name]) {
      throw new Error(
        `Falta la variable de entorno ${name}. Revisa backend/.env (ver .env.example).`
      );
    }
  }
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    // Traer DATETIME/TIMESTAMP como strings crudos ("YYYY-MM-DD HH:MM:SS"), no
    // como objetos Date. mysql2 interpreta esas columnas usando la timezone
    // LOCAL del proceso de Node al construir un Date, lo que rompe cualquier
    // comparación cronológica si el reloj/timezone del servidor de la base no
    // coincide exactamente con el del proceso (nos pasó: el servidor de la
    // base tiene ~6h de desfase, y eso hacía que el poller de tickets nunca
    // "alcanzara" el reloj real y re-emitiera los mismos tickets sin parar).
    // Con strings crudos, toda comparación se hace texto-contra-texto, en el
    // mismo marco de referencia que ya usa la propia base — autoconsistente
    // sin importar el desfase.
    dateStrings: true,
  });
  return pool;
}

/**
 * Conexión de SOLO LECTURA a la base real de osTicket (producción, no nos
 * pertenece). Esta función es la única forma en que el resto del backend
 * habla con MySQL, y rechaza cualquier consulta que no sea SELECT — no se
 * escribe, actualiza ni borra nada bajo ninguna circunstancia.
 */
export async function readOnlyQuery<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const normalized = sql.trim().toUpperCase();
  if (!normalized.startsWith("SELECT")) {
    throw new Error(
      `Consulta rechazada: solo se permiten SELECT en esta conexión de solo lectura. Recibido: ${sql.slice(0, 60)}...`
    );
  }
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}

export default getPool;
