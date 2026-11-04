import type { AdminCategory, CategoryPublishState } from "@/lib/types";

const RANK: Record<CategoryPublishState, number> = { Hidden: 0, ComingSoon: 1, Active: 2 };

/** Kendi durumu + (varsa) ebeveyninin etkin durumunun en kısıtlayıcısı. */
export function effectiveState(
  cat: AdminCategory,
  all: AdminCategory[]
): CategoryPublishState {
  if (!cat.parentCategoryId) return cat.publishState;
  const parent = all.find((c) => c.id === cat.parentCategoryId);
  if (!parent) return cat.publishState;
  const parentEffective = effectiveState(parent, all);
  return RANK[parentEffective] < RANK[cat.publishState] ? parentEffective : cat.publishState;
}
