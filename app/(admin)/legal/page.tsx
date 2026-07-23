"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLegalDocument, useUpsertLegalDocument } from "@/lib/hooks/useLegal";
import { toast } from "sonner";
import type { LegalDocument, LegalDocumentType } from "@/lib/types";

const DOC_TYPES: { type: LegalDocumentType; label: string }[] = [
  { type: "PrivacyPolicy", label: "Gizlilik Politikası" },
  { type: "TermsOfService", label: "Kullanım Koşulları" },
  { type: "KvkkNotice", label: "KVKK Aydınlatma Metni" },
];

export default function LegalPage() {
  const [activeType, setActiveType] = useState<LegalDocumentType>("PrivacyPolicy");
  const { data, isLoading, isError } = useLegalDocument(activeType);

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

      {isLoading ? (
        <p className="text-sm text-gray-400">Yükleniyor...</p>
      ) : isError ? (
        <p className="text-sm text-red-600">Metin yüklenemedi.</p>
      ) : (
        <LegalEditor key={activeType} type={activeType} doc={data ?? null} />
      )}
    </div>
  );
}

function LegalEditor({ type, doc }: { type: LegalDocumentType; doc: LegalDocument | null }) {
  const [content, setContent] = useState(doc?.content ?? "");
  const [updatedAt, setUpdatedAt] = useState<string | null>(doc?.updatedAt ?? null);
  const upsert = useUpsertLegalDocument();

  async function handleSave() {
    if (!content.trim()) {
      toast.error("İçerik boş olamaz.");
      return;
    }
    try {
      const saved = await upsert.mutateAsync({ type, content });
      setUpdatedAt(saved.updatedAt);
      toast.success("Kaydedildi.");
    } catch {
      toast.error("Kaydedilemedi. Backend loglarını kontrol edin.");
    }
  }

  return (
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
        <Button onClick={handleSave} disabled={upsert.isPending}>
          {upsert.isPending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>
    </div>
  );
}
