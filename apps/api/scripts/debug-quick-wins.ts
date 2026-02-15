import { createDb } from "../../../packages/db/src/client.ts";
import {
  createCrawlRepository,
  createProjectRepository,
  createScoreRepository,
  createUserRepository,
} from "../src/repositories";
import { createCrawlService } from "../src/services/crawl-service";

async function main() {
  const crawlId = "319cb28f-ca7f-409f-8794-a00090196896";
  const userId = "ac071d37-8217-4d77-be31-af558e754ce4"; // crawltest user

  console.log(`Checking Quick Wins for Crawl ID: ${crawlId}`);

  const db = createDb(process.env.DATABASE_URL!);
  const service = createCrawlService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    scores: createScoreRepository(db),
  });

  try {
    const wins = await service.getQuickWins(userId, crawlId);
    console.log("Quick Wins Result:", JSON.stringify(wins, null, 2));
    console.log("Type:", Array.isArray(wins) ? "Array" : typeof wins);
    console.log("Length:", Array.isArray(wins) ? wins.length : "N/A");
  } catch (error) {
    console.error("Error fetching quick wins:", error);
  }
}

main().catch(console.error);
