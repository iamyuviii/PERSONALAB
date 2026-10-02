import { existsSync, mkdirSync, openSync, closeSync } from "node:fs";
import { dirname, resolve } from "node:path";

if (existsSync(".env")) process.loadEnvFile(".env");
const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:")) throw new Error("Set DATABASE_URL to a local SQLite file in .env.");
const path = resolve("prisma", url.slice(5));
mkdirSync(dirname(path), { recursive: true });
// Some Windows Prisma engines cannot initialize a missing file during db push.
// Exclusive creation guarantees an existing database is never truncated.
try { closeSync(openSync(path, "wx")); }
catch (error) { if (error.code !== "EEXIST") throw error; }
