import { DayRecord } from "@/lib/types";
import { whoLabel, custodyColor } from "@/lib/custody";

// Mirrors renderDay() (migration doc §5.3): full single-day detail —
// schedule, custody chips, meals, notes, escalation flag. Custody
// segments are AM/Day/PM/ON (no "EV" — see lib/types.ts for why).

function CustodyChip({ label, code }: { label: string; code: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm shadow-sm">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: custodyColor(code) }}
      />
      <span className="text-ink/60">{label}</span>
      <span className="font-medium">{whoLabel(code)}</span>
    </div>
  );
}

export default function DayView({ record }: { record: DayRecord }) {
  return (
    <div className="rounded-xl bg-paper p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl">
          {record.day}, {record.date}
        </h2>
        {record.flag && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
            Flagged
          </span>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <CustodyChip label="AM" code={record.custody.am} />
        <CustodyChip label="Day" code={record.custody.day} />
        <CustodyChip label="PM" code={record.custody.pm} />
        <CustodyChip label="Overnight" code={record.custody.on} />
      </div>

      {record.school && (
        <p className="mb-2 text-sm">
          <span className="text-ink/60">School:</span> {record.school} (
          {record.schoolStart}&ndash;{record.schoolStop})
        </p>
      )}

      {record.activities
        .filter((a) => a.name)
        .map((a, i) => (
          <p key={i} className="mb-2 text-sm">
            <span className="text-ink/60">{a.name}:</span>{" "}
            {a.start && a.stop ? `${a.start}\u2013${a.stop}` : a.start || ""}
          </p>
        ))}

      {record.notes && (
        <div className="mt-4 rounded-lg bg-james/10 p-3 text-sm">
          <div className="mb-1 font-medium text-james">Notes</div>
          {record.notes}
        </div>
      )}
    </div>
  );
}
