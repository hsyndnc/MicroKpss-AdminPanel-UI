"use client";
import { useState } from "react";
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, useSetCategoryPublishState } from "@/lib/hooks/useCategories";
import { categorySchema, type CategoryInput } from "@/lib/validations/categorySchema";
import { effectiveState } from "@/lib/categoryTree";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { AdminCategory, CategoryPublishState } from "@/lib/types";
import { Pencil, Trash2 } from "lucide-react";

const STATE_LABEL: Record<CategoryPublishState, string> = { Active: "Aktif", ComingSoon: "Yakında", Hidden: "Gizli" };

function needsConfirm(current: CategoryPublishState, next: CategoryPublishState): boolean {
  return current === "Active" && next !== "Active";
}

function downgradeDescription(cat: AdminCategory, next: CategoryPublishState): string {
  const noun = cat.parentCategoryId ? "ders" : "kategori";
  const verb = next === "Hidden" ? "tamamen kaybolur" : "tıklanamaz hale gelir";
  return `Bu ${noun} şu an canlıda kullanıcılara görünüyor. ${STATE_LABEL[next]} yaparsan hemen ${verb}. Devam edilsin mi?`;
}

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const setStateMutation = useSetCategoryPublishState();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);
  const [pendingChange, setPendingChange] = useState<{ cat: AdminCategory; nextState: CategoryPublishState } | null>(null);

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

  function handleStateChange(cat: AdminCategory, nextState: CategoryPublishState) {
    if (nextState === cat.publishState) return;
    if (needsConfirm(cat.publishState, nextState)) {
      setPendingChange({ cat, nextState });
      return;
    }
    applyStateChange(cat.id, nextState);
  }

  async function applyStateChange(id: string, nextState: CategoryPublishState) {
    try {
      await setStateMutation.mutateAsync({ id, state: nextState });
      toast.success("Durum güncellendi");
    } catch {
      toast.error("Durum güncellenemedi");
    }
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
              <TableRow className="bg-white hover:bg-white">
                <TableHead className="sticky left-0 z-10 bg-inherit">İsim</TableHead>
                <TableHead className="hidden md:table-cell">Üst Kategori</TableHead>
                <TableHead className="hidden sm:table-cell">Aktif Soru</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Aksiyonlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id} className="bg-white hover:bg-gray-50">
                  <TableCell className="sticky left-0 z-10 bg-inherit font-medium">{cat.name}</TableCell>
                  <TableCell className="hidden text-gray-600 md:table-cell">{cat.parentCategoryName ?? "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{cat.activeQuestionCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select
                        items={(Object.keys(STATE_LABEL) as CategoryPublishState[]).map((s) => ({ value: s, label: STATE_LABEL[s] }))}
                        value={cat.publishState ?? ""}
                        disabled={cat.publishState == null}
                        onValueChange={(v) => v && handleStateChange(cat, v as CategoryPublishState)}
                      >
                        <SelectTrigger size="sm">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATE_LABEL) as CategoryPublishState[]).map((s) => (
                            <SelectItem key={s} value={s}>{STATE_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {cat.publishState != null && effectiveState(cat, categories) !== cat.publishState && (
                        <Badge
                          className="bg-amber-100 text-amber-800 hover:bg-amber-100"
                          title={`Üst kategori ${effectiveState(cat, categories) === "Hidden" ? "gizli" : "yakında"} olduğu için bu ders mobilde ${effectiveState(cat, categories) === "Hidden" ? "görünmüyor" : "tıklanamıyor"}.`}
                        >
                          {effectiveState(cat, categories) === "Hidden" ? "Ebeveyn gizli" : "Ebeveyn yakında"}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" className="h-11 w-11 p-0 md:h-7 md:w-auto md:px-2.5" onClick={() => openEdit(cat)}>
                      <Pencil className="h-4 w-4" /><span className="sr-only md:not-sr-only md:ml-1">Düzenle</span>
                    </Button>
                    <Button size="sm" variant="outline" className="h-11 w-11 p-0 text-red-700 border-red-300 md:h-7 md:w-auto md:px-2.5" onClick={() => setDeleteTarget(cat)}>
                      <Trash2 className="h-4 w-4" /><span className="sr-only md:not-sr-only md:ml-1">Sil</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-400">Kategori bulunamadı</TableCell>
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

      <ConfirmDialog
        open={!!pendingChange}
        title="Durumu Değiştir"
        description={pendingChange ? downgradeDescription(pendingChange.cat, pendingChange.nextState) : ""}
        onConfirm={() => {
          if (pendingChange) applyStateChange(pendingChange.cat.id, pendingChange.nextState);
          setPendingChange(null);
        }}
        onCancel={() => setPendingChange(null)}
        confirmLabel="Devam Et"
      />
    </div>
  );
}
