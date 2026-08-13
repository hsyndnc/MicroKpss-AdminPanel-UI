import { Badge } from "@/components/ui/badge";
import type { ContentStatus } from "@/lib/types";

const config: Record<ContentStatus, { label: string; className: string }> = {
  PendingReview: { label: "Bekliyor",   className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  Active:        { label: "Aktif",      className: "bg-green-100 text-green-800 hover:bg-green-100" },
  Rejected:      { label: "Reddedildi", className: "bg-red-100 text-red-800 hover:bg-red-100" },
  Archived:      { label: "Arşiv",      className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
  FlaggedForReview: { label: "İncelemede", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  const { label, className } = config[status];
  return <Badge className={className}>{label}</Badge>;
}
