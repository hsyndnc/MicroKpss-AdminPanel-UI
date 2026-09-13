import { NextRequest } from "next/server";
import { pipelineProxy } from "@/lib/api/pipeline-proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.text();
  return pipelineProxy(
    `/sources/${encodeURIComponent(id)}/generate`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body }
  );
}
