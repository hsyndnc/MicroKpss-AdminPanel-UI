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
