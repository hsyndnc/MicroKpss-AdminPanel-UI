import { Badge } from "@/components/ui/badge";

const config: Record<string, { label: string; className: string }> = {
  Service: { label: "Servis", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  Import:  { label: "İmport", className: "bg-purple-100 text-purple-800 hover:bg-purple-100" },
};

export function SourceBadge({ source }: { source?: string | null }) {
  if (!source) return <span className="text-gray-400 text-sm">—</span>;
  const entry = config[source];
  if (!entry) return <span className="text-gray-400 text-sm">—</span>;
  return <Badge className={entry.className}>{entry.label}</Badge>;
}
