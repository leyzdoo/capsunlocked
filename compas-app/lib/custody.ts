import { CustodyCode } from "./types";

// Ported from Compas.html's whoLabel() / custodyClass() / custodyColor()
// (migration doc §5.3) — the shared helpers every view uses to interpret
// the JL/ABB/JW/BCC/? codes from the sheet. Kept as pure functions of
// the data so they carry over unchanged regardless of framework, per
// the migration doc's own recommendation (§7.7).

export function whoLabel(code: CustodyCode): string {
  switch (code) {
    case "JL":
      return "James";
    case "ABB":
      return "Alejandra";
    case "JW":
      return "School";
    case "BCC":
      return "Before/After Care";
    case "?":
    case "":
      return "Unknown";
    default:
      // combined codes like 'ABBJL'
      return code;
  }
}

export function custodyColor(code: CustodyCode): string {
  if (!code || code === "?") return "var(--fog)";
  if (code === "JL") return "var(--james)";
  if (code === "ABB") return "var(--ale)";
  if (code === "JW") return "var(--school)";
  if (code === "BCC") return "var(--bcc)";
  // combined / split responsibility
  return "var(--mixed)";
}
