import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
if (existsSync(resolve(root, ".env"))) process.loadEnvFile(resolve(root, ".env"));
const command = process.argv[2];
const url = process.env.DATABASE_URL?.trim();
const postgres = /^postgres(?:ql)?:\/\//.test(url || "");
if (!postgres && url && !url.startsWith("file:")) throw new Error("DATABASE_URL must be a PostgreSQL connection string or a local file: URL.");
if (!url && command !== "generate") throw new Error("Set DATABASE_URL in your service environment before initializing the database.");
if (command === "deploy" && !postgres) throw new Error("Render free deployments require a hosted PostgreSQL DATABASE_URL. Local SQLite is only for development.");
const schema = resolve(root, postgres ? "prisma/postgresql/schema.prisma" : "prisma/schema.prisma");
const require = createRequire(import.meta.url);
const cli = require.resolve("prisma/build/index.js");
function prisma(...args) {
  const result = spawnSync(process.execPath, [cli, ...args, "--schema", schema], {
    cwd: root, env: process.env, stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

function checkDatabase() {
  const result = spawnSync(process.execPath, [resolve(root, "scripts/check-database.mjs")], {
    cwd: root, env: process.env, stdio: "inherit", timeout: 45000,
  });
  if (result.error) {
    console.error("[Database check] Could not finish the application database check within 45 seconds.");
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

if (command === "generate") {
  prisma("generate");
} else if (command === "check") {
  checkDatabase();
} else if (command === "setup" || command === "deploy") {
  if (command === "setup") prisma("generate");
  if (postgres) {
    // Only migrations touch the hosted database. No resets or destructive db push.
    prisma("migrate", "deploy");
  } else {
    await import("./prepare-db.mjs");
    prisma("db", "push", "--skip-generate");
  }
  if (command === "deploy") checkDatabase();
} else {
  throw new Error("Use database.mjs generate, setup, deploy, or check.");
}
