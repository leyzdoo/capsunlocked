// Mirrors the ACTUAL live "Compas_2026_Full_Year" sheet columns, read
// directly from the spreadsheet on 2026-08-15 (59 columns, A through
// BG). This intentionally differs from the original migration doc's
// §3.1 description in a few places — the live sheet is the ground
// truth (per the doc's own guidance in §3.1), not the doc or the XLSX
// export:
//   - Only 4 custody segments exist (AM/Day/PM/ON) — there is no
//     "EV With" column on the live sheet.
//   - Activity1-4 each have Start/DO/Stop/PU but no per-activity Notes
//     column; Activity5 only has DO/PU (no Start/Stop/Notes).
//   - Only PA2 and PA3 parent-activity slots exist — PA1
//     (PAParent/PAName/...) has never been auto-provisioned on this
//     sheet, presumably because slot 1 has never been written to.
//   - There's a "Link" column (AU) not documented in the migration doc.
//   - "AleNotes" does not exist yet on the live sheet.
// If any of these get auto-provisioned later (via a write from the
// live V2/V3 app), re-run the header read in lib/sheets.ts's comments
// and update this file to match.

export type CustodyCode = "JL" | "ABB" | "JW" | "BCC" | "?" | string;

export interface ActivitySlot {
  name: string; // Activity1..5
  start: string; // A{n}Start — empty string for slot 5, which has none
  dropOff: string; // A{n}DO
  stop: string; // A{n}Stop — empty string for slot 5, which has none
  pickUp: string; // A{n}PU
}

export interface ParentActivitySlot {
  slot: 2 | 3; // only slots 2 and 3 exist on the live sheet — see note above
  parent: string; // PA{n}Parent
  name: string; // PA{n}Name
  start: string; // PA{n}Start
  end: string; // PA{n}End
  coverage: string; // PA{n}Coverage
  notes: string; // PA{n}Notes
}

export interface DayRecord {
  date: string; // 'Date' column, e.g. "May 8 2026"
  day: string; // 'Day' — weekday label
  holidayDayOff: string;

  school: string;
  schoolStart: string;
  schoolDropOff: string; // 'SchDO'
  schoolStop: string;
  schoolPickUp: string; // 'SchPU'

  bcc: string; // Yes/No
  bccStop: string;
  bccPickUp: string;

  activities: ActivitySlot[]; // 5 slots — see ActivitySlot note on slot 5

  meals: {
    break: CustodyCode;
    lunch: CustodyCode;
    dinner: CustodyCode;
  };

  custody: {
    am: CustodyCode;
    day: CustodyCode;
    pm: CustodyCode;
    on: CustodyCode; // overnight — note: no 'ev' segment on the live sheet
  };

  chaseDay: string; // legacy field, carried over
  notes: string; // James's notes
  flag: boolean; // escalated / needs attention
  weekendSummary: string;
  weekday: string; // legacy carried-over column, distinct from 'day'
  link: string; // 'Link' column — purpose not yet documented, carried through as-is

  parentActivities: ParentActivitySlot[]; // PA2 and PA3 only, see note above
}

export type Role = "JL" | "ABB";

export interface Identity {
  email: string;
  role: Role | null;
}
