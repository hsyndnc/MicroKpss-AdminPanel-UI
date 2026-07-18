"use client";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface RejectDialogProps {
  open: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function RejectDialog({ open, onConfirm, onCancel, loading }: RejectDialogProps) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  function close() {
    setReason("");
    onCancel();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Soruyu Reddet</DialogTitle>
          <DialogDescription>
            Reddetme sebebini yaz. Bu sebep soruyla birlikte kaydedilir.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={3}
          maxLength={500}
          placeholder="Örn: Doğru cevap hatalı, şıklar tutarsız..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={close}>İptal</Button>
          <Button
            className="bg-red-600 hover:bg-red-700"
            disabled={!trimmed || loading}
            onClick={() => { onConfirm(trimmed); setReason(""); }}
          >
            {loading ? "Reddediliyor..." : "Reddet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
