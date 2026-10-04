"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLegalDocument, usePublishLegalDocumentVersion } from "@/lib/hooks/useLegal";
import { toast } from "sonner";
import type { LegalDocument, LegalDocumentType } from "@/lib/types";
import { LEGAL_DOC_LABELS } from "@/lib/legalLabels";
import { formatTrDate } from "@/lib/format";

const DOC_TYPES: { type: LegalDocumentType; label: string }[] = (
  ["PrivacyPolicy", "TermsOfService", "KvkkNotice", "ExplicitConsent"] as const
).map((type) => ({ type, label: LEGAL_DOC_LABELS[type] }));

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
  const [reconsent, setReconsent] = useState<"minor" | "material" | null>(null);
  const publish = usePublishLegalDocumentVersion();

  async function handlePublish() {
    if (!content.trim()) {
      toast.error("İçerik boş olamaz.");
      return;
    }
    if (!reconsent) return;
    try {
      await publish.mutateAsync({
        type,
        content,
        requiresReconsent: reconsent === "material",
      });
      setReconsent(null);
      toast.success("Yeni sürüm yayınlandı.");
    } catch {
      toast.error("Yayınlanamadı. Backend loglarını kontrol edin.");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {doc
          ? `Sürüm ${doc.version} · ${formatTrDate(doc.updatedAt, "d MMMM yyyy")}'da güncellendi`
          : "Henüz yayınlanmadı — yayınlamak sürüm 1'i oluşturur."}
      </p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={24}
        className="w-full border rounded-lg p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="# Başlık&#10;&#10;Markdown içeriği buraya..."
      />
      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Değişikliğin niteliği</legend>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="radio"
            name={`reconsent-${type}`}
            className="mt-1"
            checked={reconsent === "minor"}
            onChange={() => setReconsent("minor")}
          />
          <span>
            <span className="font-medium">Esaslı değişiklik değil</span>
            <span className="block text-gray-500">
              Yazım/biçim düzeltmesi, kapsam aynı. Kullanıcılardan yeniden onay istenmez.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="radio"
            name={`reconsent-${type}`}
            className="mt-1"
            checked={reconsent === "material"}
            onChange={() => setReconsent("material")}
          />
          <span>
            <span className="font-medium">Esaslı değişiklik</span>
            <span className="block text-gray-500">
              Kapsam genişliyor: yeni alıcı, yeni amaç, yeni ülke. Tüm kullanıcılara
              yeniden onay sorulur.
            </span>
          </span>
        </label>
      </fieldset>
      <div className="flex items-center justify-end">
        <Button onClick={handlePublish} disabled={!reconsent || publish.isPending}>
          {publish.isPending ? "Yayınlanıyor..." : "Yeni sürüm yayınla"}
        </Button>
      </div>
    </div>
  );
}
