import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json(
    { error: "The Project VALORIS tracking service has been retired." },
    { status: 410 },
  );
}
