import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { crawlInsights, pageInsights } from "../schema";

export type CrawlInsightInsert = typeof crawlInsights.$inferInsert;
export type PageInsightInsert = typeof pageInsights.$inferInsert;

export function crawlInsightQueries(db: Database) {
  return {
    async replaceForCrawl(crawlId: string, rows: CrawlInsightInsert[]) {
      await db.transaction(async (tx) => {
        await tx
          .delete(crawlInsights)
          .where(eq(crawlInsights.crawlId, crawlId));
        if (rows.length) {
          await tx.insert(crawlInsights).values(rows);
        }
      });
    },

    async listByCrawl(crawlId: string) {
      return db
        .select()
        .from(crawlInsights)
        .where(eq(crawlInsights.crawlId, crawlId));
    },
  };
}

export function pageInsightQueries(db: Database) {
  return {
    async replaceForCrawl(crawlId: string, rows: PageInsightInsert[]) {
      await db.transaction(async (tx) => {
        await tx.delete(pageInsights).where(eq(pageInsights.crawlId, crawlId));
        if (rows.length) {
          await tx.insert(pageInsights).values(rows);
        }
      });
    },

    async listByCrawl(crawlId: string) {
      return db
        .select()
        .from(pageInsights)
        .where(eq(pageInsights.crawlId, crawlId));
    },
  };
}
