import { eq } from "drizzle-orm";
import type { AppDatabase as Database } from "../d1-client";
import { crawlInsights, pageInsights } from "../schema";
import { chunkForD1Insert } from "./d1-batch";

export type CrawlInsightInsert = typeof crawlInsights.$inferInsert;
export type PageInsightInsert = typeof pageInsights.$inferInsert;

export function crawlInsightQueries(db: Database) {
  return {
    async replaceForCrawl(crawlId: string, rows: CrawlInsightInsert[]) {
      await db.transaction(async (tx) => {
        await tx
          .delete(crawlInsights)
          .where(eq(crawlInsights.crawlId, crawlId));
        for (const chunk of chunkForD1Insert(rows)) {
          await tx.insert(crawlInsights).values(chunk);
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
        for (const chunk of chunkForD1Insert(rows)) {
          await tx.insert(pageInsights).values(chunk);
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
