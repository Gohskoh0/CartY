import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/', '/api/auth/login'];
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-secret-32-chars-minimum!!');

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p)) return NextResponse.next();

  const token = request.cookies.get('admin_session')?.value;
  if (!token) return NextResponse.redirect(new URL('/', request.url));

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/config/:path*'],
};
