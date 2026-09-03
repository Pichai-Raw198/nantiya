import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { ensureDb } from "@/lib/ensureDb";

export async function GET() {
  try {
    await ensureDb();
    let categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    if (categories.length === 0) {
      await prisma.category.createMany({
        data: DEFAULT_CATEGORIES.map((c) => ({
          name: c.name,
          type: c.type as "income" | "expense",
          color: c.color,
          icon: c.icon,
        })),
      });
      categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    }
    return NextResponse.json(categories);
  } catch (e) {
    console.error("GET /api/categories error", e);
    return NextResponse.json({ error: "โหลดหมวดหมู่ไม่สำเร็จ", detail: String(e) }, { status: 500 });
  }
}
