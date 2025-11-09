import { PrismaClient } from "@prisma/client";

// Reuse the Prisma client across hot reloads in development
const globalForPrisma = globalThis;

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"], // optional but helpful for debugging
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;


// globalThis.prisma: This global variable ensures that the Prisma client instance is
// reused across hot reloads during development. Without this, each time your application
// reloads, a new instance of the Prisma client would be created, potentially leading
// to connection issues.