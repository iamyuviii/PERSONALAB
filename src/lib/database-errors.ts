import { Prisma } from "@prisma/client";

export function databaseFailure(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientInitializationError) &&
      !(error instanceof Prisma.PrismaClientKnownRequestError) &&
      !(error instanceof Prisma.PrismaClientUnknownRequestError)) return null;

  const code = error instanceof Prisma.PrismaClientInitializationError
    ? error.errorCode
    : error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;

  // Inspect driver details locally; never return connection strings or credentials.
  if (code === "P1011" || /Error opening a TLS connection/i.test(error.message)) {
    return { code: "DATABASE_TLS_FAILED", status: 503, error: "Research storage is unavailable because the secure database connection failed. The service's database connection settings need checking." };
  }
  if (code === "P1000" || code === "P1010") {
    return { code: "DATABASE_ACCESS_FAILED", status: 503, error: "Research storage is unavailable because database access was denied. The service's database credentials and permissions need checking." };
  }
  if (["P1001", "P1002", "P1008", "P1017", "P2024"].includes(code || "")) {
    return { code: "DATABASE_UNAVAILABLE", status: 503, error: "Research storage is temporarily unavailable. Please retry shortly." };
  }
  if (["P1003", "P2021", "P2022"].includes(code || "")) {
    return { code: "DATABASE_SCHEMA_MISSING", status: 503, error: "Research storage has not been initialized correctly. The service's database migrations need checking." };
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { code: "DATABASE_INITIALIZATION_FAILED", status: 503, error: "Research storage could not connect to the database. The service's database configuration needs checking." };
  }
  return null;
}
