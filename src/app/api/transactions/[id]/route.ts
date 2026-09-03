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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDb();
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { id } = await params;
  try {
    // ensure ownership
    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
    const body = await req.json();
    const { amount, type, categoryName, date, note, categoryId } = body;
    const data: Record<string, unknown> = {};
    if (amount !== undefined) {
      const clean = String(amount).replace(/,/g,"").trim();
      data.amount = Number(clean);
    }
    if (type) data.type = type;
    if (categoryName) data.categoryName = categoryName;
    if (categoryId !== undefined) data.categoryId = categoryId || null;
    if (date) data.date = new Date(date);
    if (note !== undefined) data.note = note || null;

    const updated = await prisma.transaction.update({ where: { id }, data: data as never });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "แก้ไขไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDb();
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { id } = await params;
  try {
    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "ลบไม่สำเร็จ" }, { status: 500 });
  }
}
