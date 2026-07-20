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
  // value doluyken alan/ders zincirden türetilir; picked* sadece value boşken devrede.
  const [pickedAlan, setPickedAlan] = useState("");
  const [pickedDers, setPickedDers] = useState("");

  const byId = new Map(categories.map((c) => [c.id, c]));
  const parentOf = (c?: AdminCategory) => (c?.parentCategoryId ? byId.get(c.parentCategoryId) : undefined);

  // Zincir: value konuysa (ders, alan) = (parent, grand); dersse (kendisi, parent); alansa (-, kendisi).
  const selected = byId.get(value);
  const parent = parentOf(selected);
  const grand = parentOf(parent);
  const derivedDers = grand ? parent!.id : parent ? selected!.id : "";
  const derivedAlan = grand ? grand.id : parent ? parent.id : (selected?.id ?? "");

  const effectiveAlan = value ? derivedAlan : pickedAlan;
  const effectiveDers = value ? derivedDers : pickedDers;

  const alanlar = categories.filter((c) => !c.parentCategoryId);
  const dersler = categories.filter((c) => c.parentCategoryId === effectiveAlan);
  const konular = categories.filter((c) => c.parentCategoryId === effectiveDers);
  const konuValue = selected && grand ? value : "";

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <span className="text-sm font-medium">Alan</span>
        <Select
          value={effectiveAlan}
          items={alanlar.map((a) => ({ value: a.id, label: a.name }))}
          onValueChange={(v) => {
            if (!v || v === effectiveAlan) return;
            setPickedAlan(v);
            setPickedDers("");
            onChange("");
          }}
        >
          <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
          <SelectContent>
            {alanlar.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium">Ders</span>
        <Select
          value={effectiveDers}
          items={dersler.map((d) => ({ value: d.id, label: d.name }))}
          disabled={!effectiveAlan}
          onValueChange={(v) => {
            if (!v || v === effectiveDers) return;
            const hasKonu = categories.some((c) => c.parentCategoryId === v);
            setPickedAlan(effectiveAlan);
            setPickedDers(v);
            // Konusu olmayan ders geçerli yapraktır; konusu varsa konu seçimi beklenir.
            onChange(hasKonu ? "" : v);
          }}
        >
          <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
          <SelectContent>
            {dersler.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {konular.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Konu</span>
          <Select value={konuValue} items={konular.map((k) => ({ value: k.id, label: k.name }))} onValueChange={(v) => v && onChange(v)}>
            <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
            <SelectContent>
              {konular.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
