"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useLegalDocumentVersion } from "@/lib/hooks/useLegal";
import { LEGAL_DOC_LABELS } from "@/lib/legalLabels";
import type { LegalDocumentType } from "@/lib/types";

export type LegalVersionTarget = { type: LegalDocumentType; version: number };

export function LegalVersionDialog({
  target,
  onClose,
}: {
  target: LegalVersionTarget | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useLegalDocumentVersion(
    target?.type ?? null,
    target?.version ?? null
  );

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {target
              ? `${LEGAL_DOC_LABELS[target.type] ?? target.type} — sürüm ${target.version}`
              : ""}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : isError ? (
          <p className="text-sm text-gray-400">Bu sürümün metni bulunamadı.</p>
        ) : (
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap font-mono text-xs">
            {data?.content}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  );
}
