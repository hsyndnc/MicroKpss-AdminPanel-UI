"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { getAdminQuestionById, updateQuestion, approveQuestion, rejectQuestion } from "@/lib/api/questions";
import { questionSchema, type QuestionInput } from "@/lib/validations/questionSchema";
import { useCategories } from "@/lib/hooks/useCategories";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { ContentStatus } from "@/lib/types";

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);

  const { data: question, isLoading } = useQuery({
    queryKey: ["question", id],
    queryFn: () => getAdminQuestionById(id),
  });

  const { data: categories = [] } = useCategories();

  const form = useForm<QuestionInput>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      body: "", categoryId: "", questionType: "MultipleChoice",
      options: ["", ""], correctAnswer: "", difficulty: "Medium",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options" as never,
  });

  useEffect(() => {
    if (question) {
      form.reset({
        body: question.body,
        categoryId: question.categoryId,
        questionType: question.questionType,
        options: question.options,
        correctAnswer: question.correctAnswer,
        difficulty: question.difficulty,
        explanation: question.explanation ?? "",
        imageUrl: question.imageUrl ?? "",
        year: question.year,
      });
    }
  }, [question, form]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["question", id] });
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const updateMutation = useMutation({
    mutationFn: (data: QuestionInput) => updateQuestion(id, data),
    onSuccess: () => { invalidateAll(); toast.success("Kaydedildi"); },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveQuestion(id),
    onSuccess: () => { invalidateAll(); toast.success("Onaylandı"); router.push("/questions"); },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectQuestion(id),
    onSuccess: () => { invalidateAll(); toast.error("Reddedildi"); router.push("/questions"); },
  });

  if (isLoading) return <div className="text-gray-400">Yükleniyor...</div>;
  if (!question) return <div className="text-gray-400">Soru bulunamadı.</div>;

  const watchedOptions = form.watch("options");

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/questions")}>← Geri</Button>
          <h1 className="text-xl font-bold">Soru Detayı</h1>
        </div>
        <StatusBadge status={question.status as ContentStatus} />
      </div>

      {question.status === "PendingReview" && (
        <div className="flex gap-3">
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
            Onayla
          </Button>
          <Button variant="outline" className="text-red-700 border-red-300" onClick={() => setRejectOpen(true)}>
            Reddet
          </Button>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Soru</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="body" render={({ field }) => (
                <FormItem>
                  <FormLabel>Soru Metni</FormLabel>
                  <FormControl><Textarea rows={4} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="categoryId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori</FormLabel>
                  <Select onValueChange={(v) => v && field.onChange(v)} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="difficulty" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zorluk</FormLabel>
                    <Select onValueChange={(v) => v && field.onChange(v)} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Easy">Kolay</SelectItem>
                        <SelectItem value="Medium">Orta</SelectItem>
                        <SelectItem value="Hard">Zor</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="questionType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tür</FormLabel>
                    <Select onValueChange={(v) => v && field.onChange(v)} value={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MultipleChoice">Çok Şıklı</SelectItem>
                        <SelectItem value="TrueFalse">D/Y</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Şıklar</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {fields.map((f, i) => (
                <div key={f.id} className="flex gap-2 items-center">
                  <span className="text-sm font-medium w-6 text-gray-500">{String.fromCharCode(65 + i)}.</span>
                  <Input {...form.register(`options.${i}`)} />
                  {fields.length > 2 && (
                    <Button type="button" variant="ghost" size="sm" className="text-gray-400 hover:text-red-500" onClick={() => remove(i)}>×</Button>
                  )}
                </div>
              ))}
              {fields.length < 6 && (
                <Button type="button" variant="outline" size="sm" onClick={() => append("")}>+ Şık Ekle</Button>
              )}

              <FormField control={form.control} name="correctAnswer" render={({ field }) => (
                <FormItem className="mt-3">
                  <FormLabel>Doğru Cevap</FormLabel>
                  <Select onValueChange={(v) => v && field.onChange(v)} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                    <SelectContent>
                      {watchedOptions.map((opt, i) =>
                        opt ? <SelectItem key={i} value={opt}>{String.fromCharCode(65 + i)}. {opt}</SelectItem> : null
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Ek Bilgiler</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="explanation" render={({ field }) => (
                <FormItem>
                  <FormLabel>Açıklama (opsiyonel)</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="imageUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>Görsel URL (opsiyonel)</FormLabel>
                  <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </form>
      </Form>

      <ConfirmDialog
        open={rejectOpen}
        title="Soruyu Reddet"
        description="Bu soruyu reddetmek istediğine emin misin?"
        onConfirm={() => rejectMutation.mutate()}
        onCancel={() => setRejectOpen(false)}
        confirmLabel="Reddet"
        confirmVariant="destructive"
      />
    </div>
  );
}
