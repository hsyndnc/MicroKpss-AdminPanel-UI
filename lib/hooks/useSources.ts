import { useQuery } from "@tanstack/react-query";
import { listSources } from "@/lib/api/pipeline";

export function useSources() {
  return useQuery({ queryKey: ["pipeline-sources"], queryFn: listSources });
}
