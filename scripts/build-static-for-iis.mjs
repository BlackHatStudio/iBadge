/**
 * Produces `out/` for IIS + Inno Setup packaging. App Router `src/app/api` route
 * handlers are incompatible with `output: "export"`, so they are moved aside for
 * this build only. Production API calls are proxied to the Express service via
 * web.config (see deployment/config/web.config.template).
 */
import { existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const apiPath = join(root, "src", "app", "api");
const holdPath = join(root, "node_modules", ".ibadge-api-hold");

function cleanNextArtifacts() {
  for (const name of [".next", "out"]) {
    const p = join(root, name);
    if (existsSync(p)) {
      rmSync(p, { recursive: true, force: true });
    }
  }
}

let code = 1;
const hadApi = existsSync(apiPath);

try {
  cleanNextArtifacts();
  if (hadApi) {
    renameSync(apiPath, holdPath);
  }

  const r = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    cwd: root,
    env: { ...process.env, NEXT_STATIC_EXPORT: "1" },
    shell: process.platform === "win32",
  });
  code = r.status === null ? 1 : r.status;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (existsSync(holdPath) && !existsSync(apiPath)) {
    renameSync(holdPath, apiPath);
  }
}

if (code === 0 && !existsSync(join(root, "out"))) {
  console.error("Build reported success but `out` directory is missing.");
  process.exit(1);
}

process.exit(code);
