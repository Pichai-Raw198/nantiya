import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

function getUserId(req: NextRequest): string | null {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  const p = verifyToken(token);
  return p?.userId || null;
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  const type = searchParams.get("type"); // income | expense
  const category = searchParams.get("category");

  const where: Record<string, unknown> = { userId };
  if (type) (where as Record<string,string>).type = type;
  if (category) (where as Record<string,string>).categoryName = category;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    (where as Record<string,unknown>).date = { gte: start, lt: end };
  }

  const transactions = await prisma.transaction.findMany({
    where: where as never,
    orderBy: { date: "desc" },
    include: { category: true },
  });

  // Summary
  const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  // By category (expense only for chart)
  const byCategory = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc: Record<string, number>, t) => {
      acc[t.categoryName] = (acc[t.categoryName] || 0) + t.amount;
      return acc;
    }, {});

  return NextResponse.json({ transactions, summary: { income, expense, balance }, byCategory });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  try {
    const body = await req.json();
    let { amount, type, categoryName, date, note, categoryId } = body;

    // sanitize amount: support "1,000" , "1,000.50"
    if (typeof amount === "string") amount = amount.replace(/,/g, "").trim();
    if (!amount || !type || !categoryName || !date) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบ (amount/type/categoryName/date)" }, { status: 400 });
    }
    if (!["income", "expense"].includes(type)) {
      return NextResponse.json({ error: "type ต้องเป็น income หรือ expense" }, { status: 400 });
    }
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: `จำนวนเงินไม่ถูกต้อง: ${amount}` }, { status: 400 });
    }

    const transaction = await prisma.transaction.create({
      data: {
        amount: amountNum,
        type,
        categoryName,
        categoryId: categoryId || null,
        date: new Date(date),
        note: note || null,
        userId,
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (e) {
    console.error("POST /api/transactions error:", e);
    return NextResponse.json({ error: "สร้างรายการไม่สำเร็จ", detail: String(e) }, { status: 500 });
  }
}
