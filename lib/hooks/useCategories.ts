import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminCategories, createCategory, updateCategory, deleteCategory } from "@/lib/api/categories";

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
