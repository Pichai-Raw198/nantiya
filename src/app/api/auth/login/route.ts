import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "กรอกอีเมลและรหัสผ่าน" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    const ok = await verifyPassword(password, user.password);
    if (!ok) return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });

    const token = signToken({ userId: user.id, email: user.email });
    const res = NextResponse.json({ id: user.id, email: user.email, name: user.name });
    res.cookies.set("token", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60*60*24*7, secure: process.env.NODE_ENV==="production" });
    return res;
  } catch (e) {
    console.error("login error", e);
    return NextResponse.json({ error: "เข้าสู่ระบบไม่สำเร็จ" }, { status: 500 });
  }
}
