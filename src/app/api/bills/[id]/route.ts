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
    const existing = await prisma.bill.findFirst({ where: { id, userId } as never });
    if (!existing) return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.amount !== undefined) {
      const clean = String(body.amount).replace(/,/g, "").trim();
      const n = Number(clean);
      if (isNaN(n) || n <= 0) return NextResponse.json({ error: "จำนวนเงินไม่ถูกต้อง" }, { status: 400 });
      data.amount = n;
    }
    if (body.dueDay !== undefined) {
      const d = Number(body.dueDay);
      if (isNaN(d) || d < 1 || d > 31) return NextResponse.json({ error: "วันที่ครบกำหนดต้อง 1-31" }, { status: 400 });
      data.dueDay = d;
    }
    if (body.note !== undefined) data.note = body.note || null;
    if (body.isPaid !== undefined) {
      data.isPaid = Boolean(body.isPaid);
      data.paidAt = body.isPaid ? new Date() : null;
    }
    const updated = await prisma.bill.update({ where: { id }, data: data as never });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "แก้ไขบิลไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDb();
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { id } = await params;
  try {
    const existing = await prisma.bill.findFirst({ where: { id, userId } as never });
    if (!existing) return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });
    await prisma.bill.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "ลบบิลไม่สำเร็จ" }, { status: 500 });
  }
}
