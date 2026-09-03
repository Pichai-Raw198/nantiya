import { prisma } from "./prisma";

let ensured = false;

export async function ensureDb() {
  if (ensured) return;
  try {
    await prisma.$queryRaw`SELECT 1 FROM "User" LIMIT 1`;
    ensured = true;
    return;
  } catch (e: unknown) {
    const msg = String(e);
    if (!msg.includes("no such table") && !msg.includes("does not exist") && !msg.includes("does_not_exist")) {
      console.error("ensureDb unknown error", e);
      return;
    }
    console.log("DB tables missing, creating...");
    const isPostgres = (process.env.DATABASE_URL || "").startsWith("postgres");
    try {
      if (isPostgres) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "User" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "email" TEXT NOT NULL,
            "name" TEXT,
            "password" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");`);
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "Category" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "name" TEXT NOT NULL,
            "type" TEXT NOT NULL,
            "color" TEXT NOT NULL DEFAULT '#6366f1',
            "icon" TEXT,
            "userId" TEXT,
            CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
          );
        `);
        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_type_userId_key" ON "Category"("name", "type", "userId");`);
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "Transaction" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "amount" DOUBLE PRECISION NOT NULL,
            "type" TEXT NOT NULL,
            "categoryId" TEXT,
            "categoryName" TEXT NOT NULL,
            "date" TIMESTAMP(3) NOT NULL,
            "note" TEXT,
            "userId" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
            CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
          );
        `);
      } else {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "User" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "email" TEXT NOT NULL,
            "name" TEXT,
            "password" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");`);
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "Category" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "name" TEXT NOT NULL,
            "type" TEXT NOT NULL,
            "color" TEXT NOT NULL DEFAULT '#6366f1',
            "icon" TEXT,
            "userId" TEXT,
            CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
          );
        `);
        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_type_userId_key" ON "Category"("name", "type", "userId");`);
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "Transaction" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "amount" REAL NOT NULL,
            "type" TEXT NOT NULL,
            "categoryId" TEXT,
            "categoryName" TEXT NOT NULL,
            "date" DATETIME NOT NULL,
            "note" TEXT,
            "userId" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
            CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
          );
        `);
      }
      console.log("DB tables created for", isPostgres ? "postgres" : "sqlite");
      ensured = true;
    } catch (err) {
      console.error("Failed to create tables", err);
    }
  }
}
