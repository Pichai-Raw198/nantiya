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

export async function GET(req: NextRequest) {
  await ensureDb();
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  if (!month) return NextResponse.json({ error: "ต้องระบุ month (YYYY-MM)" }, { status: 400 });

  const bills = await prisma.bill.findMany({
    where: { userId, month } as never,
    orderBy: [{ dueDay: "asc" }, { createdAt: "asc" }],
  });

  const total = bills.reduce((s: number, b: { amount: number }) => s + b.amount, 0);
  const paid = bills.filter((b: { isPaid: boolean }) => b.isPaid);
  const unpaid = bills.filter((b: { isPaid: boolean }) => !b.isPaid);
  const paidAmount = paid.reduce((s: number, b: { amount: number }) => s + b.amount, 0);
  const unpaidAmount = unpaid.reduce((s: number, b: { amount: number }) => s + b.amount, 0);

  return NextResponse.json({
    bills,
    summary: { total, paidCount: paid.length, unpaidCount: unpaid.length, paidAmount, unpaidAmount },
  });
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  try {
    const body = await req.json();
    let { title, amount, month, dueDay, note } = body;
    if (typeof amount === "string") amount = amount.replace(/,/g, "").trim();
    if (!title || !amount || !month || !dueDay) {
      return NextResponse.json({ error: "กรอกชื่อ ยอดเงิน เดือน และวันที่ครบกำหนด" }, { status: 400 });
    }
    const amountNum = Number(amount);
    const dueNum = Number(dueDay);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "จำนวนเงินไม่ถูกต้อง" }, { status: 400 });
    }
    if (isNaN(dueNum) || dueNum < 1 || dueNum > 31) {
      return NextResponse.json({ error: "วันที่ครบกำหนดต้อง 1-31" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "รูปแบบเดือนต้อง YYYY-MM" }, { status: 400 });
    }

    const bill = await prisma.bill.create({
      data: { title: String(title).trim(), amount: amountNum, month, dueDay: dueNum, note: note || null, userId } as never,
    });
    return NextResponse.json(bill, { status: 201 });
  } catch (e) {
    console.error("POST /api/bills error:", e);
    return NextResponse.json({ error: "สร้างบิลไม่สำเร็จ", detail: String(e) }, { status: 500 });
  }
}
