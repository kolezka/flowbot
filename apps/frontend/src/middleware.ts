import { NextRequest, NextResponse } from 'next/server';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:3000';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Proxy /api/* requests to the backend API
  if (pathname.startsWith('/api/')) {
    const target = `${API_INTERNAL_URL}${pathname}${search}`;
    return NextResponse.rewrite(new URL(target));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
