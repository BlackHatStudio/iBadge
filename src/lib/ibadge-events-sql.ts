import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";

import type { EventRecord } from "@/lib/kiosk-types";

const execFileAsync = promisify(execFile);
const SQLCMD_PATH = "sqlcmd";

type SqlcmdConfig = {
  server: string;
  database: string;
  authArgs: string[];
};

function parseEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return {} as Record<string, string>;
  }

  const parsed: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function sqlcmdConfig(): SqlcmdConfig {
  const serverEnv = parseEnvFile(path.join(process.cwd(), "server", ".env"));
  const server = process.env.IBADGE_SQLCMD_SERVER?.trim() || serverEnv.DB_SERVER || serverEnv.SQLSERVER_HOST || "localhost";
  const database =
    process.env.IBADGE_SQLCMD_DATABASE?.trim() || serverEnv.DB_NAME || serverEnv.SQLSERVER_DATABASE || "ibadge";
  const username = process.env.IBADGE_SQLCMD_USERNAME?.trim();
  const password = process.env.IBADGE_SQLCMD_PASSWORD?.trim();

  return {
    server,
    database,
    authArgs: username && password ? ["-U", username, "-P", password] : ["-E"],
  };
}

function mapEventRow(columns: string[]): EventRecord {
  return {
    EventId: columns[0] ?? "",
    EventName: columns[1] ?? "",
    IsActive: columns[2] === "1",
    LastUpdatedUTC: columns[3] ?? null,
  };
}

async function runSqlRows(query: string) {
  const config = sqlcmdConfig();
  const { stdout } = await execFileAsync(
    SQLCMD_PATH,
    [
      ...config.authArgs,
      "-S",
      config.server,
      "-d",
      config.database,
      "-W",
      "-s",
      "|",
      "-h",
      "-1",
      "-Q",
      query,
    ],
    {
      maxBuffer: 1024 * 1024 * 4,
    }
  );

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("("))
    .map((line) => line.split("|").map((column) => column.trim()));
}

function toUtcIsoExpression(columnName: string) {
  return `CONVERT(nvarchar(33), ${columnName}, 127) + 'Z'`;
}

export async function listIbadgeEvents() {
  const rows = await runSqlRows(`
    SET NOCOUNT ON;
    SELECT
      CAST(EventID AS nvarchar(50)) AS EventId,
      EventName,
      CAST(IsActive AS int) AS IsActive,
      ${toUtcIsoExpression("CreatedUTC")} AS LastUpdatedUTC
    FROM dbo.Event
    ORDER BY EventName;
  `);

  return rows.map(mapEventRow);
}

export async function createIbadgeEvent(name: string) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Event name is required.");
  }

  const escapedName = trimmedName.replace(/'/g, "''");
  const rows = await runSqlRows(`
    SET NOCOUNT ON;
    INSERT INTO dbo.Event (EventName, IsActive, CreatedUTC)
    OUTPUT
      CAST(inserted.EventID AS nvarchar(50)) AS EventId,
      inserted.EventName,
      CAST(inserted.IsActive AS int) AS IsActive,
      ${toUtcIsoExpression("inserted.CreatedUTC")} AS LastUpdatedUTC
    VALUES (N'${escapedName}', 1, SYSUTCDATETIME());
  `);

  const created = rows[0];
  if (!created) {
    throw new Error("Event insert did not return a row.");
  }

  return mapEventRow(created);
}
