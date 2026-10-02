import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { ensureDb } from "@/lib/ensureDb";

const RENAME_MAP: Record<string, string> = {
  "อาหาร": "ครอบครัว",
  "เดินทาง": "ทำงาน",
  "ช้อปปิ้ง": "ส่วนตัว",
  "บันเทิง": "ของใช้",
  "การศึกษา": "ลูก",
  "อื่นๆ (รายจ่าย)": "มาริ",
  "อื่นๆ": "มาริ",
};

export async function GET() {
  try {
    await ensureDb();
    // auto-migrate ชื่อหมวดหมู่เก่า -> ใหม่ (ทั้ง Category และ Transaction)
    for (const [oldName, newName] of Object.entries(RENAME_MAP)) {
      const olds = await prisma.category.findMany({ where: { name: oldName } as never });
      for (const c of olds as unknown as Array<{ id: string; type: string; userId: string | null }>) {
        const dup = await prisma.category.findFirst({
          where: { name: newName, type: c.type, userId: c.userId } as never,
        });
        if (dup) {
          // มีชื่อใหม่แล้ว: ย้าย transaction ไปใช้ตัวใหม่แล้วลบตัวเก่า
          await prisma.transaction.updateMany({ where: { categoryId: c.id } as never, data: { categoryName: newName } as never });
          await prisma.transaction.updateMany({ where: { categoryName: oldName } as never, data: { categoryName: newName } as never });
          await prisma.category.delete({ where: { id: c.id } }).catch(() => {});
        } else {
          await prisma.category.update({ where: { id: c.id }, data: { name: newName } as never });
          await prisma.transaction.updateMany({ where: { categoryName: oldName } as never, data: { categoryName: newName } as never });
        }
      }
      // เผื่อมี transaction อ้างชื่อเก่าโดยไม่มี category row
      await prisma.transaction.updateMany({ where: { categoryName: oldName } as never, data: { categoryName: newName } as never });
    }
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
