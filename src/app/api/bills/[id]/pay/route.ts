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

// POST = จ่ายบิล (สร้าง Transaction expense + mark isPaid)
// DELETE = ยกเลิกจ่าย (mark isPaid=false, ไม่ลบ Transaction เดิม)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDb();
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { id } = await params;
  try {
    const bill = await prisma.bill.findFirst({ where: { id, userId } as never }) as unknown as {
      id: string; title: string; amount: number; month: string; dueDay: number; isPaid: boolean; note?: string | null;
    } | null;
    if (!bill) return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });
    if (bill.isPaid) return NextResponse.json({ error: "บิลนี้จ่ายแล้ว" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const categoryName = body.categoryName || "บิล/ผ่อน";
    const categoryId = body.categoryId || null;
    // วันที่จ่าย: วันนี้ แต่ clamp ให้อยู่ในเดือนของบิลถ้าเป็นเดือนปัจจุบัน
    const payDate = body.date ? new Date(body.date) : new Date();

    const [tx, updated] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          amount: bill.amount,
          type: "expense",
          categoryName,
          categoryId,
          date: payDate,
          note: `จ่ายบิล: ${bill.title} (${bill.month})${bill.note ? " - " + bill.note : ""}`,
          userId,
        } as never,
      }),
      prisma.bill.update({ where: { id }, data: { isPaid: true, paidAt: new Date() } as never }),
    ]);
    return NextResponse.json({ bill: updated, transaction: tx });
  } catch (e) {
    console.error("pay bill error", e);
    return NextResponse.json({ error: "จ่ายบิลไม่สำเร็จ", detail: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDb();
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { id } = await params;
  try {
    const bill = await prisma.bill.findFirst({ where: { id, userId } as never });
    if (!bill) return NextResponse.json({ error: "ไม่พบบิล" }, { status: 404 });
    const updated = await prisma.bill.update({ where: { id }, data: { isPaid: false, paidAt: null } as never });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "ยกเลิกจ่ายไม่สำเร็จ" }, { status: 500 });
  }
}
