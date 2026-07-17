import { PrismaClient } from "@prisma/client";

const globalDb = globalThis as unknown as { forgeDb?: PrismaClient };
export const db = globalDb.forgeDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.forgeDb = db;
