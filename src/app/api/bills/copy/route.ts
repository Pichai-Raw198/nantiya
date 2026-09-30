import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { ensureDb } from "@/lib/ensureDb";

function getUserId(req: NextRequest): string | null {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const p = verifyToken(token);
  return p?.userId || null;
}

// POST { fromMonth, toMonth } — คัดลอกบิลจากเดือนก่อนมาเดือนใหม่ (isPaid=false)
export async function POST(req: NextRequest) {
  await ensureDb();
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  try {
    const { fromMonth, toMonth } = await req.json();
    if (!fromMonth || !toMonth) return NextResponse.json({ error: "ต้องระบุ fromMonth และ toMonth" }, { status: 400 });
    const source = await prisma.bill.findMany({ where: { userId, month: fromMonth } as never }) as unknown as Array<{
      title: string; amount: number; dueDay: number; note?: string | null;
    }>;
    if (source.length === 0) return NextResponse.json({ error: "ไม่พบบิลเดือนก่อน" }, { status: 404 });
    const existing = await prisma.bill.findMany({ where: { userId, month: toMonth } as never }) as unknown as Array<{ title: string }>;
    const existingTitles = new Set(existing.map((b) => b.title));
    const toCreate = source.filter((b) => !existingTitles.has(b.title));
    if (toCreate.length === 0) return NextResponse.json({ error: "เดือนนี้มีบิลครบแล้ว" }, { status: 400 });
    await prisma.bill.createMany({
      data: toCreate.map((b) => ({ title: b.title, amount: b.amount, month: toMonth, dueDay: b.dueDay, note: b.note || null, isPaid: false, userId })) as never,
    });
    const bills = await prisma.bill.findMany({ where: { userId, month: toMonth } as never, orderBy: [{ dueDay: "asc" }] });
    return NextResponse.json({ copied: toCreate.length, bills }, { status: 201 });
  } catch (e) {
    console.error("copy bills error", e);
    return NextResponse.json({ error: "คัดลอกบิลไม่สำเร็จ", detail: String(e) }, { status: 500 });
  }
}
