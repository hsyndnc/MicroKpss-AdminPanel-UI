# Admin Users — AuthProvider Filtering UI

**Date:** 2026-09-26  
**Status:** Spec  
**Backend Spec:** KpssSoru-backend/docs/admin-users-authprovider-filtering.md

---

## Overview

Admin users page (`/users`) currently filters by `role` and `kpssType`. This spec adds **authentication provider** filtering UI to show:
- **Google** — OAuth login via Google
- **Apple** — OAuth login via Apple
- **Normal Mail** — Email/password login

Include stats showing provider distribution.

---

## Changes Required

### 1. Update AdminUser Type

**File:** `lib/types.ts`

```typescript
export interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  kpssType?: KpssType;
  createdAt: string;
  authProvider?: string;  // NEW: "Google" | "Apple" | "Email"
}
```

### 2. Update API Function

**File:** `lib/api/users.ts`

```typescript
export interface GetUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  kpssType?: string;
  authProvider?: string;  // NEW
}

export async function getAdminUsers(params: GetUsersParams = {}): Promise<PagedResult<AdminUser>> {
  const { page = 1, pageSize = 20, search, role, kpssType, authProvider } = params;
  const { data } = await apiClient.get<PagedResult<AdminUser>>("/admin/users", {
    params: {
      page,
      pageSize,
      ...(search ? { search } : {}),
      ...(role ? { role } : {}),
      ...(kpssType ? { kpssType } : {}),
      ...(authProvider ? { authProvider } : {}),  // NEW
    },
  });
  return data;
}
```

### 3. Update Users Page

**File:** `app/(admin)/users/page.tsx`

#### 3a. Add PROVIDER_OPTIONS constant (after KPSS_OPTIONS)

```typescript
const PROVIDER_OPTIONS = [
  { value: "all", label: "Tüm Sağlayıcılar" },
  { value: "Google", label: "Google" },
  { value: "Apple", label: "Apple" },
  { value: "Email", label: "Normal Mail" },
];
```

#### 3b. Add authProvider to query state (in UsersContent function)

```typescript
const authProvider = searchParams.get("authProvider") ?? "all";
```

#### 3c. Pass to useUsers hook

```typescript
const { data, isLoading } = useUsers({
  page,
  search: search || undefined,
  role: role === "all" ? undefined : role,
  kpssType: kpssType === "all" ? undefined : kpssType,
  authProvider: authProvider === "all" ? undefined : authProvider,  // NEW
});
```

#### 3d. Add Select component for provider (after kpssType Select)

```typescript
<Select value={authProvider} items={PROVIDER_OPTIONS} onValueChange={(v) => v && setQueryParam("authProvider", v)}>
  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
  <SelectContent>
    {PROVIDER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
  </SelectContent>
</Select>
```

#### 3e. Add provider column to table (optional)

In `<TableHeader>` add:
```typescript
<TableHead>Giriş Yöntemi</TableHead>
```

In `<TableBody>` row, add:
```typescript
<TableCell className="text-sm text-gray-600">
  {u.authProvider === "Email" ? "Email" : u.authProvider || "—"}
</TableCell>
```

### 4. Display Stats (Optional Enhancement)

After total count line, add provider breakdown:

```typescript
<p className="text-sm text-gray-500">
  Toplam: {data?.totalCount ?? "—"} | 
  Google: {stats?.google ?? 0} | 
  Apple: {stats?.apple ?? 0} | 
  Email: {stats?.email ?? 0}
</p>
```

Or simpler approach: request backend for stats endpoint later.

---

## UI Layout

```
Kullanıcılar
Toplam: 800

[Search box] [Role filter] [KPSS Type filter] [Provider filter] ← NEW

[Table with users and provider column] ← NEW column optional
```

---

## Testing Checklist

- [ ] Filter by each provider shows correct results
- [ ] URL params update: `/users?authProvider=Google`
- [ ] Refresh page keeps filter active
- [ ] Combined filters work: `?role=Standard&authProvider=Apple`
- [ ] Pagination works with filtered results
- [ ] Table displays provider for each user
- [ ] "all" value clears filter
