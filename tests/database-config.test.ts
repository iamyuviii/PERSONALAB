import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("SQLite and PostgreSQL schemas describe the same application data", () => {
  const local = readFileSync("prisma/schema.prisma", "utf8").replace(/\r\n/g, "\n").trim();
  const hosted = readFileSync("prisma/postgresql/schema.prisma", "utf8").replace(/\r\n/g, "\n").trim();
  assert.equal(hosted, local.replace('provider = "sqlite"', 'provider = "postgresql"'));
  const migration = readFileSync("prisma/postgresql/migrations/20261002000000_initial/migration.sql", "utf8");
  for (const name of ["Project", "Evidence", "Persona", "Run", "StageLog", "Simulation", "Report", "GroundTruth"]) {
    assert.ok(migration.includes(`CREATE TABLE "${name}"`));
  }
  assert.ok(migration.includes("JSONB"));
  assert.ok(!migration.includes("DROP TABLE"));
});

test("hosted deployment rejects ephemeral SQLite and unsupported URLs without exposing secrets", () => {
  for (const url of ["file:./dev.db", "mysql://private:SECRET@localhost/database"]) {
    const result = spawnSync(process.execPath, ["scripts/database.mjs", "deploy"], {
      encoding: "utf8", env: { ...process.env, DATABASE_URL: url },
    });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PostgreSQL/);
    assert.ok(!result.stderr.includes("SECRET"));
  }
});
