import { DayRecord } from "@/lib/types";
import { custodyColor, whoLabel } from "@/lib/custody";

// Mirrors renderWeekBars() (migration doc §5.3): a 7-day view with a
// custody bar per day. Segments are AM/Day/PM/ON — the live sheet has
// no "EV With" column (see lib/types.ts for the full discrepancy note
// against the original migration doc).

export default function WeekView({
  days,
  onSelectDay,
}: {
  days: DayRecord[];
  onSelectDay: (date: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
      {days.map((record) => (
        <button
          key={record.date}
          onClick={() => onSelectDay(record.date)}
          className="rounded-lg bg-white p-3 text-left shadow-sm transition hover:shadow-md"
        >
          <div className="mb-2 text-xs text-ink/60">{record.day}</div>
          <div className="mb-2 text-sm font-medium">{record.date}</div>
          <div className="flex h-2 overflow-hidden rounded-full">
            {(["am", "day", "pm", "on"] as const).map((seg) => (
              <div
                key={seg}
                className="flex-1"
                style={{ backgroundColor: custodyColor(record.custody[seg]) }}
                title={`${seg.toUpperCase()}: ${whoLabel(record.custody[seg])}`}
              />
            ))}
          </div>
          {record.flag && (
            <span className="mt-2 inline-block text-xs text-red-600">⚑ flagged</span>
          )}
        </button>
      ))}
    </div>
  );
}
