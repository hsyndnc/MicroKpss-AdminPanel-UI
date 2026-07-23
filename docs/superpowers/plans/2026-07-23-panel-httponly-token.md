# Admin Panel HttpOnly Token Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** JWT access + refresh token'larını localStorage/JS-cookie'den (XSS ile çalınabilir) HttpOnly cookie'ye taşıyıp, tüm backend çağrılarını token'ı sunucuda ekleyen bir Next.js proxy üzerinden geçirmek (SECURITY_TODO #6).

**Architecture:** Pipeline için kurulu Next.js route-handler proxy deseninin (`app/api/pipeline/...`) backend için tekrarı. Tarayıcı artık token'a hiç dokunmaz: login/logout ve tüm backend istekleri sunucu route'larından geçer, sunucu HttpOnly cookie'den token'ı okuyup `Authorization: Bearer` header'ını ekler. Access token 401 dönerse proxy sunucuda refresh cookie'siyle sessizce yeniler ve isteği tekrarlar. Bearer header AYNEN korunur — değişen tek şey token'ın saklandığı yer ve header'ı kimin koyduğu.

**Tech Stack:** Next.js 16.2.10 (App Router, route handlers), React 19, TypeScript, axios (yalnız client tarafı), zustand (yalnız kullanıcı adı/rol gösterimi için — token DEĞİL).

## Global Constraints

