import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleteQuestions = request.nextUrl.searchParams.get("delete_questions") ?? "false";
  const res = await fetch(
    `${process.env.PIPELINE_URL}/sources/${encodeURIComponent(id)}?delete_questions=${deleteQuestions}`,
    { method: "DELETE", headers: { "X-Api-Key": process.env.PIPELINE_API_KEY ?? "" } }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
