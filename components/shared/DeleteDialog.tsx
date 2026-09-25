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
}

export function DeleteDialog({ open, onConfirm, onCancel, loading }: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Soruyu Sil</DialogTitle>
          <DialogDescription>
            Bu işlem geri alınamaz. Soru kalıcı olarak silinecektir.
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
