import { Button } from "@/components/ui/button";

type BulkAction = "approve" | "delete" | null;

interface BulkActionBarProps {
  count: number;
  onApprove: () => void;
  onDelete: () => void;
  onCancel: () => void;
  /** Hangi toplu işlem sürüyor; null ise boşta. Butonlar birbirini kilitler. */
  running?: BulkAction;
}

export function BulkActionBar({
  count, onApprove, onDelete, onCancel, running = null,
}: BulkActionBarProps) {
  if (count === 0) return null;
  const busy = running !== null;
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md">
      <span className="text-sm text-blue-700 font-medium">{count} soru seçildi</span>
      <Button size="sm" onClick={onApprove} disabled={busy}>
        {running === "approve" ? "Onaylanıyor..." : "Tümünü Onayla"}
      </Button>
      <Button
        size="sm"
        className="bg-red-600 hover:bg-red-700"
        onClick={onDelete}
        disabled={busy}
      >
        {running === "delete" ? "Siliniyor..." : "Tümünü Sil"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>İptal</Button>
    </div>
  );
}
