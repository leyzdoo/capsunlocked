"use client";

import { useEffect, useState } from "react";
import { DayRecord } from "@/lib/types";
import DayView from "@/components/DayView";
import WeekView from "@/components/WeekView";

// Mirrors the original load sequence (migration doc §5.1): fetch the
// full dataset once, cache it client-side, and render every view from
// that cache rather than re-querying per view. Here that cache is just
// React state instead of a module-level DATA_MAP, but the pattern is
// the same — see the migration doc's own recommendation (§7.7) to
// preserve this rather than switch to per-view fetching.

type View = "day" | "week";

export default function SchedulePage() {
  const [days, setDays] = useState<DayRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("week");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/schedule")
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        setDays(data.days);
        setSelectedDate(data.days[0]?.date ?? null);
      })
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return (
      <main className="p-6">
        <p className="text-red-600">Couldn&apos;t load the schedule: {error}</p>
        <p className="mt-2 text-sm text-ink/60">
          If you haven&apos;t signed in yet, or credentials aren&apos;t
          configured, check NEXTAUTH and Google Sheets API env vars.
        </p>
      </main>
    );
  }

  if (!days) {
    return (
      <main className="p-6">
        <p className="text-ink/60">Loading…</p>
      </main>
    );
  }

  const selectedRecord = days.find((d) => d.date === selectedDate) ?? days[0];

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl">Schedule</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setView("week")}
            className={`rounded-full px-4 py-1.5 text-sm ${
              view === "week" ? "bg-ink text-white" : "bg-white text-ink/70"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setView("day")}
            className={`rounded-full px-4 py-1.5 text-sm ${
              view === "day" ? "bg-ink text-white" : "bg-white text-ink/70"
            }`}
          >
            Day
          </button>
        </div>
      </div>

      {view === "week" && (
        <WeekView
          days={days}
          onSelectDay={(date) => {
            setSelectedDate(date);
            setView("day");
          }}
        />
      )}

      {view === "day" && selectedRecord && <DayView record={selectedRecord} />}
    </main>
  );
}
