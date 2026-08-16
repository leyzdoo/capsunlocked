import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateRow } from "@/lib/sheets";
import { requireActor } from "@/lib/roleMap";

// PATCH /api/schedule/[date]
// Mirrors updateRow(rowIndex, updates). Requires a recognized actor,
// same as the original (migration doc §4.2) — _requireActor_() throws
// for unrecognized accounts; here that becomes a 401/403.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { date: string } }
) {
  const session = await getServerSession(authOptions);

  try {
    requireActor(session?.user?.email);
  } catch {
    return NextResponse.json({ error: "Not a recognized Compás account" }, { status: 403 });
  }

  const updates = await req.json();
  await updateRow(params.date, updates);

  return NextResponse.json({ ok: true });
}
