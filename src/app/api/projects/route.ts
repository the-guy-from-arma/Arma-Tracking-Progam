import { NextResponse } from "next/server";

const retired = () => NextResponse.json(
  { error: "The Project VALORIS tracking service has been retired. Enfusion University is now the primary platform." },
  { status: 410 },
);

export const GET = retired;
export const POST = retired;
