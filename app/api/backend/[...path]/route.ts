import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies } from "@/lib/auth/cookies";

const BACKEND = process.env.BACKEND_URL;

async function handle(req: NextRequest, path: string[]) {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  const refresh = jar.get(REFRESH_COOKIE)?.value;

  // path zaten backend'in tam yolunu taşır (client baseURL: /api/backend/api/v1).
  // Proxy generic pass-through: /api/backend/<X> → ${BACKEND}/<X>.
  const url = `${BACKEND}/${path.join("/")}${req.nextUrl.search}`;
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.text() : undefined;

  const buildHeaders = (token?: string) => {
    const h: Record<string, string> = {};
    const contentType = req.headers.get("content-type");
    if (contentType) h["content-type"] = contentType;
    if (token) h["authorization"] = `Bearer ${token}`;
    return h;
  };

  let res = await fetch(url, { method: req.method, headers: buildHeaders(access), body, cache: "no-store" });

  // Sessiz refresh: access 401 döndü ve elimizde refresh var
  let rotated: { access: string; refresh: string } | null = null;
  if (res.status === 401 && refresh) {
    const rr = await fetch(`${BACKEND}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
      cache: "no-store",
    });
    if (rr.ok) {
      const data = await rr.json(); // {accessToken, refreshToken, ...} — ROTATES
      rotated = { access: data.accessToken, refresh: data.refreshToken };
      res = await fetch(url, { method: req.method, headers: buildHeaders(data.accessToken), body, cache: "no-store" });
    }
  }

  const payload = await res.text();
  const out = new NextResponse(payload, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
  if (rotated) setAuthCookies(out, rotated.access, rotated.refresh);
  return out;
}

type Ctx = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, ctx: Ctx) { return handle(req, (await ctx.params).path); }
export async function POST(req: NextRequest, ctx: Ctx) { return handle(req, (await ctx.params).path); }
export async function PUT(req: NextRequest, ctx: Ctx) { return handle(req, (await ctx.params).path); }
export async function PATCH(req: NextRequest, ctx: Ctx) { return handle(req, (await ctx.params).path); }
export async function DELETE(req: NextRequest, ctx: Ctx) { return handle(req, (await ctx.params).path); }
