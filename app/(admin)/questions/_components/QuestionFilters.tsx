"use client";
import type { AdminCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const STATUS_OPTIONS = [
  { value: "PendingReview", label: "Bekliyor" },
  { value: "Active", label: "Aktif" },
  { value: "Rejected", label: "Reddedildi" },
  { value: "all", label: "Tümü" },
];

export const SOURCE_OPTIONS = [
  { value: "all", label: "Tümü" },
  { value: "Service", label: "Servis" },
  { value: "Import", label: "İmport" },
];

type QuestionFiltersProps = {
  layout: "row" | "stack";
  status: string;
  source: string;
  categoryId: string;
  aiPassed: boolean;
  categories: AdminCategory[];
  hasActiveFilters: boolean;
  onStatusChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onAiPassedChange: (checked: boolean) => void;
  onClear: () => void;
};

export function QuestionFilters({
  layout, status, source, categoryId, aiPassed, categories, hasActiveFilters,
  onStatusChange, onSourceChange, onCategoryChange, onAiPassedChange, onClear,
}: QuestionFiltersProps) {
  const subjectOptions = [
    { value: "all", label: "Tüm Dersler" },
    ...categories.filter((c) => c.parentCategoryId).map((c) => ({ value: c.id, label: c.name })),
  ];
  const triggerWidth = layout === "row" ? "w-40" : "w-full";

  return (
    <div className={cn("flex gap-3", layout === "row" ? "flex-wrap items-center" : "flex-col items-stretch")}>
      <Select value={status} items={STATUS_OPTIONS} onValueChange={(v) => v && onStatusChange(v)}>
        <SelectTrigger className={triggerWidth}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={source} items={SOURCE_OPTIONS} onValueChange={(v) => v && onSourceChange(v)}>
        <SelectTrigger className={triggerWidth}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOURCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={categoryId} items={subjectOptions} onValueChange={(v) => v && onCategoryChange(v)}>
        <SelectTrigger className={triggerWidth}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {subjectOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <label className="flex items-center gap-2 p-2 text-sm text-gray-600 cursor-pointer select-none">
        <Checkbox checked={aiPassed} onCheckedChange={(c) => onAiPassedChange(!!c)} />
        Yalnızca AI&apos;dan geçenler
      </label>

      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className={layout === "row" ? "ml-auto" : "w-full"}
        >
          Filtreleri Temizle
        </Button>
      )}
    </div>
  );
}
