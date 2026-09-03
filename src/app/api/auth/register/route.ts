import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { ensureDb } from "@/lib/ensureDb";

export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const { email, password, name } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "กรอกอีเมลและรหัสผ่าน" }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "รหัสผ่านต้อง >=6 ตัว" }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "อีเมลนี้ถูกใช้แล้ว" }, { status: 400 });

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, password: hashed, name: name || null } });

    const token = signToken({ userId: user.id, email: user.email });
    const res = NextResponse.json({ id: user.id, email: user.email, name: user.name });
    res.cookies.set("token", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60*60*24*7, secure: process.env.NODE_ENV==="production" });
    return res;
  } catch (e) {
    console.error("register error", e);
    return NextResponse.json({ error: "สมัครไม่สำเร็จ", detail: String(e) }, { status: 500 });
  }
}
