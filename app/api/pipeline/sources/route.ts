import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch(`${process.env.PIPELINE_URL}/sources`, {
    headers: { "X-Api-Key": process.env.PIPELINE_API_KEY ?? "" },
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
