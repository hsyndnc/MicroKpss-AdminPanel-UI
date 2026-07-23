import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/auth/cookies";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const res = await fetch(`${process.env.BACKEND_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: res.status });
  }

  const data = await res.json(); // {accessToken, refreshToken, accessTokenExpiry, email, role}
  const out = NextResponse.json({ email: data.email, role: data.role });
  setAuthCookies(out, data.accessToken, data.refreshToken);
  return out;
}
