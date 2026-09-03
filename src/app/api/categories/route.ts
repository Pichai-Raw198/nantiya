import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORIES } from "@/lib/categories";

export async function GET() {
  let categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  // seed if empty
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
}
