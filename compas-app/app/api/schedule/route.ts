import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSheetData } from "@/lib/sheets";
import { resolveActor } from "@/lib/roleMap";

// GET /api/schedule
// Mirrors getSheetData() + getMyIdentity(): returns the full day-record
// dataset plus the caller's resolved role, matching the original app's
// "fetch everything once per page load into DATA_MAP" pattern
// (migration doc §2, §7.1).
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = resolveActor(session?.user?.email);

  if (!role) {
    return NextResponse.json({ error: "Not signed in as a recognized account" }, { status: 401 });
  }

  const days = await getSheetData();

  return NextResponse.json({
    identity: { email: session!.user!.email, role },
    days,
  });
}
