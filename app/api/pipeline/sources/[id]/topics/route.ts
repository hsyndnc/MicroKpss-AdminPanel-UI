import { NextRequest } from "next/server";
import { pipelineProxy } from "@/lib/api/pipeline-proxy";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return pipelineProxy(`/sources/${encodeURIComponent(id)}/topics`);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.text();
  return pipelineProxy(`/sources/${encodeURIComponent(id)}/topics`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
