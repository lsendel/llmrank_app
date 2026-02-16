import {
  leadQueries,
  scanResultQueries,
  projectQueries,
  type Database,
} from "@llm-boost/db";

/**
 * Converts a lead (captured during public scan / report share) into a
 * real project once the user signs up.
 *
 * This is best-effort — a failure here must never block the signup flow.
 */
export async function convertLeadToProject(
  db: Database,
  userId: string,
  email: string,
) {
  const lead = await leadQueries(db).findByEmail(email);
  if (!lead || !lead.scanResultId || lead.convertedAt) return null;

  const scanResult = await scanResultQueries(db).getById(lead.scanResultId);
  if (!scanResult) return null;

  // Create project from the scan domain
  const project = await projectQueries(db).create({
    userId,
    name: scanResult.domain,
    domain: `https://${scanResult.domain}`,
  });

  // Mark the lead as converted so it isn't processed again
  await leadQueries(db).markConverted(lead.id, project.id);

  return project;
}
