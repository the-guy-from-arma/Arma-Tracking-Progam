import { NextResponse } from "next/server";

const retired = () => NextResponse.json(
  { error: "The Project VALORIS tracking service has been retired." },
  { status: 410 },
);

export const GET = retired;
export const POST = retired;
export const PATCH = retired;
