import { NextRequest } from "next/server";
import { pipelineProxy } from "@/lib/api/pipeline-proxy";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  return pipelineProxy("/upload", { method: "POST", body: form });
}
