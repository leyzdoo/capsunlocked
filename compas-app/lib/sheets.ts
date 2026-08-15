import { google } from "googleapis";
import { ActivitySlot, DayRecord, ParentActivitySlot } from "./types";
import { MOCK_DAYS } from "./mockData";

// Replaces SpreadsheetApp (migration doc §7.1). The original app got
// synchronous, in-process sheet access because Code.gs ran bound to the
// spreadsheet; here we authenticate as a service account that must be
// shared onto the target sheet with Editor access.

const USE_MOCK = process.env.COMPAS_USE_MOCK_DATA === "true";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
    );
  }
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

// ─────────────────────────────────────────────────────────────────────
//  COLUMN MAPPING — read directly from the live "Compas_2026_Full_Year"
//  sheet's header row on 2026-08-15 (59 columns, A through BG). This is
//  ground truth, not the migration doc's §3.1 description or the XLSX
//  export — see the discrepancy notes in lib/types.ts. If columns get
//  added later (e.g. PA1 auto-provisioned, or AleNotes added), update
//  both this array and lib/types.ts's DayRecord shape to match.
// ─────────────────────────────────────────────────────────────────────
const HEADER_ORDER = [
  "Date", "Day", "Holiday/DayOff", "School", "SchStart", "SchDO", "SchStop", "SchPU",
  "BCC", "BCCStop", "BCCPU",
  "Activity1", "A1Start", "A1DO", "A1Stop", "A1PU",
  "Activity2", "A2Start", "A2DO", "A2Stop", "A2PU",
  "Break", "Lunch", "Dinner",
  "AM With", "Day With", "PM With", "ON With",
  "ChaseDay", "Notes", "Flag", "Weekend Summary", "Weekday",
  "Activity3", "A3Start", "A3DO", "A3Stop", "A3PU",
  "Activity4", "A4Start", "A4DO", "A4Stop", "A4PU",
  "Activity5", "A5DO", "A5PU",
  "Link",
  "PA2Parent", "PA2Name", "PA2Start", "PA2End", "PA2Coverage", "PA2Notes",
  "PA3Parent", "PA3Name", "PA3Start", "PA3End", "PA3Coverage", "PA3Notes",
] as const;

/**
 * Converts one raw sheet row (array of formatted-value cells, in
 * left-to-right column order) into a DayRecord. Assumes the row's
 * columns match HEADER_ORDER exactly — call verifyHeaderOrder() against
 * a live read before trusting this in production, since a manually
 * edited sheet could reorder or insert columns.
 */
function rowToDayRecord(row: string[]): DayRecord {
  const get = (name: (typeof HEADER_ORDER)[number]) => {
    const idx = HEADER_ORDER.indexOf(name);
    return row[idx] ?? "";
  };

  const activity = (n: 1 | 2 | 3 | 4): ActivitySlot => ({
    name: get(`Activity${n}` as any),
    start: get(`A${n}Start` as any),
    dropOff: get(`A${n}DO` as any),
    stop: get(`A${n}Stop` as any),
    pickUp: get(`A${n}PU` as any),
  });

  const activity5: ActivitySlot = {
    name: get("Activity5"),
    start: "", // no A5Start column on the live sheet
    dropOff: get("A5DO"),
    stop: "", // no A5Stop column on the live sheet
    pickUp: get("A5PU"),
  };

  const parentActivity = (slot: 2 | 3): ParentActivitySlot => ({
    slot,
    parent: get(`PA${slot}Parent` as any),
    name: get(`PA${slot}Name` as any),
    start: get(`PA${slot}Start` as any),
    end: get(`PA${slot}End` as any),
    coverage: get(`PA${slot}Coverage` as any),
    notes: get(`PA${slot}Notes` as any),
  });

  return {
    date: get("Date"),
    day: get("Day"),
    holidayDayOff: get("Holiday/DayOff"),
    school: get("School"),
    schoolStart: get("SchStart"),
    schoolDropOff: get("SchDO"),
    schoolStop: get("SchStop"),
    schoolPickUp: get("SchPU"),
    bcc: get("BCC"),
    bccStop: get("BCCStop"),
    bccPickUp: get("BCCPU"),
    activities: [activity(1), activity(2), activity(3), activity(4), activity5],
    meals: {
      break: get("Break"),
      lunch: get("Lunch"),
      dinner: get("Dinner"),
    },
    custody: {
      am: get("AM With"),
      day: get("Day With"),
      pm: get("PM With"),
      on: get("ON With"),
    },
    chaseDay: get("ChaseDay"),
    notes: get("Notes"),
    flag: get("Flag").trim() !== "",
    weekendSummary: get("Weekend Summary"),
    weekday: get("Weekday"),
    link: get("Link"),
    parentActivities: [parentActivity(2), parentActivity(3)],
  };
}

/**
 * Sanity check: confirms a freshly-read header row still matches
 * HEADER_ORDER before trusting rowToDayRecord's positional mapping.
 * Call this once per getSheetData() and log a loud warning (not a
 * silent failure) if the sheet's been restructured since this file
 * was written.
 */
function verifyHeaderOrder(liveHeader: string[]): string[] {
  const mismatches: string[] = [];
  HEADER_ORDER.forEach((expected, i) => {
    if (liveHeader[i] !== expected) {
      mismatches.push(`col ${i}: expected "${expected}", got "${liveHeader[i] ?? "(missing)"}"`);
    }
  });
  return mismatches;
}

/**
 * Mirrors getSheetData(): reads the entire primary sheet and returns it
 * as DayRecord objects. Uses valueRenderOption FORMATTED_VALUE to match
 * the original getDisplayValues() behavior (migration doc §7.1).
 */
export async function getSheetData(): Promise<DayRecord[]> {
  if (USE_MOCK) return MOCK_DAYS;

  const spreadsheetId = process.env.COMPAS_SPREADSHEET_ID;
  const sheetName = process.env.COMPAS_SHEET_NAME ?? "Compas_2026_Full_Year";
  if (!spreadsheetId) throw new Error("Missing COMPAS_SPREADSHEET_ID");

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = res.data.values ?? [];
  const [header, ...dataRows] = rows;

  const mismatches = verifyHeaderOrder(header as string[]);
  if (mismatches.length > 0) {
    console.warn(
      "getSheetData: live sheet header no longer matches HEADER_ORDER — " +
        "rowToDayRecord's mapping may be wrong. Mismatches:\n" +
        mismatches.join("\n")
    );
  }

  return dataRows.map((row) => rowToDayRecord(row as string[]));
}

/**
 * Mirrors updateRow(rowIndex, updates): writes a partial update to one
 * day's row. The original auto-provisions missing columns first
 * (_ensureColumns) and calls SpreadsheetApp.flush() for an immediate
 * commit. TODO: implement the actual Sheets API write (values.update
 * on the specific row/column range) plus the column-provisioning
 * equivalent — deferred since it touches the live data and deserves a
 * deliberate review pass rather than being bundled with the read-side
 * mapping work.
 */
export async function updateRow(
  date: string,
  updates: Partial<DayRecord>
): Promise<void> {
  if (USE_MOCK) {
    console.log(`[mock] updateRow(${date})`, updates);
    return;
  }

  throw new Error(
    "updateRow: not yet implemented against the live Sheets API — " +
      "see the TODO above this function."
  );
}
