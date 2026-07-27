import { pipelineProxy } from "@/lib/api/pipeline-proxy";

export async function GET() {
  return pipelineProxy("/sources");
}
