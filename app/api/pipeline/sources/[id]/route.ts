import { NextRequest } from "next/server";
import { pipelineProxy } from "@/lib/api/pipeline-proxy";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleteQuestions = request.nextUrl.searchParams.get("delete_questions") ?? "false";
  return pipelineProxy(
    `/sources/${encodeURIComponent(id)}?delete_questions=${deleteQuestions}`,
    { method: "DELETE" }
  );
}
