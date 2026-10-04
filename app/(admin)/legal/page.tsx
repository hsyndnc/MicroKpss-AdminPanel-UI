"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useLegalDocument,
  usePublishLegalDocumentVersion,
  useRefetchLegalDocument,
} from "@/lib/hooks/useLegal";
import { toast } from "sonner";
import type { LegalDocument, LegalDocumentType } from "@/lib/types";
import { LEGAL_DOC_LABELS } from "@/lib/legalLabels";
import { formatTrDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [staleDraft, setStaleDraft] = useState<string | null>(null);
  const [loadedVersion, setLoadedVersion] = useState<number | null>(doc?.version ?? null);
  const refetchLegal = useRefetchLegalDocument();
  const publish = usePublishLegalDocumentVersion();

  // Arka plan tazelemesi (pencere odağı) yeni bir sürüm getirdiyse textarea hâlâ eski
  // sürümü gösteriyor; böyle yayınlamak diğer admin'in değişikliğini sessizce ezer.
  const supersededBy = doc && doc.version !== loadedVersion ? doc : null;

  function handlePublishClick() {
    if (!content.trim()) {
      toast.error("İçerik boş olamaz.");
      return;
    }
    if (!reconsent) return;
    if (reconsent === "material") {
      setConfirmOpen(true);
      return;
    }
    void doPublish();
  }

  async function doPublish() {
    setConfirmOpen(false);
    try {
      const saved = await publish.mutateAsync({
        type,
        content,
        requiresReconsent: reconsent === "material",
      });
      setLoadedVersion(saved.version);
      setReconsent(null);
      setStaleDraft(null);
      toast.success("Yeni sürüm yayınlandı.");
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const backendMessage = (err as { response?: { data?: { error?: string } } })?.response
        ?.data?.error;
      const failed = () =>
        toast.error(backendMessage ?? "Yayınlanamadı. Backend loglarını kontrol edin.");

      // Backend yarış durumunu da doğrulama hatasını da `400` ile bildiriyor. Ayıran
      // şey sunucudaki sürüm: gerçek yarışta editörün açtığı sürümün üstüne bir sürüm
      // yayınlanmıştır. Eşitse (ya da metin hiç yok) yarış değil, gerçek bir hatadır.
      if (status === 400) {
        const mine = content;
        try {
          const fresh = await refetchLegal(type);
          if (fresh && fresh.version !== loadedVersion) {
            setStaleDraft(mine);
            setContent(fresh.content);
            setLoadedVersion(fresh.version);
            toast.error(
              "Bu metin siz yazarken güncellendi, en son sürüm yüklendi — değişikliğinizi tekrar uygulayın."
            );
          } else {
            failed();
          }
        } catch {
          failed();
        }
        return;
      }
      failed();
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
      {supersededBy && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">
            Bu metnin {supersededBy.version}. sürümü siz bu ekranı açtıktan sonra yayınlandı
          </p>
          <p className="text-gray-600">
            Yukarıdaki alanda hâlâ sizin açtığınız sürüm duruyor. Böyle yayınlarsanız o
            değişikliğin üstüne yazarsınız.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStaleDraft(content);
                setContent(supersededBy.content);
                setLoadedVersion(supersededBy.version);
              }}
            >
              Sunucudaki metni yükle
            </Button>
            <Button variant="ghost" onClick={() => setLoadedVersion(supersededBy.version)}>
              Yoksay
            </Button>
          </div>
        </div>
      )}
      {staleDraft !== null && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">Yazdığınız metin korundu</p>
          <p className="text-gray-600">
            Yukarıdaki alanda şimdi sunucudaki en son sürüm duruyor. Kendi metninizi geri
            yükleyip değişikliğinizi tekrar uygulayabilirsiniz.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setContent(staleDraft);
                setStaleDraft(null);
              }}
            >
              Geri yükle
            </Button>
            <Button variant="ghost" onClick={() => setStaleDraft(null)}>
              Yoksay
            </Button>
          </div>
        </div>
      )}
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
        <Button onClick={handlePublishClick} disabled={!reconsent || publish.isPending}>
          {publish.isPending ? "Yayınlanıyor..." : "Yeni sürüm yayınla"}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Esaslı değişiklik olarak yayınlanacak"
        description="Bu sürüm esaslı değişiklik olarak yayınlanacak. Tüm kullanıcılar uygulamayı açtığında metni yeniden onaylamak zorunda kalacak. Devam edilsin mi?"
        onConfirm={() => void doPublish()}
        onCancel={() => setConfirmOpen(false)}
        confirmLabel="Yayınla"
      />
    </div>
  );
}
