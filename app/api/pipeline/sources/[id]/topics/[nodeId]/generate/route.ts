import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const { id, nodeId } = await params;
  const body = await request.text();
  const res = await fetch(
    `${process.env.PIPELINE_URL}/sources/${encodeURIComponent(id)}/topics/${encodeURIComponent(nodeId)}/generate`,
    {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.PIPELINE_API_KEY ?? "",
        "Content-Type": "application/json",
      },
      body,
    }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
