import { PrismaClient, Prisma } from "@prisma/client";

console.log(`[Database check] Node ${process.version}; OpenSSL ${process.versions.openssl}; Prisma ${Prisma.prismaVersion.client}; ${process.platform}/${process.arch}`);
let client;
try {
  client = new PrismaClient({ log: [] });
  await client.$connect();
  // Exercise the generated runtime client and application tables, not just the migration engine.
  // Do not write data or print saved studies.
  await client.project.findMany({ take: 1, select: { id: true, reports: { take: 1, select: { id: true } } } });
  console.log("[Database check] Application database read succeeded.");
} catch (error) {
  const rawCode = error?.errorCode || error?.code;
  const code = /^P\d{4}$/.test(rawCode || "") ? rawCode : "UNKNOWN";
  const tls = /Error opening a TLS connection/i.test(error?.message || "");
  console.error(`[Database check] Application database read failed (${code}${tls ? "; TLS handshake failed" : ""}).`);
  console.error("[Database check] Check DATABASE_URL, database availability, and the generated Prisma engine. Connection credentials and raw driver messages are omitted.");
  process.exitCode = 1;
} finally {
  if (client) {
    try { await client.$disconnect(); }
    catch {
      console.error("[Database check] Database client cleanup failed.");
      process.exitCode = 1;
    }
  }
}
