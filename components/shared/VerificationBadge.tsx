import { Badge } from "@/components/ui/badge";

const config: Record<string, { label: string; className: string }> = {
  gecti:              { label: "AI: Geçti",             className: "bg-green-100 text-green-800 hover:bg-green-100" },
  supheli:            { label: "AI: Şüpheli",           className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  kontrol_edilemedi:  { label: "AI: Kontrol edilemedi", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
};

export function VerificationBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const entry = config[status];
  if (!entry) return null;
  return <Badge className={entry.className}>{entry.label}</Badge>;
}
