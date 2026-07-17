import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL || "";
if (!/^postgres(ql)?:\/\//.test(url)) throw new Error("DATABASE_URL must be a PostgreSQL connection string");
const db = new PrismaClient();
try {
  const email = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD || "";
  if (!email || password.length < 12) throw new Error("OWNER_EMAIL and an OWNER_PASSWORD of at least 12 characters are required");
  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.upsert({ where: { email }, update: { role: "OWNER" }, create: { email, name: process.env.OWNER_NAME || "ForgeOps Owner", passwordHash, role: "OWNER", specialty: "Command authority" } });
  console.log(`[startup] Owner authority ready for ${email}`);
} finally { await db.$disconnect(); }
