import { Badge } from "@/components/ui/badge";

const config: Record<string, { label: string; className: string }> = {
  Google: { label: "Google", className: "bg-red-50 text-red-700 hover:bg-red-50" },
  Apple: { label: "Apple", className: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
  Email: { label: "E-posta", className: "bg-blue-50 text-blue-700 hover:bg-blue-50" },
};

export function AuthProviderBadge({ provider }: { provider?: string | null }) {
  if (!provider) return <span className="text-gray-400 text-sm">—</span>;
  const entry = config[provider];
  if (!entry) return <span className="text-gray-400 text-sm">—</span>;
  return <Badge className={entry.className}>{entry.label}</Badge>;
}
