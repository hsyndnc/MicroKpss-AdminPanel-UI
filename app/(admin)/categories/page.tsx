"use client";
import { useState } from "react";
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from "@/lib/hooks/useCategories";
import { categorySchema, type CategoryInput } from "@/lib/validations/categorySchema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { AdminCategory } from "@/lib/types";
import { Pencil, Trash2 } from "lucide-react";

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);

  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", parentCategoryId: "" },
  });

  function openCreate() {
    setEditTarget(null);
    form.reset({ name: "", parentCategoryId: "" });
    setModalOpen(true);
  }

  function openEdit(cat: AdminCategory) {
    setEditTarget(cat);
    form.reset({ name: cat.name, parentCategoryId: cat.parentCategoryId ?? "" });
    setModalOpen(true);
  }

  async function onSubmit(values: CategoryInput) {
    const payload = { name: values.name, parentCategoryId: values.parentCategoryId || undefined };
    if (editTarget) {
      await updateMutation.mutateAsync({ id: editTarget.id, ...payload });
      toast.success("Güncellendi");
    } else {
      await createMutation.mutateAsync(payload);
      toast.success("Oluşturuldu");
    }
    setModalOpen(false);
  }

  async function handleDelete(cat: AdminCategory) {
    if (cat.activeQuestionCount > 0) {
      toast.error(`${cat.activeQuestionCount} aktif soru var. Önce soruları taşıyın.`);
      setDeleteTarget(null);
      return;
    }
    await deleteMutation.mutateAsync(cat.id);
    toast.error("Silindi");
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kategoriler</h1>
        <Button onClick={openCreate}>+ Yeni Kategori</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-white">
                <TableHead className="sticky left-0 z-10 bg-inherit">İsim</TableHead>
                <TableHead className="hidden md:table-cell">Üst Kategori</TableHead>
                <TableHead className="hidden sm:table-cell">Aktif Soru</TableHead>
                <TableHead className="text-right">Aksiyonlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id} className="bg-white hover:bg-gray-50">
                  <TableCell className="sticky left-0 z-10 bg-inherit font-medium">{cat.name}</TableCell>
                  <TableCell className="hidden text-gray-600 md:table-cell">{cat.parentCategoryName ?? "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{cat.activeQuestionCount}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" className="h-11 w-11 p-0 md:h-8 md:w-auto md:px-3" onClick={() => openEdit(cat)}>
                      <Pencil className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Düzenle</span>
                    </Button>
                    <Button size="sm" variant="outline" className="h-11 w-11 p-0 text-red-700 border-red-300 md:h-8 md:w-auto md:px-3" onClick={() => setDeleteTarget(cat)}>
                      <Trash2 className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Sil</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-400">Kategori bulunamadı</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(v) => !v && setModalOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "Kategori Düzenle" : "Yeni Kategori"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>İsim</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="parentCategoryId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Üst Kategori (opsiyonel)</FormLabel>
                  <Select items={[{ value: "", label: "Yok" }, ...categories.filter((c) => c.id !== editTarget?.id).map((c) => ({ value: c.id, label: c.name }))]} onValueChange={(v) => field.onChange(v ?? "")} value={field.value ?? ""}>
                    <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Yok</SelectItem>
                      {categories.filter((c) => c.id !== editTarget?.id).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>İptal</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editTarget ? "Güncelle" : "Oluştur"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Kategori Sil"
        description={`"${deleteTarget?.name}" kategorisini silmek istediğine emin misin?`}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Sil"
        confirmVariant="destructive"
      />
    </div>
  );
}
