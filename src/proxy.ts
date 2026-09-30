// 認証が要る領域への入口で Cookie セッションを検証する（Next.js 16 の proxy。旧 middleware）
// ここは粗い門番で、各 Route Handler / Server Action / ページでも必ず再検証する
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, sessionSecret, verifyToken, type TokenKind } from "@/lib/auth/token";

/** Cookie のトークンを検証し、有効なら主体を返す */
function sessionOf(request: NextRequest, kind: TokenKind): string | null {
  const raw = request.cookies.get(COOKIE_NAME[kind])?.value;
  if (!raw) return null;
  return verifyToken(sessionSecret(), raw, kind, Math.floor(Date.now() / 1000))?.subject ?? null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // カジノ: /casino/enter と入場 API 以外は入場セッション必須
  if (pathname.startsWith("/casino") || pathname.startsWith("/api/casino")) {
    const isEntry = pathname === "/casino/enter" || pathname === "/api/casino/enter";
    if (!isEntry && !sessionOf(request, "casino")) {
      if (pathname.startsWith("/api/")) {
        return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/casino/enter", request.url));
    }
  }

  // 実行委員: ログインと招待リンクからのパスワード設定以外はセッション必須
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const isPublicAuthPage = pathname === "/admin/login" || pathname === "/admin/setup";
    if (!isPublicAuthPage && !sessionOf(request, "admin")) {
      if (pathname.startsWith("/api/")) {
        return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/casino/:path*", "/api/casino/:path*", "/admin/:path*", "/api/admin/:path*"],
};
