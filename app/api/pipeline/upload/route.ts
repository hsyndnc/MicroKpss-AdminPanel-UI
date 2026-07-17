import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const form = await request.formData();

  const res = await fetch(`${process.env.PIPELINE_URL}/upload`, {
    method: "POST",
    headers: { "X-Api-Key": process.env.PIPELINE_API_KEY ?? "" },
    body: form,
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
