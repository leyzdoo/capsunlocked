import { Role } from "./types";

// Replaces the GAS-hardcoded ROLE_MAP (migration doc §4.11 / §7.2).
// Kept in an env var rather than committed so the allowlist can change
// without a code deploy.
function loadRoleMap(): Record<string, Role> {
  const raw = process.env.COMPAS_ROLE_MAP;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    console.error("COMPAS_ROLE_MAP is not valid JSON — no roles will resolve");
    return {};
  }
}

const ROLE_MAP = loadRoleMap();

/** Mirrors _resolveActor_() — returns the role for a signed-in email, or null. */
export function resolveActor(email: string | null | undefined): Role | null {
  if (!email) return null;
  return ROLE_MAP[email] ?? null;
}

/** Mirrors _requireActor_() — throws if the signed-in account isn't recognized. */
export function requireActor(email: string | null | undefined): Role {
  const role = resolveActor(email);
  if (!role) {
    throw new Error("Not a recognized Compás account");
  }
  return role;
}
