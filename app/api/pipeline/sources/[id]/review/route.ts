import { NextRequest } from "next/server";
import { pipelineProxy } from "@/lib/api/pipeline-proxy";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return pipelineProxy(`/sources/${encodeURIComponent(id)}/review`, {
    method: "POST",
  });
}
