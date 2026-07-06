import { Button } from "@/components/ui/button";

interface BulkActionBarProps {
  count: number;
  onApprove: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function BulkActionBar({ count, onApprove, onCancel, loading }: BulkActionBarProps) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md">
      <span className="text-sm text-blue-700 font-medium">{count} soru seçildi</span>
      <Button size="sm" onClick={onApprove} disabled={loading}>
        {loading ? "Onaylanıyor..." : "Tümünü Onayla"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>İptal</Button>
    </div>
  );
}
