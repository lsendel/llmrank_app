import { eq, desc, sql } from "drizzle-orm";
import type { Database } from "../client";
import { discoveredLinks } from "../schema";

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

      const chunks = [];
      for (let i = 0; i < links.length; i += 100) {
        chunks.push(links.slice(i, i + 100));
      }

      for (const chunk of chunks) {
        await db
          .insert(discoveredLinks)
          .values(chunk)
          .onConflictDoUpdate({
            target: [discoveredLinks.sourceUrl, discoveredLinks.targetUrl],
            set: { lastSeenAt: new Date() },
          });
      }
    },

    /** Summary stats for a target domain. */
    async getSummary(targetDomain: string): Promise<BacklinkSummary> {
      const [row] = await db
        .select({
          totalBacklinks: sql<number>`count(*)::int`,
          referringDomains: sql<number>`count(distinct ${discoveredLinks.sourceDomain})::int`,
          dofollowRatio: sql<number>`round(avg(case when ${discoveredLinks.rel} = 'dofollow' then 1 else 0 end)::numeric, 2)`,
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
          linkCount: sql<number>`count(*)::int`,
          latestAnchor: sql<
            string | null
          >`(array_agg(${discoveredLinks.anchorText} order by ${discoveredLinks.lastSeenAt} desc))[1]`,
          firstSeen: sql<string>`min(${discoveredLinks.discoveredAt})::date::text`,
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
        .select({ count: sql<number>`count(*)::int` })
        .from(discoveredLinks)
        .where(eq(discoveredLinks.targetDomain, targetDomain));
      return row?.count ?? 0;
    },
  };
}
