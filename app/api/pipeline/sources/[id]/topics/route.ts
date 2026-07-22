import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await fetch(
    `${process.env.PIPELINE_URL}/sources/${encodeURIComponent(id)}/topics`,
    { headers: { "X-Api-Key": process.env.PIPELINE_API_KEY ?? "" }, cache: "no-store" }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.text();
  const res = await fetch(
    `${process.env.PIPELINE_URL}/sources/${encodeURIComponent(id)}/topics`,
    {
      method: "PUT",
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
