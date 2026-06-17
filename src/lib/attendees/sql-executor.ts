import sql from "mssql";

import type { SqlExecutor } from "@/lib/attendees/repository";

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function getSqlConfig(): sql.config | string {
  const connectionString = process.env.ATTENDEE_SQLSERVER_CONNECTION_STRING?.trim() || process.env.SQLSERVER_CONNECTION_STRING?.trim();
  if (connectionString) {
    return connectionString;
  }

  return {
    server: process.env.SQLSERVER_HOST?.trim() || process.env.DB_SERVER?.trim() || requireEnv("SQLSERVER_HOST"),
    database: process.env.SQLSERVER_DATABASE?.trim() || process.env.DB_NAME?.trim() || requireEnv("SQLSERVER_DATABASE"),
    user: process.env.SQLSERVER_USER?.trim() || process.env.DB_USER?.trim(),
    password: process.env.SQLSERVER_PASSWORD?.trim() || process.env.DB_PASSWORD?.trim(),
    options: {
      encrypt: process.env.SQLSERVER_ENCRYPT !== "false",
      trustServerCertificate: process.env.SQLSERVER_TRUST_SERVER_CERTIFICATE === "true",
    },
  };
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(getSqlConfig()).connect();
  }
  return poolPromise;
}

function bindParams(request: sql.Request, params: Record<string, unknown>) {
  for (const [key, value] of Object.entries(params)) {
    if (value instanceof Buffer) {
      request.input(key, sql.VarBinary(sql.MAX), value);
    } else {
      request.input(key, value as never);
    }
  }
}

export function createMssqlExecutor(): SqlExecutor {
  return {
    async query<T>(queryText: string, params: Record<string, unknown> = {}) {
      const pool = await getPool();
      const request = pool.request();
      bindParams(request, params);
      const result = await request.query<T>(queryText);
      return result.recordset ?? [];
    },
    async transaction<T>(work: (executor: SqlExecutor) => Promise<T>) {
      const pool = await getPool();
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      const executor: SqlExecutor = {
        async query<R>(queryText: string, params: Record<string, unknown> = {}) {
          const request = new sql.Request(transaction);
          bindParams(request, params);
          const result = await request.query<R>(queryText);
          return result.recordset ?? [];
        },
        async transaction<R>(nestedWork: (nestedExecutor: SqlExecutor) => Promise<R>) {
          return nestedWork(executor);
        },
      };

      try {
        const result = await work(executor);
        await transaction.commit();
        return result;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    },
  };
}
