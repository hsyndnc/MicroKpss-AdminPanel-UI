"use client";
import { useState } from "react";
import { useExamDate, useUpsertExamDate } from "@/lib/hooks/useExamDates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { differenceInDays, format } from "date-fns";
import { tr } from "date-fns/locale";
import type { KpssType } from "@/lib/types";

const LABELS: Record<KpssType, string> = {
  Lisans: "Lisans",
  Onlisans: "Önlisans",
  Ortaogretim: "Ortaöğretim",
};

export function ExamDateCard({ kpssType }: { kpssType: KpssType }) {
  const { data, isLoading } = useExamDate(kpssType);
  const upsertMutation = useUpsertExamDate();
  const [editing, setEditing] = useState(false);
  const [dateValue, setDateValue] = useState("");

  const examDate = data?.date ? new Date(data.date) : null;
  const daysLeft = examDate ? differenceInDays(examDate, new Date()) : null;

  async function handleSave() {
    if (!dateValue) return;
    await upsertMutation.mutateAsync({ kpssType, date: new Date(dateValue).toISOString() });
    toast.success("Kaydedildi");
    setEditing(false);
  }

  function startEdit() {
    setDateValue(examDate ? format(examDate, "yyyy-MM-dd") : "");
    setEditing(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>📅 {LABELS[kpssType]}</span>
          {examDate && !editing && (
            <Button variant="ghost" size="sm" onClick={startEdit} className="text-gray-400 hover:text-gray-600">✏️</Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-20 bg-gray-100 animate-pulse rounded" />
        ) : editing ? (
          <div className="space-y-3">
            <Input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={upsertMutation.isPending || !dateValue}>
                {upsertMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>İptal</Button>
            </div>
          </div>
        ) : examDate ? (
          <div className="text-center py-2 space-y-2">
            <p className="text-5xl font-bold text-blue-600">{Math.max(0, daysLeft ?? 0)}</p>
            <p className="text-sm text-gray-500">gün kaldı</p>
            <p className="text-sm text-gray-600">{format(examDate, "d MMMM yyyy", { locale: tr })}</p>
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, 100 - ((daysLeft ?? 0) / 365) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-gray-400">Henüz belirlenmedi</p>
            <Button size="sm" variant="outline" onClick={startEdit}>Tarih Belirle</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
