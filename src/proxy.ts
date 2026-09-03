import { NextResponse, NextRequest } from "next/server";

const protectedPaths = ["/"];
const authPaths = ["/login", "/register"];

export function proxy(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const path = req.nextUrl.pathname;

  const isProtected = protectedPaths.some(p => path === p);
  const isAuth = authPaths.some(p => path.startsWith(p));

  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isAuth && token) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register"],
};
