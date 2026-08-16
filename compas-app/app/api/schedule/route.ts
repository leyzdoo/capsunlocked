import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSheetData } from "@/lib/sheets";
import { resolveActor } from "@/lib/roleMap";

const USE_MOCK = process.env.COMPAS_USE_MOCK_DATA === "true";

// GET /api/schedule
// Mirrors getSheetData() + getMyIdentity(): returns the full day-record
// dataset plus the caller's resolved role, matching the original app's
// "fetch everything once per page load into DATA_MAP" pattern
// (migration doc §2, §7.1).
//
// Dev convenience: in mock mode, skip the identity check entirely so
// the UI is browsable without Google OAuth configured. This ONLY
// applies when COMPAS_USE_MOCK_DATA=true — real Sheets data always
// requires a recognized signed-in account, same as before.
export async function GET() {
  if (USE_MOCK) {
    const days = await getSheetData();
    return NextResponse.json({
      identity: { email: "demo@mock.local", role: "JL" },
      days,
    });
  }

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
