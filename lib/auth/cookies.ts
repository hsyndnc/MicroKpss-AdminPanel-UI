import { NextResponse } from "next/server";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

const MAX_AGE = 60 * 60 * 24 * 30; // 30 gün (refresh token ömrü)

const baseOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

export function setAuthCookies(res: NextResponse, access: string, refresh: string) {
  res.cookies.set(ACCESS_COOKIE, access, { ...baseOptions, maxAge: MAX_AGE });
  res.cookies.set(REFRESH_COOKIE, refresh, { ...baseOptions, maxAge: MAX_AGE });
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { ...baseOptions, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...baseOptions, maxAge: 0 });
}
