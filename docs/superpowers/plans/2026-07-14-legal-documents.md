# Admin Panel — Yasal Metinler Düzenleme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/legal` sayfası — 3 yasal metin türü (Gizlilik Politikası, Kullanım Koşulları, KVKK Aydınlatma) için markdown textarea ile düzenleme, kaydetme, son güncelleme tarihi.

**Architecture:** Mevcut desenler: `apiClient` (lib/api/client.ts) + tip dosyası + sayfa. Exam-dates sayfası referans. İçerik markdown; textarea yeterli (önizleme YAGNI).

**Tech Stack:** Next.js 15 App Router, TypeScript, mevcut shadcn/ui bileşenleri

## Global Constraints

- TypeScript hatasız: `npx tsc --noEmit`
- Yeni paket eklenmeyecek
- Commit öncesi kullanıcıdan onay al; Co-Authored-By eklenmeyecek

## API Kontratı (backend planıyla birebir aynı)

```
GET /api/v1/legal/{type}          → anonim (apiClient token eklese de sorun olmaz)
  type: PrivacyPolicy | TermsOfService | KvkkNotice
  200: { "type": "...", "content": "<markdown>", "updatedAt": "..." } | 404: kayıt yok

PUT /api/v1/admin/legal           → Admin JWT
  body: { "type": "PrivacyPolicy", "content": "<markdown>" }
  200: aynı DTO | 400: { "error": "..." }
```

---

## Task 1: Tipler + API Client

**Files:**
- Modify: `lib/types.ts` (sonuna ekle)
- Create: `lib/api/legal.ts`

- [ ] **Step 1: `lib/types.ts` sonuna ekle**

```typescript
export type LegalDocumentType = "PrivacyPolicy" | "TermsOfService" | "KvkkNotice";

export interface LegalDocument {
  type: LegalDocumentType;
  content: string;
  updatedAt: string;
}
```

- [ ] **Step 2: `lib/api/legal.ts` oluştur** (categories.ts deseni)

```typescript
import { apiClient } from "./client";
import type { LegalDocument, LegalDocumentType } from "@/lib/types";

export async function getLegalDocument(type: LegalDocumentType): Promise<LegalDocument | null> {
  try {
    const { data } = await apiClient.get<LegalDocument>(`/legal/${type}`);
    return data;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "response" in error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 404) return null;
    }
    throw error;
  }
}

export async function upsertLegalDocument(type: LegalDocumentType, content: string): Promise<LegalDocument> {
  const { data } = await apiClient.put<LegalDocument>("/admin/legal", { type, content });
  return data;
}
```

- [ ] **Step 3: Derleme kontrolü**

```bash
npx tsc --noEmit
```

---

## Task 2: `/legal` Sayfası

**Files:**
- Create: `app/(admin)/legal/page.tsx`

- [ ] **Step 1: Sayfayı oluştur**

```tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getLegalDocument, upsertLegalDocument } from "@/lib/api/legal";
import type { LegalDocumentType } from "@/lib/types";

const DOC_TYPES: { type: LegalDocumentType; label: string }[] = [
  { type: "PrivacyPolicy", label: "Gizlilik Politikası" },
  { type: "TermsOfService", label: "Kullanım Koşulları" },
  { type: "KvkkNotice", label: "KVKK Aydınlatma Metni" },
];

export default function LegalPage() {
  const [activeType, setActiveType] = useState<LegalDocumentType>("PrivacyPolicy");
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async (type: LegalDocumentType) => {
    setLoading(true);
    setMessage(null);
    try {
      const doc = await getLegalDocument(type);
      setContent(doc?.content ?? "");
      setUpdatedAt(doc?.updatedAt ?? null);
    } catch {
      setMessage({ kind: "err", text: "Metin yüklenemedi." });
      setContent("");
      setUpdatedAt(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(activeType);
  }, [activeType, load]);

  async function handleSave() {
    if (!content.trim()) {
      setMessage({ kind: "err", text: "İçerik boş olamaz." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const doc = await upsertLegalDocument(activeType, content);
      setUpdatedAt(doc.updatedAt);
      setMessage({ kind: "ok", text: "Kaydedildi." });
    } catch {
      setMessage({ kind: "err", text: "Kaydedilemedi. Backend loglarını kontrol edin." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Yasal Metinler</h1>
        <p className="text-sm text-gray-500 mt-1">
          Markdown formatında yazın — mobil uygulamada render edilir.
        </p>
      </div>

      <div className="flex gap-2">
        {DOC_TYPES.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeType === type
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Yükleniyor...</p>
      ) : (
        <div className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={24}
            className="w-full border rounded-lg p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="# Başlık&#10;&#10;Markdown içeriği buraya..."
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {updatedAt
                ? `Son güncelleme: ${new Date(updatedAt).toLocaleString("tr-TR")}`
                : "Henüz kaydedilmemiş."}
            </span>
            <div className="flex items-center gap-3">
              {message && (
                <span className={`text-sm ${message.kind === "ok" ? "text-green-600" : "text-red-600"}`}>
                  {message.text}
                </span>
              )}
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Derleme kontrolü**

```bash
npx tsc --noEmit
```

---

## Task 3: Sidebar Linki

**Files:**
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: navItems'a ekle** — `{ href: "/content", ... }` satırının altına:

```typescript
  { href: "/legal", label: "Yasal Metinler", icon: Scale },
```

`lucide-react` import satırına `Scale` ekle.

- [ ] **Step 2: Derleme + görsel kontrol**

```bash
npx tsc --noEmit && npm run dev
```

---

## Task 4: Manuel Test

**Önkoşul:** Backend ayakta (LegalDocument endpoint'leri deploy edilmiş), admin girişi yapılmış.

- [ ] **Step 1:** `/legal` aç → "Gizlilik Politikası" sekmesi seed içeriğiyle dolu gelmeli (backend seed'i).
- [ ] **Step 2:** Metni değiştir → Kaydet → "Kaydedildi." + güncelleme tarihi yenilenmeli.
- [ ] **Step 3:** "Kullanım Koşulları" sekmesi → boş gelmeli ("Henüz kaydedilmemiş.") → metin yaz, kaydet → tekrar yükle, metin gelmeli.
- [ ] **Step 4:** İçeriği tamamen sil → Kaydet → "İçerik boş olamaz." görünmeli (istek atılmadan).
