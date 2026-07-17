import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL || "";
if (!/^postgres(ql)?:\/\//.test(url)) throw new Error("DATABASE_URL must be a PostgreSQL connection string");
const db = new PrismaClient();
try {
  const email = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD || "";
  const name = (process.env.OWNER_NAME || "Project VALORIS Owner").trim();

  if (!email && !password) {
    console.warn("[startup] OWNER_EMAIL and OWNER_PASSWORD are not configured; skipping owner sync.");
    console.warn("[startup] Add both variables and redeploy before using owner-only controls.");
  } else {
    if (!email || !password) throw new Error("OWNER_EMAIL and OWNER_PASSWORD must be configured together");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("OWNER_EMAIL must be a valid email address");
    if (password.length < 12) throw new Error("OWNER_PASSWORD must contain at least 12 characters");

    const passwordHash = await bcrypt.hash(password, 12);
    await db.user.upsert({
      where: { email },
      update: { name, passwordHash, role: "OWNER", suspended: false },
      create: { email, name, passwordHash, role: "OWNER", specialty: "Network administration" },
    });
    console.log(`[startup] Owner authority ready for ${email}`);
  }
} finally { await db.$disconnect(); }
