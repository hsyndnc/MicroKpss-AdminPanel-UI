"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { getAdminQuestionById, updateQuestion, approveQuestion, rejectQuestion } from "@/lib/api/questions";
import { questionSchema, type QuestionInput } from "@/lib/validations/questionSchema";
import { useCategories } from "@/lib/hooks/useCategories";
import { useReports } from "@/lib/hooks/useReports";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VerificationBadge } from "@/components/shared/VerificationBadge";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { CategoryCascadeSelect } from "@/components/shared/CategoryCascadeSelect";
import { RejectDialog } from "@/components/shared/RejectDialog";
import { AiFixDialog } from "@/components/shared/AiFixDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { REASON_LABELS } from "@/lib/constants";
import type { ContentStatus, AiFixSuggestion, ReportReason } from "@/lib/types";

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [aiFixOpen, setAiFixOpen] = useState(false);

  const { data: question, isLoading } = useQuery({
    queryKey: ["question", id],
    queryFn: () => getAdminQuestionById(id),
  });

  const { data: categories = [] } = useCategories();

  const isFlagged = question?.status === "FlaggedForReview";
  const { data: reports = [] } = useReports({ enabled: isFlagged });
  const report = reports.find((r) => r.questionId === id);

  const form = useForm<QuestionInput>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      body: "", categoryId: "", questionType: "MultipleChoice",
      options: ["", ""], correctAnswer: "", difficulty: "Medium",
      explanation: "", imageUrl: "", year: undefined,
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
        questionType: question.type ?? question.questionType,
        options: question.options,
        correctAnswer: question.correctAnswer,
        difficulty: question.difficulty,
        explanation: question.explanation ?? "",
        imageUrl: question.imageUrl ?? "",
        year: question.year ?? undefined,
      });
    }
  }, [question, form]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["question", id] });
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const onSubmit = (d: QuestionInput) => {
    const cat = categories.find((c) => c.id === d.categoryId);
    if (!cat?.parentCategoryId) {
      form.setError("categoryId", { message: "Ders seçiniz" });
      return;
    }
    if (categories.some((c) => c.parentCategoryId === cat.id)) {
      form.setError("categoryId", { message: "Konu seçiniz" });
      return;
    }
    updateMutation.mutate(d);
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
    mutationFn: (reason: string) => rejectQuestion(id, reason),
    onSuccess: () => { invalidateAll(); toast.error("Reddedildi"); router.push("/questions"); },
  });

  if (isLoading) return <div className="text-gray-400">Yükleniyor...</div>;
  if (!question) return <div className="text-gray-400">Soru bulunamadı.</div>;

  const watchedOptions = form.watch("options");
  const hasContext =
    !!report ||
    !!question.sourceText ||
    (question.verificationStatus === "supheli" && !!question.verificationNote);

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] flex-col">
      <div className="flex-1 space-y-6 overflow-auto p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/questions")}>← Geri</Button>
          <h1 className="text-xl font-bold">Soru Detayı</h1>
        </div>
        <div className="flex items-center gap-2">
          {question.verificationStatus && (
            <Button size="sm" variant="outline" onClick={() => setAiFixOpen(true)}>
              AI ile Düzelt
            </Button>
          )}
          <StatusBadge status={question.status as ContentStatus} />
          <VerificationBadge status={question.verificationStatus} />
          <SourceBadge source={question.source} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)]">
      <Form {...form}>
        <form id="question-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  <CategoryCascadeSelect categories={categories} value={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="difficulty" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zorluk</FormLabel>
                    <Select items={[{ value: "Easy", label: "Kolay" }, { value: "Medium", label: "Orta" }, { value: "Hard", label: "Zor" }]} onValueChange={(v) => v && field.onChange(v)} value={field.value}>
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
                    <Select items={[{ value: "MultipleChoice", label: "Çok Şıklı" }, { value: "TrueFalse", label: "D/Y" }]} onValueChange={(v) => v && field.onChange(v)} value={field.value}>
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
                <div key={f.id} className="flex gap-2 items-start">
                  <span className="text-sm font-medium w-6 pt-1.5 text-gray-500 shrink-0">{String.fromCharCode(65 + i)}.</span>
                  <Textarea rows={1} className="min-h-8 py-1 resize-none" {...form.register(`options.${i}`)} />
                  {fields.length > 2 && (
                    <Button type="button" variant="ghost" size="sm" className="text-gray-400 hover:text-red-500 shrink-0" onClick={() => remove(i)}>×</Button>
                  )}
                </div>
              ))}
              {fields.length < 6 && (
                <Button type="button" variant="outline" size="sm" onClick={() => append("")}>+ Şık Ekle</Button>
              )}

              <FormField control={form.control} name="correctAnswer" render={({ field }) => (
                <FormItem className="mt-3">
                  <FormLabel>Doğru Cevap</FormLabel>
                  <Select items={watchedOptions.map((opt, i) => opt ? { value: opt, label: `${String.fromCharCode(65 + i)}. ${opt}` } : null).filter((x) => x !== null)} onValueChange={(v) => v && field.onChange(v)} value={field.value}>
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

        </form>
      </Form>

      {hasContext && (
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {report && (
            <Card className="border-orange-300 bg-orange-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-orange-800">
                  <Flag className="h-4 w-4" />
                  Kullanıcı Raporları
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0 text-sm text-orange-900">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-xl font-bold text-white">
                    {report.reportCount}
                  </span>
                  <div>
                    <div className="font-medium">rapor · İncelemede</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(report.reasonBreakdown).map(([reason, count]) => (
                        <Badge key={reason} variant="secondary" className="text-xs">
                          {(REASON_LABELS[reason as ReportReason] ?? reason)} ×{count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                {report.notes.length > 0 && (
                  <div className="space-y-2 border-t border-orange-200 pt-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                      Notlar ({report.notes.length})
                    </div>
                    {report.notes.map((n, i) => (
                      <blockquote
                        key={i}
                        className="rounded-md border-l-2 border-orange-400 bg-white/70 px-3 py-2 text-orange-900"
                      >
                        {n}
                      </blockquote>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {question.verificationStatus === "supheli" && question.verificationNote && (
            <Card className="border-amber-300 bg-amber-50">
              <CardHeader><CardTitle className="text-base text-amber-800">AI doğrulama notu</CardTitle></CardHeader>
              <CardContent className="pt-0 text-sm text-amber-800">{question.verificationNote}</CardContent>
            </Card>
          )}
          {question.sourceText && (
            <Card>
              <CardHeader><CardTitle className="text-base">Kaynak Metin</CardTitle></CardHeader>
              <CardContent>
                <p className="max-h-[calc(100vh-16rem)] overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
                  {question.sourceText}
                </p>
              </CardContent>
            </Card>
          )}
        </aside>
      )}
      </div>
      </div>

      <div className="shrink-0 border-t bg-white px-6 py-4">
        <div className="flex max-w-2xl items-center justify-between">
          <Button type="submit" form="question-form" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
          </Button>
          {question.status === "PendingReview" && (
            <div className="flex gap-2">
              <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                Onayla
              </Button>
              <Button type="button" variant="outline" className="text-red-700 border-red-300" onClick={() => setRejectOpen(true)}>
                Reddet
              </Button>
            </div>
          )}
        </div>
      </div>

      <RejectDialog
        open={rejectOpen}
        onConfirm={(reason) => rejectMutation.mutate(reason)}
        onCancel={() => setRejectOpen(false)}
        loading={rejectMutation.isPending}
      />

      <AiFixDialog
        open={aiFixOpen}
        question={question}
        onClose={() => setAiFixOpen(false)}
        onApply={(s: AiFixSuggestion) => {
          form.reset({
            ...form.getValues(),
            body: s.body,
            options: s.options,
            correctAnswer: s.correctAnswer,
          });
          toast.info("Öneri forma uygulandı — kontrol edip Kaydet'e basın.");
        }}
      />
    </div>
  );
}
