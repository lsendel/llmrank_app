import type { ProjectsDefaultPreset } from "@/lib/api";

export type ProjectsViewPreset = ProjectsDefaultPreset;

export function isProjectsViewPreset(
  value: string | null | undefined,
): value is ProjectsViewPreset {
  return (
    value === "seo_manager" ||
    value === "content_lead" ||
    value === "exec_summary"
  );
}

export function normalizeProjectsViewPreset(
  value: string | null | undefined,
): ProjectsViewPreset | null {
  return isProjectsViewPreset(value) ? value : null;
}

export function defaultProjectsViewPresetFromPersona(
  _persona?: string | null,
): ProjectsViewPreset {
  // Always default to "exec_summary" (health: all, sort: activity_desc) so
  // every project is visible on first visit. Users can override and save.
  return "exec_summary";
}

export function shouldSyncProjectsViewPreset(options: {
  serverPreset?: string | null;
  localPreset?: string | null;
}): boolean {
  const serverPreset = normalizeProjectsViewPreset(options.serverPreset);
  const localPreset = normalizeProjectsViewPreset(options.localPreset);
  return !serverPreset && !!localPreset;
}
