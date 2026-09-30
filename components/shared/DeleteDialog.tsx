"use client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  /** Toplu silmede seçili soru sayısı. Verilmezse tekil metin gösterilir. */
  count?: number;
}

export function DeleteDialog({ open, onConfirm, onCancel, loading, count }: DeleteDialogProps) {
  const bulk = typeof count === "number" && count > 1;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bulk ? `${count} Soruyu Sil` : "Soruyu Sil"}</DialogTitle>
          <DialogDescription>
            {/* Silme backend'de soft delete (BaseRepository.Delete → IsDeleted=true):
                kayıt veritabanında kalır ama listeden ve uygulamadan düşer. Panelde
                geri alma yolu yok — "kalıcı olarak silinir" demek yanlış olurdu. */}
            {bulk
              ? `Seçili ${count} soru listeden ve uygulamadan kaldırılacak. Panelden geri alınamaz.`
              : "Soru listeden ve uygulamadan kaldırılacak. Panelden geri alınamaz."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>İptal</Button>
          <Button
            className="bg-red-600 hover:bg-red-700"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? "Siliniyor..." : "Sil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
