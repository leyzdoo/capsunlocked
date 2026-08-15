import { DayRecord } from "./types";

// Mirrors the original app's IS_APPS_SCRIPT offline fallback (migration
// doc §7.8): a small local fixture so the app is usable without live
// Google credentials, for dev and for onboarding. Shape matches the
// REAL live-sheet schema in lib/types.ts (4 custody segments, PA2/PA3
// only, Activity5 with no start/stop) — see lib/sheets.ts's header
// mapping for why this differs from the original migration doc.

function emptyActivity(): { name: string; start: string; dropOff: string; stop: string; pickUp: string } {
  return { name: "", start: "", dropOff: "", stop: "", pickUp: "" };
}

function emptyParentActivities() {
  return [
    { slot: 2 as const, parent: "", name: "", start: "", end: "", coverage: "", notes: "" },
    { slot: 3 as const, parent: "", name: "", start: "", end: "", coverage: "", notes: "" },
  ];
}

export const MOCK_DAYS: DayRecord[] = [
  {
    date: "2026-08-15",
    day: "Saturday",
    holidayDayOff: "",
    school: "",
    schoolStart: "",
    schoolDropOff: "",
    schoolStop: "",
    schoolPickUp: "",
    bcc: "No",
    bccStop: "",
    bccPickUp: "",
    activities: [
      {
        name: "Soccer practice",
        start: "10:00 AM",
        dropOff: "JL",
        stop: "11:30 AM",
        pickUp: "JL",
      },
      emptyActivity(),
      emptyActivity(),
      emptyActivity(),
      emptyActivity(),
    ],
    meals: { break: "JL", lunch: "JL", dinner: "ABB" },
    custody: { am: "JL", day: "JL", pm: "JL", on: "ABB" },
    chaseDay: "",
    notes: "Weekend handoff at 5pm.",
    flag: false,
    weekendSummary: "JL→ABB",
    weekday: "",
    link: "",
    parentActivities: emptyParentActivities(),
  },
  {
    date: "2026-08-16",
    day: "Sunday",
    holidayDayOff: "",
    school: "",
    schoolStart: "",
    schoolDropOff: "",
    schoolStop: "",
    schoolPickUp: "",
    bcc: "No",
    bccStop: "",
    bccPickUp: "",
    activities: [emptyActivity(), emptyActivity(), emptyActivity(), emptyActivity(), emptyActivity()],
    meals: { break: "ABB", lunch: "ABB", dinner: "ABB" },
    custody: { am: "ABB", day: "ABB", pm: "ABB", on: "ABB" },
    chaseDay: "",
    notes: "",
    flag: false,
    weekendSummary: "ABB",
    weekday: "",
    link: "",
    parentActivities: emptyParentActivities(),
  },
  {
    date: "2026-08-17",
    day: "Monday",
    holidayDayOff: "",
    school: "Lincoln Elementary",
    schoolStart: "8:15 AM",
    schoolDropOff: "ABB",
    schoolStop: "3:00 PM",
    schoolPickUp: "JL",
    bcc: "No",
    bccStop: "",
    bccPickUp: "",
    activities: [emptyActivity(), emptyActivity(), emptyActivity(), emptyActivity(), emptyActivity()],
    meals: { break: "ABB", lunch: "JW", dinner: "JL" },
    custody: { am: "ABB", day: "JW", pm: "JL", on: "JL" },
    chaseDay: "",
    notes: "",
    flag: true,
    weekendSummary: "",
    weekday: "",
    link: "",
    parentActivities: emptyParentActivities(),
  },
];
