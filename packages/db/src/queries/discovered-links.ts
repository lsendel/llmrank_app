import { eq, desc, sql } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { discoveredLinks } from "../schema";
import { chunkForD1Insert } from "./d1-batch";

export interface BacklinkSummary {
  totalBacklinks: number;
  referringDomains: number;
  dofollowRatio: number;
}

export interface ReferringDomain {
  domain: string;
  linkCount: number;
  latestAnchor: string | null;
  firstSeen: string;
}

export function discoveredLinkQueries(db: Database) {
  return {
    /**
     * Upsert a batch of discovered links.
     * On conflict (same sourceUrl + targetUrl), update lastSeenAt.
     */
    async upsertBatch(
      links: {
        sourceUrl: string;
        sourceDomain: string;
        targetUrl: string;
        targetDomain: string;
        anchorText?: string | null;
        rel?: string;
      }[],
    ) {
      if (links.length === 0) return;

      const rows = links.map((c) => ({ ...c, id: crypto.randomUUID() }));
      // 90 (not 100) leaves room for the onConflictDoUpdate set-clause param.
      await Promise.all(
        chunkForD1Insert(rows, 90).map((chunk) =>
          db
            .insert(discoveredLinks)
            .values(chunk)
            .onConflictDoUpdate({
              target: [discoveredLinks.sourceUrl, discoveredLinks.targetUrl],
              set: { lastSeenAt: new Date().toISOString() },
            }),
        ),
      );
    },

    /** Summary stats for a target domain. */
    async getSummary(targetDomain: string): Promise<BacklinkSummary> {
      const [row] = await db
        .select({
          totalBacklinks: sql<number>`count(*)`,
          referringDomains: sql<number>`count(distinct ${discoveredLinks.sourceDomain})`,
          dofollowRatio: sql<number>`round(avg(case when ${discoveredLinks.rel} = 'dofollow' then 1.0 else 0.0 end), 2)`,
        })
        .from(discoveredLinks)
        .where(eq(discoveredLinks.targetDomain, targetDomain));

      return {
        totalBacklinks: row?.totalBacklinks ?? 0,
        referringDomains: row?.referringDomains ?? 0,
        dofollowRatio: Number(row?.dofollowRatio ?? 0),
      };
    },

    /** Paginated list of backlinks for a target domain. */
    async listForDomain(targetDomain: string, limit = 50, offset = 0) {
      return db
        .select()
        .from(discoveredLinks)
        .where(eq(discoveredLinks.targetDomain, targetDomain))
        .orderBy(desc(discoveredLinks.lastSeenAt))
        .limit(limit)
        .offset(offset);
    },

    /** Top referring domains for a target domain. */
    async topReferringDomains(
      targetDomain: string,
      limit = 20,
    ): Promise<ReferringDomain[]> {
      const rows = await db
        .select({
          domain: discoveredLinks.sourceDomain,
          linkCount: sql<number>`count(*)`,
          latestAnchor: sql<
            string | null
          >`(SELECT ${discoveredLinks.anchorText} FROM ${discoveredLinks} dl2 WHERE dl2.source_domain = ${discoveredLinks.sourceDomain} AND dl2.target_domain = ${discoveredLinks.targetDomain} ORDER BY dl2.last_seen_at DESC LIMIT 1)`,
          firstSeen: sql<string>`CAST(min(${discoveredLinks.discoveredAt}) AS TEXT)`,
        })
        .from(discoveredLinks)
        .where(eq(discoveredLinks.targetDomain, targetDomain))
        .groupBy(discoveredLinks.sourceDomain)
        .orderBy(sql`count(*) desc`)
        .limit(limit);

      return rows.map((r) => ({
        domain: r.domain,
        linkCount: r.linkCount,
        latestAnchor: r.latestAnchor,
        firstSeen: r.firstSeen,
      }));
    },

    /** Total count of links pointing to a target domain. */
    async countForDomain(targetDomain: string): Promise<number> {
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(discoveredLinks)
        .where(eq(discoveredLinks.targetDomain, targetDomain));
      return row?.count ?? 0;
    },
  };
}
