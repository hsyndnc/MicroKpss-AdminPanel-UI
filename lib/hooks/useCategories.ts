import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminCategories, createCategory, updateCategory, deleteCategory, setCategoryPublishState } from "@/lib/api/categories";
import type { AdminCategory, CategoryPublishState } from "@/lib/types";

export function useCategories() {
  return useQuery({ queryKey: ["admin-categories"], queryFn: getAdminCategories });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name: string; parentCategoryId?: string }) =>
      updateCategory(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
}

export function useSetCategoryPublishState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, state }: { id: string; state: CategoryPublishState }) =>
      setCategoryPublishState(id, state),
    onSuccess: (updated) => {
      // Sunucu cevabını cache'e hemen yaz — yalnız invalidate'e güvenirsek
      // Select'in görünen değeri POST + refetch tamamlanana dek (iki round-trip)
      // eski kalır, admin "tıklamam işlemedi" sanıp tekrar tıklayabilir.
      qc.setQueryData<AdminCategory[]>(["admin-categories"], (old) =>
        old?.map((c) => (c.id === updated.id ? updated : c)) ?? old
      );
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
    },
  });
}
