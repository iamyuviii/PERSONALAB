import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { databaseFailure } from "../src/lib/database-errors";

test("TLS initialization errors are actionable without leaking driver details", () => {
  const result = databaseFailure(new Prisma.PrismaClientInitializationError(
    "Error opening a TLS connection: OpenSSL error postgresql://user:SECRET@host/db", "6.19.3",
  ));
  assert.equal(result?.code, "DATABASE_TLS_FAILED");
  assert.equal(result?.status, 503);
  assert.ok(!JSON.stringify(result).includes("SECRET"));
  assert.ok(!result?.error.includes("db:setup"));
});

test("database access, availability, and missing schema have distinct diagnostics", () => {
  for (const [code, expected] of [
    ["P1011", "DATABASE_TLS_FAILED"],
    ["P1000", "DATABASE_ACCESS_FAILED"],
    ["P1001", "DATABASE_UNAVAILABLE"],
    ["P2021", "DATABASE_SCHEMA_MISSING"],
  ]) {
    const error = new Prisma.PrismaClientKnownRequestError("private driver details", { code, clientVersion: "6.19.3" });
    assert.equal(databaseFailure(error)?.code, expected);
  }
  assert.equal(databaseFailure(new Error("unrelated error")), null);
  assert.equal(databaseFailure(new Prisma.PrismaClientKnownRequestError("missing record", { code: "P2025", clientVersion: "6.19.3" })), null);
});