- Next.js 16.2.10: route handler ikinci argümanı `{ params }: { params: Promise<...> }` (await gerekir); `cookies()` (`next/headers`) **async** — `await cookies()`.
- Cookie bayrakları her yerde aynı: `httpOnly: true`, `sameSite: "strict"`, `path: "/"`, `secure: process.env.NODE_ENV === "production"` (dev http'de Secure kapalı olmalı, yoksa lokalde cookie yazılmaz).
- Cookie isimleri: access → `access_token`, refresh → `refresh_token`. maxAge = `60*60*24*30` (30 gün, refresh ömrü). Middleware ve tüm route'lar bu isimleri kullanır.
- Backend taban yolu: `${BACKEND_URL}/api/v1/...`. `BACKEND_URL` **server-only** env (NEXT_PUBLIC değil).
- Backend `POST /api/v1/auth/login` gövde `{email, password}` → 200 `{accessToken, refreshToken, accessTokenExpiry, email, role}` veya hata durum kodu.
- Backend `POST /api/v1/auth/refresh` gövde `{refreshToken}` → 200 aynı şekil veya 401 `{error}`. **Refresh ROTATES**: yeni `refreshToken` döner → proxy her başarılı refresh'te İKİ cookie'yi de yeniden set etmeli.
- Backend `POST /api/v1/auth/logout` `[Authorize]` (Bearer gerekli), gövdesiz → 204.
- Middleware sadece cookie **varlığını** kontrol eder (JWT imza doğrulama YOK — karar 2026-07-23). Gerçek doğrulama backend'de.
- Panelde **test runner yok** → her task'ın doğrulaması `npm run dev` (localhost:3000) + backend (localhost:5213) çalışırken **curl** ile yapılır.
- DRY: cookie isimleri ve set/clear mantığı tek modülde (`lib/auth/cookies.ts`) — login, logout ve proxy hepsi onu kullanır.

**Ön koşul (tüm curl doğrulamaları için):** İki servis ayakta olmalı — backend `dotnet run --project KpssApp.API` (5213) ve panel `npm run dev` (3000). Docker `kpssapp-postgres` çalışıyor olmalı. Test admin: `admin@kpssapp.com` / `Admin1234!`.

---

### Task 1: Login route handler + cookie helper + server env

Deliverable: `POST /api/auth/login` backend'e giriş yapar ve access+refresh token'ları HttpOnly cookie olarak yazar; gövdede token DÖNMEZ.

**Files:**
- Create: `lib/auth/cookies.ts`
- Create: `app/api/auth/login/route.ts`
- Modify: `.env.local` (yeni `BACKEND_URL`)
- Modify: `.env.example` (yeni `BACKEND_URL`)

**Interfaces:**
- Produces: `lib/auth/cookies.ts` → `ACCESS_COOKIE = "access_token"`, `REFRESH_COOKIE = "refresh_token"`, `setAuthCookies(res: NextResponse, access: string, refresh: string): void`, `clearAuthCookies(res: NextResponse): void`.
- Produces: `POST /api/auth/login` gövde `{email, password}` → 200 `{email, role}` + iki HttpOnly Set-Cookie; hata → backend durum kodu.

- [ ] **Step 1: `BACKEND_URL` env değişkenini ekle**

`.env.local` ve `.env.example` dosyalarının her ikisine ekle (değer .env.local'de gerçek, .example'da örnek):

```
# .env.local
BACKEND_URL=http://localhost:5213
```
```
# .env.example
BACKEND_URL=http://localhost:5213
```

- [ ] **Step 2: Cookie yardımcı modülünü yaz**

`lib/auth/cookies.ts` oluştur:

```ts
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
```

- [ ] **Step 3: Login route handler'ı yaz**

`app/api/auth/login/route.ts` oluştur:

```ts
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
```

- [ ] **Step 4: Geçerli giriş — curl ile doğrula (200 + iki HttpOnly cookie)**

Run:
```bash
curl -i -s -X POST http://localhost:3000/api/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"admin@kpssapp.com","password":"Admin1234!"}' | grep -iE "HTTP/|set-cookie"
```
Expected: `HTTP/1.1 200 OK` + iki `set-cookie:` satırı — `access_token=...; ... HttpOnly; SameSite=Strict` ve `refresh_token=...; ... HttpOnly; SameSite=Strict`. Gövdede token OLMAMALI (yalnız `{email, role}`).

- [ ] **Step 5: Yanlış şifre — curl ile doğrula (cookie yazılmamalı)**

Run:
```bash
curl -i -s -X POST http://localhost:3000/api/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"admin@kpssapp.com","password":"yanlis"}' | grep -iE "HTTP/|set-cookie"
```
Expected: `HTTP/1.1 400` (backend login hatası 400 döner) ve **hiç** `set-cookie` satırı yok.

- [ ] **Step 6: Commit**

```bash
git add lib/auth/cookies.ts app/api/auth/login/route.ts .env.example
git commit -m "feat: login route handler — access/refresh token'ı HttpOnly cookie'ye yazar"
```
(Not: `.env.local` git-ignore'da, commit'e girmez.)

---

### Task 2: Kimlik doğrulamalı catch-all backend proxy (sessiz refresh)

Deliverable: `/api/backend/[...path]` altındaki tüm istekler HttpOnly access cookie'sinden Bearer header ekleyerek backend'e iletilir; backend 401 dönerse refresh cookie'siyle sessizce yenilenip istek tekrarlanır ve iki cookie yeniden yazılır.

**Files:**
- Create: `app/api/backend/[...path]/route.ts`

**Interfaces:**
- Consumes: `lib/auth/cookies.ts` → `ACCESS_COOKIE`, `REFRESH_COOKIE`, `setAuthCookies` (Task 1).
- Produces: `GET|POST|PUT|PATCH|DELETE /api/backend/<path>` → backend `${BACKEND_URL}/api/v1/<path>` cevabını (status + gövde) aynen döner; gerektiğinde Set-Cookie ile yenilenmiş token'lar.

- [ ] **Step 1: Catch-all proxy route'unu yaz**

`app/api/backend/[...path]/route.ts` oluştur:

```ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies } from "@/lib/auth/cookies";

const BACKEND = process.env.BACKEND_URL;

async function handle(req: NextRequest, path: string[]) {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  const refresh = jar.get(REFRESH_COOKIE)?.value;

  const url = `${BACKEND}/api/v1/${path.join("/")}${req.nextUrl.search}`;
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
```

- [ ] **Step 2: Cookie ile korumalı endpoint — curl ile doğrula (200)**

Önce login olup cookie'leri jar dosyasına al, sonra proxy üzerinden korumalı bir admin endpoint çağır:
```bash
curl -s -c /tmp/kpss-cj.txt -X POST http://localhost:3000/api/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"admin@kpssapp.com","password":"Admin1234!"}' > /dev/null
curl -i -s -b /tmp/kpss-cj.txt "http://localhost:3000/api/backend/api/v1/admin/questions?page=1&pageSize=1" | grep -iE "HTTP/"
```
Expected: `HTTP/1.1 200 OK` (proxy access cookie'sini Bearer'a çevirip backend'den veriyi getirdi).

- [ ] **Step 3: Cookie'siz istek — curl ile doğrula (401)**

Run:
```bash
curl -i -s "http://localhost:3000/api/backend/api/v1/admin/questions?page=1&pageSize=1" | grep -iE "HTTP/"
```
Expected: `HTTP/1.1 401` (access cookie yok, refresh yok → backend Bearer'sız 401, refresh denenmez).

- [ ] **Step 4: Sessiz refresh yolu — curl ile doğrula**

Refresh yolunu tetiklemek için jar dosyasındaki `access_token` değerini bozup `refresh_token`'ı geçerli bırak, sonra proxy'yi çağır:
```bash
# access_token'ı geçersiz bir değere çevir, refresh_token dokunma
sed -i '' -E 's/(access_token[[:space:]]+)[^[:space:]]+$/\1BOZUK/' /tmp/kpss-cj.txt 2>/dev/null || \
  sed -i -E 's/(access_token[[:space:]]+)[^[:space:]]+$/\1BOZUK/' /tmp/kpss-cj.txt
curl -i -s -b /tmp/kpss-cj.txt -c /tmp/kpss-cj.txt \
  "http://localhost:3000/api/backend/api/v1/admin/questions?page=1&pageSize=1" | grep -iE "HTTP/|set-cookie"
```
Expected: `HTTP/1.1 200 OK` + iki yeni `set-cookie` (access_token ve refresh_token yenilendi). Proxy bozuk access ile 401 aldı → refresh ile yeniledi → isteği tekrarlayıp 200 döndürdü.

- [ ] **Step 5: Commit**

```bash
git add app/api/backend
git commit -m "feat: catch-all backend proxy — HttpOnly cookie'den Bearer + sessiz refresh"
```

---

### Task 3: Logout route handler

Deliverable: `POST /api/auth/logout` her iki HttpOnly cookie'yi siler ve (elde access varsa) backend logout'unu best-effort çağırır.

**Files:**
- Create: `app/api/auth/logout/route.ts`

**Interfaces:**
- Consumes: `lib/auth/cookies.ts` → `ACCESS_COOKIE`, `clearAuthCookies` (Task 1).
- Produces: `POST /api/auth/logout` → 200 `{ok: true}` + iki `Set-Cookie` (maxAge=0).

- [ ] **Step 1: Logout route handler'ı yaz**

`app/api/auth/logout/route.ts` oluştur:

```ts
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
```

- [ ] **Step 2: Logout — curl ile doğrula (cookie'ler silinir)**

Run:
```bash
curl -i -s -b /tmp/kpss-cj.txt -X POST http://localhost:3000/api/auth/logout | grep -iE "HTTP/|set-cookie"
```
Expected: `HTTP/1.1 200 OK` + iki `set-cookie` satırı `access_token=;` ve `refresh_token=;` (`Max-Age=0` veya geçmiş Expires ile).

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/logout
git commit -m "feat: logout route handler — HttpOnly cookie'leri siler + best-effort backend logout"
```

---

### Task 4: İstemci geçişi (client + login/logout UI + store + middleware)

Deliverable: UI artık uçtan uca cookie tabanlı; token localStorage'da/JS-cookie'de hiç tutulmaz. Bu task bir "switchover" — bölünürse uygulama yarı çalışır kalır, o yüzden tek task.

**Files:**
- Modify: `lib/api/client.ts` (baseURL + request interceptor kaldır)
- Modify: `lib/api/auth.ts` (`login` route'a; `logout` ekle)
- Modify: `app/(auth)/login/page.tsx` (localStorage/cookie kaldır)
- Modify: `lib/store/authStore.ts` (token alanını kaldır)
- Modify: `components/layout/Sidebar.tsx` (logout route + clearAuth)
- Modify: `middleware.ts` (cookie adı `access_token`)

**Interfaces:**
- Consumes: `POST /api/auth/login` (Task 1), `/api/backend/[...path]` (Task 2), `POST /api/auth/logout` (Task 3).
- Produces: `lib/api/auth.ts` → `login(email, password): Promise<{email: string; role: string}>`, `logout(): Promise<void>`.
- Produces: `lib/store/authStore.ts` → `useAuthStore` state `{ user: AuthUser | null; setAuth(user: AuthUser): void; clearAuth(): void }` (token alanı YOK).

- [ ] **Step 1: `lib/api/client.ts` — baseURL değiştir, request interceptor'ı kaldır**

Dosyanın TAMAMINI şununla değiştir:

```ts
import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api/backend/api/v1",
});

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    // Proxy sessiz refresh'i de denedi; buraya gelen 401 = oturum gerçekten bitti.
    if (error.response?.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
```

- [ ] **Step 2: `lib/api/auth.ts` — login'i yeni route'a al, logout ekle**

Dosyanın TAMAMINI şununla değiştir:

```ts
export interface LoginResult {
  email: string;
  role: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("login_failed");
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
```

- [ ] **Step 3: `lib/store/authStore.ts` — token alanını kaldır (yalnız user)**

Dosyanın TAMAMINI şununla değiştir:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/lib/types";

interface AuthState {
  user: AuthUser | null;
  setAuth: (user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setAuth: (user) => set({ user }),
      clearAuth: () => set({ user: null }),
    }),
    { name: "kpss-admin-auth" }
  )
);
```

- [ ] **Step 4: `app/(auth)/login/page.tsx` — localStorage/cookie satırlarını kaldır**

`setAuthCookie` fonksiyonunu (satır 15-17) TAMAMEN sil. `onSubmit` içindeki try bloğunu şununla değiştir:

```ts
    try {
      const data = await login(values.email, values.password);
      setAuth({ email: data.email, role: data.role as UserRole });
      router.push("/dashboard");
    } catch {
      toast.error("E-posta veya şifre hatalı.");
    }
```

(Silinen satırlar: `localStorage.setItem("token", data.accessToken);` ve `setAuthCookie(data.accessToken);` ve eski `setAuth(token, user)` çağrısı. `login`, `setAuth`, `UserRole`, `useAuthStore` importları zaten mevcut; `setAuth` artık tek argüman alıyor.)

- [ ] **Step 5: `components/layout/Sidebar.tsx` — logout'u route'a bağla**

Üst importlara ekle:
```ts
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";
```

Bileşen içinde `clearAuth` satırının yanına router ekle ve `handleLogout`'u değiştir (mevcut `localStorage.removeItem("token")` ve `document.cookie = "token=; ..."` satırlarını SİL):

```ts
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  async function handleLogout() {
    await logout();
    clearAuth();
    router.push("/login");
  }
```

- [ ] **Step 6: `middleware.ts` — cookie adını `access_token` yap**

Tek satırı değiştir:
```ts
  const token = request.cookies.get("access_token")?.value;
```
(Gerisi aynı: yoksa `/login`'e redirect; `/login` ve `/` serbest.)

- [ ] **Step 7: Kullanılmayan env'i temizle**

`.env.local` ve `.env.example` dosyalarından `NEXT_PUBLIC_API_BASE_URL` satırını sil (artık kimse okumuyor — client.ts relative `/api/backend` kullanıyor).

- [ ] **Step 8: Uçtan uca tarayıcı doğrulaması**

`npm run dev` çalışırken tarayıcıda:
1. `/login` → `admin@kpssapp.com` / `Admin1234!` ile gir → `/dashboard`'a yönleniyor.
2. DevTools → Application → Cookies: `access_token` ve `refresh_token` var, ikisinde de **HttpOnly ✓** ve **SameSite=Strict**.
3. DevTools → Console: `localStorage.getItem("token")` → **`null`** (XSS artık token okuyamıyor — bu maddenin kanıtı). `document.cookie` çıktısında `access_token`/`refresh_token` **görünmüyor** (HttpOnly).
4. Korumalı sayfalarda gez (Sorular, Kullanıcılar) → veriler yükleniyor (proxy üzerinden).
5. "Çıkış Yap" → `/login`'e dönüyor; Application → Cookies'te iki token da **silinmiş**.
6. Çıkıştan sonra doğrudan `/dashboard`'a gitmeyi dene → middleware `/login`'e atıyor.

- [ ] **Step 9: Commit**

```bash
git add lib/api/client.ts lib/api/auth.ts lib/store/authStore.ts "app/(auth)/login/page.tsx" components/layout/Sidebar.tsx middleware.ts .env.example
git commit -m "feat: panel token'ı HttpOnly cookie'ye taşındı — client proxy'ye geçti, localStorage token kaldırıldı (SECURITY_TODO #6)"
```

---

## Notlar / Kapsam dışı

- **Bu plan yalnız `kpss-admin-panel` reposunu değiştirir.** Backend'de değişiklik YOK — backend zaten `/auth/refresh` (rotate) ve `/auth/logout`'u sağlıyor.
- Eski ham `localStorage["token"]` anahtarı yeni kodda hiç okunmaz; tarayıcıda kalıntı değeri zararsızdır (isteyen kullanıcı bir kez elle temizleyebilir).
- Middleware bilinçli olarak yalnız cookie varlığına bakar; JWT imza doğrulaması Faz 2'ye bırakıldı (backend her istekte gerçek doğrulamayı yapıyor).
- Deploy'da: `BACKEND_URL` prod backend adresine ayarlanır; `NODE_ENV=production` olduğunda cookie'ler otomatik `Secure` olur (HTTPS şart).
