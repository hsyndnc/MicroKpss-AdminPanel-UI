import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, clearAuthCookies } from "@/lib/auth/cookies";

export async function POST() {
  const access = (await cookies()).get(ACCESS_COOKIE)?.value;

  // Best-effort: backend'de refresh token'ı sil. Başarısızlık yoksayılır.
  if (access) {
    try {
      await fetch(`${process.env.BACKEND_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${access}` },
        cache: "no-store",
      });
    } catch {
      /* yoksay — cookie'ler yine de silinecek */
    }
  }

  const out = NextResponse.json({ ok: true });
  clearAuthCookies(out);
  return out;
}
