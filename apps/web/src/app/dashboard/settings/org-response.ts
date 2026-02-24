interface OrganizationWithId {
  id: string;
}

function isOrganizationWithId(value: unknown): value is OrganizationWithId {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    (value as { id: string }).id.length > 0
  );
}

/**
 * /api/orgs returns either { data: orgObject | null } or
 * legacy { data: orgArray }. Normalize both shapes to a single org id.
 */
export function extractOrgIdFromPayload(payload: unknown): string | null {
  const data =
    typeof payload === "object" && payload !== null
      ? (payload as { data?: unknown }).data
      : undefined;

  if (Array.isArray(data)) {
    const first = data.find(isOrganizationWithId);
    return first?.id ?? null;
  }

  if (isOrganizationWithId(data)) {
    return data.id;
  }

  return null;
}
