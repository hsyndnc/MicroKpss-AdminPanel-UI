"use client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserDetail } from "@/lib/hooks/useUsers";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import type { AdminUser } from "@/lib/types";

const roleLabel: Record<string, string> = { Standard: "Standart", Premium: "Premium", Admin: "Admin" };
const kpssLabel: Record<string, string> = { Lisans: "Lisans", Onlisans: "Önlisans", Ortaogretim: "Ortaöğretim" };

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function UserDetailSheet({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const { data: detail, isLoading, isError } = useUserDetail(user?.id ?? null);

  const accuracy =
    detail && detail.solvedCount > 0
      ? `%${Math.round((detail.correctCount / detail.solvedCount) * 100)}`
      : "—";

  return (
    <Sheet open={!!user} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[400px] sm:max-w-[400px]">
        {user && (
          <>
            <SheetHeader>
              <SheetTitle className="break-all">{user.email}</SheetTitle>
              <div className="flex gap-2">
                <Badge variant="secondary">{roleLabel[user.role] ?? user.role}</Badge>
                {user.kpssType && <Badge variant="outline">{kpssLabel[user.kpssType] ?? user.kpssType}</Badge>}
              </div>
            </SheetHeader>

            <div className="mt-4 divide-y px-1">
              <InfoRow
                label="Kayıt tarihi"
                value={format(new Date(user.createdAt), "d MMM yyyy", { locale: tr })}
              />
              {isLoading ? (
                <div className="space-y-2 py-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-5" />)}
                </div>
              ) : isError ? (
                <p className="py-3 text-sm text-gray-400">İstatistikler yüklenemedi.</p>
              ) : detail ? (
                <>
                  <InfoRow
                    label="Son giriş"
                    value={detail.lastLoginAt
                      ? format(new Date(detail.lastLoginAt), "d MMM yyyy HH:mm", { locale: tr })
                      : "—"}
                  />
                  <InfoRow label="Çözülen soru" value={detail.solvedCount} />
                  <InfoRow label="Doğruluk oranı" value={accuracy} />
                </>
              ) : null}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
