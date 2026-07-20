"use client";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminCategory } from "@/lib/types";

interface CategoryCascadeSelectProps {
  categories: AdminCategory[];
  value: string;
  onChange: (id: string) => void;
}

export function CategoryCascadeSelect({ categories, value, onChange }: CategoryCascadeSelectProps) {
  // value doluyken ders her zaman değerden türetilir; pickedDers sadece konu boşken devrede.
  const [pickedDers, setPickedDers] = useState("");

  const dersler = categories.filter((c) => !c.parentCategoryId);
  const selected = categories.find((c) => c.id === value);
  const effectiveDers = value ? (selected?.parentCategoryId ?? selected?.id ?? "") : pickedDers;
  const konular = categories.filter((c) => c.parentCategoryId === effectiveDers);
  // Eski veri: value bir ders id'siyse konu dropdown'ı boş (placeholder) görünmeli.
  const konuValue = selected?.parentCategoryId ? value : "";

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <span className="text-sm font-medium">Ders</span>
        <Select
          value={effectiveDers}
          onValueChange={(v) => {
            if (!v || v === effectiveDers) return;
            setPickedDers(v);
            onChange("");
          }}
        >
          <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
          <SelectContent>
            {dersler.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium">Konu</span>
        <Select
          value={konuValue}
          onValueChange={(v) => v && onChange(v)}
          disabled={!effectiveDers}
        >
          <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
          <SelectContent>
            {konular.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
