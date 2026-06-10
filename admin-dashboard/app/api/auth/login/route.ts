import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-secret-32-chars-minimum!!');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'Robust_dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '#Hack.me1223#';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  }
  const token = await new SignJWT({ role: 'admin', username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .setIssuedAt()
    .sign(JWT_SECRET);

  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 12,
    path: '/',
  });
  return response;
}
